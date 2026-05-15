import { Easing } from "react-native-reanimated";

export const motion = {
  duration: {
    short: 150,
    medium: 200,
    pressIn: 80,
    pressOut: 100,
  },
  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
  },
};
