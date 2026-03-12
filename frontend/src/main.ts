import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './styles/main.css'
import './styles/schedule.css'
import { initializeApiWithClientStore } from '@/api/client'

// Bootstrap function for application initialization
async function bootstrap() {
  console.log('[Bootstrap] Starting application...')
  
  const app = createApp(App)
  
  // Setup Pinia before client store initialization
  app.use(createPinia())
  app.use(router)
  
  try {
    // Initialize client store and API client
    await initializeApiWithClientStore()
    console.log('[Bootstrap] Client store and API client initialized successfully')
  } catch (error) {
    console.error('[Bootstrap] Failed to initialize client store:', error)
    // Continue anyway - application should still work
  }
  
  // Mount the app
  app.mount('#app')
  
  console.log('[Bootstrap] Application mounted successfully')
}

// Start the application
bootstrap().catch((error) => {
  console.error('[Bootstrap] Critical error during application startup:', error)
})
