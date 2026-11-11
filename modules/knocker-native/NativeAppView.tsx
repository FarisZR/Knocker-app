import { requireNativeView } from "expo";
import type { ComponentType } from "react";
import type { NativeSyntheticEvent, ViewProps } from "react-native";

export interface NativeAction {
  type: string;
  id?: string;
  token?: string;
  profileJson?: string;
  enabled?: boolean;
}

/** A single native surface owns every Android screen and interaction. */
export const NativeAppView = requireNativeView(
  "KnockerNative",
  "KnockerAppView",
) as ComponentType<
  ViewProps & {
    stateJson: string;
    onAction: (event: NativeSyntheticEvent<NativeAction>) => void;
  }
>;
