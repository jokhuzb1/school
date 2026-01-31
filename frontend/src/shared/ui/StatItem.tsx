import React from 'react';
import { Tooltip, Typography } from 'antd';
import {
    flexRowWrap,
    getStatItemContainerStyle,
    getStatItemIconStyle,
    getStatItemValueStyle,
    statGroupDividerStyle,
    statItemLabelStyle,
} from './styles';

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
            style={getStatItemContainerStyle({
                color,
                highlight,
                clickable: Boolean(onClick),
            })}
            onClick={onClick}
        >
            <span style={getStatItemIconStyle(color)}>{icon}</span>
            <Text strong style={getStatItemValueStyle(color)}>{value}</Text>
            <Text type="secondary" style={statItemLabelStyle}>{label}</Text>
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
