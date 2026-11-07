import { Redirect, useLocalSearchParams } from "expo-router";

/** Deep links enter the same Compose navigation stack as taps on the home screen. */
export default function NativeProfileLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect href={{ pathname: "/", params: { profile: id || "new" } }} />
  );
}
