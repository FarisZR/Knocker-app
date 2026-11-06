import { useWindowDimensions } from "react-native";
import { homeActionsHeight } from "@/lib/homeActionsLayout";
import { useProfiles } from "@/context/ProfilesContext";
import { performKnockHaptic } from "@/lib/haptics";
import React from "react";
import {
  Host,
  Column,
  LoadingIndicator,
  Row,
  FlowRow,
  Button,
  TextButton,
  FilledTonalButton,
  ExtendedFloatingActionButton,
  Text,
  Switch,
  FilterChip,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  semantics,
  padding,
  verticalScroll,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import type {
  EditorActionsProps,
  ToggleProps,
  TileProps,
  HomeActionsProps,
} from "./NativeActions";

export function EditorActions({
  canSave,
  onSave,
  onCancel,
}: EditorActionsProps) {
  return (
    <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
      <Row horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth()]}>
        <TextButton onClick={onCancel}>
          <Text>Cancel</Text>
        </TextButton>
        <Button enabled={canSave} onClick={onSave}>
          <Text>Save profile</Text>
        </Button>
      </Row>
    </Host>
  );
}
export function MaterialToggle({ label, value, onChange }: ToggleProps) {
  return (
    <Host matchContents>
      <Switch
        value={value}
        onCheckedChange={onChange}
        modifiers={[semantics({ contentDescription: label })]}
      />
    </Host>
  );
}
/** Offers exclusive tile slots and lets the selected slot be cleared with another tap. */
export function TileChips({ value, onChange, profiles, currentId }: TileProps) {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <FlowRow horizontalArrangement={{ spacedBy: 8 }}>
        {[null, 1, 2, 3, 4, 5].map((slot) => {
          const owner =
            slot === null
              ? undefined
              : profiles.find((p) => p.tileSlot === slot && p.id !== currentId);
          return (
            <FilterChip
              key={slot ?? "off"}
              selected={value === slot}
              enabled={!owner || value === slot}
              onClick={() => onChange(value === slot ? null : slot)}
              modifiers={[
                semantics({
                  contentDescription: owner
                    ? `Slot ${slot}, used by ${owner.name}`
                    : slot === null
                      ? "No Quick Settings tile"
                      : `Slot ${slot}`,
                }),
              ]}
            >
              <FilterChip.Label>
                <Text>{slot === null ? "Off" : String(slot)}</Text>
              </FilterChip.Label>
            </FilterChip>
          );
        })}
      </FlowRow>
    </Host>
  );
}
/** Renders native grouped add, bulk and pinned actions, sharing the current pending state. */
export function HomeActions({
  onNew,
  onKnockAll,
  hasProfiles,
}: HomeActionsProps) {
  const { profiles, pendingKnocks, knockOne } = useProfiles();
  const { height } = useWindowDimensions();
  const pinned = profiles.filter((p) => p.pinnedToHome);
  return (
    <Host
      style={{
        width: 280,
        height: homeActionsHeight(hasProfiles, pinned.length, height),
      }}
    >
      <Column
        horizontalAlignment="end"
        verticalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth(), verticalScroll(), padding(4, 4, 4, 8)]}
      >
        {hasProfiles ? (
          <FilledTonalButton
            onClick={onNew}
            modifiers={[semantics({ contentDescription: "New profile" })]}
          >
            <Text>＋ New profile</Text>
          </FilledTonalButton>
        ) : null}
        {pinned.map((profile) => (
          <FilledTonalButton
            key={profile.id}
            enabled={!pendingKnocks.has(profile.id)}
            onClick={() => {
              performKnockHaptic();
              void knockOne(profile.id);
            }}
            contentPadding={{ start: 20, end: 20, top: 16, bottom: 16 }}
            modifiers={[
              semantics({ contentDescription: `Pinned knock ${profile.name}` }),
            ]}
          >
            {pendingKnocks.has(profile.id) ? (
              <LoadingIndicator modifiers={[size(24, 24)]} />
            ) : null}
            <Text maxLines={1}>
              {pendingKnocks.has(profile.id)
                ? `Connecting ${profile.name}`
                : `↗ Knock ${profile.name}`}
            </Text>
          </FilledTonalButton>
        ))}
        {hasProfiles ? (
          <Button
            enabled={pendingKnocks.size === 0}
            onClick={onKnockAll}
            contentPadding={{ start: 28, end: 28, top: 22, bottom: 22 }}
            modifiers={[semantics({ contentDescription: "Knock all servers" })]}
          >
            <Text style={{ typography: "titleLarge", fontWeight: "600" }}>
              {pendingKnocks.size > 0 ? "Connecting…" : "↗ Knock all"}
            </Text>
          </Button>
        ) : (
          <ExtendedFloatingActionButton
            onClick={onNew}
            modifiers={[semantics({ contentDescription: "New profile" })]}
          >
            <ExtendedFloatingActionButton.Icon>
              <Text style={{ fontSize: 28 }}>＋</Text>
            </ExtendedFloatingActionButton.Icon>
            <ExtendedFloatingActionButton.Text>
              <Text>New profile</Text>
            </ExtendedFloatingActionButton.Text>
          </ExtendedFloatingActionButton>
        )}
      </Column>
    </Host>
  );
}
