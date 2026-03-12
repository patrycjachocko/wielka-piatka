<script setup lang="ts">
import { computed } from 'vue'
import WeekendScheduleTable from '@/components/schedule/WeekendScheduleTable.vue'
import WeekdayScheduleTable from '@/components/schedule/WeekdayScheduleTable.vue'
import type { EnhancedScheduleEvent } from '@/stores/schedule'
import type { ScheduleDay, TimeSlot } from '@/types/schedule'

// Simplified view type for Phase 3
interface SimplifiedView {
  contextLabel: string
  events: EnhancedScheduleEvent[]
  weekdayDays: readonly string[]
  weekendDays: readonly string[]
  weekdaySlots: any[]
  weekendSlots: any[]
  audience: string
  studyMode: string
}

const props = defineProps<{
  view: SimplifiedView
}>()

// Convert simple day strings to ScheduleDay structures
const weekdayScheduleDays = computed<ScheduleDay[]>(() => 
  props.view.weekdayDays.map(dayKey => ({
    key: dayKey as any,
    label: getDayLabel(dayKey),
    slotGroup: 'weekday' as const
  }))
)

const weekendScheduleDays = computed<ScheduleDay[]>(() => 
  props.view.weekendDays.map(dayKey => ({
    key: dayKey as any,
    label: getDayLabel(dayKey),
    slotGroup: 'weekend' as const  
  }))
)

// Simple mock slots for Phase 3
const mockWeekdaySlots = computed<TimeSlot[]>(() => [
  { id: 'wd-8', label: '8:00-9:30', slotGroup: 'weekday', start: '08:00', end: '09:30' },
  { id: 'wd-10', label: '10:00-11:30', slotGroup: 'weekday', start: '10:00', end: '11:30' },
  { id: 'wd-12', label: '12:00-13:30', slotGroup: 'weekday', start: '12:00', end: '13:30' },
  { id: 'wd-14', label: '14:00-15:30', slotGroup: 'weekday', start: '14:00', end: '15:30' },
  { id: 'wd-16', label: '16:00-17:30', slotGroup: 'weekday', start: '16:00', end: '17:30' }
])

const mockWeekendSlots = computed<TimeSlot[]>(() => [
  { id: 'we-8', label: '8:00-9:30', slotGroup: 'weekend', start: '08:00', end: '09:30' },
  { id: 'we-10', label: '10:00-11:30', slotGroup: 'weekend', start: '10:00', end: '11:30' },
  { id: 'we-12', label: '12:00-13:30', slotGroup: 'weekend', start: '12:00', end: '13:30' },
  { id: 'we-14', label: '14:00-15:30', slotGroup: 'weekend', start: '14:00', end: '15:30' },
])

function getDayLabel(dayKey: string): string {
  const labels: Record<string, string> = {
    monday: 'Poniedziałek',
    tuesday: 'Wtorek', 
    wednesday: 'Środa',
    thursday: 'Czwartek',
    friday: 'Piątek',
    saturday: 'Sobota',
    sunday: 'Niedziela'
  }
  return labels[dayKey] || dayKey
}
</script>

<template>
  <section class="schedule-board-shell">
    <div class="schedule-board-scroll" data-testid="schedule-board-scroll">
      <div
        class="schedule-board"
        :class="{ 'schedule-board--with-weekend': view.weekendDays.length > 0 }"
        data-testid="schedule-board"
      >
        <WeekdayScheduleTable
          v-if="view.weekdayDays.length > 0"
          :days="weekdayScheduleDays"
          :events="view.events"
          :slots="mockWeekdaySlots"
        />

        <WeekendScheduleTable
          v-if="view.weekendDays.length > 0"
          :days="weekendScheduleDays"
          :events="view.events"
          :slots="mockWeekendSlots"
        />
      </div>
    </div>
  </section>
</template>
