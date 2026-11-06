/** Reserves the same vertical budget used by native bulk and pinned floating actions. */
export function homeActionsHeight(
  hasProfiles: boolean,
  pinned: number,
  windowHeight: number,
): number {
  return Math.min(hasProfiles ? 144 + pinned * 64 : 72, windowHeight * 0.55);
}

/** Places result feedback above the visible floating action cluster. */
export function snackbarBottom(
  requested: number,
  windowHeight: number,
  topInset: number,
  contentHeight: number,
): number {
  return Math.max(
    8,
    Math.min(requested, windowHeight - topInset - contentHeight - 8),
  );
}
