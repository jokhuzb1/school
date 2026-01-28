import React, { useState } from "react";
import {
  Layout as AntLayout,
  Menu,
  Dropdown,
  Avatar,
  Button,
  theme,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSchool } from "../../hooks/useSchool";
import { buildMenuItems } from "./layoutMenu";

const { Header, Sider, Content } = AntLayout;

const headerStyle = {
  padding: "0 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
} as const;
const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: 16,
} as const;
const logoContainerStyle = {
  height: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;
const contentStyle = {
  margin: 24,
  padding: 24,
  minHeight: 280,
} as const;

const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { schoolId: contextSchoolId, isSuperAdmin } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  // URL'dan schoolId ni olish (SuperAdmin maktab panelida bo'lganda)
  const urlSchoolId = location.pathname.match(/\/schools\/([^\/]+)/)?.[1];
  const schoolId = urlSchoolId || contextSchoolId;
  const isViewingSchool = !!urlSchoolId; // SuperAdmin maktab panelini ko'rayaptimi?

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userMenuItems = [
    { key: "profile", label: "Profil", icon: <UserOutlined /> },
    {
      key: "logout",
      label: "Chiqish",
      icon: <LogoutOutlined />,
      onClick: handleLogout,
    },
  ];

  const menuItems = buildMenuItems({
    isSuperAdmin,
    isViewingSchool,
    schoolId,
    role: user?.role,
  });

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
        style={{
          background: themeToken.colorBgContainer,
          borderRight: `1px solid ${themeToken.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            ...logoContainerStyle,
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: themeToken.colorPrimary,
              fontSize: collapsed ? 16 : 18,
            }}
          >
            {collapsed ? "AS" : "Davomat"}
          </h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            background: themeToken.colorBgContainer,
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            ...headerStyle,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={headerRightStyle}>
            <span>
              {isSuperAdmin && !isViewingSchool
                ? "Barcha maktablar"
                : user?.school?.name || "Maktab"}
            </span>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Avatar
                icon={<UserOutlined />}
                style={{
                  cursor: "pointer",
                  background: themeToken.colorPrimary,
                }}
              />
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            background: themeToken.colorBgContainer,
            borderRadius: themeToken.borderRadius,
            ...contentStyle,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
