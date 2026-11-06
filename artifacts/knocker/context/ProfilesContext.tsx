import { performResultHaptic } from "@/lib/haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import type { KnockResult } from "@/lib/knock";
import { performKnock } from "@/lib/performKnock";
import {
  grantStart,
  mergeGrantsForSave,
  prepareProfileSave,
} from "@/lib/grants";
import { grantConfigurationFingerprint } from "@/lib/profileConfiguration";
import { knockBatch } from "@/lib/knockBatch";
import { pendingKnockFeedback } from "@/lib/knockFeedback";
import {
  applyLaunchResults,
  selectLaunchResults,
  mergeExpiryFromNative,
} from "@/lib/launchResults";
import { scheduleRenewals } from "@/lib/autoRenew";
import {
  deleteProfileSecret,
  loadProfiles,
  nativeConfigurationFingerprint,
  saveProfiles,
  type Profile,
} from "@/lib/profiles";
import {
  isNativeAvailable as isKnockerNativeAvailable,
  subscribeToNativeKnocks,
  awaitLaunchKnockResults,
  type NativeLaunchKnockResult,
  loadProfilesFromNative,
  syncProfiles as syncProfilesToNative,
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
  pendingKnocks: ReadonlySet<string>;
  dismissSnackbar: () => void;
}

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

