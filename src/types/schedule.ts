export type AudienceKind = 'student' | 'teacher'
export type StudyMode = 'full-time' | 'part-time'
export type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
export type SlotGroup = 'weekday' | 'weekend'

export interface SidebarLeaf {
  id: string
  label: string
  kind: 'leaf'
  audience: AudienceKind
  studyMode?: StudyMode
  entityType: 'group' | 'teacher'
}

export interface SidebarBranch {
  id: string
  label: string
  kind: 'branch'
  children: SidebarTreeNode[]
  defaultOpen?: boolean
}

export type SidebarTreeNode = SidebarBranch | SidebarLeaf

export interface TimeSlot {
  id: string
  label: string
  slotGroup: SlotGroup
  start: string
  end: string
}

export interface ScheduleEvent {
  id: string
  leafId: string
  day: DayKey
  slotId: string
  subject: string
  room: string
  lecturer: string
  groupLabel?: string
}

export interface ScheduleDayLayout {
  weekdayDays: ScheduleDay[]
  weekendDays: ScheduleDay[]
}

export interface ScheduleViewState extends ScheduleDayLayout {
  selectedLeafId: string
  selectedAudience: AudienceKind
  selectedStudyMode?: StudyMode
}

export interface ScheduleViewDto extends ScheduleDayLayout {
  contextLabel: string
  audience: AudienceKind
  studyMode?: StudyMode
  weekdaySlots: TimeSlot[]
  weekendSlots: TimeSlot[]
  events: ScheduleEvent[]
}

export interface ScheduleDay {
  key: DayKey
  label: string
  slotGroup: SlotGroup
}
