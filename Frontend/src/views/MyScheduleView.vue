<script setup>
import { ref, computed, onActivated, onMounted, onUnmounted, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import api from '../api'
import TimetableGrid from '../components/TimetableGrid.vue'

const savedSchedules = ref([])
const loading = ref(true)
const selectedSchedule = ref(null)
const detailLoading = ref(false)
const deleteConfirmId = ref(null)
const updatedKeysSet = ref(new Set())
const confirmLoading = ref(false)
const simulateLoading = ref(false)
const overrideSaving = ref(false)

// All entries from API (unfiltered) — used for group switching lookups
const allEntries = ref([])
// Base entries (filtered by group selection + isUpdated tagged)
const baseEntries = ref([])

// Override state: saved (in DB) vs local (working copy)
const savedOverrides = ref({})
const localOverrides = ref({})

// ─── Undo / Redo history ───
const history = ref([])      // array of JSON-stringified override snapshots
const historyIndex = ref(-1) // current position in history (-1 = initial state, no edits yet)
const isUndoRedoing = ref(false) // flag to prevent pushHistory during undo/redo

function pushHistory() {
  if (isUndoRedoing.value) return
  // Cut any "future" states if user made a new edit after undoing
  history.value = history.value.slice(0, historyIndex.value + 1)
  // Push a snapshot of the current state
  history.value.push(JSON.stringify(localOverrides.value))
  historyIndex.value = history.value.length - 1
}

function resetHistory() {
  history.value = []
  historyIndex.value = -1
}

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

function undo() {
  if (!canUndo.value) return
  isUndoRedoing.value = true
  historyIndex.value--
  localOverrides.value = JSON.parse(history.value[historyIndex.value])
  isUndoRedoing.value = false
}

function redo() {
  if (!canRedo.value) return
  isUndoRedoing.value = true
  historyIndex.value++
  localOverrides.value = JSON.parse(history.value[historyIndex.value])
  isUndoRedoing.value = false
}

const isDirty = computed(() => {
  return JSON.stringify(localOverrides.value) !== JSON.stringify(savedOverrides.value)
})

const hasUpdates = computed(() => updatedKeysSet.value.size > 0)
const overrideCount = computed(() => Object.keys(localOverrides.value).length)

// Computed display entries: base entries transformed by local overrides
const displayEntries = computed(() => {
  const result = []
  for (const entry of baseEntries.value) {
    const key = `${entry.idPrzedmiotu}_${entry.rodzaj}_${entry.dzien}_${entry.godzina}_${entry.tydzien}_${entry.grupa}`
    const ov = localOverrides.value[key]

    if (!ov) {
      result.push(entry)
      continue
    }

    let modified = { ...entry, _overrideKey: key }

    // Group override: find the new group's data from allEntries
    if (ov.overriddenGroup != null && ov.overriddenGroup !== entry.grupa) {
      const newGroupEntry = allEntries.value.find(e =>
        e.idPrzedmiotu === entry.idPrzedmiotu
        && e.rodzaj === entry.rodzaj
        && e.grupa === ov.overriddenGroup
      )
      if (newGroupEntry) {
        modified._originalGrupa = entry.grupa
        modified._originalTydzien = entry.tydzien
        modified.dzien = newGroupEntry.dzien
        modified.godzina = newGroupEntry.godzina
        modified.ilosc = newGroupEntry.ilosc
        modified.sala = newGroupEntry.sala
        modified.grupa = ov.overriddenGroup
        if (newGroupEntry.czas) modified.czas = newGroupEntry.czas
      } else {
        modified._originalGrupa = entry.grupa
        modified.grupa = ov.overriddenGroup
      }
    }

    // Custom time override (teacher)
    if (ov.customDay != null || ov.customStartSlot != null || ov.customDuration != null) {
      modified._originalDzien = modified._originalDzien ?? modified.dzien
      modified._originalGodzina = modified._originalGodzina ?? modified.godzina
      modified._originalIlosc = modified._originalIlosc ?? modified.ilosc
      modified._originalTydzien = modified._originalTydzien ?? modified.tydzien
      if (ov.customDay != null) modified.dzien = ov.customDay
      if (ov.customStartSlot != null) modified.godzina = ov.customStartSlot
      if (ov.customDuration != null) modified.ilosc = ov.customDuration
    }

    result.push(modified)
  }
  return result
})

// ─── Conflict detection ───
function tygConflicts(a, b) {
  if (a === 0 || b === 0) return true
  return a === b
}

const dayNames = { 1: 'Poniedzialek', 2: 'Wtorek', 3: 'Sroda', 4: 'Czwartek', 5: 'Piatek', 6: 'Sobota', 7: 'Niedziela' }
function tygLabel(t) {
  if (t === 1) return 'Tyg. parzyste'
  if (t === 2) return 'Tyg. nieparzyste'
  return 'Co tydzien'
}

function buildEntryKey(e) {
  return e._overrideKey || `${e.idPrzedmiotu}_${e.rodzaj}_${e.dzien}_${e.godzina}_${e.tydzien}_${e.grupa}`
}

function makeConflictPairId(keyA, keyB) {
  return keyA < keyB ? `${keyA}--${keyB}` : `${keyB}--${keyA}`
}

// Ignored conflicts: saved (in DB) vs local (working copy)
const savedIgnoredConflicts = ref([])
const ignoredConflicts = ref([])

const allConflicts = computed(() => {
  const visible = displayEntries.value.filter(e => {
    const key = buildEntryKey(e)
    const ov = localOverrides.value[key]
    return !ov?.hidden
  })
  const found = []
  const conflictKeys = new Set()
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i], b = visible[j]
      if (a.dzien !== b.dzien) continue
      const tyA = a._originalTydzien ?? a.tydzien
      const tyB = b._originalTydzien ?? b.tydzien
      const effTyA = (localOverrides.value[a._overrideKey]?.forceWeekly) ? 0 : tyA
      const effTyB = (localOverrides.value[b._overrideKey]?.forceWeekly) ? 0 : tyB
      if (!tygConflicts(effTyA, effTyB)) continue
      const startA = a.godzina, iloscA = a.ilosc || 1, endA = startA + iloscA
      const startB = b.godzina, iloscB = b.ilosc || 1, endB = startB + iloscB
      if (startA < endB && startB < endA) {
        // Allow perfect overlap (same start + same duration)
        if (startA === startB && iloscA === iloscB) continue
        const keyA = buildEntryKey(a)
        const keyB = buildEntryKey(b)
        const pairId = makeConflictPairId(keyA, keyB)
        conflictKeys.add(keyA)
        conflictKeys.add(keyB)
        found.push({
          pairId,
          keyA,
          keyB,
          dayName: dayNames[a.dzien] || `Dzien ${a.dzien}`,
          timeA: a.czas || `slot ${a.godzina}-${a.godzina + (a.ilosc || 1) - 1}`,
          timeB: b.czas || `slot ${b.godzina}-${b.godzina + (b.ilosc || 1) - 1}`,
          nameA: a.przedmiot || a.przedmiotSkrot || '?',
          nameB: b.przedmiot || b.przedmiotSkrot || '?',
          typeA: a.rodzaj,
          typeB: b.rodzaj,
          groupA: a.grupa,
          groupB: b.grupa,
          weekA: tygLabel(effTyA),
          weekB: tygLabel(effTyB),
        })
      }
    }
  }
  return { list: found, keys: conflictKeys }
})

