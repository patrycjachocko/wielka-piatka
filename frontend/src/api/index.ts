// Main API exports
export * from './client';
export * from './types';

// Re-export commonly used elements
export { apiClient } from './client';
export type { 
  ApiResponse, 
  ScheduleEvent, 
  SubjectDto, 
  NotificationDto,
  UserProfileDto,
  SyncStatusDto 
} from './types';