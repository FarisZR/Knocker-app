import React, { useEffect, useState } from "react";
import { StyleSheet, View, type TextInputProps } from "react-native";
import {
  Host,
  OutlinedTextField,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";

/** Keep editing on the UI thread while retaining the shared editor's draft contract. */
export function MaterialInput({
  value = "",
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  style,
  accessibilityLabel,
}: TextInputProps) {
  const text = useNativeState(value);
  const [editVersion, setEditVersion] = useState(0);
  useEffect(() => {
    if (text.get() !== value) text.set(value);
  }, [value, text, editVersion]);
  const flat = StyleSheet.flatten(style);
  return (
    <View style={{ flex: flat?.flex, minWidth: 0 }}>
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <OutlinedTextField
          value={text}
          onValueChange={(next) => {
            onChangeText?.(next);
            setEditVersion((version) => version + 1);
          }}
          singleLine
          visualTransformation={secureTextEntry ? "password" : "none"}
          keyboardOptions={{
            keyboardType: secureTextEntry
              ? "password"
              : keyboardType === "url"
                ? "uri"
                : keyboardType === "number-pad"
                  ? "number"
                  : "text",
            capitalization: autoCapitalize ?? "none",
            autoCorrectEnabled: autoCorrect ?? false,
            imeAction: "next",
          }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Placeholder>
            <Text>{placeholder ?? ""}</Text>
          </OutlinedTextField.Placeholder>
          {accessibilityLabel ? (
            <OutlinedTextField.Label>
              <Text>{accessibilityLabel}</Text>
            </OutlinedTextField.Label>
          ) : null}
        </OutlinedTextField>
      </Host>
    </View>
  );
}
