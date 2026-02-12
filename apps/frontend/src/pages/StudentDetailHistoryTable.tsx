import React from "react";
import { Card, Table } from "antd";
import type { DailyAttendance } from "@shared/types";
import { buildStudentAttendanceColumns } from "./studentDetail.utils";

type StudentDetailHistoryTableProps = {
  filteredAttendance: DailyAttendance[];
  onRowClick: (record: DailyAttendance) => void;
};

export const StudentDetailHistoryTable: React.FC<StudentDetailHistoryTableProps> = ({
  filteredAttendance,
  onRowClick,
}) => (
  <Card title="Davomat Tarixi" size="small" style={{ borderRadius: 8, border: "1px solid #f0f0f0" }}>
    <Table
      dataSource={filteredAttendance}
      columns={buildStudentAttendanceColumns()}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 20 }}
      onRow={(record) => ({
        onClick: () => onRowClick(record),
        style: { cursor: "pointer" },
      })}
    />
  </Card>
);
