// API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Helper function to get full URL for assets (photos, etc.)
export const getAssetUrl = (path: string | undefined | null): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}/${path.replace(/^\//, '')}`;
};

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 50;

// Date/Time formats
export const DATE_FORMAT = 'DD MMM, YYYY';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'DD MMM HH:mm';
