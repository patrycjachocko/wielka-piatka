<script setup lang="ts">
import { computed } from 'vue'

import ScheduleEventCard from '@/components/schedule/ScheduleEventCard.vue'
import type { DayKey, ScheduleDay, TimeSlot } from '@/types/schedule'
import type { EnhancedScheduleEvent } from '@/stores/schedule'

const props = defineProps<{
  days: ScheduleDay[]
  events: EnhancedScheduleEvent[]
  slots: TimeSlot[]
}>()

const tableStyle = computed(() => ({
  '--schedule-day-count': String(props.days.length),
}))

const eventMap = computed(() => {
  return new Map(props.events.map((event) => [`${event.day}:${event.slotId}`, event]))
})

function getEvent(day: DayKey, slotId: string) {
  return eventMap.value.get(`${day}:${slotId}`)
}
</script>

<template>
  <table class="schedule-table schedule-table--weekday" :style="tableStyle" data-testid="weekday-table">
    <thead>
      <tr>
        <th class="schedule-table__time-header" scope="col">Godzina</th>
        <th v-for="day in days" :key="day.key" class="schedule-table__day-header" scope="col">
          {{ day.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="slot in slots" :key="slot.id">
        <th class="schedule-table__time-cell" scope="row">{{ slot.label }}</th>
        <td
          v-for="day in days"
          :key="`${day.key}-${slot.id}`"
          class="schedule-table__cell"
          :data-cell-id="`${day.key}-${slot.id}`"
        >
          <ScheduleEventCard v-if="getEvent(day.key, slot.id)" :event="getEvent(day.key, slot.id)!" />
        </td>
      </tr>
    </tbody>
  </table>
</template>
