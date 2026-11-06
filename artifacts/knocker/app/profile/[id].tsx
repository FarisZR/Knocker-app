import {
  Redirect,
  useRouter,
  useLocalSearchParams,
  usePreventRemove,
} from "expo-router";
import React, { useState } from "react";
import { Alert, Platform } from "react-native";
import { ProfileEditor } from "@/components/ProfileEditor";
import { useAdaptiveLayout } from "@/hooks/useAdaptiveLayout";

export default function ProfileEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showTwoPanes } = useAdaptiveLayout();
  const [dirty, setDirty] = useState(false);
  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    const discard = () => {
      setDirty(false);
      repeat();
    };
    if (Platform.OS === "web") {
      if (window.confirm("Discard unsaved changes?")) discard();
    } else
      Alert.alert(
        "Discard unsaved changes?",
        "Your changes have not been saved.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: discard },
        ],
      );
  });
  const finish = () => {
    setDirty(false);
    disablePrevention();
    router.back();
  };
  const profileId = id || "new";
  if (showTwoPanes)
    return (
      <Redirect href={{ pathname: "/", params: { profile: profileId } }} />
    );
  return (
    <ProfileEditor
      key={profileId}
      profileId={profileId}
      onDirtyChange={setDirty}
      onSaved={finish}
      onDeleted={finish}
      onCancel={finish}
    />
  );
}
