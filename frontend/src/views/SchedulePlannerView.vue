<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import ScheduleBoard from '@/components/schedule/ScheduleBoard.vue'
import ScheduleSidebar from '@/components/sidebar/ScheduleSidebar.vue'
import { useScheduleStore } from '@/stores/schedule'

const scheduleStore = useScheduleStore()
const { currentView, selectedAudience, selectedLeafId, selectedStudyMode } = storeToRefs(scheduleStore)

const visibleDaysLabel = computed(() => {
  if (selectedAudience.value === 'teacher') {
    return 'Poniedziałek-niedziela'
  }

  if (selectedStudyMode.value === 'part-time') {
    return 'Piątek-niedziela'
  }

  return 'Poniedziałek-piątek'
})
</script>

<template>
  <main class="planner-shell" data-testid="layout-shell">
    <section class="planner-sidebar-panel" data-testid="sidebar-panel">
      <header class="planner-panel-header">
        <p class="planner-eyebrow">Wielka Piątka</p>
        <h1 class="planner-title">Plan zajęć</h1>
        <p class="planner-description">
          Mockowy interfejs do przeglądania planu zajęć dla studentów i prowadzących.
        </p>
      </header>

      <ScheduleSidebar
        :nodes="scheduleStore.sidebarTree"
        :selected-leaf-id="selectedLeafId"
        @select-leaf="scheduleStore.selectLeaf"
      />
    </section>

    <section class="planner-board-panel" data-testid="board-panel">
      <header class="planner-board-header">
        <div>
          <p class="planner-eyebrow">Aktualny widok</p>
          <h2 class="planner-context" data-testid="context-label">
            {{ currentView.contextLabel }}
          </h2>
        </div>

        <div class="planner-status">
          <span class="planner-badge">
            {{ selectedAudience === 'teacher' ? 'Prowadzący' : 'Student' }}
          </span>
          <span class="planner-badge planner-badge--muted">
            {{ visibleDaysLabel }}
          </span>
        </div>
      </header>

      <ScheduleBoard :view="currentView" />
    </section>
  </main>
</template>
