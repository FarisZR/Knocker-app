import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useProfiles } from "@/context/ProfilesContext";
import { isValidUrl } from "@/lib/format";
import { newProfile, type Profile } from "@/lib/profiles";
import {
  isNativeAvailable as isKnockerNativeAvailable,
  TILE_SLOT_COUNT,
} from "knocker-native";

export default function ProfileEditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profiles, upsert, remove } = useProfiles();

  const isNew = id === "new" || !id;
  const existing = useMemo(
    () => (isNew ? null : profiles.find((p) => p.id === id) ?? null),
    [isNew, id, profiles],
  );

  const [draft, setDraft] = useState<Profile>(() => existing ?? newProfile());
  const [showKey, setShowKey] = useState(false);
  const [allowIpOverride, setAllowIpOverride] = useState(
    !!(existing?.ipOverride && existing.ipOverride.length > 0),
  );

  useEffect(() => {
    if (existing) setDraft(existing);
  }, [existing]);

  const patch = (next: Partial<Profile>) =>
    setDraft((d) => ({ ...d, ...next }));

  const ttlWarning =
    draft.autoRenew &&
    draft.ttlSeconds !== null &&
    draft.ttlSeconds > 0 &&
    draft.ttlSeconds < 120;

  const canSave =
    draft.name.trim().length > 0 &&
    isValidUrl(draft.endpointUrl) &&
    draft.apiKey.trim().length > 0;

  const onSave = async () => {
    const sanitized: Profile = {
      ...draft,
      name: draft.name.trim(),
      endpointUrl: draft.endpointUrl.trim(),
      apiKey: draft.apiKey.trim(),
      ipOverride:
        allowIpOverride && draft.ipOverride
          ? draft.ipOverride.trim()
          : null,
    };
    await upsert(sanitized);
    router.back();
  };

  const onDelete = () => {
    if (isNew) return;
    const doIt = async () => {
      await remove(draft.id);
      router.back();
    };
    if (Platform.OS === "web") {
      // Alert.alert isn't well-supported in RN web; just confirm via window.confirm.
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined" && window.confirm("Delete this profile?")) {
        void doIt();
      }
      return;
    }
    Alert.alert("Delete profile?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void doIt() },
    ]);
  };

  const Body = Platform.OS === "web" ? ScrollView : KeyboardAwareScrollView;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Body
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 100,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.h1, { color: colors.foreground }]}>
          {isNew ? "New profile" : "Edit profile"}
        </Text>

        <Section title="Server" colors={colors}>
          <Field label="Name" colors={colors}>
            <TextInput
              value={draft.name}
              onChangeText={(t) => patch({ name: t })}
              placeholder="Home Server"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              autoCapitalize="words"
            />
          </Field>
          <Field label="Endpoint URL" colors={colors}>
            <TextInput
              value={draft.endpointUrl}
              onChangeText={(t) => patch({ endpointUrl: t })}
              placeholder="https://knock.example.com (HTTPS required)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Field>
          <Field label="API key" colors={colors}>
            <View style={styles.keyRow}>
              <TextInput
                value={draft.apiKey}
                onChangeText={(t) => patch({ apiKey: t })}
                placeholder="X-Api-Key value"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { flex: 1, color: colors.foreground, borderColor: colors.border },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
              />
              <Pressable onPress={() => setShowKey((s) => !s)} hitSlop={8} style={styles.eye}>
                <Feather
                  name={showKey ? "eye-off" : "eye"}
                  size={18}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
          </Field>
          <Field
            label="TTL (seconds)"
            sub="Leave blank to use the key's max TTL"
            colors={colors}
          >
            <TextInput
              value={draft.ttlSeconds === null ? "" : String(draft.ttlSeconds)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
                patch({ ttlSeconds: Number.isFinite(n) ? n : null });
              }}
              placeholder="e.g. 3600"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              keyboardType="number-pad"
            />
          </Field>
        </Section>

        <Section title="Whitelist target" colors={colors}>
          <ToggleRow
            label="Whitelist a different IP/CIDR"
            sub="Requires allow_remote_whitelist on the API key"
            value={allowIpOverride}
            onChange={(v) => {
              setAllowIpOverride(v);
              if (!v) patch({ ipOverride: null });
            }}
            colors={colors}
            last={!allowIpOverride}
          />
          {allowIpOverride ? (
            <Field label="IP or CIDR" colors={colors}>
              <TextInput
                value={draft.ipOverride ?? ""}
                onChangeText={(t) => patch({ ipOverride: t })}
                placeholder="203.0.113.42 or 203.0.113.0/24"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          ) : null}
        </Section>

        <Section title="Triggers" colors={colors}>
          <ToggleRow
            label="Knock when app opens"
            sub="Fires automatically on launch"
            value={draft.knockOnOpen}
            onChange={(v) => patch({ knockOnOpen: v })}
            colors={colors}
          />
          <ToggleRow
            label="Auto-renew before expiry"
            sub={`Re-knock ${draft.autoRenewSafetyWindowSec / 60} min before expiry`}
            value={draft.autoRenew}
            onChange={(v) => patch({ autoRenew: v })}
            colors={colors}
            last
          />
          {ttlWarning ? (
            <View style={styles.warning}>
              <Feather name="alert-triangle" size={14} color={colors.primary} />
              <Text style={[styles.warningText, { color: colors.primary }]}>
                TTL is shorter than the safety window. Consider TTL ≥ 120s.
              </Text>
            </View>
          ) : null}
        </Section>

        <Section title="Quick access" colors={colors}>
          <ToggleRow
            label="Pin to home"
            sub="Adds a dedicated knock button above Knock all"
            value={draft.pinnedToHome}
            onChange={(v) => patch({ pinnedToHome: v })}
            colors={colors}
            last={!isKnockerNativeAvailable}
          />
          {isKnockerNativeAvailable ? (
            <View style={[styles.field, { paddingTop: 14 }]}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}> 
                Quick Settings tile slot
              </Text>
              <Text
                style={[styles.fieldSub, { color: colors.mutedForeground }]}
              >
                Android names these system tiles Knock 1-{TILE_SLOT_COUNT}.
                Pick the same number here and in the Quick Settings editor.
              </Text>
              <TileSlotPicker
                value={draft.tileSlot}
                profiles={profiles}
                currentId={draft.id}
                onChange={(slot) => patch({ tileSlot: slot })}
                colors={colors}
              />
              <Text
                style={[styles.tileSlotHint, { color: colors.mutedForeground }]}
              >
                {draft.tileSlot === null
                  ? "Add a Knock tile in Android, then match its number here."
                  : `This profile will respond to the Android tile labeled \"Knock ${draft.tileSlot}\".`}
              </Text>
            </View>
          ) : null}
        </Section>

        {!isNew ? (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                borderColor: colors.destructive,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.deleteText, { color: colors.destructive }]}>
              Delete profile
            </Text>
          </Pressable>
        ) : null}
      </Body>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.borderVariant,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.btnGhost,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.btnGhostText, { color: colors.onSurfaceVariant }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.btnPrimary,
            {
              backgroundColor: colors.primary,
              opacity: !canSave ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="check" size={18} color={colors.primaryForeground} />
          <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground }]}>
            Save
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.sectionBody,
          { backgroundColor: colors.surface },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Field({
  label,
  sub,
  children,
  colors,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.fieldSub, { color: colors.mutedForeground }]}>
          {sub}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function TileSlotPicker({
  value,
  profiles,
  currentId,
  onChange,
  colors,
}: {
  value: number | null;
  profiles: Profile[];
  currentId: string;
  onChange: (slot: number | null) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const slots = Array.from({ length: TILE_SLOT_COUNT }, (_, i) => i + 1);
  const ownerOf = (slot: number) =>
    profiles.find((p) => p.tileSlot === slot && p.id !== currentId);
  return (
    <View style={styles.tileSlotRow}>
      <Pressable
        onPress={() => onChange(null)}
        style={({ pressed }) => [
          styles.tileSlotChip,
          {
            borderColor: colors.border,
            backgroundColor:
              value === null ? colors.primary : "transparent",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.tileSlotChipText,
            {
              color:
                value === null ? colors.primaryForeground : colors.foreground,
            },
          ]}
        >
          Off
        </Text>
      </Pressable>
      {slots.map((slot) => {
        const conflict = ownerOf(slot);
        const isActive = value === slot;
        const isDisabled = Boolean(conflict) && !isActive;
        return (
          <Pressable
            key={slot}
            disabled={isDisabled}
            accessibilityState={{ disabled: isDisabled, selected: isActive }}
            accessibilityLabel={
              isDisabled
                ? `Slot ${slot}, unavailable${
                    conflict?.name ? `, used by ${conflict.name}` : ""
                  }`
                : `Slot ${slot}${isActive ? ", selected" : ""}`
            }
            onPress={() => {
              if (isDisabled) return;
              onChange(isActive ? null : slot);
            }}
            style={({ pressed }) => [
              styles.tileSlotChip,
              {
                borderColor: conflict ? colors.destructive : colors.border,
                backgroundColor: isActive ? colors.primary : "transparent",
                opacity: isDisabled ? 0.45 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.tileSlotChipText,
                {
                  color: isActive
                    ? colors.primaryForeground
                    : conflict
                      ? colors.destructive
                      : colors.foreground,
                },
              ]}
            >
              {slot}
            </Text>
            {conflict ? (
              <Text
                style={[
                  styles.tileSlotChipSub,
                  { color: colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {conflict.name || "used"}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
  colors,
  last,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.toggleRow,
        !last
          ? { borderBottomColor: colors.borderVariant, borderBottomWidth: 1 }
          : null,
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? colors.primaryForeground : colors.onSurfaceVariant}
        trackColor={{ false: colors.border, true: colors.primary }}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  h1: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionBody: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 },
  field: { paddingVertical: 12 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  keyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eye: { padding: 8, marginTop: 8 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  toggleSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  warningText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  btnGhost: { flex: 1, paddingVertical: 14, alignItems: "center" },
  btnGhostText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  btnPrimary: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnPrimaryText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  tileSlotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  tileSlotChip: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  tileSlotChipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tileSlotChipSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    maxWidth: 90,
  },
  tileSlotHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    lineHeight: 17,
  },
});
