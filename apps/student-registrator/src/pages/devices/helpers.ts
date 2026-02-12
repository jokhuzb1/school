import { BACKEND_URL } from '../../api';
import type { AddToast } from './types';

export const isBackendOnline = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return false;
  const last = new Date(lastSeenAt).getTime();
  if (Number.isNaN(last)) return false;
  return Date.now() - last < 2 * 60 * 60 * 1000;
};

export const formatWebhookUrl = (value?: string) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}`;
    } catch (error: unknown) {
      void error;
      return value;
    }
  }
  if (value.startsWith('/')) return value;
  return `/${value}`;
};

export const getBackendPortLabel = () => {
  try {
    const url = new URL(BACKEND_URL);
    if (url.port) return url.port;
    return url.protocol === 'https:' ? '443' : '80';
  } catch (error: unknown) {
    void error;
    return '';
  }
};

export const maskWebhookValue = (value: string, kind: 'url' | 'secret' | 'header') => {
  if (!value) return '';
  if (kind === 'url') {
    return value.replace(/secret=[^&]+/i, 'secret=***');
  }
  return '****************';
};

export const copyToClipboard = async (value: string, label: string, addToast: AddToast) => {
  try {
    await navigator.clipboard.writeText(value);
    addToast(`${label} nusxalandi`, 'success');
  } catch (error: unknown) {
    void error;
    addToast('Nusxalashda xato', 'error');
  }
};
