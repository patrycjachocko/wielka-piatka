import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { scheduleApi } from '@/api/schedule'
import type { 
  ScheduleEvent as ApiScheduleEvent, 
  SyncStatusDto,
  SubjectDto 
} from '@/api/types'

// Loading states
export interface LoadingState {
  isLoading: boolean
  error: string | null
}

// Enhanced event with visual status mapping  
export interface EnhancedScheduleEvent extends ApiScheduleEvent {
  visualStatus: 'normal' | 'added' | 'removed'
}

// Simple view mode for Phase 3 - no complex navigation yet  
export type ViewMode = 'general' | 'filtered'

export const useScheduleStore = defineStore('schedule', () => {
  // Core data state
  const events = ref<EnhancedScheduleEvent[]>([])
  const subjects = ref<SubjectDto[]>([])
  const syncStatus = ref<SyncStatusDto | null>(null)
  
  // Loading states
  const eventsLoading = ref<LoadingState>({ isLoading: false, error: null })
  const syncLoading = ref<LoadingState>({ isLoading: false, error: null })
  const subjectsLoading = ref<LoadingState>({ isLoading: false, error: null })
  
  // Current view (simplified for Phase 3)
  const viewMode = ref<ViewMode>('general')
  const lastRefreshed = ref<Date | null>(null)
  
  // Computed properties
  const isLoading = computed(() => 
    eventsLoading.value.isLoading || 
    syncLoading.value.isLoading || 
    subjectsLoading.value.isLoading
  )
  
  const hasError = computed(() => 
    eventsLoading.value.error || 
    syncLoading.value.error || 
    subjectsLoading.value.error
  )
  
  const hasChanges = computed(() => 
    events.value.some(event => event.changeStatus === 'added' || event.changeStatus === 'removed')
  )
  
  const pendingChangesCount = computed(() => 
    events.value.filter(event => event.changeStatus === 'added' || event.changeStatus === 'removed').length
  )
  
  // Enhanced events with visual status mapping
  const enhancedEvents = computed<EnhancedScheduleEvent[]>(() => 
    events.value.map(event => ({
      ...event,
      visualStatus: mapChangeStatusToVisual(event.changeStatus)
    }))
  )

  // Simple current view for Phase 3 compatibility  
  const currentView = computed(() => ({
    contextLabel: viewMode.value === 'general' ? 'Plan zajęć' : 'Widok filtrowany',
    events: enhancedEvents.value, // Use enhanced events with visual status
    // Temporary simple day/slot structure for compatibility
    weekdayDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const,
    weekendDays: ['saturday', 'sunday'] as const,
    weekdaySlots: [], // TODO: Extract from events or get from API
    weekendSlots: [], // TODO: Extract from events or get from API
    audience: 'student' as const, // Simplified for Phase 3
    studyMode: 'full-time' as const // Simplified for Phase 3
  }))
  
  // Actions
  async function fetchEvents() {
    console.log('[ScheduleStore] Fetching events...')
    eventsLoading.value = { isLoading: true, error: null }
    
    try {
      const response = await scheduleApi.getEvents()
      
      if (response.success && response.data) {
        events.value = response.data.map(enhanceEvent)
        lastRefreshed.value = new Date()
        console.log('[ScheduleStore] Events loaded successfully:', events.value.length)
      } else {
        const errorMsg = response.error?.message || 'Failed to load events'
        eventsLoading.value.error = errorMsg
        console.error('[ScheduleStore] Failed to load events:', errorMsg)
      }
    } catch (error) {
      eventsLoading.value.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ScheduleStore] Error fetching events:', error)
    } finally {
      eventsLoading.value.isLoading = false
    }
  }
  
  async function fetchSyncStatus() {
    console.log('[ScheduleStore] Fetching sync status...')
    syncLoading.value = { isLoading: true, error: null }
    
    try {
      const response = await scheduleApi.getSyncStatus()
      
      if (response.success && response.data) {
        syncStatus.value = response.data
        console.log('[ScheduleStore] Sync status loaded:', syncStatus.value)
      } else {
        const errorMsg = response.error?.message || 'Failed to load sync status'
        syncLoading.value.error = errorMsg
        console.error('[ScheduleStore] Failed to load sync status:', errorMsg)
      }
    } catch (error) {
      syncLoading.value.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ScheduleStore] Error fetching sync status:', error)
    } finally {
      syncLoading.value.isLoading = false
    }
  }
  
  async function fetchSubjects() {
    console.log('[ScheduleStore] Fetching subjects...')
    subjectsLoading.value = { isLoading: true, error: null }
    
    try {
      const response = await scheduleApi.getSubjects()
      
      if (response.success && response.data) {
        subjects.value = response.data
        console.log('[ScheduleStore] Subjects loaded:', subjects.value.length)
      } else {
        const errorMsg = response.error?.message || 'Failed to load subjects'
        subjectsLoading.value.error = errorMsg
        console.error('[ScheduleStore] Failed to load subjects:', errorMsg)
      }
    } catch (error) {
      subjectsLoading.value.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ScheduleStore] Error fetching subjects:', error)
    } finally {
      subjectsLoading.value.isLoading = false
    }
  }
  
  async function triggerSync() {
    console.log('[ScheduleStore] Triggering manual sync...')
    syncLoading.value = { isLoading: true, error: null }
    
    try {
      const response = await scheduleApi.triggerSync()
      
      if (response.success) {
        console.log('[ScheduleStore] Sync triggered successfully')
        // Optionally refresh data after sync
        await Promise.all([fetchEvents(), fetchSyncStatus()])
      } else {
        const errorMsg = response.error?.message || 'Failed to trigger sync'
        syncLoading.value.error = errorMsg
        console.error('[ScheduleStore] Failed to trigger sync:', errorMsg)
      }
    } catch (error) {
      syncLoading.value.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ScheduleStore] Error triggering sync:', error)
    } finally {
      syncLoading.value.isLoading = false
    }
  }
  
  async function dismissChanges() {
    console.log('[ScheduleStore] Dismissing changes...')
    
    try {
      const response = await scheduleApi.dismissChanges()
      
      if (response.success) {
        // Clear change status from local events
        events.value = events.value.map(event => ({
          ...event,
          changeStatus: null
        }))
        console.log('[ScheduleStore] Changes dismissed successfully')
      } else {
        const errorMsg = response.error?.message || 'Failed to dismiss changes'
        console.error('[ScheduleStore] Failed to dismiss changes:', errorMsg)
      }
    } catch (error) {
      console.error('[ScheduleStore] Error dismissing changes:', error)
    }
  }
  
  async function refreshAll() {
    console.log('[ScheduleStore] Refreshing all data...')
    await Promise.all([
      fetchEvents(),
      fetchSyncStatus(),
      fetchSubjects()
    ])
  }
  
  // Helper functions
  function enhanceEvent(event: ApiScheduleEvent): EnhancedScheduleEvent {
    return {
      ...event,
      visualStatus: mapChangeStatusToVisual(event.changeStatus)
    }
  }
  
  // Initialize store
  async function initialize() {
    console.log('[ScheduleStore] Initializing...')
    await refreshAll()
  }
  
  return {
    // State
    events: computed(() => events.value),
    subjects: computed(() => subjects.value),
    syncStatus: computed(() => syncStatus.value),
    
    // Loading states  
    eventsLoading: computed(() => eventsLoading.value),
    syncLoading: computed(() => syncLoading.value),
    subjectsLoading: computed(() => subjectsLoading.value),
    isLoading,
    hasError,
    
    // View state
    viewMode: computed(() => viewMode.value),
    lastRefreshed: computed(() => lastRefreshed.value),
    hasChanges,
    pendingChangesCount,
    
    // Enhanced data
    enhancedEvents,
    currentView, // For compatibility with existing components
    
    // Actions
    fetchEvents,
    fetchSyncStatus,  
    fetchSubjects,
    triggerSync,
    dismissChanges,
    refreshAll,
    initialize,
    
    // Legacy compatibility (temporary)
    selectLeaf: (leafId: string) => {
      console.warn('[ScheduleStore] selectLeaf is deprecated in Phase 3')
    },
    selectedAudience: computed(() => 'student' as const),
    selectedLeafId: computed(() => 'general'),
    selectedStudyMode: computed(() => 'full-time' as const),
    sidebarTree: [] // Empty for Phase 3 - will be replaced in Phase 4
  }
})

/**
 * Map API changeStatus to visual status for UI
 */
function mapChangeStatusToVisual(changeStatus: string | null): 'normal' | 'added' | 'removed' {
  switch (changeStatus) {
    case 'added':
      return 'added'
    case 'removed':  
      return 'removed'
    default:
      return 'normal'
  }
}
