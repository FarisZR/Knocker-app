import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
/** Selects the shared light or dark palette using the current system appearance. */
export function useColors() {
  return {
    ...(useColorScheme() === "dark" ? colors.dark : colors.light),
    radius: colors.radius,
  };
}
