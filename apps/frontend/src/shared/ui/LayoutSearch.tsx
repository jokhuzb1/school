import { Empty, Input, Skeleton, Spin, Typography } from "antd";
import type { ReactNode } from "react";
import type { SearchGroup } from "@shared/types";

const { Text } = Typography;

type LayoutSearchProps = {
  searchValue: string;
  searchLoading: boolean;
  searchGroups: SearchGroup[];
  highlightMatch: (text: string, query: string) => ReactNode;
  onInputChange: (next: string) => void;
  onSelectRoute: (route: string) => void;
};

export function LayoutSearch({
  searchValue,
  searchLoading,
  searchGroups,
  highlightMatch,
  onInputChange,
  onSelectRoute,
}: LayoutSearchProps) {
  return (
    <>
      <Input
        size="small"
        style={{ height: 32, lineHeight: "32px" }}
        allowClear
        placeholder="Qidirish..."
        value={searchValue}
        onChange={(e) => onInputChange(e.target.value)}
        suffix={searchLoading ? <Spin size="small" /> : null}
      />
      {searchValue.trim().length > 0 && (
        <div
          style={{
            position: "absolute",
            marginTop: 6,
            background: "#fff",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
            boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
            width: "100%",
            zIndex: 1000,
            maxHeight: 320,
            overflow: "auto",
            padding: 8,
          }}
        >
          {searchLoading ? (
            <Skeleton active title={false} paragraph={{ rows: 3 }} />
          ) : searchGroups.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            searchGroups.map((group) => (
              <div key={group.key} style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {group.label}
                </Text>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => onSelectRoute(item.route)}
                    >
                      <div>{highlightMatch(item.title, searchValue)}</div>
                      {item.subtitle && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {highlightMatch(item.subtitle, searchValue)}
                        </Text>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
