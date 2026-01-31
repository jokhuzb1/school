import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type HeaderMeta = {
  showTime: boolean;
  showLiveStatus: boolean;
  isConnected: boolean;
  lastUpdated: Date | null;
  refresh?: (() => void | Promise<void>) | null;
};

type HeaderMetaContextValue = {
  meta: HeaderMeta;
  setMeta: (next: Partial<HeaderMeta>) => void;
  setRefresh: (refresh?: (() => void | Promise<void>) | null) => void;
  setLastUpdated: (date: Date | null) => void;
  reset: () => void;
};

const defaultMeta: HeaderMeta = {
  showTime: true,
  showLiveStatus: false,
  isConnected: false,
  lastUpdated: null,
  refresh: null,
};

const HeaderMetaContext = createContext<HeaderMetaContextValue | undefined>(
  undefined,
);

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

export const useHeaderMeta = () => {
  const ctx = useContext(HeaderMetaContext);
  if (!ctx) {
    throw new Error("useHeaderMeta must be used within HeaderMetaProvider");
  }
  return ctx;
};
