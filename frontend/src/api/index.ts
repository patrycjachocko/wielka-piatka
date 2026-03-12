// Main API exports
export * from './client';
export * from './types';
export * from './schedule';

// Re-export commonly used elements
export { apiClient } from './client';
export { scheduleApi } from './schedule';
export type { 
  ApiResponse, 
  ScheduleEvent, 
  SubjectDto, 
  NotificationDto,
  UserProfileDto,
  SyncStatusDto 
} from './types';