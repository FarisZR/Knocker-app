import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { knock, type KnockResult } from "@/lib/knock";
import { scheduleRenewals } from "@/lib/autoRenew";
import {
  deleteProfileSecret,
  loadProfiles,
  saveProfiles,
  type Profile,
} from "@/lib/profiles";

export interface SnackbarState {
  id: number;
  text: string;
  detail?: string;
  tone: "success" | "error" | "info";
  retry?: () => void;
}

interface ProfilesContextValue {
  profiles: Profile[];
  loaded: boolean;
  upsert: (p: Profile) => Promise<void>;
  remove: (id: string) => Promise<void>;
  knockOne: (id: string) => Promise<void>;
  knockAll: () => Promise<void>;
  snackbar: SnackbarState | null;
  dismissSnackbar: () => void;
}

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const profilesRef = useRef<Profile[]>([]);
  profilesRef.current = profiles;

  const persist = useCallback(async (next: Profile[]) => {
    setProfiles(next);
    await saveProfiles(next);
  }, []);

  const updateOne = useCallback(
    async (id: string, patch: Partial<Profile>) => {
      const next = profilesRef.current.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      );
      await persist(next);
    },
    [persist],
  );

  const showSnackbar = useCallback((s: Omit<SnackbarState, "id">) => {
    setSnackbar({ ...s, id: Date.now() });
  }, []);

  const dismissSnackbar = useCallback(() => setSnackbar(null), []);

  const knockOne = useCallback(
    async (id: string) => {
      const profile = profilesRef.current.find((p) => p.id === id);
      if (!profile) return;
      const result: KnockResult = await knock(profile);
      const now = Date.now();
      if (result.ok) {
        await updateOne(id, {
          lastKnockStatus: "success",
          lastKnockAt: now,
          lastError: null,
          whitelistedEntry: result.whitelistedEntry,
          expiresAt: result.expiresAt,
        });
        showSnackbar({
          text: `Knocked ${profile.name || "profile"}`,
          detail: result.whitelistedEntry
            ? `${result.whitelistedEntry} · ${Math.round(result.expiresInSeconds / 60)}m`
            : undefined,
          tone: "success",
        });
      } else {
        await updateOne(id, {
          lastKnockStatus: "error",
          lastKnockAt: now,
          lastError: result.message,
        });
        showSnackbar({
          text: `${profile.name || "Profile"} failed`,
          detail: result.message,
          tone: "error",
          retry: () => {
            void knockOne(id);
          },
        });
      }
    },
    [updateOne, showSnackbar],
  );

  const knockAll = useCallback(async () => {
    const list = profilesRef.current;
    if (list.length === 0) return;
    const settled = await Promise.all(
      list.map(async (p) => ({ p, r: await knock(p) })),
    );
    const now = Date.now();
    const next = profilesRef.current.map((existing) => {
      const found = settled.find((s) => s.p.id === existing.id);
      if (!found) return existing;
      if (found.r.ok) {
        return {
          ...existing,
          lastKnockStatus: "success" as const,
          lastKnockAt: now,
          lastError: null,
          whitelistedEntry: found.r.whitelistedEntry,
          expiresAt: found.r.expiresAt,
        };
      }
      return {
        ...existing,
        lastKnockStatus: "error" as const,
        lastKnockAt: now,
        lastError: found.r.message,
      };
    });
    await persist(next);
    const successes = settled.filter((s) => s.r.ok).length;
    const failures = settled.length - successes;
    const failedNames = settled
      .filter((s) => !s.r.ok)
      .map((s) => s.p.name || "unnamed")
      .join(", ");
    showSnackbar({
      text: `Knocked ${successes} profile${successes === 1 ? "" : "s"}`,
      detail:
        failures > 0
          ? `${failures} failed${failedNames ? ` · ${failedNames}` : ""}`
          : undefined,
      tone: failures > 0 ? "error" : "success",
      retry:
        failures > 0
          ? () => {
              void knockAll();
            }
          : undefined,
    });
  }, [persist, showSnackbar]);

  const upsert = useCallback(
    async (p: Profile) => {
      const exists = profilesRef.current.some((x) => x.id === p.id);
      const next = exists
        ? profilesRef.current.map((x) => (x.id === p.id ? p : x))
        : [...profilesRef.current, p];
      await persist(next);
    },
    [persist],
  );

  const remove = useCallback(
    async (id: string) => {
      await persist(profilesRef.current.filter((x) => x.id !== id));
      await deleteProfileSecret(id);
    },
    [persist],
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await loadProfiles();
      if (cancelled) return;
      profilesRef.current = list;
      setProfiles(list);
      setLoaded(true);
      // Knock on app open — fire after ref is updated
      for (const p of list) {
        if (p.knockOnOpen) {
          void knockOne(p.id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reschedule renewals whenever profiles change.
  // Track which profiles we have already fired in this app session to avoid
  // a tight loop: scheduleRenewals -> fire -> persist -> effect -> scheduleRenewals.
  const firedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!loaded) return;
    // Reset the gate when a profile gets a fresh future expiresAt
    const now = Date.now();
    for (const p of profiles) {
      if (p.expiresAt && p.expiresAt > now + 1000) {
        firedRef.current.delete(p.id);
      }
    }
    scheduleRenewals(profiles, (id) => {
      if (firedRef.current.has(id)) return;
      firedRef.current.add(id);
      void knockOne(id);
    });
  }, [profiles, loaded, knockOne]);

  const value = useMemo<ProfilesContextValue>(
    () => ({
      profiles,
      loaded,
      upsert,
      remove,
      knockOne,
      knockAll,
      snackbar,
      dismissSnackbar,
    }),
    [profiles, loaded, upsert, remove, knockOne, knockAll, snackbar, dismissSnackbar],
  );

  return (
    <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>
  );
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error("useProfiles must be used inside ProfilesProvider");
  return ctx;
}
