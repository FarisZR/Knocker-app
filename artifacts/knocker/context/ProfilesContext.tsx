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
import { AppState, Platform } from "react-native";

import { performKnock } from "@/lib/performKnock";
import {
  grantStart,
  acceptsKnockResult,
  applyKnockResult,
  mergeGrantsForSave,
  prepareProfileSave,
} from "@/lib/grants";
import { grantConfigurationFingerprint } from "@/lib/profileConfiguration";
import { knockBatch } from "@/lib/knockBatch";
import { pendingKnockFeedback } from "@/lib/knockFeedback";
import { applyLaunchResults, selectLaunchResults } from "@/lib/launchResults";
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
  outcome?: "success" | "error";
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

function toNativeSnapshot(list: Profile[]): NativeProfileSnapshot[] {
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
    whitelistedAt: p.whitelistedAt,
    grantRecordedAt: p.grantRecordedAt,
    whitelistedEntry: p.whitelistedEntry,
    grantNetworkId: p.grantNetworkId,
    grantNetworkType: p.grantNetworkType,
    knockOnOpen: p.knockOnOpen,
    configurationFingerprint: nativeConfigurationFingerprint(p),
    grantConfigurationFingerprint: grantConfigurationFingerprint(p),
  }));
}

/** Hydrates saved profiles while cached Android launch requests run independently. */
export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const snackbarId = useRef(0);
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
  /** Counts overlapping JS consumers without hiding native requests still in flight. */
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
  const loadedRef = useRef(false);
  profilesRef.current = profiles;

  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  /** Serializes snapshots and merges native grants around storage writes. */
  const persist = useCallback((next: Profile[]) => {
    profilesRef.current = next;
    setProfiles(next);
    const write = persistenceQueue.current
      .catch(() => {})
      .then(async () => {
        let saved = next;
        if (isKnockerNativeAvailable) {
          saved = mergeGrantsForSave(saved, await loadProfilesFromNative());
          await syncProfilesToNative(toNativeSnapshot(saved));
          saved = mergeGrantsForSave(saved, await loadProfilesFromNative());
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
  }, []);

  const showSnackbar = useCallback((s: Omit<SnackbarState, "id">) => {
    const id = ++snackbarId.current;
    setSnackbar({ ...s, id });
    return id;
  }, []);

  const dismissSnackbar = useCallback(() => setSnackbar(null), []);

  /** Dispatches immediately, then reconciles the result against the current target. */
  const runKnock = useCallback(
    async (id: string) => {
      const profile = profilesRef.current.find((p) => p.id === id);
      if (!profile || pendingCounts.current.has(id)) return null;
      const finish = beginKnocks([id]);
      try {
        // Capture local identity in parallel; never wait for it to start a knock.
        const result = await performKnock(profile);
        const current = profilesRef.current.find(
          (candidate) => candidate.id === id,
        );
        if (!current || !acceptsKnockResult(current, profile, result))
          return result;
        const updated = applyKnockResult(current, profile, result);
        const write = persist(
          profilesRef.current.map((p) => (p.id === id ? updated : p)),
        );
        if (Platform.OS !== "android") performResultHaptic(result.ok);
        if (result.ok) {
          const minutes = Math.round(result.expiresInSeconds / 60);
          const detail = result.whitelistedEntry
            ? `${result.whitelistedEntry} · ${minutes}m`
            : `${minutes}m`;
          showSnackbar({
            text: `Knocked ${current.name || "profile"}`,
            detail: result.ttlCapped
              ? `${detail} · TTL capped by server`
              : detail,
            tone: result.ttlCapped ? "info" : "success",
            outcome: "success",
          });
        } else {
          showSnackbar({
            text: `${current.name || "Profile"} failed`,
            detail: result.message,
            tone: "error",
            outcome: "error",
            retry: () => {
              void runKnock(id);
            },
          });
        }
        await write;
        return result;
      } finally {
        finish();
      }
    },
    [persist, showSnackbar, beginKnocks],
  );

  const knockOne = useCallback(
    async (id: string) => {
      await runKnock(id);
    },
    [runKnock],
  );

  /** Runs independent requests concurrently and retains edits made during the batch. */
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
      const settled = await knockBatch(list, performKnock);
      const next = profilesRef.current.map((existing) => {
        const found = settled.find((s) => s.item.id === existing.id);
        return found
          ? applyKnockResult(existing, found.item, found.result)
          : existing;
      });
      const write = persist(next);
      const successes = settled.filter((s) => s.result.ok).length;
      const failures = settled.length - successes;
      if (Platform.OS !== "android") performResultHaptic(failures === 0);
      const cappedCount = settled.filter(
        (s) => s.result.ok && s.result.ttlCapped,
      ).length;
      const failedNames = settled
        .filter((s) => !s.result.ok)
        .map((s) => s.item.name || "unnamed")
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
        outcome: failures > 0 ? "error" : "success",
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

  /** Saves only after hydration, keeping grants unless their permission target changed. */
  const upsert = useCallback(
    async (candidate: Profile) => {
      if (!loadedRef.current) throw new Error("Profiles are still loading");
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

  /** Reports partial deletion if secret cleanup fails after metadata is committed. */
  const remove = useCallback(
    async (id: string) => {
      if (!loadedRef.current) throw new Error("Profiles are still loading");
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
    let startupSnackbarId: number | undefined;
    const finishPending = () => {
      finish?.();
      finish = undefined;
    };
    void (async () => {
      const nativeResultsPromise = awaitLaunchKnockResults();
      const list = await loadProfiles();
      if (cancelled) return;
      profilesRef.current = list;
      setProfiles(list);
      loadedRef.current = true;
      setLoaded(true);
      const launchIds = new Set(
        list.filter((p) => p.knockOnOpen).map((p) => p.id),
      );
      if (launchIds.size) {
        finish = beginKnocks([...launchIds]);
        startupSnackbarId = showSnackbar({
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
          grantConfigurationFingerprint: grantConfigurationFingerprint(profile),
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
        mergeGrantsForSave(profilesRef.current, nativeProfiles),
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
          outcome: failed.length ? "error" : "success",
          persistent: failed.length > 0,
          retry: failed.length
            ? () => {
                for (const result of failed) void runKnock(result.profileId);
              }
            : undefined,
        });
      }
      await write;
    })()
      .catch((error) => {
        console.warn("Failed to reconcile launch knocks.", error);
        if (!cancelled && !loadedRef.current)
          setLoadError(new Error("Could not read saved profiles. Try again."));
      })
      .finally(() => {
        finishPending();
        if (!cancelled && startupSnackbarId !== undefined)
          setSnackbar((current) =>
            current?.id === startupSnackbarId ? null : current,
          );
      });
    return () => {
      cancelled = true;
      finishPending();
    };
  }, [beginKnocks, persist, runKnock, showSnackbar]);

  // Tiles and background renewals can finish while the activity is stopped.
  useEffect(() => {
    if (!loaded || !isKnockerNativeAvailable) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void loadProfilesFromNative()
        .then((nativeProfiles) => {
          const previous = profilesRef.current;
          const merged = mergeGrantsForSave(previous, nativeProfiles);
          if (merged.some((profile, index) => profile !== previous[index]))
            return persist(merged);
        })
        .catch((error) => {
          console.warn("Failed to refresh native grant state.", error);
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
              const next = mergeGrantsForSave(current, snapshots);
              if (next.some((profile, index) => profile !== current[index]))
                return persist(next);
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

  if (loadError) throw loadError;
  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  );
}

/** Requires the shared provider so screens cannot create competing profile stores. */
export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error("useProfiles must be used inside ProfilesProvider");
  return ctx;
}
