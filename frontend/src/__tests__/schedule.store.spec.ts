import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useScheduleStore } from '@/stores/schedule'

describe('schedule store (Phase 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with correct default state', () => {
    const store = useScheduleStore()

    expect(store.currentView.contextLabel).toBe('Plan zajęć')
    expect(store.currentView.audience).toBe('student')
    expect(store.currentView.studyMode).toBe('full-time')
    expect(store.currentView.weekdayDays).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday'
    ])
    expect(store.currentView.weekendDays).toEqual(['saturday', 'sunday'])
    expect(store.events).toEqual([])
  })

  it('has correct loading states', () => {
    const store = useScheduleStore()

    expect(store.isLoading).toBe(false)
    expect(store.hasError).toBe(false)
    expect(store.hasChanges).toBe(false)
    expect(store.pendingChangesCount).toBe(0)
  })

  it('provides legacy compatibility methods', () => {
    const store = useScheduleStore()

    // Legacy methods should exist for compatibility
    expect(typeof store.selectLeaf).toBe('function')
    expect(store.selectedAudience).toBe('student')
    expect(store.selectedLeafId).toBe('general')
    expect(store.selectedStudyMode).toBe('full-time')
    expect(Array.isArray(store.sidebarTree)).toBe(true)
  })
})
