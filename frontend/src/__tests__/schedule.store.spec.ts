import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { defaultLeafId, partTimeDays, weekdayDays, weekdaySlots, weekendDays, weekendSlots } from '@/mocks/schedule'
import { useScheduleStore } from '@/stores/schedule'

describe('schedule store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('defaults to the full-time student schedule', () => {
    const store = useScheduleStore()

    expect(store.selectedLeafId).toBe(defaultLeafId)
    expect(store.currentView.contextLabel).toBe('Informatyka I, semestr 1')
    expect(store.currentView.weekdayDays).toEqual(weekdayDays)
    expect(store.currentView.weekdayDays.map((day) => day.key)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
    ])
    expect(store.currentView.weekdaySlots).toHaveLength(weekdaySlots.length)
    expect(store.currentView.weekendDays).toHaveLength(0)
    expect(store.currentView.weekendSlots).toHaveLength(0)
  })

  it('shows friday to sunday for part-time students', () => {
    const store = useScheduleStore()

    store.selectLeaf('student-part-time-informatyka-2-sem-1')

    expect(store.selectedStudyMode).toBe('part-time')
    expect(store.currentView.weekdayDays).toHaveLength(0)
    expect(store.currentView.weekdaySlots).toHaveLength(0)
    expect(store.currentView.weekendDays).toEqual(partTimeDays)
    expect(store.currentView.weekendDays.map((day) => day.key)).toEqual([
      'friday',
      'saturday',
      'sunday',
    ])
    expect(store.currentView.weekendSlots).toHaveLength(weekendSlots.length)
    expect(store.currentView.events.some((event) => event.day === 'friday')).toBe(true)
    expect(store.currentView.events.some((event) => event.day === 'saturday')).toBe(true)
    expect(store.currentView.events.some((event) => event.subject === 'Projektowanie aplikacji')).toBe(true)
  })

  it('shows the full monday to sunday layout for teachers', () => {
    const store = useScheduleStore()

    store.selectLeaf('teacher-jan-kowalski')

    expect(store.selectedAudience).toBe('teacher')
    expect(store.currentView.weekdayDays).toEqual(weekdayDays)
    expect(store.currentView.weekdaySlots).toHaveLength(weekdaySlots.length)
    expect(store.currentView.weekendDays).toEqual(weekendDays)
    expect(store.currentView.weekendSlots).toHaveLength(weekendSlots.length)
    expect(store.currentView.events.some((event) => event.day === 'saturday')).toBe(true)
  })
})
