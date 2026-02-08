import { createContext } from "react";

export type HeaderMeta = {
  showTime: boolean;
  showLiveStatus: boolean;
  isConnected: boolean;
  lastUpdated: Date | null;
  refresh?: (() => void | Promise<void>) | null;
};

export type HeaderMetaContextValue = {
  meta: HeaderMeta;
  setMeta: (next: Partial<HeaderMeta>) => void;
  setRefresh: (refresh?: (() => void | Promise<void>) | null) => void;
  setLastUpdated: (date: Date | null) => void;
  reset: () => void;
};

export const HeaderMetaContext = createContext<HeaderMetaContextValue | undefined>(
  undefined,
);
