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
import {
  awaitLaunchKnockResults,
  isNativeAvailable as isKnockerNativeAvailable,
  loadProfilesFromNative,
  syncProfiles as syncProfilesToNative,
  type NativeLaunchKnockResult,
  type NativeProfileSnapshot,
} from "knocker-native";

export interface SnackbarState {
  id: number;
  text: string;
  detail?: string;
  tone: "success" | "error" | "info";
  persistent?: boolean;
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

type KnockFeedbackMode = "snackbar" | "silent";

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const profilesRef = useRef<Profile[]>([]);
  profilesRef.current = profiles;

  const persist = useCallback(async (next: Profile[]) => {
    setProfiles(next);
    await saveProfiles(next);
    if (isKnockerNativeAvailable) {
      const snapshot: NativeProfileSnapshot[] = next.map((p) => ({
        id: p.id,
        name: p.name,
        endpointUrl: p.endpointUrl,
        apiKey: p.apiKey,
        ttlSeconds: p.ttlSeconds,
        ipOverride: p.ipOverride,
        autoRenew: p.autoRenew,
        autoRenewSafetyWindowSec: p.autoRenewSafetyWindowSec,
        tileSlot: p.tileSlot,
        expiresAt: p.expiresAt,
        knockOnOpen: p.knockOnOpen,
      }));
      // Wait for native storage so a just-saved tile mapping works immediately.
      try {
        await syncProfilesToNative(snapshot);
      } catch (error) {
        console.warn("Failed to sync profiles to native storage.", error);
      }
    }
  }, []);

  const toNativeSnapshot = useCallback((list: Profile[]): NativeProfileSnapshot[] => {
    return list.map((p) => ({
      id: p.id,
      name: p.name,
      endpointUrl: p.endpointUrl,
      apiKey: p.apiKey,
      ttlSeconds: p.ttlSeconds,
      ipOverride: p.ipOverride,
      autoRenew: p.autoRenew,
      autoRenewSafetyWindowSec: p.autoRenewSafetyWindowSec,
      tileSlot: p.tileSlot,
      expiresAt: p.expiresAt,
      knockOnOpen: p.knockOnOpen,
    }));
  }, []);

  const mergeExpiryFromNative = useCallback(
    (
      jsProfiles: Profile[],
      nativeProfiles: NativeProfileSnapshot[],
    ): Profile[] => {
      if (nativeProfiles.length === 0) return jsProfiles;
      const nativeById = new Map(nativeProfiles.map((p) => [p.id, p]));
      return jsProfiles.map((profile) => {
        const nativeProfile = nativeById.get(profile.id);
        if (!nativeProfile || nativeProfile.expiresAt == null) return profile;
        if (profile.expiresAt == null || nativeProfile.expiresAt > profile.expiresAt) {
          return { ...profile, expiresAt: nativeProfile.expiresAt };
        }
        return profile;
      });
    },
    [],
  );

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

