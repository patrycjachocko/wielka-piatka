<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'
import TimetableGrid from '../components/TimetableGrid.vue'
import SavePlanModal from '../components/SavePlanModal.vue'

const nauczyciele = ref([])
const selectedNauczyciel = ref(null)
const rozklad = ref([])
const konsultacje = ref([])
const loading = ref(false)
const searchQuery = ref('')
const showSaveModal = ref(false)
const saveMessage = ref('')

onMounted(async () => {
  const { data } = await api.get('/nauczyciele')
  nauczyciele.value = data
})

function filteredNauczyciele() {
  if (!searchQuery.value) return nauczyciele.value
  const q = searchQuery.value.toLowerCase()
  return nauczyciele.value.filter((n) =>
    n.nazwa.toLowerCase().includes(q)
  )
}

async function selectNauczyciel(id) {
  selectedNauczyciel.value = nauczyciele.value.find((n) => n.id === id)
  loading.value = true

  try {
    const [rozkladRes, konsultacjeRes] = await Promise.all([
      api.get(`/rozklad/nauczyciel/${id}`),
      api.get(`/rozklad/nauczyciel/${id}/konsultacje`),
    ])
    rozklad.value = rozkladRes.data
    konsultacje.value = konsultacjeRes.data
  } finally {
    loading.value = false
  }
}

// Merge schedule entries with consultations mapped to the same format
const combinedEntries = computed(() => {
  const konsultacjeAsEntries = konsultacje.value.map((k) => ({
    id: `kon-${k.id}`,
    dzien: k.dzien,
    dzienNazwa: k.dzienNazwa,
    godzina: k.godzina,
    ilosc: k.ilosc || 1,
    czas: k.czas,
    tydzien: 0,
    rodzaj: k.typ === 'D' ? 'Inne' : 'Kon',
    grupa: 0,
    przedmiot: k.typ === 'D' ? 'Inne' : 'Konsultacje',
    przedmiotSkrot: k.typ === 'D' ? 'Inne' : 'Konsultacje',
    nauczyciel: null,
    nauczycielSkrot: null,
    sala: null,
    studia: null,
    semestr: null,
    opis: k.opis,
    typ: k.typ,
  }))
  return [...rozklad.value, ...konsultacjeAsEntries]
})

async function savePlan(name) {
  try {
    await api.post('/schedules', {
      name,
      scheduleType: 'Teacher',
      configuration: {
        idNauczyciela: selectedNauczyciel.value.id,
      },
    })
    showSaveModal.value = false
    saveMessage.value = `Plan "${name}" zostal zapisany!`
    setTimeout(() => { saveMessage.value = '' }, 3000)
  } catch {
    saveMessage.value = 'Blad podczas zapisywania planu'
    setTimeout(() => { saveMessage.value = '' }, 3000)
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Plan nauczyciela</h1>

    <!-- Wyszukiwanie -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-1">Wybierz nauczyciela</label>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Szukaj po nazwisku..."
        class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 mb-2"
      />
      <select
        size="8"
        class="w-full border border-gray-300 rounded-md text-sm"
        @change="selectNauczyciel(Number($event.target.value))"
      >
        <option
          v-for="n in filteredNauczyciele()"
          :key="n.id"
          :value="n.id"
        >
          {{ n.nazwa }}
        </option>
      </select>
    </div>

    <template v-if="selectedNauczyciel">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">
        {{ selectedNauczyciel.nazwa }}
      </h2>

      <div v-if="loading" class="text-center py-8 text-gray-500">Ladowanie...</div>

      <template v-else>
        <TimetableGrid :entries="combinedEntries" :show-study-info="true" />

        <!-- Przycisk zapisu planu -->
        <div v-if="combinedEntries.length > 0" class="mt-4 flex items-center gap-3">
          <button
            @click="showSaveModal = true"
            class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
          >
            Zapisz plan
          </button>
          <span v-if="saveMessage" class="text-sm text-green-700">{{ saveMessage }}</span>
        </div>
      </template>
    </template>

    <SavePlanModal
      :visible="showSaveModal"
      @confirm="savePlan"
      @cancel="showSaveModal = false"
    />
  </div>
</template>
