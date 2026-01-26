import React from 'react';
import { Tag } from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    LoginOutlined,
    LogoutOutlined,
} from '@ant-design/icons';
import type { AttendanceStatus, EventType } from '../types';
import dayjs from 'dayjs';

// Status konfiguratsiyasi
const STATUS_CONFIG: Record<AttendanceStatus, { color: string; text: string; icon: React.ReactNode }> = {
    PRESENT: { color: 'green', text: 'Kelgan', icon: <CheckCircleOutlined /> },
    LATE: { color: 'orange', text: 'Kech', icon: <ClockCircleOutlined /> },
    ABSENT: { color: 'red', text: 'Kelmagan', icon: <CloseCircleOutlined /> },
    EXCUSED: { color: 'gray', text: 'Sababli', icon: <ExclamationCircleOutlined /> },
};

interface StatusTagProps {
    status: AttendanceStatus;
    showIcon?: boolean;
    time?: string | null;
    size?: 'small' | 'default';
}

/**
 * Davomat status tag'i - Standart dizayn
 */
const StatusTag: React.FC<StatusTagProps> = ({
    status,
    showIcon = true,
    time,
    size = 'default',
}) => {
    const config = STATUS_CONFIG[status];
    if (!config) return <Tag>-</Tag>;

    const timeStr = time ? dayjs(time).format('HH:mm') : '';
    const style = size === 'small' ? { fontSize: 11, padding: '0 6px', margin: 0 } : { margin: 0 };

    return (
        <Tag color={config.color} icon={showIcon ? config.icon : undefined} style={style}>
            {config.text}
            {timeStr && ` (${timeStr})`}
        </Tag>
    );
};

// Event type konfiguratsiyasi
const EVENT_CONFIG: Record<EventType, { color: string; text: string; icon: React.ReactNode }> = {
    IN: { color: 'success', text: 'KIRDI', icon: <LoginOutlined /> },
    OUT: { color: 'processing', text: 'CHIQDI', icon: <LogoutOutlined /> },
};

interface EventTagProps {
    eventType: EventType;
    showIcon?: boolean;
    size?: 'small' | 'default';
}

/**
 * Event type tag'i (IN/OUT)
 */
const EventTag: React.FC<EventTagProps> = ({
    eventType,
    showIcon = true,
    size = 'default',
}) => {
    const config = EVENT_CONFIG[eventType];
    if (!config) return <Tag>-</Tag>;

    const style = size === 'small' ? { fontSize: 10, padding: '0 4px', margin: 0 } : { margin: 0 };

    return (
        <Tag color={config.color} icon={showIcon ? config.icon : undefined} style={style}>
            {eventType}
        </Tag>
    );
};

// Status colors export (boshqa joylarda ishlatish uchun)
export const statusColors: Record<AttendanceStatus, string> = {
    PRESENT: '#52c41a',
    LATE: '#faad14',
    ABSENT: '#ff4d4f',
    EXCUSED: '#8c8c8c',
};

export { StatusTag, EventTag, STATUS_CONFIG, EVENT_CONFIG };
export default StatusTag;
