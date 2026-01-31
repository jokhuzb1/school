import type { MenuProps } from "antd";
import {
  ApiOutlined,
  BankOutlined,
  BookOutlined,
  CalendarOutlined,
  DashboardOutlined,
  SettingOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  LeftOutlined,
} from "@ant-design/icons";

export type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "GUARD";

export function buildMenuItems(params: {
  isSuperAdmin: boolean;
  isViewingSchool: boolean;
  schoolId?: string | null;
  role?: UserRole | null;
  backTo?: string;
}): MenuProps["items"] {
  const { isSuperAdmin, isViewingSchool, schoolId, role, backTo } = params;

  // SuperAdmin o'z panelida (maktab ko'rmayapti)
  if (isSuperAdmin && !isViewingSchool) {
    return [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "Boshqaruv" },
      { key: "/schools", icon: <BankOutlined />, label: "Maktablar" },
      { key: "/cameras", icon: <VideoCameraOutlined />, label: "Kameralar" },
      { key: "/settings", icon: <SettingOutlined />, label: "Sozlamalar" },
    ];
  }

  // Maktab paneli (SuperAdmin yoki oddiy admin/teacher/guard)
  const prefix = schoolId ? `/schools/${schoolId}` : "";

  // Base items for all school users
  const items: MenuProps["items"] = [
    {
      key: `${prefix}/dashboard`,
      icon: <DashboardOutlined />,
      label: "Boshqaruv",
    },
    {
      key: `${prefix}/students`,
      icon: <TeamOutlined />,
      label: "O'quvchilar",
    },
    {
      key: `${prefix}/attendance`,
      icon: <CalendarOutlined />,
      label: "Davomat",
    },
    { key: `${prefix}/classes`, icon: <BookOutlined />, label: "Sinflar" },
    {
      key: `${prefix}/cameras`,
      icon: <VideoCameraOutlined />,
      label: "Kameralar",
    },
  ];

  // GUARD: read-only monitoring, no write/admin features
  if (role === "GUARD") {
    items.push({
      key: `${prefix}/devices`,
      icon: <ApiOutlined />,
      label: "Qurilmalar",
    });
  }

  // TEACHER: read assigned classes, no device/holiday/settings
  if (role === "TEACHER") {
    // teacher sees dashboard, students (own classes), attendance (own), classes (own)
    // no devices, holidays, settings
  }

  // SCHOOL_ADMIN: full access
  if (role === "SCHOOL_ADMIN" || isSuperAdmin) {
    items.push({
      key: `${prefix}/devices`,
      icon: <ApiOutlined />,
      label: "Qurilmalar",
    });
    items.push({
      key: `${prefix}/holidays`,
      icon: <CalendarOutlined />,
      label: "Bayramlar",
    });
    items.push({
      key: `${prefix}/users`,
      icon: <TeamOutlined />,
      label: "Xodimlar",
    });
    items.push({
      key: `${prefix}/settings`,
      icon: <SettingOutlined />,
      label: "Sozlamalar",
    });
  }

  // SuperAdmin uchun "Orqaga" tugmasi
  if (isSuperAdmin && isViewingSchool) {
    items.unshift({
      key: backTo || "/schools",
      icon: <LeftOutlined />,
      label: "Ortga",
    });
  }

  return items;
}
