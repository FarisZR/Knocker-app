import React from "react";
import { NativeAppView } from "../modules/knocker-native/NativeAppView";

export type ErrorFallbackProps = { error: Error; resetError: () => void };

/** Even the recovery screen uses the same native Material surface. */
export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <NativeAppView
      style={{ flex: 1 }}
      stateJson={JSON.stringify({
        fatal: error.message || "Please try opening the app again.",
      })}
      onAction={(event) => {
        if (event.nativeEvent.type === "restart") resetError();
      }}
    />
  );
}
