import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Dropdown, Avatar, Button, theme } from 'antd';
import {
    DashboardOutlined,
    TeamOutlined,
    CalendarOutlined,
    BookOutlined,
    ApiOutlined,
    SettingOutlined,
    BankOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    UserOutlined,
    LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSchool } from '../hooks/useSchool';

const { Header, Sider, Content } = AntLayout;

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
        navigate('/login');
    };

    const userMenuItems = [
        { key: 'profile', label: 'Profile', icon: <UserOutlined /> },
        { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, onClick: handleLogout },
    ];

    // Menu items based on role
    const getMenuItems = () => {
        // SuperAdmin o'z panelida (maktab ko'rmayapti)
        if (isSuperAdmin && !isViewingSchool) {
            return [
                { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
                { key: '/schools', icon: <BankOutlined />, label: 'Maktablar' },
                { key: '/settings', icon: <SettingOutlined />, label: 'Sozlamalar' },
            ];
        }

        // Maktab paneli (SuperAdmin yoki oddiy admin)
        const prefix = schoolId ? `/schools/${schoolId}` : '';
        const items = [
            { key: `${prefix}/dashboard`, icon: <DashboardOutlined />, label: 'Dashboard' },
            { key: `${prefix}/students`, icon: <TeamOutlined />, label: "O'quvchilar" },
            { key: `${prefix}/attendance`, icon: <CalendarOutlined />, label: 'Davomat' },
            { key: `${prefix}/classes`, icon: <BookOutlined />, label: 'Sinflar' },
            { key: `${prefix}/devices`, icon: <ApiOutlined />, label: 'Qurilmalar' },
            { key: `${prefix}/holidays`, icon: <CalendarOutlined />, label: 'Bayramlar' },
            { key: `${prefix}/settings`, icon: <SettingOutlined />, label: 'Sozlamalar' },
        ];
        
        // SuperAdmin uchun "Orqaga" tugmasi
        if (isSuperAdmin && isViewingSchool) {
            items.unshift({ key: '/schools', icon: <BankOutlined />, label: '← Maktablar' });
        }
        
        return items;
    };

    return (
        <AntLayout style={{ minHeight: '100vh' }}>
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
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
                }}>
                    <h2 style={{ margin: 0, color: themeToken.colorPrimary, fontSize: collapsed ? 16 : 18 }}>
                        {collapsed ? 'AS' : 'Attendance'}
                    </h2>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={getMenuItems()}
                    onClick={({ key }) => navigate(key)}
                    style={{ borderRight: 0 }}
                />
            </Sider>
            <AntLayout>
                <Header
                    style={{
                        padding: '0 24px',
                        background: themeToken.colorBgContainer,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
                    }}
                >
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span>{isSuperAdmin && !isViewingSchool ? 'Barcha maktablar' : user?.school?.name || 'Maktab'}</span>
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer', background: themeToken.colorPrimary }} />
                        </Dropdown>
                    </div>
                </Header>
                <Content
                    style={{
                        margin: 24,
                        padding: 24,
                        background: themeToken.colorBgContainer,
                        borderRadius: themeToken.borderRadius,
                        minHeight: 280,
                    }}
                >
                    <Outlet />
                </Content>
            </AntLayout>
        </AntLayout>
    );
};

export default Layout;
