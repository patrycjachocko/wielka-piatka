<template>
  <div class="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-4">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
      <span class="inline-block w-2 h-2 rounded-full" 
            :class="clientInfo.isValid ? 'bg-green-500' : 'bg-red-500'"></span>
      Client Debug Panel
    </h3>
    
    <div class="space-y-2 text-xs">
      <!-- Client ID -->
      <div class="flex items-center justify-between">
        <span class="text-gray-600 dark:text-gray-400">Client ID:</span>
        <div class="flex items-center gap-2">
          <code class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
            {{ clientInfo.shortId }}...
          </code>
          <button
            @click="copyClientId"
            class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            title="Copy full ID"
          >
            📋
          </button>
        </div>
      </div>
      
      <!-- Status -->
      <div class="flex items-center justify-between">
        <span class="text-gray-600 dark:text-gray-400">Status:</span>
        <span :class="statusColorClass">
          {{ clientInfo.isInitialized ? 'Initialized' : 'Not initialized' }}
        </span>
      </div>
      
      <!-- Validation -->
      <div class="flex items-center justify-between">
        <span class="text-gray-600 dark:text-gray-400">Valid UUID:</span>
        <span :class="validationColorClass">
          {{ clientInfo.isValid ? 'Yes' : 'No' }}
        </span>
      </div>
      
      <!-- Last checked -->
      <div class="flex items-center justify-between" v-if="clientInfo.lastChecked">
        <span class="text-gray-600 dark:text-gray-400">Last checked:</span>
        <span class="text-gray-700 dark:text-gray-300">
          {{ formatTime(clientInfo.lastChecked) }}
        </span>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="flex gap-2 mt-4">
      <button
        @click="refreshClient"
        class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
      >
        Refresh
      </button>
      <button
        @click="regenerateClient"
        class="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded"
      >
        Regenerate
      </button>
      <button
        @click="clearClient"
        class="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
      >
        Clear
      </button>
    </div>
    
    <!-- Copy notification -->
    <div v-if="showCopyNotification" 
         class="text-xs text-green-600 dark:text-green-400 mt-2">
      Client ID copied to clipboard!
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClientStore } from '@/stores/client'

const clientStore = useClientStore()
const showCopyNotification = ref(false)

// Computed properties
const clientInfo = computed(() => clientStore.clientInfo)

const statusColorClass = computed(() => 
  clientInfo.value.isInitialized 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400'
)

const validationColorClass = computed(() => 
  clientInfo.value.isValid 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400'
)

// Methods
function formatTime(date: Date): string {
  return date.toLocaleTimeString()
}

async function copyClientId() {
  try {
    await navigator.clipboard.writeText(clientStore.clientId)
    showCopyNotification.value = true
    setTimeout(() => {
      showCopyNotification.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy client ID:', error)
  }
}

function refreshClient() {
  clientStore.refresh()
}

function regenerateClient() {
  if (confirm('Are you sure you want to generate a new Client ID? This will affect your saved preferences.')) {
    clientStore.regenerate()
  }
}

function clearClient() {
  if (confirm('Are you sure you want to clear the Client ID? You will lose all saved preferences.')) {
    clientStore.clearClientId()
  }
}
</script>