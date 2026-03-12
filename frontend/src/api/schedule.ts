import { apiClient } from './client';
import type { 
  ApiResponse, 
  ScheduleEvent, 
  SyncStatusDto, 
  SubjectDto 
} from './types';
import { APP_CONSTANTS } from '@/core/config';

/**
 * Schedule API client
 * Handles all schedule-related API calls
 */
export class ScheduleApiClient {
  
  /**
   * Get all schedule events
   * Note: This endpoint has side effects - marks pending changes as dismissed after fetch
   */
  async getEvents(): Promise<ApiResponse<ScheduleEvent[]>> {
    console.log('[ScheduleAPI] Fetching schedule events...');
    
    const response = await apiClient.get<ScheduleEvent[]>(
      APP_CONSTANTS.ENDPOINTS.SCHEDULE.EVENTS
    );
    
    if (response.success) {
      console.log('[ScheduleAPI] Fetched', response.data?.length || 0, 'events');
    } else {
      console.error('[ScheduleAPI] Failed to fetch events:', response.error?.message)
    }
    
    return response;
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus(): Promise<ApiResponse<SyncStatusDto>> {
    console.log('[ScheduleAPI] Fetching sync status...');
    
    const response = await apiClient.get<SyncStatusDto>(
      APP_CONSTANTS.ENDPOINTS.SCHEDULE.SYNC_STATUS
    );
    
    if (response.success) {
      console.log('[ScheduleAPI] Sync status:', response.data);
    } else {
      console.error('[ScheduleAPI] Failed to fetch sync status:', response.error?.message)
    }
    
    return response;
  }

  /**
   * Trigger manual synchronization
   */
  async triggerSync(): Promise<ApiResponse<void>> {
    console.log('[ScheduleAPI] Triggering manual sync...');
    
    const response = await apiClient.post<void>(
      APP_CONSTANTS.ENDPOINTS.SCHEDULE.SYNC_TRIGGER
    );
    
    if (response.success) {
      console.log('[ScheduleAPI] Manual sync triggered successfully');
    } else {
      console.error('[ScheduleAPI] Failed to trigger sync:', response.error?.message)
    }
    
    return response;
  }

  /**
   * Dismiss all pending changes (mark as read)
   */
  async dismissChanges(): Promise<ApiResponse<void>> {
    console.log('[ScheduleAPI] Dismissing all changes...');
    
    const response = await apiClient.post<void>(
      APP_CONSTANTS.ENDPOINTS.SCHEDULE.CHANGES_DISMISS
    );
    
    if (response.success) {
      console.log('[ScheduleAPI] All changes dismissed');
    } else {
      console.error('[ScheduleAPI] Failed to dismiss changes:', response.error?.message)
    }
    
    return response;
  }

  /**
   * Get all available subjects
   */
  async getSubjects(): Promise<ApiResponse<SubjectDto[]>> {
    console.log('[ScheduleAPI] Fetching subjects...');
    
    const response = await apiClient.get<SubjectDto[]>(
      APP_CONSTANTS.ENDPOINTS.SCHEDULE.SUBJECTS
    );
    
    if (response.success) {
      console.log('[ScheduleAPI] Fetched', response.data?.length || 0, 'subjects');
    } else {
      console.error('[ScheduleAPI] Failed to fetch subjects:', response.error?.message)
    }
    
    return response;
  }

  /**
   * Get detailed schedule entries for a specific subject
   * @param subjectId - ID of the subject
   * @param filters - Optional filters (types, groups, studyCourseId, semester)
   */
  async getSubjectEntries(
    subjectId: number, 
    filters?: {
      types?: string[];
      groups?: number[];
      studyCourseId?: number;
      semester?: number;
    }
  ): Promise<ApiResponse<any>> { // TODO: Add SubjectScheduleResponse type
    console.log('[ScheduleAPI] Fetching entries for subject', subjectId, 'with filters:', filters);
    
    const endpoint = `${APP_CONSTANTS.ENDPOINTS.SCHEDULE.SUBJECT_ENTRIES}/${subjectId}/entries`;
    const params: Record<string, any> = {};
    
    if (filters?.types?.length) {
      params.types = filters.types.join(',');
    }
    if (filters?.groups?.length) {
      params.groups = filters.groups.join(',');
    }
    if (filters?.studyCourseId) {
      params.studyCourseId = filters.studyCourseId;
    }
    if (filters?.semester) {
      params.semester = filters.semester;
    }
    
    const response = await apiClient.get(endpoint, params);
    
    if (response.success) {
      console.log('[ScheduleAPI] Fetched subject entries successfully');
    } else {
      console.error('[ScheduleAPI] Failed to fetch subject entries:', response.error?.message)
    }
    
    return response;
  }
}

// Default instance
export const scheduleApi = new ScheduleApiClient();