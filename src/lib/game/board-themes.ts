export interface BoardTheme {
  id: string;
  label: string;
  dark: string;
  light: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "indigo", label: "Indigo", dark: "#312e81", light: "#e0e7ff" },
  { id: "green", label: "Green", dark: "#769656", light: "#eeeed2" },
  { id: "brown", label: "Brown", dark: "#b58863", light: "#f0d9b5" },
  { id: "blue", label: "Blue", dark: "#4a6fa5", light: "#dde7f0" },
  { id: "slate", label: "Slate", dark: "#475569", light: "#e2e8f0" },
  { id: "rose", label: "Rose", dark: "#9f1239", light: "#fce7f3" },
];

const STORAGE_KEY = "ccb-board-theme";

export function getStoredBoardTheme(): BoardTheme {
  if (typeof window === "undefined") return BOARD_THEMES[1]; // default: Green
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return BOARD_THEMES.find((t) => t.id === id) || BOARD_THEMES[1]; // default: Green
  } catch {
    return BOARD_THEMES[1]; // default: Green
  }
}

export function storeBoardTheme(themeId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {}
}
