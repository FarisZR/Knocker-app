import React, { useState } from "react";
import {
  Host,
  AlertDialog,
  Column,
  Row,
  Text,
  TextButton,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers";
import { useNetworkStatus } from "@/context/NetworkContext";

export function NetworkStatus() {
  const { connection, checksEnabled, checking, setChecksEnabled, refresh } =
    useNetworkStatus();
  const colors = useMaterialColors();
  const [showPreferences, setShowPreferences] = useState(false);
  return (
    <Host
      matchContents={{ vertical: true }}
      style={{ width: "100%", marginTop: 8 }}
    >
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Text
          style={{ typography: "labelMedium" }}
          color={colors.onSurfaceVariant}
          modifiers={[weight(1)]}
        >
          {connection?.isConnected === false
            ? "Offline"
            : (connection?.type ?? "Connection")}
        </Text>
        <TextButton onClick={() => setShowPreferences(true)}>
          <Text>
            {checking
              ? "Checking IP…"
              : `IP checks: ${checksEnabled ? "on" : "off"}`}
          </Text>
        </TextButton>
      </Row>
      {showPreferences ? (
        <AlertDialog onDismissRequest={() => setShowPreferences(false)}>
          <AlertDialog.Title>
            <Text>Public-IP checks</Text>
          </AlertDialog.Title>
          <AlertDialog.Text>
            <Column verticalArrangement={{ spacedBy: 12 }}>
              <Text>
                Connection changes are detected on your phone without an IP
                service.
              </Text>
              <Text>
                Optional checks share your public IP with ipify to compare IPv4
                and IPv6 addresses. They run once a minute while this app is
                open, on resume and on connection changes. They never delay a
                knock.
              </Text>
              {checksEnabled ? (
                <TextButton
                  onClick={() => {
                    setShowPreferences(false);
                    refresh();
                  }}
                >
                  <Text>Check now</Text>
                </TextButton>
              ) : null}
            </Column>
          </AlertDialog.Text>
          <AlertDialog.DismissButton>
            <TextButton onClick={() => setShowPreferences(false)}>
              <Text>{checksEnabled ? "Close" : "Keep off"}</Text>
            </TextButton>
          </AlertDialog.DismissButton>
          <AlertDialog.ConfirmButton>
            <TextButton
              onClick={() => {
                setChecksEnabled(!checksEnabled);
                setShowPreferences(false);
              }}
            >
              <Text>{checksEnabled ? "Turn off" : "Enable checks"}</Text>
            </TextButton>
          </AlertDialog.ConfirmButton>
        </AlertDialog>
      ) : null}
    </Host>
  );
}