type KnockFeedbackMode = "snackbar" | "silent";

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [pendingKnocks, setPendingKnocks] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const pendingCounts = useRef(new Map<string, number>());
  const nativePending = useRef<ReadonlySet<string>>(new Set());
  const publishPending = useCallback(() => {
    setPendingKnocks(
      new Set([...pendingCounts.current.keys(), ...nativePending.current]),
    );
  }, []);
  const beginKnocks = useCallback(
    (ids: string[]) => {
      for (const id of ids)
        pendingCounts.current.set(id, (pendingCounts.current.get(id) ?? 0) + 1);
      publishPending();
      return () => {
        for (const id of ids) {
          const count = (pendingCounts.current.get(id) ?? 1) - 1;
          if (count > 0) pendingCounts.current.set(id, count);
          else pendingCounts.current.delete(id);
        }
        publishPending();
      };
    },
    [publishPending],
  );
  const profilesRef = useRef<Profile[]>([]);
  profilesRef.current = profiles;

  const toNativeSnapshot = useCallback(
    (list: Profile[]): NativeProfileSnapshot[] =>
      list.map((p) => ({
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
        whitelistedAt: p.whitelistedAt,
        grantRecordedAt: p.grantRecordedAt,
        whitelistedEntry: p.whitelistedEntry,
        grantNetworkId: p.grantNetworkId,
        grantNetworkType: p.grantNetworkType,
        knockOnOpen: p.knockOnOpen,
        configurationFingerprint: nativeConfigurationFingerprint(p),
        grantConfigurationFingerprint: grantConfigurationFingerprint(p),
      })),
    [],
  );

  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback(
    (next: Profile[]) => {
      profilesRef.current = next;
      setProfiles(next);
      const write = persistenceQueue.current
        .catch(() => {})
        .then(async () => {
          let saved = next;
          if (isKnockerNativeAvailable) {
            saved = mergeGrantsForSave(saved, await loadProfilesFromNative());
            try {
              await syncProfilesToNative(toNativeSnapshot(saved));
              saved = mergeGrantsForSave(saved, await loadProfilesFromNative());
            } catch (error) {
              console.warn("Failed to sync profiles to native storage.", error);
            }
          }
          await saveProfiles(saved);
          const merged = mergeGrantsForSave(
            profilesRef.current,
            toNativeSnapshot(saved),
          );
          if (
            merged.some(
              (profile, index) => profile !== profilesRef.current[index],
            )
          ) {
            profilesRef.current = merged;
            setProfiles(merged);
          }
        });
      persistenceQueue.current = write;
      return write;
    },
    [toNativeSnapshot],
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
      if (!profile || pendingCounts.current.has(id)) return null;
      const finish = beginKnocks([id]);
      try {
        // Capture local identity in parallel; never wait for it to start a knock.
        const result: KnockResult = await performKnock(profile);
        const current = profilesRef.current.find(
          (candidate) => candidate.id === id,
        );
        if (
          !current ||
          nativeConfigurationFingerprint(current) !==
            nativeConfigurationFingerprint(profile)
        )
          return result;
        const now = Date.now();
        if (feedbackMode === "snackbar") performResultHaptic(result.ok);
        if (result.ok) {
          await updateOne(id, {
            lastKnockStatus: "success",
            lastKnockAt: now,
            lastError: null,
            whitelistedEntry: result.whitelistedEntry,
            expiresAt: result.expiresAt,
            whitelistedAt:
              result.whitelistedAt ??
              grantStart(result.expiresAt, result.expiresInSeconds, now),
            grantRecordedAt: result.completedAtMillis ?? now,
            grantNetworkId: result.grantNetworkId ?? null,
            grantNetworkType: result.grantNetworkType ?? null,
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
      } finally {
        finish();
      }
    },
    [updateOne, showSnackbar, beginKnocks],
  );

  const knockOne = useCallback(
    async (id: string) => {
      await runKnock(id);
    },
    [runKnock],
  );

  const knockAll = useCallback(async () => {
    const list = profilesRef.current.filter(
      (profile) => !pendingCounts.current.has(profile.id),
    );
    if (list.length === 0) return;
    const finish = beginKnocks(list.map((p) => p.id));
    try {
      showSnackbar({
        ...pendingKnockFeedback(list.length),
        tone: "info",
        persistent: true,
      });
      const settled = (await knockBatch(list, performKnock)).map(
        ({ item, result }) => ({ p: item, r: result }),
      );
      const now = Date.now();
      const next = profilesRef.current.map((existing) => {
        const found = settled.find((s) => s.p.id === existing.id);
        if (
          !found ||
          nativeConfigurationFingerprint(existing) !==
            nativeConfigurationFingerprint(found.p)
        )
          return existing;
        if (found.r.ok) {
          return {
            ...existing,
            lastKnockStatus: "success" as const,
            lastKnockAt: now,
            lastError: null,
            whitelistedEntry: found.r.whitelistedEntry,
            expiresAt: found.r.expiresAt,
            whitelistedAt:
              found.r.whitelistedAt ??
              grantStart(found.r.expiresAt, found.r.expiresInSeconds, now),
            grantRecordedAt: found.r.completedAtMillis ?? now,
            grantNetworkId: found.r.grantNetworkId ?? null,
            grantNetworkType: found.r.grantNetworkType ?? null,
          };
        }
        return {
          ...existing,
          lastKnockStatus: "error" as const,
          lastKnockAt: now,
          lastError: found.r.message,
        };
      });
      const write = persist(next);
      const successes = settled.filter((s) => s.r.ok).length;
      const failures = settled.length - successes;
      performResultHaptic(failures === 0);
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
        detailParts.push(`${cappedCount} TTL capped by server`);
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
      await write;
    } finally {
      finish();
    }
  }, [persist, showSnackbar, beginKnocks]);

  const upsert = useCallback(
    async (candidate: Profile) => {
      const p = prepareProfileSave(
        candidate,
        profilesRef.current.find((profile) => profile.id === candidate.id),
      );
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

  // Hydrate the UI independently of the cached Android batch. RootLayout starts
  // native HTTP after the first frame; reading the promise never starts work.
  useEffect(() => {
    let cancelled = false;
    let finish: (() => void) | undefined;
    void (async () => {
      const nativeResultsPromise = awaitLaunchKnockResults();
      const list = await loadProfiles();
      if (cancelled) return;
      profilesRef.current = list;
      setProfiles(list);
      setLoaded(true);
      const launchIds = new Set(
        list.filter((p) => p.knockOnOpen).map((p) => p.id),
      );
      if (launchIds.size) {
        finish = beginKnocks([...launchIds]);
        showSnackbar({
          ...pendingKnockFeedback(
            launchIds.size,
            "Startup request sent · waiting for Knocker server",
          ),
          tone: "info",
          persistent: true,
        });
      }

      // Do not sync a pre-launch snapshot over a native grant that is in flight.
      const nativeResults = await nativeResultsPromise;
      if (cancelled) return;
      const currentTargets = profilesRef.current.filter((p) =>
        launchIds.has(p.id),
      );
      const { matching, missing } = selectLaunchResults(
        currentTargets,
        nativeResults,
      );
      const settled = await knockBatch(missing, async (profile) => ({
        result: await performKnock(profile),
        completedAtMillis: Date.now(),
      }));
      if (cancelled) return;
      const jsResults: NativeLaunchKnockResult[] = settled.map(
        ({ item: profile, result: { result, completedAtMillis } }) => ({
          profileId: profile.id,
          name: profile.name,
          ok: result.ok,
          message: result.ok ? null : result.message,
          whitelistedEntry: result.ok ? result.whitelistedEntry : null,
          expiresInSeconds: result.ok ? result.expiresInSeconds : null,
          expiresAtMillis: result.ok ? result.expiresAt : null,
          requestedTtlSeconds: result.ok
            ? result.requestedTtlSeconds
            : profile.ttlSeconds,
          ttlCapped: result.ok && result.ttlCapped,
          configurationFingerprint: nativeConfigurationFingerprint(profile),
          whitelistedAtMillis: result.ok
            ? (result.whitelistedAt ??
              grantStart(
                result.expiresAt,
                result.expiresInSeconds,
                completedAtMillis,
              ))
            : null,
          grantNetworkId: result.ok ? (result.grantNetworkId ?? null) : null,
          grantNetworkType: result.ok
            ? (result.grantNetworkType ?? null)
            : null,
          completedAtMillis,
        }),
      );
      const nativeProfiles = isKnockerNativeAvailable
        ? await loadProfilesFromNative()
        : [];
      if (cancelled) return;
      const allResults = selectLaunchResults(profilesRef.current, [
        ...matching,
        ...jsResults,
      ]).matching;
      const next = applyLaunchResults(
        mergeExpiryFromNative(profilesRef.current, nativeProfiles),
        allResults,
      );
      // Publish results before disk writes or native snapshot synchronization.
      const write = persist(next);
      if (allResults.length) {
        const successes = allResults.filter((result) => result.ok).length;
        const failed = allResults.filter((result) => !result.ok);
        const capped = allResults.filter(
          (result) => result.ok && result.ttlCapped,
        ).length;
        const detail = [
          `${successes}/${allResults.length} profile${allResults.length === 1 ? "" : "s"} whitelisted`,
        ];
        if (failed.length)
          detail.push(
            `${failed.length} failed · ${failed
              .map((result) => result.name || "unnamed")
              .slice(0, 2)
              .join(", ")}`,
          );
        if (capped) detail.push(`${capped} TTL capped by server`);
        showSnackbar({
          text: failed.length
            ? "Launch knock finished with issues"
            : "Launch knock succeeded",
          detail: detail.join(" · "),
          tone: failed.length ? "error" : capped ? "info" : "success",
          persistent: true,
          retry: failed.length
            ? () => {
                for (const result of failed) void runKnock(result.profileId);
              }
            : undefined,
        });
      } else if (launchIds.size) dismissSnackbar();
      await write;
    })()
      .catch((error) => {
        console.warn("Failed to reconcile launch knocks.", error);
      })
      .finally(() => {
        finish?.();
      });
    return () => {
      cancelled = true;
      finish?.();
      finish = undefined;
    };
  }, [beginKnocks, dismissSnackbar, persist, runKnock, showSnackbar]);

  // Tiles and background renewals can finish while the activity is stopped.
  useEffect(() => {
    if (!loaded || !isKnockerNativeAvailable) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void loadProfilesFromNative().then((nativeProfiles) => {
        const previous = profilesRef.current;
        const merged = mergeExpiryFromNative(previous, nativeProfiles);
        if (!merged.some((profile, index) => profile !== previous[index]))
          return;
        void persist(merged).catch((error) => {
          console.warn("Failed to persist native grant updates.", error);
        });
      });
    });
    return () => subscription.remove();
  }, [loaded, persist]);

  useEffect(
    () =>
      subscribeToNativeKnocks((ids) => {
        const finished = [...nativePending.current].some(
          (id) => !ids.includes(id),
        );
        nativePending.current = new Set(ids);
        publishPending();
        if (finished && loaded)
          void loadProfilesFromNative()
            .then((snapshots) => {
              const current = profilesRef.current;
              const next = mergeExpiryFromNative(current, snapshots);
              if (next.some((profile, index) => profile !== current[index]))
                void persist(next);
            })
            .catch((error) =>
              console.warn("Failed to refresh native knock state.", error),
            );
      }),
    [loaded, persist, publishPending],
  );

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
      pendingKnocks,
      dismissSnackbar,
    }),
    [
      profiles,
      loaded,
      upsert,
      remove,
      knockOne,
      knockAll,
      snackbar,
      pendingKnocks,
      dismissSnackbar,
    ],
  );

  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  );
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error("useProfiles must be used inside ProfilesProvider");
  return ctx;
}
