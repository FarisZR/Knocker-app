export interface PendingKnockFeedback {
  text: string;
  detail?: string;
}

/** Keeps manual and startup knocks consistent while the server responds. */
export function pendingKnockFeedback(
  total: number,
  detail?: string,
): PendingKnockFeedback {
  return {
    text: `Knocking ${total} profile${total === 1 ? "" : "s"}…`,
    detail,
  };
}
