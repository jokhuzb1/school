/**
 * Mock Module Index
 * Loyihani mock mode-da ishga tushiradi
 */

export * from './data';
export * from './generators';
export * from './services';

// Mock mode tekshirish
export const isMockMode = (): boolean => {
  return import.meta.env.VITE_MOCK_MODE === 'true';
};

console.log('[Mock] Mock mode:', isMockMode() ? 'ENABLED' : 'DISABLED');
