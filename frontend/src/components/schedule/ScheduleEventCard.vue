<script setup lang="ts">
import type { EnhancedScheduleEvent } from '@/stores/schedule'

defineProps<{
  event: EnhancedScheduleEvent
}>()
</script>

<template>
  <article 
    class="schedule-event-card" 
    :class="{
      'schedule-event-card--added': event.visualStatus === 'added',
      'schedule-event-card--removed': event.visualStatus === 'removed',
      'schedule-event-card--normal': event.visualStatus === 'normal'
    }"
    :data-testid="`event-${event.id}`"
  >
    <!-- Change indicator -->
    <div v-if="event.visualStatus !== 'normal'" class="schedule-event-card__indicator">
      <span v-if="event.visualStatus === 'added'" class="text-green-600 text-xs font-bold">
        + DODANO
      </span>
      <span v-else-if="event.visualStatus === 'removed'" class="text-red-600 text-xs font-bold">
        - USUNIĘTO  
      </span>
    </div>
    
    <strong class="schedule-event-card__title">{{ event.subject }}</strong>
    <p class="schedule-event-card__meta">Sala: {{ event.room }}</p>
    <p class="schedule-event-card__meta">Prowadzący: {{ event.lecturer }}</p>
    <p v-if="event.groupLabel" class="schedule-event-card__meta">
      Grupa: {{ event.groupLabel }}
    </p>
  </article>
</template>

<style scoped>
.schedule-event-card--added {
  border-color: #10b981;
  background-color: #ecfdf5;
}

.schedule-event-card--removed {
  border-color: #f87171;
  background-color: #fef2f2;
  opacity: 0.75;
}

.schedule-event-card--normal {
  /* Default styling - no additional classes needed */
}

.schedule-event-card__indicator {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
}
</style>
