<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useTimetableStore } from '../stores/timetable'
import TimetableGrid from '../components/TimetableGrid.vue'
import SavePlanModal from '../components/SavePlanModal.vue'
import api from '../api'

const store = useTimetableStore()

const selectedStudia = ref(null)
const selectedSemestr = ref(null)
const selectedSpec = ref(null)
const selectedGrupy = ref({})
const selectedJezyk = ref(null)
const showSaveModal = ref(false)
const saveMessage = ref('')

onMounted(() => {
  store.fetchStudia()
})

watch(selectedStudia, async (val) => {
  selectedSemestr.value = null
  selectedSpec.value = null
  store.specjalnosci = []
  store.grupy = []
  store.rozklad = []
  selectedGrupy.value = {}
  selectedJezyk.value = null
  if (!val) return
  await store.fetchSemestry(val)
})

watch(selectedSemestr, async (val) => {
  selectedSpec.value = null
  store.grupy = []
  store.rozklad = []
  selectedGrupy.value = {}
  selectedJezyk.value = null
  if (!val || !selectedStudia.value) return
  await store.fetchSpecjalnosci(selectedStudia.value, val)
  // Automatycznie wybierz jeśli jest tylko jedna specjalność
  if (store.specjalnosci.length === 1) {
    selectedSpec.value = store.specjalnosci[0].id
  }
})

watch(selectedSpec, async (val) => {
  if (val === null || !selectedStudia.value || !selectedSemestr.value) return
  selectedJezyk.value = null
  // Pobierz grupy i rozkład równolegle
  await Promise.all([
    store.fetchGrupy(selectedStudia.value, selectedSemestr.value, val),
    store.fetchRozklad(selectedStudia.value, selectedSemestr.value, val),
  ])
  // Ustaw domyślnie grupę 1 dla każdego rodzaju
  const defaults = {}
  store.grupy.forEach((g) => {
    defaults[g.rodzaj] = g.grupy.length > 0 ? g.grupy[0] : 1
  })
  selectedGrupy.value = defaults

  // Auto-wybór domyślnego języka (angielski lub pierwszy dostępny)
  autoSelectJezyk()
})

// Dostępne języki w aktualnym planie (unikalne przedmioty z rodzajem J)
const dostepneJezyki = computed(() => {
  const map = new Map()
  store.rozklad
    .filter((e) => e.rodzaj === 'J')
    .forEach((e) => {
      if (!map.has(e.idPrzedmiotu)) {
        map.set(e.idPrzedmiotu, { id: e.idPrzedmiotu, nazwa: e.przedmiot })
      }
    })
  return Array.from(map.values())
})

// Automatyczny wybór języka: angielski jeśli dostępny, w przeciwnym razie pierwszy
function autoSelectJezyk() {
  const jezyki = dostepneJezyki.value
  if (jezyki.length === 0) return
  const angielski = jezyki.find((j) => j.nazwa.toLowerCase().includes('angielski'))
  selectedJezyk.value = angielski ? angielski.id : jezyki[0].id
}

// Grupy z dynamiczną liczbą grup J w zależności od wybranego języka
const grupyZFiltremJ = computed(() => {
  if (selectedJezyk.value === null) return store.grupy
  return store.grupy.map((g) => {
    if (g.rodzaj !== 'J') return g
    const grupyJezyka = new Set()
    store.rozklad
      .filter((e) => e.rodzaj === 'J' && e.idPrzedmiotu === selectedJezyk.value)
      .forEach((e) => grupyJezyka.add(e.grupa))
    return { ...g, grupy: Array.from(grupyJezyka).sort((a, b) => a - b) }
  })
})

// Aktualizuj wybraną grupę J gdy zmienia się język
watch(selectedJezyk, (val) => {
  if (val === null) return
  const jGrupy = grupyZFiltremJ.value.find((g) => g.rodzaj === 'J')
  if (jGrupy && jGrupy.grupy.length > 0 && !jGrupy.grupy.includes(selectedGrupy.value['J'])) {
    selectedGrupy.value['J'] = jGrupy.grupy[0]
  }
})

