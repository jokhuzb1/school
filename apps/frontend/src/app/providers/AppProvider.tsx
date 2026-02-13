import type { ReactNode } from "react";
import { ConfigProvider, App as AppAntd } from "antd";
import { AuthProvider } from "./auth";

type AppProviderProps = {
  children: ReactNode;
};

export function AppProvider({ children }: AppProviderProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 6,
        },
      }}
    >
      <AppAntd>
        <AuthProvider>{children}</AuthProvider>
      </AppAntd>
    </ConfigProvider>
  );
}
