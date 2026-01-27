import React from 'react';
import { Card, Badge, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, WifiOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface PageHeaderProps {
    children: React.ReactNode;
    showTime?: boolean;
    showLiveStatus?: boolean;
    isConnected?: boolean;
    extra?: React.ReactNode;
}

/**
 * Standart sahifa header komponenti - Dashboard uslubida
 * Kompakt Card ichida statistikalar, filter'lar va vaqt ko'rsatadi
 */
const PageHeader: React.FC<PageHeaderProps> = ({
    children,
    showTime = false,
    showLiveStatus = false,
    isConnected = false,
    extra,
}) => {
    const [currentTime, setCurrentTime] = React.useState(dayjs());

    React.useEffect(() => {
        if (!showTime) return;
        const timer = setInterval(() => setCurrentTime(dayjs()), 60000);
        return () => clearInterval(timer);
    }, [showTime]);

    return (
        <Card size="small" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {/* Vaqt */}
                {showTime && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ClockCircleOutlined style={{ fontSize: 16, color: '#1890ff' }} />
                            <Text strong style={{ fontSize: 16 }}>{currentTime.format('HH:mm')}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                <CalendarOutlined style={{ marginRight: 4 }} />
                                {currentTime.format('DD MMM, ddd')}
                            </Text>
                        </div>
                        <Divider />
                    </>
                )}

                {/* Jonli status */}
                {showLiveStatus && (
                    <>
                        <Tooltip title={isConnected ? 'Real vaqt ulangan' : 'Oflayn'}>
                            <Badge
                                status={isConnected ? 'success' : 'error'}
                                text={
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                        <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#ff4d4f' }} />
                                        {isConnected ? 'Jonli' : 'Oflayn'}
                                    </span>
                                }
                            />
                        </Tooltip>
                        <Divider />
                    </>
                )}

                {/* Main content (statistikalar, filterlar) */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                    {children}
                </div>

                {/* Extra content (qo'shimcha tugmalar) */}
                {extra && (
                    <>
                        <Divider />
                        {extra}
                    </>
                )}
            </div>
        </Card>
    );
};

/**
 * Vertikal divider - header ichida
 */
const Divider: React.FC = () => (
    <div style={{ width: 1, height: 24, background: '#e8e8e8' }} />
);

export { PageHeader, Divider };
export default PageHeader;
