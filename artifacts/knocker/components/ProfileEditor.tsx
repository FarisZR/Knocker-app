import { nativeConfigurationFingerprint } from "@/lib/profileConfiguration";
import { prepareProfileSave } from "@/lib/grants";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useProfiles } from "@/context/ProfilesContext";
import { isValidUrl } from "@/lib/format";
import { newProfile, type Profile } from "@/lib/profiles";

interface ProfileEditorProps {
  profileId: string;
  embedded?: boolean;
  onSaved: (profile: Profile) => void;
  onDeleted: (profileId: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/** Owns an editable draft; clean drafts refresh from storage while dirty drafts survive layout changes. */
export function ProfileEditor({
  profileId,
  embedded = false,
  onSaved,
  onDeleted,
  onCancel,
  onDirtyChange,
}: ProfileEditorProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profiles, loaded, upsert, remove } = useProfiles();

  const isNew = profileId === "new" || !profileId;
  const existing = useMemo(
    () =>
      isNew
        ? null
        : (profiles.find((profile) => profile.id === profileId) ?? null),
    [isNew, profileId, profiles],
  );

  const [draft, setDraft] = useState<Profile>(() => existing ?? newProfile());
  const [showKey, setShowKey] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [allowIpOverride, setAllowIpOverride] = useState(
    !!(existing?.ipOverride && existing.ipOverride.length > 0),
  );
  const baselineRef = useRef(draft);
  const baselineAllowIpOverrideRef = useRef(allowIpOverride);
  const initializedProfileIdRef = useRef<string | null>(null);

  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(baselineRef.current) ||
    allowIpOverride !== baselineAllowIpOverrideRef.current;

  useEffect(() => {
    if (!loaded) return;
    if (
      initializedProfileIdRef.current === profileId &&
      (isDirty ||
        !existing ||
        nativeConfigurationFingerprint(existing) ===
          nativeConfigurationFingerprint(baselineRef.current))
    )
      return;
    const next = existing ?? newProfile();
    const nextAllowIpOverride = Boolean(
      next.ipOverride && next.ipOverride.length > 0,
    );
    setDraft(next);
    setShowKey(false);
    setAllowIpOverride(nextAllowIpOverride);
    baselineRef.current = next;
    baselineAllowIpOverrideRef.current = nextAllowIpOverride;
    initializedProfileIdRef.current = profileId;
  }, [existing, isNew, loaded, profileId, isDirty]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
  const showSaveAction = !embedded || isDirty;

  /** Normalizes user input and preserves grants only when the permission target is unchanged. */
  const onSave = async () => {
    setStorageError(null);
    const sanitized: Profile = prepareProfileSave(
      {
        ...draft,
        name: draft.name.trim(),
        endpointUrl: draft.endpointUrl.trim(),
        apiKey: draft.apiKey.trim(),
        ipOverride:
          allowIpOverride && draft.ipOverride ? draft.ipOverride.trim() : null,
      },
      existing,
    );
    try {
      await upsert(sanitized);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Could not save profile",
      );
      return;
    }
    setDraft(sanitized);
    baselineRef.current = sanitized;
    baselineAllowIpOverrideRef.current = allowIpOverride;
    onDirtyChange?.(false);
    onSaved(sanitized);
  };

  /** Confirms removal before deleting both the profile and its securely stored key. */
  const onDelete = () => {
    if (isNew) return;
    const doIt = async () => {
      try {
        await remove(draft.id);
      } catch (error) {
        setStorageError(
          error instanceof Error ? error.message : "Could not delete profile",
        );
        return;
      }
      onDirtyChange?.(false);
      onDeleted(draft.id);
    };
    if (Platform.OS === "web") {
      // Alert.alert isn't well-supported in RN web; just confirm via window.confirm.
      // eslint-disable-next-line no-alert
      if (
        typeof window !== "undefined" &&
        window.confirm("Delete this profile?")
      ) {
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

  const cancel = () => {
    setDraft(baselineRef.current);
    setAllowIpOverride(baselineAllowIpOverrideRef.current);
    setShowKey(false);
    onDirtyChange?.(false);
    onCancel();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Body
        contentContainerStyle={[
          styles.scrollContent,
          embedded ? styles.embeddedContent : null,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.h1, { color: colors.foreground }]}>
          {isNew ? "New profile" : "Edit profile"}
        </Text>
        {storageError ? (
          <Text style={{ color: colors.destructive }}>{storageError}</Text>
        ) : null}

        <Section title="Server" colors={colors}>
          <Field label="Name" colors={colors}>
            <TextInput
              accessibilityLabel="Name"
              value={draft.name}
              onChangeText={(t) => patch({ name: t })}
              placeholder="Home Server"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border },
              ]}
              autoCapitalize="words"
            />
          </Field>
          <Field label="Endpoint URL" colors={colors}>
            <TextInput
              accessibilityLabel="Endpoint URL"
              value={draft.endpointUrl}
              onChangeText={(t) => patch({ endpointUrl: t })}
              placeholder="https://knock.example.com (HTTPS required)"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Field>
          <Field label="API key" colors={colors}>
            <View style={styles.keyRow}>
              <TextInput
                accessibilityLabel="API key"
                value={draft.apiKey}
                onChangeText={(t) => patch({ apiKey: t })}
                placeholder="X-Api-Key value"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    flex: 1,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
              />
              <Pressable
                onPress={() => setShowKey((s) => !s)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showKey ? "Hide API key" : "Show API key"}
                style={styles.eye}
              >
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
              accessibilityLabel="TTL (seconds)"
              value={draft.ttlSeconds === null ? "" : String(draft.ttlSeconds)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
                patch({ ttlSeconds: Number.isFinite(n) ? n : null });
              }}
              placeholder="e.g. 3600"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border },
              ]}
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
                accessibilityLabel="IP or CIDR"
                value={draft.ipOverride ?? ""}
                onChangeText={(t) => patch({ ipOverride: t })}
                placeholder="203.0.113.42 or 203.0.113.0/24"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
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
            sub={"Adds a dedicated knock button above Knock all"}
            value={draft.pinnedToHome}
            onChange={(v) => patch({ pinnedToHome: v })}
            colors={colors}
            last
          />
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

      {showSaveAction ? (
        <Animated.View
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
            onPress={cancel}
            style={({ pressed }) => [
              styles.btnGhost,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              style={[styles.btnGhostText, { color: colors.onSurfaceVariant }]}
            >
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
            <Text
              style={[
                styles.btnPrimaryText,
                { color: colors.primaryForeground },
              ]}
            >
              Save
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Groups the web/iOS editor fields. */
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
      <Text
        style={[
          styles.sectionTitle,
          {
            color: colors.mutedForeground,
          },
        ]}
      >
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionBody, { backgroundColor: colors.surface }]}>
        {children}
      </View>
    </View>
  );
}

/** Adds supporting text while letting native text fields own their Android labels. */
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

/** Pairs a setting label with its accessible switch. */
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
  scrollContent: { padding: 20, gap: 18 },
  embeddedContent: { width: "100%", maxWidth: 900, alignSelf: "center" },
  h1: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionBody: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 },
  field: { paddingVertical: 12 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
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
  eye: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  toggleSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  warningText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
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
  deleteText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  btnGhost: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  btnGhostText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 2,
  },
  btnPrimary: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 2,
  },
});
