import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
export function useColors() {
  return {
    ...(useColorScheme() === "dark" ? colors.dark : colors.light),
    radius: colors.radius,
  };
}
