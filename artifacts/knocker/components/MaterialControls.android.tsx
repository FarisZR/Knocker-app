import React, { useEffect } from "react";
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
  useEffect(() => {
    if (text.value !== value) text.value = value;
  }, [value, text]);
  const flat = StyleSheet.flatten(style);
  return (
    <View style={{ flex: flat?.flex, minWidth: 0 }}>
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <OutlinedTextField
          value={text}
          onValueChange={onChangeText}
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
