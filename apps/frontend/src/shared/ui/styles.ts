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
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

export const headerMetaRowStyle: CSSProperties = {
  ...flexRowWrap,
  gap: 12,
  justifyContent: "space-between",
};

export const headerMetaLeftStyle: CSSProperties = {
  ...flexRowWrap,
  gap: 12,
  flex: 1,
};

export const headerMetaRightStyle: CSSProperties = {
  ...flexRowWrap,
  gap: 8,
  justifyContent: "flex-end",
};

export const headerMainContentStyle: CSSProperties = {
  ...flexRowWrap,
  gap: 16,
  flex: 1,
  justifyContent: "space-between",
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

export const fullHeightLayoutStyle: CSSProperties = {
  minHeight: "100vh",
};

export const menuNoBorderStyle: CSSProperties = {
  borderRight: 0,
};

export const pageHeaderCardStyle: CSSProperties = {
  marginBottom: 12,
};

export const timeIconStyle: CSSProperties = {
  fontSize: 16,
  color: "#1890ff",
};

export const timeTextStyle: CSSProperties = {
  fontSize: 16,
};

export const timeSubTextStyle: CSSProperties = {
  fontSize: 12,
};

export const calendarIconStyle: CSSProperties = {
  marginRight: 4,
};

export const protectedRouteContainerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
};

export const uiGalleryContainerStyle: CSSProperties = {
  width: "100%",
};

export const statusBarContainerStyle: CSSProperties = {
  display: "flex",
  borderRadius: 4,
  overflow: "hidden",
  background: "#f0f0f0",
};

export const statusBarTotalStyle: CSSProperties = {
  marginTop: 6,
};

export function getLiveIconStyle(isConnected: boolean): CSSProperties {
  return { color: isConnected ? "#52c41a" : "#ff4d4f" };
}

export function getSiderStyle(themeToken: any): CSSProperties {
  return {
    background: themeToken.colorBgContainer,
    borderRight: `1px solid ${themeToken.colorBorderSecondary}`,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  };
}

export function getLogoContainerStyle(themeToken: any): CSSProperties {
  return {
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
  };
}

export function getHeaderStyle(themeToken: any): CSSProperties {
  return {
    padding: "0 24px",
    background: themeToken.colorBgContainer,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
    position: "sticky",
    top: 0,
    zIndex: 10,
    height: 64,
    lineHeight: "normal",
  };
}

export function getContentStyle(themeToken: any): CSSProperties {
  return {
    margin: 24,
    padding: 24,
    background: themeToken.colorBgContainer,
    borderRadius: themeToken.borderRadius,
    minHeight: 280,
  };
}

export function getStatItemContainerStyle(params: {
  color: string;
  highlight: boolean;
  clickable: boolean;
}): CSSProperties {
  const { color, highlight, clickable } = params;
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: clickable ? "pointer" : "default",
    ...(highlight && {
      background: `${color}10`,
      padding: "4px 10px",
      borderRadius: 6,
    }),
  };
}

export function getStatItemIconStyle(color: string): CSSProperties {
  return { color, display: "flex", alignItems: "center" };
}

export function getStatItemValueStyle(color: string): CSSProperties {
  return { fontSize: 16, color };
}

export const statItemLabelStyle: CSSProperties = {
  fontSize: 11,
};

export function getLogoTitleStyle(params: {
  collapsed: boolean;
  color: string;
}): CSSProperties {
  const { collapsed, color } = params;
  return {
    margin: 0,
    color,
    fontSize: collapsed ? 16 : 18,
  };
}

export function getAvatarStyle(color: string): CSSProperties {
  return {
    cursor: "pointer",
    background: color,
  };
}

export function getStatusTagStyle(size: "small" | "default"): CSSProperties {
  return size === "small"
    ? { fontSize: 11, padding: "0 6px", margin: 0 }
    : { margin: 0 };
}

export function getEventTagStyle(size: "small" | "default"): CSSProperties {
  return size === "small"
    ? { fontSize: 10, padding: "0 4px", margin: 0 }
    : { margin: 0 };
}

export function getStatusBarSegmentStyle(
  value: number,
  total: number,
  color: string,
): CSSProperties {
  return {
    width: `${(value / total) * 100}%`,
    background: color,
  };
}
