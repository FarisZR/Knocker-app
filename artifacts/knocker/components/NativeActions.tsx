import type { Profile } from "@/lib/profiles";
export interface EditorActionsProps {
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}
export interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}
export interface TileProps {
  value: number | null;
  onChange: (value: number | null) => void;
  profiles: Profile[];
  currentId: string;
}
export interface HomeActionsProps {
  hasProfiles: boolean;
  onNew: () => void;
  onKnockAll: () => void;
}
export function EditorActions(_: EditorActionsProps) {
  return null;
}
export function MaterialToggle(_: ToggleProps) {
  return null;
}
export function TileChips(_: TileProps) {
  return null;
}
export function HomeActions(_: HomeActionsProps) {
  return null;
}
