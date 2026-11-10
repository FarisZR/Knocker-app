import * as Sentry from "@sentry/react-native";
import { setDiagnosticsEnabled } from "knocker-native";

/** How long a turn-off waits for already captured reports before giving up. */
const CLOSE_TIMEOUT_MS = 2000;

/** Stops a running Sentry SDK, but never lets a slow flush hold up saving the choice. */
async function stopSentry(timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Sentry.close(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } catch {
    // Closing is best effort; the stored choice still stops the next launch.
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Applies the user's crash-report choice. Turning it off stops a running SDK
 * first, so the choice holds for this session even if saving it fails; turning
 * it on only saves, and Sentry starts on the next launch.
 */
export async function applyDiagnosticsChoice(
  enabled: boolean,
  closeTimeoutMs: number = CLOSE_TIMEOUT_MS,
): Promise<void> {
  if (!enabled) await stopSentry(closeTimeoutMs);
  await setDiagnosticsEnabled(enabled);
}
