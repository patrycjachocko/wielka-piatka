<script setup>
import { ref } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const planName = ref('')
const error = ref('')

function handleConfirm() {
  const trimmed = planName.value.trim()
  if (!trimmed) {
    error.value = 'Nazwa planu jest wymagana'
    return
  }
  emit('confirm', trimmed)
  planName.value = ''
  error.value = ''
}

function handleCancel() {
  planName.value = ''
  error.value = ''
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Overlay -->
      <div class="absolute inset-0 bg-black bg-opacity-50" @click="handleCancel" />

      <!-- Modal -->
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Zapisz plan</h3>

        <label class="block text-sm font-medium text-gray-700 mb-1">Nazwa planu</label>
        <input
          v-model="planName"
          type="text"
          placeholder="np. Moj plan - semestr 4"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 mb-1"
          @keyup.enter="handleConfirm"
          autofocus
        />
        <p v-if="error" class="text-red-500 text-xs mb-3">{{ error }}</p>
        <div v-else class="mb-3" />

        <div class="flex justify-end gap-2">
          <button
            @click="handleCancel"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Anuluj
          </button>
          <button
            @click="handleConfirm"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
