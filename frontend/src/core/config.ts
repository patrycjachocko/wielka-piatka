// Core application configuration

// Environment variables
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

// Application constants
export const APP_CONSTANTS = {
  // Local storage keys
  CLIENT_ID_KEY: 'wielka-piatka-client-id',
  
  // Polling intervals
  NOTIFICATIONS_POLLING_INTERVAL: 30 * 60 * 1000, // 30 minutes in milliseconds
  
  // API endpoints
  ENDPOINTS: {
    SCHEDULE: {
      EVENTS: '/api/schedule/events',
      SUBJECTS: '/api/schedule/subjects',
      SYNC_STATUS: '/api/schedule/sync/status',
      SYNC_TRIGGER: '/api/schedule/sync/trigger',
      CHANGES_DISMISS: '/api/schedule/changes/dismiss',
      SUBJECT_ENTRIES: '/api/schedule/subject',
    },
    TRACKING: {
      SUBJECTS: '/api/tracking/subjects',
      ADD_SUBJECT: '/api/tracking/subjects/add',
      REMOVE_SUBJECT: '/api/tracking/subjects/remove',
    },
    NOTIFICATIONS: {
      LIST: '/api/notification',
      COUNT: '/api/notification/count',
      READ: '/api/notification',
      READ_ALL: '/api/notification/read-all',
      DELETE_ALL: '/api/notification',
    },
    USER_PLAN: {
      PROFILE: '/api/userplan/profile',
      OVERRIDES: '/api/userplan/overrides',
      OVERRIDES_SINGLE: '/api/userplan/overrides/single',
    },
    CALDAV: {
      CALENDARS: '/caldav/calendars',
      SCHEDULE: '/caldav/schedule.ics',
      MY_SCHEDULE: '/caldav/my',
    },
  },
} as const;

// Utility functions
export function generateClientId(): string {
  // Use crypto.randomUUID if available, fallback to custom implementation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getStoredClientId(): string | null {
  try {
    return localStorage.getItem(APP_CONSTANTS.CLIENT_ID_KEY);
  } catch (error) {
    console.warn('Failed to access localStorage:', error);
    return null;
  }
}

export function setStoredClientId(clientId: string): void {
  try {
    localStorage.setItem(APP_CONSTANTS.CLIENT_ID_KEY, clientId);
  } catch (error) {
    console.warn('Failed to store clientId in localStorage:', error);
  }
}

export function initializeClientId(): string {
  let clientId = getStoredClientId();
  
  if (!clientId) {
    clientId = generateClientId();
    setStoredClientId(clientId);
  }
  
  return clientId;
}