// Filtruj wpisy po wybranych grupach i języku (reaktywnie)
const filteredEntries = computed(() => {
  return store.rozklad.filter((e) => {
    // Filtr grupy
    const wybranaGrupa = selectedGrupy.value[e.rodzaj]
    if (wybranaGrupa !== undefined && e.grupa !== wybranaGrupa) return false

    // Filtr języka: jeśli wybrano konkretny język, odrzuć inne przedmioty J
    if (e.rodzaj === 'J' && selectedJezyk.value !== null && e.idPrzedmiotu !== selectedJezyk.value) {
      return false
    }

    return true
  })
})

async function savePlan(name) {
  try {
    await api.post('/schedules', {
      name,
      scheduleType: 'Student',
      configuration: {
        idStudiow: selectedStudia.value,
        semestr: selectedSemestr.value,
        idSpecjalnosci: selectedSpec.value,
        grupy: selectedGrupy.value,
        idJezyka: selectedJezyk.value,
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
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Plan studenta</h1>

    <!-- Selektory -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <!-- Kierunek -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Kierunek</label>
          <select
            v-model="selectedStudia"
            class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option :value="null" disabled>Wybierz kierunek...</option>
            <option v-for="s in store.studia" :key="s.id" :value="s.id">
              {{ s.nazwa }}
            </option>
          </select>
        </div>

        <!-- Semestr -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Semestr</label>
          <select
            v-model="selectedSemestr"
            :disabled="!selectedStudia"
            class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option :value="null" disabled>Wybierz semestr...</option>
            <option v-for="s in store.semestry" :key="s" :value="s">
              Semestr {{ s }}
            </option>
          </select>
        </div>

        <!-- Specjalność -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Specjalność</label>
          <select
            v-model="selectedSpec"
            :disabled="!selectedSemestr || store.specjalnosci.length === 0"
            class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option :value="null" disabled>Wybierz specjalność...</option>
            <option v-for="s in store.specjalnosci" :key="s.id" :value="s.id">
              {{ (s.nazwa && !s.nazwa.startsWith('<ogóln')) ? s.nazwa : 'brak' }}
            </option>
          </select>
        </div>
      </div>

      <!-- Grupy -->
      <div v-if="grupyZFiltremJ.length > 0" class="border-t border-gray-200 pt-4">
        <p class="text-sm font-medium text-gray-700 mb-2">Wybierz grupy:</p>
        <div class="flex flex-wrap gap-4">
          <div v-for="g in grupyZFiltremJ" :key="g.rodzaj" class="flex items-center gap-2">
            <label class="text-sm text-gray-600 font-medium">{{ g.rodzaj }}:</label>
            <select
              v-model="selectedGrupy[g.rodzaj]"
              class="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option v-for="num in g.grupy" :key="num" :value="num">{{ num }}</option>
            </select>
          </div>
        </div>

        <!-- Wybór języka obcego -->
        <div v-if="dostepneJezyki.length > 1" class="mt-3 flex items-center gap-2">
          <label class="text-sm text-gray-600 font-medium">Język obcy:</label>
          <select
            v-model="selectedJezyk"
            class="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option v-for="j in dostepneJezyki" :key="j.id" :value="j.id">{{ j.nazwa }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-8 text-gray-500">
      Ładowanie planu...
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="text-center py-8 text-red-500">
      {{ store.error }}
    </div>

    <!-- Tabela -->
    <TimetableGrid v-else-if="filteredEntries.length > 0" :entries="filteredEntries" />

    <!-- Komunikat gdy nie wybrano jeszcze parametrów -->
    <div v-else-if="!selectedStudia || !selectedSemestr || selectedSpec === null" class="text-center py-8 text-gray-400">
      Wybierz kierunek, semestr i specjalność aby wyświetlić plan zajęć.
    </div>

    <!-- Przycisk zapisu planu (poza łańcuchem v-if) -->
    <div v-if="filteredEntries.length > 0 && !store.loading" class="mt-4 flex items-center gap-3">
      <button
        @click="showSaveModal = true"
        class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
      >
        Zapisz plan
      </button>
      <span v-if="saveMessage" class="text-sm text-green-700">{{ saveMessage }}</span>
    </div>

    <SavePlanModal
      :visible="showSaveModal"
      @confirm="savePlan"
      @cancel="showSaveModal = false"
    />
  </div>
</template>