  const runKnock = useCallback(
    async (id: string, feedbackMode: KnockFeedbackMode = "snackbar") => {
      const profile = profilesRef.current.find((p) => p.id === id);
      if (!profile) return null;
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
        if (feedbackMode === "snackbar") {
          const minutes = Math.round(result.expiresInSeconds / 60);
          const baseDetail = result.whitelistedEntry
            ? `${result.whitelistedEntry} · ${minutes}m`
            : `${minutes}m`;
          showSnackbar({
            text: `Knocked ${profile.name || "profile"}`,
            detail: result.ttlCapped
              ? `${baseDetail} · TTL capped by server`
              : baseDetail,
            tone: result.ttlCapped ? "info" : "success",
          });
        }
      } else {
        await updateOne(id, {
          lastKnockStatus: "error",
          lastKnockAt: now,
          lastError: result.message,
        });
        if (feedbackMode === "snackbar") {
          showSnackbar({
            text: `${profile.name || "Profile"} failed`,
            detail: result.message,
            tone: "error",
            retry: () => {
              void runKnock(id);
            },
          });
        }
      }
      return result;
    },
    [updateOne, showSnackbar],
  );

  const showLaunchSnackbarFromNative = useCallback(
    (results: NativeLaunchKnockResult[]) => {
      const total = results.length;
      const successes = results.filter((r) => r.ok).length;
      const failures = total - successes;
      const cappedCount = results.filter((r) => r.ok && r.ttlCapped).length;
      const failedNames = results
        .filter((r) => !r.ok)
        .map((r) => r.name || "unnamed")
        .slice(0, 2)
        .join(", ");
      const detailParts: string[] = [
        `${successes}/${total} profile${total === 1 ? "" : "s"} whitelisted`,
      ];
      if (failures > 0) {
        detailParts.push(
          `${failures} failed${failedNames ? ` · ${failedNames}${failures > 2 ? ", …" : ""}` : ""}`,
        );
      }
      if (cappedCount > 0) {
        detailParts.push(`${cappedCount} TTL capped by server`);
      }
      showSnackbar({
        text:
          failures > 0
            ? "Launch knock finished with issues"
            : "Launch knock succeeded",
        detail: detailParts.join(" · "),
        tone: failures > 0 ? "error" : cappedCount > 0 ? "info" : "success",
        persistent: true,
        retry:
          failures > 0
            ? () => {
                for (const failed of results) {
                  if (!failed.ok) {
                    void runKnock(failed.profileId);
                  }
                }
              }
            : undefined,
      });
    },
    [runKnock, showSnackbar],
  );

  const knockOne = useCallback(
    async (id: string) => {
      await runKnock(id);
    },
    [runKnock],
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
    const cappedCount = settled.filter((s) => s.r.ok && s.r.ttlCapped).length;
    const failedNames = settled
      .filter((s) => !s.r.ok)
      .map((s) => s.p.name || "unnamed")
      .join(", ");
    const detailParts: string[] = [];
    if (failures > 0) {
      detailParts.push(
        `${failures} failed${failedNames ? ` · ${failedNames}` : ""}`,
      );
    }
    if (cappedCount > 0) {
      detailParts.push(
        `${cappedCount} TTL capped by server`,
      );
    }
    showSnackbar({
      text: `Knocked ${successes} profile${successes === 1 ? "" : "s"}`,
      detail: detailParts.length > 0 ? detailParts.join(" · ") : undefined,
      tone: failures > 0 ? "error" : cappedCount > 0 ? "info" : "success",
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
      await persist(
        p.tileSlot === null
          ? next
          : next.map((x) =>
              x.id !== p.id && x.tileSlot === p.tileSlot
                ? { ...x, tileSlot: null }
                : x,
            ),
      );
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
      const nativeProfilesPromise = isKnockerNativeAvailable
        ? loadProfilesFromNative()
        : Promise.resolve<NativeProfileSnapshot[]>([]);
      // On Android the native module fires launch knocks from its OnCreate
      // hook — long before the JS bundle finishes loading — so we just await
      // its results instead of doing a second round of HTTP from JS. We start
      // awaiting in parallel with loadProfiles() to keep latency minimal.
      const nativeLaunchPromise = isKnockerNativeAvailable
        ? awaitLaunchKnockResults()
        : Promise.resolve<NativeLaunchKnockResult[] | null>(null);
      const list = await loadProfiles();
      if (cancelled) return;
      profilesRef.current = list;
      setProfiles(list);
      setLoaded(true);

      if (isKnockerNativeAvailable) {
        void (async () => {
          const nativeProfiles = await nativeProfilesPromise;
          if (cancelled) return;

          const mergedProfiles = mergeExpiryFromNative(
            profilesRef.current,
            nativeProfiles,
          );
          profilesRef.current = mergedProfiles;
          setProfiles(mergedProfiles);

          // Push the freshly loaded snapshot into the native store so tiles &
          // alarms have current data even if no edit happens this session.
          void syncProfilesToNative(toNativeSnapshot(mergedProfiles));
        })();
      }

      const launchProfiles = list.filter((p) => p.knockOnOpen);
      if (launchProfiles.length === 0) return;

      // Prefer the native launch-knock results when available — the HTTP
      // request was already fired by LaunchKnocker.kt at process start. If
      // native returned nothing (cache empty, stale snapshot, or no
      // knockOnOpen profiles), fall through to the JS-side knock path so we
      // still cover web / iOS / Expo Go and freshly-upgraded installs.
      const nativeResults = await nativeLaunchPromise;
      if (cancelled) return;

      if (nativeResults !== null && nativeResults.length > 0) {
        showLaunchSnackbarFromNative(nativeResults);
        return;
      }

      const settled = await Promise.all(
        launchProfiles.map(async (profile) => ({
          profile,
          result: await runKnock(profile.id, "silent"),
        })),
      );
      if (cancelled) return;
      const successes = settled.filter((s) => s.result?.ok).length;
      const failures = settled.length - successes;
      const cappedCount = settled.filter((s) => s.result?.ok && s.result.ttlCapped).length;
      const failedNames = settled
        .filter((s) => s.result && !s.result.ok)
        .map((s) => s.profile.name || "unnamed")
        .slice(0, 2)
        .join(", ");
      const detailParts: string[] = [
        `${successes}/${launchProfiles.length} profile${launchProfiles.length === 1 ? "" : "s"} whitelisted`,
      ];
      if (failures > 0) {
        detailParts.push(
          `${failures} failed${failedNames ? ` · ${failedNames}${failures > 2 ? ", …" : ""}` : ""}`,
        );
      }
      if (cappedCount > 0) {
        detailParts.push(`${cappedCount} TTL capped by server`);
      }
      showSnackbar({
        text:
          failures > 0
            ? "Launch knock finished with issues"
            : "Launch knock succeeded",
        detail: detailParts.join(" · "),
        tone: failures > 0 ? "error" : cappedCount > 0 ? "info" : "success",
        persistent: true,
        retry:
          failures > 0
            ? () => {
                for (const failed of settled) {
                  if (failed.result && !failed.result.ok) {
                    void runKnock(failed.profile.id);
                  }
                }
              }
            : undefined,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mergeExpiryFromNative,
    runKnock,
    showLaunchSnackbarFromNative,
    showSnackbar,
    toNativeSnapshot,
  ]);

  // Reschedule renewals whenever profiles change. Gate is keyed by
  // (profileId, expiresAt) so a single expiry value can only trigger one
  // auto-renew. A failed renewal leaves expiresAt unchanged and will NOT
  // re-fire — this avoids: schedule -> fire -> fail -> persist -> effect ->
  // schedule -> fire... loop. Only when a successful knock advances
  // expiresAt is the next renewal allowed.
  const firedRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!loaded) return;
    scheduleRenewals(profiles, (id) => {
      const profile = profilesRef.current.find((p) => p.id === id);
      if (!profile || !profile.expiresAt) return;
      if (firedRef.current.get(id) === profile.expiresAt) return;
      firedRef.current.set(id, profile.expiresAt);
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
