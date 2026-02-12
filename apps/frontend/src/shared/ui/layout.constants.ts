export const headerMiddleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  justifyContent: "space-between",
  flex: 1,
} as const;

export const headerMetaLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginLeft: 12,
} as const;

export const headerSearchWrapStyle = {
  width: 240,
  position: "relative",
} as const;

export const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  height: "100%",
} as const;

export const headerRightActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
} as const;

export const timeStackStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  lineHeight: 1.1,
} as const;

export const timeRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
} as const;

export const timeSubRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 4,
} as const;

export const siderUserWrapStyle = {
  marginTop: "auto",
  padding: "12px 16px",
  borderTop: "1px solid #f0f0f0",
  display: "flex",
  alignItems: "center",
  gap: 12,
} as const;

export const siderUserTextStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
} as const;

export const roleLabelMap: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "Admin",
  TEACHER: "O'qituvchi",
  GUARD: "Qo'riqchi",
};

export type BackState = {
  backTo?: string;
  schoolName?: string;
};
