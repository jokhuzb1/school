import React from "react";
import { Card, Space } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import PageHeader, { Divider } from "./PageHeader";
import { StatGroup, StatItem } from "./StatItem";
import { uiGalleryContainerStyle } from "./styles";

const UiGallery: React.FC = () => {
  return (
    <Space direction="vertical" size={16} style={uiGalleryContainerStyle}>
      <Card title="Shared UI – PageHeader + StatItem" size="small">
        <PageHeader showTime showLiveStatus isConnected>
          <StatGroup>
            <StatItem
              icon={<CheckCircleOutlined />}
              label="kelgan"
              value={123}
              color="#52c41a"
            />
            <StatItem
              icon={<ClockCircleOutlined />}
              label="kech"
              value={14}
              color="#fa8c16"
            />
          </StatGroup>
          <Divider />
          <StatItem
            icon={<CheckCircleOutlined />}
            label="umumiy"
            value="137"
            color="#1890ff"
            tooltip="Demo tooltip"
          />
        </PageHeader>
      </Card>
    </Space>
  );
};

export default UiGallery;
