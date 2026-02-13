import React, { useCallback, useMemo, useState } from "react";
import {
  HeaderMetaContext,
  type HeaderMeta,
} from "./HeaderMetaContext";

const defaultMeta: HeaderMeta = {
  showTime: true,
  showLiveStatus: false,
  isConnected: false,
  lastUpdated: null,
  refresh: null,
};

export const HeaderMetaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [meta, setMetaState] = useState<HeaderMeta>(defaultMeta);

  const setMeta = useCallback((next: Partial<HeaderMeta>) => {
    setMetaState((prev) => {
      const updated = { ...prev, ...next };
      const unchanged =
        updated.showTime === prev.showTime &&
        updated.showLiveStatus === prev.showLiveStatus &&
        updated.isConnected === prev.isConnected &&
        updated.lastUpdated === prev.lastUpdated &&
        updated.refresh === prev.refresh;
      return unchanged ? prev : updated;
    });
  }, []);

  const setRefresh = useCallback(
    (refresh?: (() => void | Promise<void>) | null) => {
      setMetaState((prev) => {
        const next = refresh ?? null;
        return prev.refresh === next ? prev : { ...prev, refresh: next };
      });
    },
    [],
  );

  const setLastUpdated = useCallback((date: Date | null) => {
    setMetaState((prev) =>
      prev.lastUpdated === date ? prev : { ...prev, lastUpdated: date },
    );
  }, []);

  const reset = useCallback(() => {
    setMetaState(defaultMeta);
  }, []);

  const value = useMemo(
    () => ({ meta, setMeta, setRefresh, setLastUpdated, reset }),
    [meta, setMeta, setRefresh, setLastUpdated, reset],
  );

  return (
    <HeaderMetaContext.Provider value={value}>
      {children}
    </HeaderMetaContext.Provider>
  );
};

