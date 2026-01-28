import type { CSSProperties } from "react";

export const uiDividerStyle: CSSProperties = {
  width: 1,
  height: 24,
  background: "#e8e8e8",
};

export const statGroupDividerStyle: CSSProperties = {
  width: 1,
  height: 20,
  background: "#e8e8e8",
};

export const flexRowWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
};

export const headerContainerStyle: CSSProperties = {
  ...flexRowWrap,
  gap: 16,
};

export const headerMainContentStyle: CSSProperties = {
  ...flexRowWrap,
  gap: 16,
  flex: 1,
};

export const headerTimeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const liveStatusTextStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
};
