import { Redirect, router, useLocalSearchParams } from "expo-router";
import React from "react";

import { ProfileEditor } from "@/components/ProfileEditor";
import { useAdaptiveLayout } from "@/hooks/useAdaptiveLayout";

export default function ProfileEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showTwoPanes } = useAdaptiveLayout();
  const profileId = id || "new";

  if (showTwoPanes) {
    return (
      <Redirect href={{ pathname: "/", params: { profile: profileId } }} />
    );
  }

  return (
    <ProfileEditor
      key={profileId}
      profileId={profileId}
      onSaved={() => router.back()}
      onDeleted={() => router.back()}
      onCancel={() => router.back()}
    />
  );
}
