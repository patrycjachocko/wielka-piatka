<script setup lang="ts">
import WeekendScheduleTable from '@/components/schedule/WeekendScheduleTable.vue'
import WeekdayScheduleTable from '@/components/schedule/WeekdayScheduleTable.vue'
import type { ScheduleViewDto } from '@/types/schedule'

defineProps<{
  view: ScheduleViewDto
}>()
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
          :days="view.weekdayDays"
          :events="view.events"
          :slots="view.weekdaySlots"
        />

        <WeekendScheduleTable
          v-if="view.weekendDays.length > 0"
          :days="view.weekendDays"
          :events="view.events"
          :slots="view.weekendSlots"
        />
      </div>
    </div>
  </section>
</template>
