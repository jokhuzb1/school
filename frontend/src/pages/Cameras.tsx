import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";
import { useSchool } from "../hooks/useSchool";
import { PageHeader, StatItem } from "../shared/ui";
import type { Camera, CameraArea } from "../types";
import { cameraApi, getStatusBadge } from "../entities/camera";
import { CAMERA_SNAPSHOT_REFRESH_MS } from "../config";
import dayjs from "dayjs";

const { Text } = Typography;

const Cameras: React.FC = () => {
  const { schoolId } = useSchool();
  const [areas, setAreas] = useState<CameraArea[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [snapshotTick, setSnapshotTick] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      const [areasData, camerasData] = await Promise.all([
        cameraApi.getAreas(schoolId),
        cameraApi.getCameras(schoolId),
      ]);
      setAreas(areasData);
      setCameras(camerasData);
      setLoading(false);
    };
    load();
  }, [schoolId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotTick((t) => t + 1);
    }, CAMERA_SNAPSHOT_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    return cameras.filter((c) => {
      const areaName = c.area?.name?.toLowerCase() || "";
      const matchesArea =
        selectedAreaId === "__classrooms__"
          ? areaName.includes("sinf")
          : selectedAreaId
            ? c.areaId === selectedAreaId
            : true;
      const matchesSearch = search
        ? c.name.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesArea && matchesSearch;
    });
  }, [cameras, selectedAreaId, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedAreaId, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    const total = cameras.length;
    const online = cameras.filter((c) => c.status === "ONLINE").length;
    const offline = cameras.filter((c) => c.status === "OFFLINE").length;
    return { total, online, offline };
  }, [cameras]);

  return (
    <div>
      <PageHeader>
        <StatItem
          icon={<VideoCameraOutlined />}
          label="Kameralar"
          value={stats.total}
          color="#1890ff"
        />
        <StatItem label="Online" value={stats.online} color="#52c41a" icon={<span />} />
        <StatItem label="Offline" value={stats.offline} color="#ff4d4f" icon={<span />} />
        <Space>
          <Text type="secondary">Hudud:</Text>
          <Select
            allowClear
            size="small"
            placeholder="Barchasi"
            value={selectedAreaId}
            onChange={setSelectedAreaId}
            style={{ width: 200 }}
            options={[
              { value: "__classrooms__", label: "Sinf xonalari" },
              ...areas.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </Space>
        <Input.Search
          allowClear
          size="small"
          placeholder="Kamera qidirish"
          style={{ width: 220 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </PageHeader>

      {loading ? null : filtered.length === 0 ? (
        <Empty description="Kamera topilmadi" />
      ) : (
        <Row gutter={[12, 12]}>
          {paged.map((cam) => {
            const status = getStatusBadge(cam.status);
            return (
              <Col key={cam.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => setSelectedCamera(cam)}
                  cover={
                    cam.snapshotUrl ? (
                      <img
                        src={`${cam.snapshotUrl}?t=${snapshotTick}`}
                        alt={cam.name}
                        style={{ height: 140, objectFit: "cover" }}
                      />
                    ) : null
                  }
                  size="small"
                >
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Text strong>{cam.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {cam.area?.name || "—"}
                    </Text>
                    <Tag color={status.color}>{status.text}</Tag>
                    {cam.lastSeenAt && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        So‘nggi: {dayjs(cam.lastSeenAt).format("DD MMM, HH:mm")}
                      </Text>
                    )}
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
      {filtered.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={filtered.length}
            showSizeChanger
            pageSizeOptions={[8, 16, 24, 48]}
            onChange={(nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            }}
            showTotal={(total) => `Jami: ${total}`}
          />
        </div>
      )}

      <Modal
        open={!!selectedCamera}
        onCancel={() => setSelectedCamera(null)}
        title={selectedCamera?.name}
        footer={null}
        width={720}
      >
        {selectedCamera ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {selectedCamera.snapshotUrl ? (
              <img
                src={`${selectedCamera.snapshotUrl}?t=${snapshotTick}`}
                alt={selectedCamera.name}
                style={{ width: "100%", borderRadius: 6 }}
              />
            ) : null}
            <Text type="secondary">
              Live stream keyinroq integratsiya qilinadi. Hozir snapshot ko‘rinishi.
            </Text>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
};

export default Cameras;
