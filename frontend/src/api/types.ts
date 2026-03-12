// Enums corresponding to backend C# enums
export enum AudienceKind {
  STUDENT = 'student',
  TEACHER = 'teacher'
}

export enum StudyMode {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time'
}

export enum DayKey {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

export enum SlotGroup {
  WEEKDAY = 'weekday',
  WEEKEND = 'weekend'
}

// DTO types corresponding to backend models

export interface TimeSlot {
  id: string;
  label: string;
  slotGroup: SlotGroup;
  start: string;
  end: string;
}

export interface ScheduleEvent {
  id: string;
  leafId: string;
  day: DayKey;
  slotId: string;
  subject: string;
  room: string;
  lecturer: string;
  groupLabel: string | null;
  changeStatus: string | null; // "added", "removed", or null
}

export interface NotificationDto {
  id: number;
  message: string;
  createdAt: string; // ISO date string
  isRead: boolean;
  subjectId: number;
  changeType: string;
}

export interface SubjectDto {
  id: number;
  name: string;
  shortName: string;
}

export interface TrackSubjectsRequest {
  clientId: string;
  subjectIds: number[];
}

export interface SyncStatusDto {
  version: number;
  lastSyncedAt: string; // ISO date string
  totalEntries: number;
  pendingChanges: number;
}

// Subject schedule view types

export interface SubjectScheduleEntry {
  id: string;
  day: DayKey;
  slotId: string;
  startHourId: number;
  durationSlots: number;
  type: string; // "W", "ĆW", "L", "PS"
  subjectName: string;
  room: string;
  lecturer: string;
  groupNumber: number;
  weekLabel: string; // "co tydzień", "tydzień I", "tydzień II"
  weekType: number;
  
  // Collision handling
  parallelIndex: number; // position in collision block (0, 1, 2...)
  parallelCount: number; // how many entries overlap (1 = no collision)
  
  // Context
  studyCourseId: number;
  studyCourseName: string;
  specialtyId: number;
  specialtyName: string;
  semester: number;
}

export interface SubjectScheduleResponse {
  subjectId: number;
  subjectName: string;
  availableTypes: string[];
  availableGroups: number[];
  hasConflicts: boolean;
  entries: SubjectScheduleEntry[];
}

// User profile and personalization types

export interface UserProfileDto {
  clientId: string;
  studyCourseId: number;
  specialtyId: number;
  semester: number;
  defaultGroup: number;
}

export interface GroupOverrideDto {
  subjectId: number;
  type: string;
  groupNumber: number;
}

export interface SetOverridesRequest {
  clientId: string;
  overrides: GroupOverrideDto[];
}

// Response wrapper for API calls
export interface ApiError {
  message: string;
  details?: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

// Common request/response patterns used throughout the app
export interface ClientIdRequest {
  clientId: string;
}

export interface CountResponse {
  count: number;
}

// Calendar export related types
export interface CalendarExportInfo {
  name: string;
  description: string;
  url: string;
}

// Loading and error states for UI
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// Common query parameters
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface DateRangeParams {
  from?: string;
  to?: string;
}