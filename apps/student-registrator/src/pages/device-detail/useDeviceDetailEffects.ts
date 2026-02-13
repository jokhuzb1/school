import { useEffect } from 'react';
import { getDeviceCapabilities, getDeviceConfiguration } from '../../api';
import type { DetailTab } from '../../features/device-detail/types';

export function useDeviceDetailEffects(params: {
  location: { pathname: string; search: string };
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
  usersLoading: boolean;
  usersLength: number;
  openImportWizard: () => Promise<void>;
  autoImportKeyRef: { current: string | null };
  closeSelectedUserDetail: () => void;
  setIsEditingUser: (next: boolean | ((prev: boolean) => boolean)) => void;
  loadUsers: (reset?: boolean) => Promise<void>;
  localDeviceId?: string;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setCapabilities: (next: Record<string, unknown> | null) => void;
  setConfigSnapshot: (next: Record<string, unknown> | null) => void;
  setTimeConfigText: (next: string) => void;
  setNtpConfigText: (next: string) => void;
  setNetworkConfigText: (next: string) => void;
}) {
  const {
    location,
    tab,
    setTab,
    usersLoading,
    usersLength,
    openImportWizard,
    autoImportKeyRef,
    closeSelectedUserDetail,
    setIsEditingUser,
    loadUsers,
    localDeviceId,
    addToast,
    setCapabilities,
    setConfigSnapshot,
    setTimeConfigText,
    setNtpConfigText,
    setNetworkConfigText,
  } = params;

  useEffect(() => {
    const queryTab = new URLSearchParams(location.search).get('tab');
    const allowedTabs: DetailTab[] = ['overview', 'configuration', 'users', 'sync'];
    if (queryTab && allowedTabs.includes(queryTab as DetailTab)) {
      setTab(queryTab as DetailTab);
    }
  }, [location.search, setTab]);

  useEffect(() => {
    if (tab === 'users') {
      closeSelectedUserDetail();
      setIsEditingUser(false);
      void loadUsers(true);
    }
  }, [tab, localDeviceId, closeSelectedUserDetail, loadUsers, setIsEditingUser]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldAutoOpenImport = searchParams.get('import') === '1';
    const key = `${location.pathname}${location.search}`;
    if (!shouldAutoOpenImport) return;
    if (tab !== 'users' || usersLoading || usersLength === 0) return;
    if (autoImportKeyRef.current === key) return;
    autoImportKeyRef.current = key;
    void openImportWizard();
  }, [location.pathname, location.search, tab, usersLoading, usersLength, openImportWizard, autoImportKeyRef]);

  useEffect(() => {
    const loadConfigData = async () => {
      if (tab !== 'configuration' || !localDeviceId) return;
      try {
        const [caps, config] = await Promise.all([
          getDeviceCapabilities(localDeviceId),
          getDeviceConfiguration(localDeviceId),
        ]);
        setCapabilities(caps);
        setConfigSnapshot(config);
        setTimeConfigText(JSON.stringify(config?.time || {}, null, 2));
        setNtpConfigText(JSON.stringify(config?.ntpServers || {}, null, 2));
        setNetworkConfigText(JSON.stringify(config?.networkInterfaces || {}, null, 2));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Configuration yuklashda xato';
        addToast(message, 'error');
      }
    };
    void loadConfigData();
  }, [
    tab,
    localDeviceId,
    addToast,
    setCapabilities,
    setConfigSnapshot,
    setTimeConfigText,
    setNtpConfigText,
    setNetworkConfigText,
  ]);
}
