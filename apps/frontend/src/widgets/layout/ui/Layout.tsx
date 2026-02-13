import React, { useEffect, useState } from "react";
import {
  Layout as AntLayout,
  Menu,
  Dropdown,
  Avatar,
  Button,
  theme,
  Badge,
  Tooltip,
  Typography,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  WifiOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useAuth } from "@entities/auth";
import { useSchool } from "@entities/school";
import { HeaderMetaProvider } from "@shared/ui/HeaderMetaProvider";
import { LayoutSearch } from "@shared/ui/LayoutSearch";
import type { BackState } from "@shared/ui/layout.constants";
import {
  headerLeftStyle,
  headerMetaLeftStyle,
  headerMiddleStyle,
  headerRightActionsStyle,
  headerSearchWrapStyle,
  roleLabelMap,
  siderUserTextStyle,
  siderUserWrapStyle,
  timeRowStyle,
  timeStackStyle,
  timeSubRowStyle,
} from "@shared/ui/layout.constants";
import { buildMenuItems } from "@shared/ui/layoutMenu";
import {
  fullHeightLayoutStyle,
  getAvatarStyle,
  getContentStyle,
  getHeaderStyle,
  getLiveIconStyle,
  getLogoContainerStyle,
  getLogoTitleStyle,
  getSiderStyle,
  liveStatusTextStyle,
  menuNoBorderStyle,
  timeIconStyle,
  timeSubTextStyle,
  timeTextStyle,
  calendarIconStyle,
} from "@shared/ui/styles";
import { useHeaderMeta } from "@shared/ui/useHeaderMeta";
import { useLayoutSearch } from "@shared/ui/useLayoutSearch";

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

const LayoutInner: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { schoolId: contextSchoolId, isSuperAdmin } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();
  const { meta, setLastUpdated } = useHeaderMeta();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const { searchValue, searchGroups, searchLoading, highlightMatch, onSearchInputChange, onSearchItemSelect } =
    useLayoutSearch();

  const urlSchoolId = location.pathname.match(/\/schools\/([^/]+)/)?.[1];
  const schoolId = urlSchoolId || contextSchoolId;
  const isViewingSchool = !!urlSchoolId;
  const backState = (location.state || {}) as BackState;

  useEffect(() => {
    if (!meta.showTime) return;
    const timer = setInterval(() => setCurrentTime(dayjs()), 60000);
    return () => clearInterval(timer);
  }, [meta.showTime]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRefresh = async () => {
    if (!meta.refresh) return;
    const result = meta.refresh();
    if (result instanceof Promise) {
      await result;
    }
    setLastUpdated(new Date());
  };

  const menuItems = buildMenuItems({
    isSuperAdmin,
    isViewingSchool,
    schoolId,
    role: user?.role,
    backTo: backState.backTo,
  });

  return (
    <AntLayout style={fullHeightLayoutStyle}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
        style={getSiderStyle(themeToken)}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={getLogoContainerStyle(themeToken)}>
            <h2 style={getLogoTitleStyle({ collapsed, color: themeToken.colorPrimary })}>
              {collapsed
                ? "AS"
                : isViewingSchool
                  ? backState.schoolName || user?.school?.name || "Maktab"
                  : user?.school?.name || "Dashboard"}
            </h2>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) =>
                isSuperAdmin && isViewingSchool ? navigate(key, { state: backState }) : navigate(key)
              }
              style={{ ...menuNoBorderStyle, flex: 1, minHeight: 0 }}
            />
          </div>
          <div style={{ ...siderUserWrapStyle, width: "100%", marginTop: "auto" }}>
            <Dropdown
              menu={{
                items: [{ key: "logout", label: "Chiqish", icon: <LogoutOutlined />, onClick: handleLogout }],
              }}
              placement="topLeft"
            >
              <Avatar icon={<UserOutlined />} style={getAvatarStyle(themeToken.colorPrimary)} />
            </Dropdown>
            {!collapsed && (
              <div style={siderUserTextStyle}>
                <Text ellipsis>
                  {isSuperAdmin && !isViewingSchool ? "Barcha maktablar" : user?.school?.name || "Maktab"}
                </Text>
                {user?.role && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {roleLabelMap[user.role] || user.role}
                  </Text>
                )}
              </div>
            )}
          </div>
        </div>
      </Sider>

      <AntLayout>
        <Header style={getHeaderStyle(themeToken)}>
          <div style={headerLeftStyle}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <div style={headerSearchWrapStyle}>
              <LayoutSearch
                searchValue={searchValue}
                searchLoading={searchLoading}
                searchGroups={searchGroups}
                highlightMatch={highlightMatch}
                onInputChange={onSearchInputChange}
                onSelectRoute={(route) => onSearchItemSelect(route, navigate)}
              />
            </div>
          </div>
          <div style={headerMiddleStyle}>
            <div style={headerMetaLeftStyle}>
              {meta.showLiveStatus && (
                <Tooltip title={meta.isConnected ? "Real vaqt ulangan" : "Oflayn"}>
                  <Badge
                    status={meta.isConnected ? "success" : "error"}
                    text={
                      <span style={liveStatusTextStyle}>
                        <WifiOutlined style={getLiveIconStyle(meta.isConnected)} />
                        {meta.isConnected ? "Jonli" : "Oflayn"}
                      </span>
                    }
                    style={{ display: "flex", alignItems: "center" }}
                  />
                </Tooltip>
              )}
              {meta.refresh && (
                <div style={headerRightActionsStyle}>
                  <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} aria-label="Yangilash" />
                  {meta.lastUpdated && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Yangilandi: {dayjs(meta.lastUpdated).format("HH:mm:ss")}
                    </Text>
                  )}
                </div>
              )}
            </div>
            {meta.showTime && (
              <div style={timeStackStyle}>
                <div style={timeRowStyle}>
                  <ClockCircleOutlined style={timeIconStyle} />
                  <Text strong style={timeTextStyle}>
                    {currentTime.format("HH:mm")}
                  </Text>
                </div>
                <Text type="secondary" style={timeSubTextStyle}>
                  <span style={timeSubRowStyle}>
                    <CalendarOutlined style={calendarIconStyle} />
                    {currentTime.format("DD MMM, ddd")}
                  </span>
                </Text>
              </div>
            )}
          </div>
        </Header>
        <Content style={getContentStyle(themeToken)}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

const Layout: React.FC = () => (
  <HeaderMetaProvider>
    <LayoutInner />
  </HeaderMetaProvider>
);

export default Layout;
