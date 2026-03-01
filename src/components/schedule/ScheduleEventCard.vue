<script setup lang="ts">
import type { ScheduleEvent } from '@/types/schedule'

defineProps<{
  event: ScheduleEvent
}>()
</script>

<template>
  <article class="schedule-event-card" :data-testid="`event-${event.id}`">
    <strong class="schedule-event-card__title">{{ event.subject }}</strong>
    <p class="schedule-event-card__meta">Sala: {{ event.room }}</p>
    <p class="schedule-event-card__meta">Prowadzący: {{ event.lecturer }}</p>
    <p v-if="event.groupLabel" class="schedule-event-card__meta">
      Grupa: {{ event.groupLabel }}
    </p>
  </article>
</template>
