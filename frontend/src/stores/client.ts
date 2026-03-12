import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

import { 
  initializeClientId, 
  getStoredClientId, 
  setStoredClientId,
  generateClientId 
} from '@/core/config'

export const useClientStore = defineStore('client', () => {
  // Reactive state
  const clientId = ref<string>('')
  const isInitialized = ref(false)
  const lastChecked = ref<Date | null>(null)

  // Computed properties
  const isValidClientId = computed(() => {
    const id = clientId.value
    // UUID v4 format validation (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  })

  const clientInfo = computed(() => ({
    id: clientId.value,
    isValid: isValidClientId.value,
    isInitialized: isInitialized.value,
    lastChecked: lastChecked.value,
    shortId: clientId.value.substring(0, 8) // First 8 characters for display
  }))

  // Actions
  function initialize() {
    try {
      console.log('[ClientStore] Initializing client ID...')
      
      const id = initializeClientId()
      clientId.value = id
      isInitialized.value = true
      lastChecked.value = new Date()
      
      console.log('[ClientStore] Client ID initialized:', id.substring(0, 8) + '...')
      return true
    } catch (error) {
      console.error('[ClientStore] Failed to initialize client ID:', error)
      isInitialized.value = false
      return false
    }
  }

  function regenerate() {
    try {
      console.log('[ClientStore] Regenerating client ID...')
      
      const newId = generateClientId()
      setStoredClientId(newId)
      clientId.value = newId
      lastChecked.value = new Date()
      
      console.log('[ClientStore] New client ID generated:', newId.substring(0, 8) + '...')
      return true
    } catch (error) {
      console.error('[ClientStore] Failed to regenerate client ID:', error)
      return false
    }
  }

  function refresh() {
    try {
      const storedId = getStoredClientId()
      if (storedId && storedId !== clientId.value) {
        clientId.value = storedId
        console.log('[ClientStore] Client ID refreshed from storage')
      }
      lastChecked.value = new Date()
      return true
    } catch (error) {
      console.error('[ClientStore] Failed to refresh client ID:', error)
      return false
    }
  }

  function clearClientId() {
    try {
      localStorage.removeItem('wielka-piatka-client-id')
      clientId.value = ''
      isInitialized.value = false
      lastChecked.value = new Date()
      console.log('[ClientStore] Client ID cleared')
      return true
    } catch (error) {
      console.error('[ClientStore] Failed to clear client ID:', error)
      return false
    }
  }

  // Getters for external usage
  function getCurrentClientId(): string {
    if (!isInitialized.value) {
      initialize()
    }
    return clientId.value
  }

  return {
    // State
    clientId: computed(() => clientId.value),
    isInitialized: computed(() => isInitialized.value),
    lastChecked: computed(() => lastChecked.value),
    
    // Computed
    isValidClientId,
    clientInfo,
    
    // Actions
    initialize,
    regenerate,
    refresh,
    clearClientId,
    getCurrentClientId
  }
})