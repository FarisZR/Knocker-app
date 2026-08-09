import { useWindowDimensions } from "react-native";

import { getWindowWidthClass } from "@/lib/adaptiveLayout";

export function useAdaptiveLayout() {
  const { width, height } = useWindowDimensions();
  const widthClass = getWindowWidthClass(width);

  return {
    width,
    height,
    widthClass,
    showTwoPanes: widthClass !== "compact",
  };
}
