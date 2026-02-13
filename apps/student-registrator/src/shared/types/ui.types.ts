export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export type ThemeMode = "light" | "dark";
