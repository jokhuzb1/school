import React from 'react';
import { Tooltip, Typography } from 'antd';
import { flexRowWrap, statGroupDividerStyle } from './styles';

const { Text } = Typography;

const groupContainerStyle: React.CSSProperties = {
    ...flexRowWrap,
    gap: 16,
};

interface StatItemProps {
    icon: React.ReactNode;
    value: number | string;
    label: string;
    color?: string;
    tooltip?: string;
    highlight?: boolean;
    onClick?: () => void;
}

/**
 * Statistika elementi - Dashboard uslubida
 * Icon + Bold number + Secondary label
 */
const StatItem: React.FC<StatItemProps> = ({
    icon,
    value,
    label,
    color = '#1890ff',
    tooltip,
    highlight = false,
    onClick,
}) => {
    const content = (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: onClick ? 'pointer' : 'default',
                ...(highlight && {
                    background: `${color}10`,
                    padding: '4px 10px',
                    borderRadius: 6,
                }),
            }}
            onClick={onClick}
        >
            <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
            <Text strong style={{ fontSize: 16, color }}>{value}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
        </div>
    );

    if (tooltip) {
        return <Tooltip title={tooltip}>{content}</Tooltip>;
    }

    return content;
};

/**
 * Statistika guruhi - bir nechta StatItem'ni guruhlash uchun
 */
interface StatGroupProps {
    children: React.ReactNode;
    showDividers?: boolean;
}

const StatGroup: React.FC<StatGroupProps> = ({ children, showDividers = true }) => {
    const childArray = React.Children.toArray(children);
    
    return (
        <div style={groupContainerStyle}>
            {childArray.map((child, index) => (
                <React.Fragment key={index}>
                    {child}
                    {showDividers && index < childArray.length - 1 && (
                        <div style={statGroupDividerStyle} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

export { StatItem, StatGroup };
export default StatItem;
