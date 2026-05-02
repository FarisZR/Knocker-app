import React, { useCallback } from "react";
import { Pressable, type PressableProps, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, "style"> {
  style?: ViewStyle | ViewStyle[];
  scaleTo?: number;
}

export function AnimatedPressable({
  style,
  scaleTo = 0.94,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps["onPressIn"]>>(
    (e) => {
      scale.value = withTiming(scaleTo, { duration: 90 });
      onPressIn?.(e);
    },
    [scale, scaleTo, onPressIn],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps["onPressOut"]>>(
    (e) => {
      scale.value = withTiming(1, { duration: 140 });
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );

  return (
    <AnimatedPressableBase
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animStyle]}
    >
      {children as React.ReactNode}
    </AnimatedPressableBase>
  );
}
