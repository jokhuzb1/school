import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";
import { PageHeader, StatItem, useHeaderMeta } from "../shared/ui";
import { schoolsService } from "../services/schools";
import type { School } from "../types";
import { cameraApi } from "../entities/camera";
import { useNavigate, useLocation } from "react-router-dom";

const { Text } = Typography;

type SchoolCameraStats = {
  schoolId: string;
  total: number;
  online: number;
  offline: number;
};

const CamerasSuperAdmin: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [stats, setStats] = useState<Record<string, SchoolCameraStats>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const backState = { backTo: location.pathname };
  const { setRefresh, setLastUpdated } = useHeaderMeta();

  const load = useCallback(async () => {
    setLoading(true);
    const schoolsData = await schoolsService.getAll("started");
    setSchools(schoolsData);
    const results = await Promise.all(
      schoolsData.map(async (s) => {
        const cams = await cameraApi.getCameras(s.id);
        const online = cams.filter((c) => c.status === "ONLINE").length;
        const offline = cams.filter((c) => c.status === "OFFLINE").length;
        return {
          schoolId: s.id,
          total: cams.length,
          online,
          offline,
        };
      }),
    );
    const map: Record<string, SchoolCameraStats> = {};
    results.forEach((r) => {
      map[r.schoolId] = r;
    });
    setStats(map);
    setLoading(false);
    setLastUpdated(new Date());
  }, [setLastUpdated]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setRefresh(load);
    return () => setRefresh(null);
  }, [load, setRefresh]);

  const totalStats = useMemo(() => {
    const total = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
    const online = Object.values(stats).reduce((sum, s) => sum + s.online, 0);
    const offline = Object.values(stats).reduce((sum, s) => sum + s.offline, 0);
    return { total, online, offline };
  }, [stats]);

  return (
    <div>
      <PageHeader>
        <StatItem
          icon={<VideoCameraOutlined />}
          label="Jami kamera"
          value={totalStats.total}
          color="#1890ff"
        />
        <StatItem label="Online" value={totalStats.online} color="#52c41a" icon={<span />} />
        <StatItem label="Offline" value={totalStats.offline} color="#ff4d4f" icon={<span />} />
      </PageHeader>

      {loading ? null : schools.length === 0 ? (
        <Empty description="Maktab topilmadi" />
      ) : (
        <Row gutter={[12, 12]}>
          {schools.map((s) => {
            const sStats = stats[s.id] || { total: 0, online: 0, offline: 0 };
            return (
              <Col key={s.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  size="small"
                  onClick={() =>
                    navigate(`/schools/${s.id}/cameras`, {
                      state: { ...backState, schoolName: s.name },
                    })
                  }
                >
                  <Space direction="vertical" size={6} style={{ width: "100%" }}>
                    <Text strong>{s.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {s.address || "-"}
                    </Text>
                    <Space>
                      <Tag color="blue">{sStats.total} kamera</Tag>
                      <Tag color="green">{sStats.online} online</Tag>
                      <Tag color="red">{sStats.offline} offline</Tag>
                    </Space>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default CamerasSuperAdmin;
