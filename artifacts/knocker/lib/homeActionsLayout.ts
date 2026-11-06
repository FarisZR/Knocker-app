export function homeActionsHeight(
  hasProfiles: boolean,
  pinned: number,
  windowHeight: number,
): number {
  return Math.min(hasProfiles ? 144 + pinned * 64 : 72, windowHeight * 0.55);
}

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