// Active (non-ignored) conflicts
const conflicts = computed(() => {
  const ignored = new Set(ignoredConflicts.value)
  const activeList = allConflicts.value.list.filter(c => !ignored.has(c.pairId))
  const activeKeys = {}
  for (const c of activeList) {
    activeKeys[c.keyA] = true
    activeKeys[c.keyB] = true
  }
  return { list: activeList, keys: activeKeys }
})

const hasConflicts = computed(() => conflicts.value.list.length > 0)
const conflictKeys = computed(() => conflicts.value.keys)

async function ignoreConflict(pairId) {
  if (!ignoredConflicts.value.includes(pairId)) {
    ignoredConflicts.value = [...ignoredConflicts.value, pairId]
    savedIgnoredConflicts.value = [...ignoredConflicts.value]
    if (selectedSchedule.value) {
      try {
        await api.put(`/schedules/${selectedSchedule.value.id}/overrides`, {
          overrides: localOverrides.value,
          ignoredConflictIds: ignoredConflicts.value,
        })
      } catch (err) {
        console.error('Blad zapisu ignorowanych konfliktow:', err)
      }
    }
  }
}

// ─── Navigation guards (KROK 3) ───
function onBeforeUnload(e) {
  if (isDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

onBeforeRouteLeave(() => {
  if (isDirty.value) {
    return window.confirm('Masz niezapisane zmiany. Czy na pewno chcesz opuścić tę stronę?')
  }
})

onActivated(async () => {
  if (!selectedSchedule.value) {
    await loadSchedules()
  }
})

// ─── API functions ───
async function loadSchedules() {
  loading.value = true
  try {
    const { data } = await api.get('/schedules')
    savedSchedules.value = data
  } finally {
    loading.value = false
  }
}

function buildNaturalKey(e) {
  return `${e.dzien}|${e.godzina}|${e.tydzien}|${e.idNauczyciela}|${e.idSali}|${e.idPrzedmiotu}|${e.rodzaj}|${e.grupa}|${e.idStudiow}|${e.semestr}|${e.idSpecjalnosci}`
}

async function openSchedule(id) {
  detailLoading.value = true
  updatedKeysSet.value = new Set()
  savedOverrides.value = {}
  localOverrides.value = {}
  resetHistory()
  savedIgnoredConflicts.value = []
  ignoredConflicts.value = []
  allEntries.value = []
  baseEntries.value = []
  try {
    const { data } = await api.get(`/schedules/${id}`)
    selectedSchedule.value = data

    // Load overrides
    if (data.overrides) {
      savedOverrides.value = JSON.parse(JSON.stringify(data.overrides))
      localOverrides.value = JSON.parse(JSON.stringify(data.overrides))
    }

    // Initialize history with the loaded state
    history.value = [JSON.stringify(localOverrides.value)]
    historyIndex.value = 0

    // Load ignored conflict IDs
    if (data.ignoredConflictIds && data.ignoredConflictIds.length > 0) {
      savedIgnoredConflicts.value = [...data.ignoredConflictIds]
      ignoredConflicts.value = [...data.ignoredConflictIds]
    }

    const serverUpdatedKeys = new Set(data.updatedKeys || [])
    const config = data.configuration

    if (data.scheduleType === 'Student') {
      const { data: rozklad } = await api.get('/rozklad', {
        params: {
          idStudiow: config.idStudiow,
          semestr: config.semestr,
          idSpec: config.idSpecjalnosci,
        },
      })

      // Keep ALL entries for group-switch lookups
      allEntries.value = rozklad

      // Filter by saved groups and language
      baseEntries.value = rozklad.filter((e) => {
        if (e.rodzaj === 'J' && config.idJezyka && e.idPrzedmiotu !== config.idJezyka) return false
        if (config.grupy && config.grupy[e.rodzaj] !== undefined) return e.grupa === config.grupy[e.rodzaj]
        return true
      }).map((e) => {
        const key = buildNaturalKey(e)
        return { ...e, isUpdated: serverUpdatedKeys.has(key) }
      })
    } else if (data.scheduleType === 'Teacher') {
      const { data: rozklad } = await api.get(`/rozklad/nauczyciel/${config.idNauczyciela}`)
      allEntries.value = rozklad
      baseEntries.value = rozklad.map((e) => {
        const key = buildNaturalKey(e)
        return { ...e, isUpdated: serverUpdatedKeys.has(key) }
      })
    }

    updatedKeysSet.value = serverUpdatedKeys
  } finally {
    detailLoading.value = false
  }
}

async function confirmChanges() {
  if (!selectedSchedule.value) return
  confirmLoading.value = true
  try {
    await api.put(`/schedules/${selectedSchedule.value.id}/confirm`)
    baseEntries.value = baseEntries.value.map((e) => ({ ...e, isUpdated: false }))
    updatedKeysSet.value = new Set()
  } finally {
    confirmLoading.value = false
  }
}

async function simulateUpdate() {
  if (!selectedSchedule.value) return
  simulateLoading.value = true
  try {
    await api.post(`/schedules/${selectedSchedule.value.id}/simulate-update`)
    await openSchedule(selectedSchedule.value.id)
  } finally {
    simulateLoading.value = false
  }
}

function backToList() {
  if (isDirty.value) {
    if (!window.confirm('Masz niezapisane zmiany. Czy na pewno chcesz wrócić?')) return
  }
  selectedSchedule.value = null
  baseEntries.value = []
  allEntries.value = []
  updatedKeysSet.value = new Set()
  savedOverrides.value = {}
  localOverrides.value = {}
  resetHistory()
  savedIgnoredConflicts.value = []
  ignoredConflicts.value = []
}

async function deleteSchedule(id) {
  await api.delete(`/schedules/${id}`)
  deleteConfirmId.value = null
  savedSchedules.value = savedSchedules.value.filter((s) => s.id !== id)
  if (selectedSchedule.value && selectedSchedule.value.id === id) {
    savedOverrides.value = {}
    localOverrides.value = {}
    resetHistory()
    savedIgnoredConflicts.value = []
    ignoredConflicts.value = []
    selectedSchedule.value = null
    baseEntries.value = []
    allEntries.value = []
  }
}

async function exportIcs(id) {
  try {
    const response = await api.get(`/schedules/${id}/export`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'text/calendar;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const disposition = response.headers['content-disposition']
    let filename = 'plan_zajec.ics'
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=["']?([^"';\n]*)/)
      if (match && match[1]) filename = match[1]
    }
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch {
    console.error('Blad podczas eksportu ICS')
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function scheduleTypeLabel(type) {
  return type === 'Student' ? 'Plan studenta' : 'Plan nauczyciela'
}

// ─── Override handling (KROK 3: local-only until Save) ───
function handleOverrideChange(key, override) {
  const newOverrides = { ...localOverrides.value }
  const isNoOp = !override.hidden && !override.overriddenGroup && !override.forceWeekly
    && !override.customDay && !override.customStartSlot && !override.customDuration
  if (isNoOp) {
    delete newOverrides[key]
  } else {
    newOverrides[key] = override
  }
  localOverrides.value = newOverrides
  pushHistory()
}

async function saveOverrides() {
  if (!selectedSchedule.value) return
  overrideSaving.value = true
  try {
    await api.put(`/schedules/${selectedSchedule.value.id}/overrides`, {
      overrides: localOverrides.value,
      ignoredConflictIds: ignoredConflicts.value,
    })
    savedOverrides.value = JSON.parse(JSON.stringify(localOverrides.value))
    savedIgnoredConflicts.value = [...ignoredConflicts.value]
    // Reset history: saved state becomes new baseline
    history.value = [JSON.stringify(localOverrides.value)]
    historyIndex.value = 0
  } catch (err) {
    console.error('Blad zapisu nadpisan:', err)
  } finally {
    overrideSaving.value = false
  }
}

function revertOverrides() {
  localOverrides.value = JSON.parse(JSON.stringify(savedOverrides.value))
  // Reset history: reverted state becomes new baseline
  history.value = [JSON.stringify(localOverrides.value)]
  historyIndex.value = 0
}

// Group lookup from local data (no API call needed)
const dayNamesShort = { 1: 'Pon', 2: 'Wt', 3: 'Sr', 4: 'Czw', 5: 'Pt', 6: 'Sob', 7: 'Ndz' }

function handleRequestGroups(idPrzedmiotu, rodzaj, resolve) {
  const groups = {}
  for (const e of allEntries.value) {
    if (e.idPrzedmiotu === idPrzedmiotu && e.rodzaj === rodzaj && !groups[e.grupa]) {
      groups[e.grupa] = {
        grupa: e.grupa,
        sala: e.sala,
        dzien: e.dzien,
        godzina: e.godzina,
        czas: e.czas || '',
        dzienNazwa: dayNamesShort[e.dzien] || '',
      }
    }
  }
  resolve(Object.values(groups).sort((a, b) => a.grupa - b.grupa))
}
</script>

<template>
  <div>
    <!-- DETAIL VIEW -->
    <template v-if="selectedSchedule">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <button @click="backToList" class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
            &larr; Wroc do listy
          </button>
          <h1 class="text-2xl font-bold text-gray-900">{{ selectedSchedule.name }}</h1>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full"
            :class="selectedSchedule.scheduleType === 'Student' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'">
            {{ scheduleTypeLabel(selectedSchedule.scheduleType) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button @click="exportIcs(selectedSchedule.id)" class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700">
            Eksportuj .ics
          </button>
        </div>
      </div>

      <!-- Toolbar: undo/redo + dirty state + save/revert -->
      <div v-if="!detailLoading" class="mb-3 flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg flex-wrap">
        <!-- Left: Undo / Redo -->
        <button
          @click="undo"
          :disabled="!canUndo"
          class="px-2.5 py-1.5 text-sm font-medium rounded-md border transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="canUndo ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100' : 'bg-gray-50 text-gray-400 border-gray-200'"
          title="Cofnij ostatnia zmiane"
        >
          &#8630; Cofnij
        </button>
        <button
          @click="redo"
          :disabled="!canRedo"
          class="px-2.5 py-1.5 text-sm font-medium rounded-md border transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="canRedo ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100' : 'bg-gray-50 text-gray-400 border-gray-200'"
          title="Ponow ostatnia cofnieta zmiane"
        >
          &#8631; Ponow
        </button>

        <!-- Center: dirty info -->
        <span v-if="isDirty" class="text-amber-800 font-semibold text-sm mx-2">
          Niezapisane zmiany ({{ overrideCount }})
        </span>
        <span v-else-if="overrideCount > 0" class="text-blue-600 text-xs mx-2">
          {{ overrideCount }} zapisanych nadpisan
        </span>

        <!-- Spacer -->
        <span class="flex-1" />

        <!-- Right: Revert + Save -->
        <button
          v-if="isDirty"
          @click="revertOverrides"
          class="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
        >
          Cofnij wszystkie zmiany
        </button>
        <button
          @click="saveOverrides"
          :disabled="overrideSaving || !isDirty"
          class="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-40 transition"
          :class="isDirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500'"
        >
          {{ overrideSaving ? 'Zapisywanie...' : 'Zapisz zmiany' }}
        </button>
      </div>

      <!-- Update notification bar -->
      <div v-if="hasUpdates" class="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
        <span class="text-red-600 font-semibold text-sm">
          Wykryto {{ updatedKeysSet.size }} {{ updatedKeysSet.size === 1 ? 'zmiane' : 'zmian(y)' }} w planie od ostatniego zatwierdzenia.
        </span>
        <button @click="confirmChanges" :disabled="confirmLoading"
          class="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50">
          {{ confirmLoading ? 'Zatwierdzam...' : 'Zatwierdz zmiany' }}
        </button>
        <button @click="simulateUpdate" :disabled="simulateLoading"
          class="ml-auto px-3 py-1.5 bg-gray-300 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-400 disabled:opacity-50"
          title="Debug: Symuluj aktualizacje">
          {{ simulateLoading ? 'Symuluje...' : 'Debug: Symuluj aktualizacje' }}
        </button>
      </div>
      <div v-else-if="!detailLoading" class="mb-4 flex justify-end">
        <button @click="simulateUpdate" :disabled="simulateLoading"
          class="px-3 py-1.5 bg-gray-300 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-400 disabled:opacity-50"
          title="Debug: Symuluj aktualizacje">
          {{ simulateLoading ? 'Symuluje...' : 'Debug: Symuluj aktualizacje' }}
        </button>
      </div>

      <div v-if="detailLoading" class="text-center py-8 text-gray-500">Ladowanie planu...</div>
      <template v-else>
        <!-- Conflict alert -->
        <div v-if="hasConflicts" class="mb-3 p-3 bg-orange-50 border border-orange-300 rounded-lg">
          <div class="text-orange-800 font-semibold text-sm mb-2">
            Wykryto {{ conflicts.list.length }} {{ conflicts.list.length === 1 ? 'konflikt' : 'konflikty' }} czasowe:
          </div>
          <div v-for="c in conflicts.list" :key="c.pairId" class="flex items-start justify-between gap-2 mb-2 last:mb-0 p-2 bg-orange-100/50 rounded">
            <div class="text-xs text-orange-800 flex-1">
              <div class="font-semibold">{{ c.dayName }}</div>
              <div class="mt-0.5">
                <span class="font-medium">{{ c.nameA }}</span>
                <span class="text-orange-600"> ({{ c.typeA }} gr. {{ c.groupA }}, {{ c.weekA }}, {{ c.timeA }})</span>
              </div>
              <div>
                <span class="font-medium">{{ c.nameB }}</span>
                <span class="text-orange-600"> ({{ c.typeB }} gr. {{ c.groupB }}, {{ c.weekB }}, {{ c.timeB }})</span>
              </div>
            </div>
            <button @click="ignoreConflict(c.pairId)" class="flex-shrink-0 px-2 py-1 text-[10px] font-medium text-orange-700 bg-orange-200 rounded hover:bg-orange-300 whitespace-nowrap">
              Ignoruj
            </button>
          </div>
        </div>
        <TimetableGrid
          :entries="displayEntries"
          :show-study-info="selectedSchedule.scheduleType === 'Teacher'"
          :editable="true"
          :overrides="localOverrides"
          :schedule-type="selectedSchedule.scheduleType"
          :conflict-keys="conflictKeys"
          @override-change="handleOverrideChange"
          @request-groups="handleRequestGroups"
        />
      </template>
    </template>

    <!-- LIST VIEW -->
    <template v-else>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Moj plan</h1>

      <div v-if="loading" class="text-center py-8 text-gray-500">Ladowanie zapisanych planow...</div>

      <div v-else-if="savedSchedules.length === 0" class="text-center py-16">
        <div class="text-5xl mb-4">&#128203;</div>
        <h2 class="text-xl font-semibold text-gray-700 mb-2">Brak zapisanych planow</h2>
        <p class="text-gray-500 mb-6">
          Przejdz do zakladki
          <router-link to="/plan-studenta" class="text-blue-600 hover:underline">Plan studenta</router-link>
          lub
          <router-link to="/plan-nauczyciela" class="text-blue-600 hover:underline">Plan nauczyciela</router-link>,
          skonfiguruj swoj plan i kliknij "Zapisz plan".
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="schedule in savedSchedules" :key="schedule.id"
          class="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition">
          <div class="flex items-start justify-between mb-3">
            <h3 class="text-lg font-semibold text-gray-900 truncate pr-2">{{ schedule.name }}</h3>
            <span class="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full"
              :class="schedule.scheduleType === 'Student' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'">
              {{ scheduleTypeLabel(schedule.scheduleType) }}
            </span>
          </div>
          <p class="text-xs text-gray-500 mb-4">Utworzono: {{ formatDate(schedule.createdAt) }}</p>
          <div class="flex gap-2">
            <button @click="openSchedule(schedule.id)" class="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">Otworz</button>
            <button v-if="deleteConfirmId !== schedule.id" @click="deleteConfirmId = schedule.id" class="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100">Usun</button>
            <template v-else>
              <button @click="deleteSchedule(schedule.id)" class="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Potwierdz</button>
              <button @click="deleteConfirmId = null" class="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Nie</button>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
