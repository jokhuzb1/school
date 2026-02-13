import React from "react";
import { Button, Card, Col, Empty, Pagination, Row, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import dayjs from "dayjs";
import type { Camera, CameraArea, Nvr } from "@shared/types";
import type { ColumnsType } from "antd/es/table";
import { getStatusBadge } from "../entities/camera";

const { Text } = Typography;

type CamerasTabsProps = {
  loading: boolean;
  filtered: Camera[];
  paged: Camera[];
  snapshotTick: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  canManage: boolean;
  nvrs: Nvr[];
  areas: CameraArea[];
  camerasWithArea: Camera[];
  nvrColumns: ColumnsType<Nvr>;
  areaColumns: ColumnsType<CameraArea>;
  cameraColumns: ColumnsType<Camera>;
  setSelectedCamera: (camera: Camera | null) => void;
  handleDownloadSchoolConfig: () => void;
  openDeployModal: (scope: "nvr" | "school") => void;
  openWebrtcSettings: () => void;
  openNvrDrawer: () => void;
  openAreaDrawer: () => void;
  openCameraDrawer: () => void;
  syncTarget: Nvr | null;
  setSyncTarget: (target: Nvr | null) => void;
  openSyncModal: (nvr?: Nvr) => void;
};

export const CamerasTabs: React.FC<CamerasTabsProps> = ({
  loading,
  filtered,
  paged,
  snapshotTick,
  page,
  pageSize,
  setPage,
  setPageSize,
  activeTab,
  setActiveTab,
  canManage,
  nvrs,
  areas,
  camerasWithArea,
  nvrColumns,
  areaColumns,
  cameraColumns,
  setSelectedCamera,
  handleDownloadSchoolConfig,
  openDeployModal,
  openWebrtcSettings,
  openNvrDrawer,
  openAreaDrawer,
  openCameraDrawer,
  syncTarget,
  setSyncTarget,
  openSyncModal,
}) => {
  const overviewContent = (
    <>
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
                  cover={cam.snapshotUrl ? <img src={`${cam.snapshotUrl}?t=${snapshotTick}`} alt={cam.name} style={{ height: 140, objectFit: "cover" }} /> : null}
                  size="small"
                >
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Text strong>{cam.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{cam.area?.name || "-"}</Text>
                    <Tag color={status.color}>{status.text}</Tag>
                    {cam.lastSeenAt && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Songgi: {dayjs(cam.lastSeenAt).format("DD MMM, HH:mm")}
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
    </>
  );

  const nvrContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Space wrap>
        {canManage && <Button type="primary" onClick={openNvrDrawer}>NVR qo'shish</Button>}
        {canManage && <Button onClick={handleDownloadSchoolConfig}>School Config</Button>}
        {canManage && <Button onClick={() => openDeployModal("school")}>School Deploy</Button>}
        <Button onClick={openWebrtcSettings}>WebRTC sozlama</Button>
      </Space>
      <Table rowKey="id" dataSource={nvrs} columns={nvrColumns} pagination={false} locale={{ emptyText: "NVR topilmadi" }} />
    </Space>
  );

  const areaContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      {canManage && <Button type="primary" onClick={openAreaDrawer}>Hudud qo'shish</Button>}
      <Table rowKey="id" dataSource={areas} columns={areaColumns} pagination={false} locale={{ emptyText: "Hudud topilmadi" }} />
    </Space>
  );

  const cameraContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      {canManage && <Button type="primary" onClick={openCameraDrawer}>Kamera qo'shish</Button>}
      <Table rowKey="id" dataSource={camerasWithArea} columns={cameraColumns} pagination={{ pageSize: 10 }} locale={{ emptyText: "Kamera topilmadi" }} />
    </Space>
  );

  const syncContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Text type="secondary">Manual sync orqali NVR'dan kelgan kamera va hududlar ro'yxatini yuborasiz. JSON formatda bo'lishi kerak.</Text>
      <Space>
        <Select
          placeholder="NVR tanlang"
          style={{ minWidth: 220 }}
          value={syncTarget?.id}
          onChange={(value) => setSyncTarget(nvrs.find((nvr) => nvr.id === value) || null)}
          options={nvrs.map((nvr) => ({ value: nvr.id, label: `${nvr.name} (${nvr.host})` }))}
        />
        <Button onClick={() => openSyncModal(syncTarget || undefined)} disabled={!syncTarget}>JSON kiritish</Button>
      </Space>
    </Space>
  );

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      style={{ marginTop: 12 }}
      items={[
        { key: "overview", label: "Ko'rinish", children: overviewContent },
        { key: "nvrs", label: "NVR", children: nvrContent },
        { key: "areas", label: "Hududlar", children: areaContent },
        { key: "cameras", label: "Kameralar", children: cameraContent },
        { key: "sync", label: "Sync", children: syncContent },
      ]}
    />
  );
};
