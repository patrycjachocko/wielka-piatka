<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import ScheduleBoard from '@/components/schedule/ScheduleBoard.vue'
import ClientDebugPanel from '@/components/debug/ClientDebugPanel.vue'
import { useScheduleStore } from '@/stores/schedule'

const scheduleStore = useScheduleStore()
const { 
  currentView, 
  isLoading, 
  hasError,
  syncStatus,
  hasChanges,
  pendingChangesCount,
  lastRefreshed
} = storeToRefs(scheduleStore)

// Initialize store on component mount
onMounted(async () => {
  console.log('[SchedulePlannerView] Initializing schedule store...')
  await scheduleStore.initialize()
})

// Handle manual refresh
async function handleRefresh() {
  console.log('[SchedulePlannerView] Manual refresh triggered')
  await scheduleStore.refreshAll()
}

// Handle manual sync
async function handleSync() {
  console.log('[SchedulePlannerView] Manual sync triggered')
  await scheduleStore.triggerSync()
}

// Handle dismiss changes
async function handleDismissChanges() {
  if (hasChanges.value) {
    console.log('[SchedulePlannerView] Dismissing changes')
    await scheduleStore.dismissChanges()
  }
}

// Computed properties for UI
const statusInfo = computed(() => {
  if (isLoading.value) return 'Ładowanie...'
  if (hasError.value) return 'Błąd ładowania'
  if (hasChanges.value) return `${pendingChangesCount.value} zmian`
  return 'Aktualny'
})

const lastRefreshedText = computed(() => {
  if (!lastRefreshed.value) return ''
  return `Ostatnia aktualizacja: ${lastRefreshed.value.toLocaleTimeString()}`
})
</script>

<template>
  <main class="planner-shell" data-testid="layout-shell">
    <section class="planner-sidebar-panel" data-testid="sidebar-panel">
      <header class="planner-panel-header">
        <p class="planner-eyebrow">Wielka Piątka</p>
        <h1 class="planner-title">Plan zajęć</h1>
        <p class="planner-description">
          Interfejs do przeglądania planu zajęć z rzeczywistymi danymi z API.
        </p>
      </header>

      <!-- Client Debug Panel -->
      <ClientDebugPanel />

      <!-- Simplified Schedule Controls (Phase 3) -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Kontrola planu</h3>
        
        <!-- Status -->
        <div class="space-y-2 text-xs mb-4">
          <div class="flex items-center justify-between">
            <span class="text-gray-600">Status:</span>
            <span class="font-medium" 
                  :class="{
                    'text-blue-600': isLoading,
                    'text-red-600': hasError,
                    'text-orange-600': hasChanges,
                    'text-green-600': !isLoading && !hasError && !hasChanges
                  }">
              {{ statusInfo }}
            </span>
          </div>
          
          <div v-if="syncStatus" class="flex items-center justify-between">
            <span class="text-gray-600">Wersja:</span>
            <span class="font-medium">{{ syncStatus.version }}</span>
          </div>
          
          <div v-if="lastRefreshedText" class="text-gray-500 text-xs">
            {{ lastRefreshedText }}
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="flex gap-2">
          <button
            @click="handleRefresh"
            :disabled="isLoading"
            class="text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 py-1 rounded"
          >
            {{ isLoading ? 'Ładowanie...' : 'Odśwież' }}
          </button>
          
          <button
            @click="handleSync"
            :disabled="isLoading"
            class="text-xs bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 py-1 rounded"
          >
            Synchronizuj
          </button>
          
          <button
            v-if="hasChanges"
            @click="handleDismissChanges"
            class="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded"
          >
            Ukryj zmiany ({{ pendingChangesCount }})
          </button>
        </div>
      </div>

      <!-- Placeholder for future navigation (Phase 4) -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <p class="text-sm text-gray-500">
          Nawigacja zostanie dodana w Fazie 4
        </p>
        <p class="text-xs text-gray-400 mt-1">
          Obecnie pokazywany jest ogólny plan zajęć
        </p>
      </div>
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
            Student
          </span>
          <span class="planner-badge planner-badge--muted">
            Poniedziałek-piątek  
          </span>
          <span v-if="isLoading" class="planner-badge planner-badge--loading">
            Ładowanie...
          </span>
          <span v-else-if="hasError" class="planner-badge planner-badge--error">
            Błąd
          </span>
          <span v-else-if="hasChanges" class="planner-badge planner-badge--changes">
            {{ pendingChangesCount }} zmian
          </span>
        </div>
      </header>

      <!-- Error State -->
      <div v-if="hasError && !isLoading" 
           class="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg m-4">
        <div class="text-center">
          <p class="text-red-600 font-medium">Błąd ładowania planu</p>
          <p class="text-red-500 text-sm mt-1">{{ hasError }}</p>
          <button 
            @click="handleRefresh"
            class="mt-3 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>

      <!-- Loading State -->  
      <div v-else-if="isLoading" 
           class="flex items-center justify-center h-64 bg-blue-50 border border-blue-200 rounded-lg m-4">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p class="text-blue-600 font-medium mt-2">Ładowanie planu...</p>
        </div>
      </div>

      <!-- Schedule Board -->
      <ScheduleBoard v-else :view="currentView" />
    </section>
  </main>
</template>

<style scoped>
.planner-badge--loading {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.planner-badge--error {
  background-color: #fef2f2;
  color: #dc2626;
}

.planner-badge--changes {
  background-color: #fef3c7;
  color: #d97706;
}
</style>
