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

/** Preserves an open modal draft across rotation and confirms navigation away from edits. */
export default function ProfileEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showTwoPanes } = useAdaptiveLayout();
  // A modal editor that is already open owns its draft until explicitly closed.
  const [editorMounted] = useState(!showTwoPanes);
  const [dirty, setDirty] = useState(false);
  /** Requires an explicit discard before repeating navigation that would lose an edited draft. */
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
  /** Closes a compact editor or selects its saved profile in the wide home pane. */
  const finish = (savedId?: string) => {
    setDirty(false);
    disablePrevention();
    if (showTwoPanes)
      router.dismissTo({
        pathname: "/",
        params: { profile: savedId ?? profileId },
      });
    else router.back();
  };
  const profileId = id || "new";
  if (showTwoPanes && !editorMounted)
    return (
      <Redirect href={{ pathname: "/", params: { profile: profileId } }} />
    );
  return (
    <ProfileEditor
      key={profileId}
      profileId={profileId}
      onDirtyChange={setDirty}
      onSaved={(profile) => finish(profile.id)}
      onDeleted={() => finish()}
      onCancel={() => finish()}
    />
  );
}
