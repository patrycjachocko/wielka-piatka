<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Nawigacja -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <RouterLink to="/" class="text-xl font-bold text-blue-700">
            Plan Zajec WI PB
          </RouterLink>
          <div class="flex items-center space-x-1">
            <RouterLink
              to="/plan-studenta"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              active-class="bg-blue-100 text-blue-700"
            >
              Plan studenta
            </RouterLink>
            <RouterLink
              to="/plan-nauczyciela"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              active-class="bg-blue-100 text-blue-700"
            >
              Plan nauczyciela
            </RouterLink>
            <RouterLink
              to="/moj-plan"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              active-class="bg-blue-100 text-blue-700"
            >
              Moj plan
            </RouterLink>
          </div>
        </div>
      </div>
    </nav>

    <!-- Tresc -->
    <main class="max-w-7xl mx-auto px-4 py-6">
      <RouterView v-slot="{ Component }">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
  </div>
</template>
