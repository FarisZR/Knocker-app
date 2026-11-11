export const MEDIUM_WIDTH_BREAKPOINT = 600;
export const EXPANDED_WIDTH_BREAKPOINT = 840;

export type WindowWidthClass = "compact" | "medium" | "expanded";

export function getWindowWidthClass(width: number): WindowWidthClass {
  if (width >= EXPANDED_WIDTH_BREAKPOINT) return "expanded";
  if (width >= MEDIUM_WIDTH_BREAKPOINT) return "medium";
  return "compact";
}
