import React, { useEffect, useRef, useState } from "react";
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
  Spin,
  Input,
  Empty,
  Skeleton,
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
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSchool } from "../../hooks/useSchool";
import { buildMenuItems } from "./layoutMenu";
import { HeaderMetaProvider, useHeaderMeta } from "./HeaderMetaContext";
import {
  fullHeightLayoutStyle,
  getLiveIconStyle,
  getContentStyle,
  getHeaderStyle,
  getLogoContainerStyle,
  getLogoTitleStyle,
  getAvatarStyle,
  getSiderStyle,
  menuNoBorderStyle,
  timeIconStyle,
  timeSubTextStyle,
  timeTextStyle,
  calendarIconStyle,
  liveStatusTextStyle,
} from "./styles";
import dayjs from "dayjs";
import { searchService } from "../../services/search";
import type { SearchGroup } from "../../types";

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

const headerMiddleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  justifyContent: "space-between",
  flex: 1,
} as const;

const headerMetaLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginLeft: 12,
} as const;

const headerSearchWrapStyle = {
  width: 240,
  position: "relative",
} as const;

const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  height: "100%",
} as const;

const headerRightActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
} as const;

const timeStackStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  lineHeight: 1.1,
} as const;

const timeRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
} as const;

const timeSubRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 4,
} as const;

const siderUserWrapStyle = {
  marginTop: "auto",
  padding: "12px 16px",
  borderTop: "1px solid #f0f0f0",
  display: "flex",
  alignItems: "center",
  gap: 12,
} as const;

const siderUserTextStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
} as const;

const roleLabelMap: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "Admin",
  TEACHER: "O'qituvchi",
  GUARD: "Qo'riqchi",
};

type BackState = {
  backTo?: string;
  schoolName?: string;
};
console.log("salom");

const LayoutInner: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { schoolId: contextSchoolId, isSuperAdmin } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();
  const { meta, setLastUpdated } = useHeaderMeta();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [searchValue, setSearchValue] = useState("");
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);
  const lastInputRef = useRef("");

  // URL'dan schoolId ni olish (SuperAdmin maktab panelida bo'lganda)
  const urlSchoolId = location.pathname.match(/\/schools\/([^\/]+)/)?.[1];
  const schoolId = urlSchoolId || contextSchoolId;
  const isViewingSchool = !!urlSchoolId; // SuperAdmin maktab panelini ko'rayaptimi?
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

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return (
      <>
        {before}
        <span style={{ background: "#fff59d", padding: "0 2px" }}>{match}</span>
        {after}
      </>
    );
  };

  useEffect(() => {
    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }
    const trimmed = searchValue.trim();
    if (trimmed.length < 2) {
      setSearchQuery("");
      setSearchGroups([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = window.setTimeout(() => {
      setSearchQuery(trimmed);
    }, 350);
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchValue]);

  useEffect(() => {
    if (!searchQuery) return;
    const requestId = ++searchRequestIdRef.current;
    const run = async () => {
      try {
        const data = await searchService.search(searchQuery);
        if (requestId !== searchRequestIdRef.current) return;
        setSearchGroups(data.groups || []);
      } catch (err) {
        if (requestId !== searchRequestIdRef.current) return;
        console.error(err);
        setSearchGroups([]);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
        }
      }
    };
    run();
  }, [searchQuery]);

  const searchOptions = searchGroups.map((group) => ({
    label: <Text type="secondary">{group.label}</Text>,
    options: group.items.map((item) => ({
      value: item.route,
      label: (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span>{highlightMatch(item.title, searchValue)}</span>
          {item.subtitle && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {highlightMatch(item.subtitle, searchValue)}
            </Text>
          )}
        </div>
      ),
    })),
  }));

  const userMenuItems = [
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
        <div
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div style={getLogoContainerStyle(themeToken)}>
            <h2
              style={getLogoTitleStyle({
                collapsed,
                color: themeToken.colorPrimary,
              })}
            >
              {collapsed
                ? "AS"
                : isViewingSchool
                  ? backState.schoolName || user?.school?.name || "Maktab"
                  : user?.school?.name || "Dashboard"}
            </h2>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) =>
                isSuperAdmin && isViewingSchool
                  ? navigate(key, { state: backState })
                  : navigate(key)
              }
              style={{ ...menuNoBorderStyle, flex: 1, minHeight: 0 }}
            />
          </div>
          <div
            style={{ ...siderUserWrapStyle, width: "100%", marginTop: "auto" }}
          >
            <Dropdown menu={{ items: userMenuItems }} placement="topLeft">
              <Avatar
                icon={<UserOutlined />}
                style={getAvatarStyle(themeToken.colorPrimary)}
              />
            </Dropdown>
            {!collapsed && (
              <div style={siderUserTextStyle}>
                <Text ellipsis>
                  {isSuperAdmin && !isViewingSchool
                    ? "Barcha maktablar"
                    : user?.school?.name || "Maktab"}
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
              <Input
                size="small"
                style={{ height: 32, lineHeight: "32px" }}
                allowClear
                placeholder="Qidirish..."
                value={searchValue}
                onChange={(e) => {
                  const next = e.target.value;
                  if (lastInputRef.current === next) return;
                  lastInputRef.current = next;
                  setSearchValue(next);
                }}
                suffix={searchLoading ? <Spin size="small" /> : null}
              />
              {searchValue.trim().length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    marginTop: 6,
                    background: "#fff",
                    border: "1px solid #f0f0f0",
                    borderRadius: 6,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
                    width: "100%",
                    zIndex: 1000,
                    maxHeight: 320,
                    overflow: "auto",
                    padding: 8,
                  }}
                >
                  {searchLoading ? (
                    <Skeleton active title={false} paragraph={{ rows: 3 }} />
                  ) : searchOptions.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    searchGroups.map((group) => (
                      <div key={group.key} style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {group.label}
                        </Text>
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setSearchValue("");
                                navigate(item.route);
                              }}
                            >
                              <div>{highlightMatch(item.title, searchValue)}</div>
                              {item.subtitle && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {highlightMatch(item.subtitle, searchValue)}
                                </Text>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={headerMiddleStyle}>
            <div style={headerMetaLeftStyle}>
              {meta.showLiveStatus && (
                <Tooltip
                  title={meta.isConnected ? "Real vaqt ulangan" : "Oflayn"}
                >
                  <Badge
                    status={meta.isConnected ? "success" : "error"}
                    text={
                      <span style={liveStatusTextStyle}>
                        <WifiOutlined
                          style={getLiveIconStyle(meta.isConnected)}
                        />
                        {meta.isConnected ? "Jonli" : "Oflayn"}
                      </span>
                    }
                    style={{ display: "flex", alignItems: "center" }}
                  />
                </Tooltip>
              )}
              {meta.refresh && (
                <div style={headerRightActionsStyle}>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    onClick={handleRefresh}
                    aria-label="Yangilash"
                  />
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
