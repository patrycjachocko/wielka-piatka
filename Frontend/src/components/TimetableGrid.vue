<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  entries: { type: Array, required: true },
  showStudyInfo: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  overrides: { type: Object, default: () => ({}) },
  scheduleType: { type: String, default: 'Student' },
  conflictKeys: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['override-change', 'request-groups'])

const days = [
  { id: 1, name: 'Poniedziałek' },
  { id: 2, name: 'Wtorek' },
  { id: 3, name: 'Środa' },
  { id: 4, name: 'Czwartek' },
  { id: 5, name: 'Piątek' },
  { id: 6, name: 'Sobota' },
  { id: 7, name: 'Niedziela' },
]

const weekdaySlots = [
  '8:30-9:15', '9:15-10:00', '10:15-11:00', '11:00-11:45',
  '12:00-12:45', '12:45-13:30', '14:00-14:45', '14:45-15:30',
  '16:00-16:45', '16:45-17:30', '17:40-18:25', '18:25-19:10',
  '19:20-20:05', '20:05-20:50',
]

const weekendSlots = [
  '8:00-8:45', '8:50-9:35', '9:50-10:35', '10:40-11:25',
  '11:40-12:25', '12:30-13:15', '13:30-14:15', '14:20-15:05',
  '15:10-15:55', '16:00-16:45', '16:50-17:35', '17:40-18:25',
  '18:30-19:15', '19:20-20:05', '20:10-20:55',
]

const typeColors = {
  W:  'bg-yellow-100 border-yellow-400 text-yellow-900',
  C:  'bg-green-100 border-green-400 text-green-900',
  L:  'bg-blue-100 border-blue-400 text-blue-900',
  Ps: 'bg-purple-100 border-purple-400 text-purple-900',
  P:  'bg-orange-100 border-orange-400 text-orange-900',
  S:  'bg-pink-100 border-pink-400 text-pink-900',
  J:  'bg-teal-100 border-teal-400 text-teal-900',
  'Ćw': 'bg-emerald-100 border-emerald-400 text-emerald-900',
  Kon: 'bg-red-50 border-red-400 text-red-900',
  Inne: 'bg-amber-50 border-amber-400 text-amber-900',
}

function getColor(rodzaj) {
  return typeColors[rodzaj] || 'bg-gray-100 border-gray-400 text-gray-900'
}

function getWeekLabel(tyg) {
  if (tyg === 1) return 'Tyg. parzyste'
  if (tyg === 2) return 'Tyg. nieparzyste'
  return ''
}



function buildOverrideKey(entry) {
  return entry._overrideKey || `${entry.idPrzedmiotu}_${entry.rodzaj}_${entry.dzien}_${entry.godzina}_${entry.tydzien}_${entry.grupa}`
}

function getOverride(entry) {
  const key = buildOverrideKey(entry)
  return props.overrides[key] || null
}

function isHidden(entry) {
  return getOverride(entry)?.hidden === true
}

function isForceWeekly(entry) {
  return getOverride(entry)?.forceWeekly === true
}

function hasGroupOverride(entry) {
  return getOverride(entry)?.overriddenGroup != null
}

function hasCustomTime(entry) {
  const ov = getOverride(entry)
  return ov?.customDay != null || ov?.customStartSlot != null
}

function hasConflict(entry) {
  const key = buildOverrideKey(entry)
  return !!props.conflictKeys[key]
}



function getForceWeeklyEndDate(entry) {
  if (!isForceWeekly(entry)) return null
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const daysToMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek)
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysToMonday)
  const firstClass = new Date(nextMonday)
  firstClass.setDate(nextMonday.getDate() + (entry.dzien - 1))
  const endDate = new Date(firstClass)
  endDate.setDate(firstClass.getDate() + 7 * 7)
  return endDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

// ─── Menu state ───
const wrapperRef = ref(null)
const activeMenuEntry = ref(null)
const menuStyle = ref({})
const availableGroups = ref([])
const groupsLoading = ref(false)
const showTimeEditor = ref(false)
const timeDay = ref(1)
const timeStart = ref(1)
const timeEnd = ref(2)
const timeError = ref('')

function slotsForDay(day) {
  return day >= 6 ? weekendSlots : weekdaySlots
}

function openMenu(entry, event) {
  if (!props.editable) return
  if (entry.rodzaj === 'Kon' || entry.rodzaj === 'Inne') return
  event.stopPropagation()

  const key = buildOverrideKey(entry)
  if (activeMenuEntry.value && buildOverrideKey(activeMenuEntry.value) === key) {
    closeMenu()
    return
  }

  activeMenuEntry.value = entry
  availableGroups.value = []
  groupsLoading.value = false
  showTimeEditor.value = false

  // Pre-populate time editor from current (possibly overridden) values
  timeDay.value = entry.dzien
  timeStart.value = entry.godzina
  timeEnd.value = entry.godzina + (entry.ilosc || 1) - 1

  // Position directly under the clicked tile (absolute, relative to wrapper)
  const tileRect = event.currentTarget.getBoundingClientRect()
  const wrapperRect = wrapperRef.value.getBoundingClientRect()
  let top = tileRect.bottom - wrapperRect.top + 4
  let left = tileRect.left - wrapperRect.left
  menuStyle.value = { top: `${top}px`, left: `${left}px` }
}

function closeMenu() {
  activeMenuEntry.value = null
}

function toggleHidden(entry) {
  const key = buildOverrideKey(entry)
  const current = props.overrides[key] || {}
  emit('override-change', key, { ...current, hidden: !current.hidden })
  closeMenu()
}

function toggleForceWeekly(entry) {
  const key = buildOverrideKey(entry)
  const current = props.overrides[key] || {}
  emit('override-change', key, { ...current, forceWeekly: !current.forceWeekly })
  closeMenu()
}

async function loadGroups(entry) {
  groupsLoading.value = true
  try {
    const groups = await new Promise((resolve) => {
      emit('request-groups', entry.idPrzedmiotu, entry.rodzaj, resolve)
    })
    availableGroups.value = groups || []
  } finally {
    groupsLoading.value = false
  }
}

function changeGroup(entry, newGroup) {
  const key = buildOverrideKey(entry)
  const current = props.overrides[key] || {}
  const originalGrupa = entry._originalGrupa ?? entry.grupa
  if (newGroup === originalGrupa) {
    const { overriddenGroup, ...rest } = current
    emit('override-change', key, rest)
  } else {
    emit('override-change', key, { ...current, overriddenGroup: newGroup })
  }
  closeMenu()
}

function openTimeEditor() {
  timeError.value = ''
  showTimeEditor.value = true
}

function checkOverlap(entry, newDay, newStart, newDuration) {
  const entryKey = buildOverrideKey(entry)
  const newEnd = newStart + newDuration
  const entryTyg = entry._originalTydzien ?? entry.tydzien
  const entryEffTyg = getOverride(entry)?.forceWeekly ? 0 : entryTyg

  for (const other of props.entries) {
    if (other === entry) continue
    const otherKey = buildOverrideKey(other)
    if (otherKey === entryKey) continue
    // Skip hidden entries
    const otherOv = props.overrides[otherKey]
    if (otherOv?.hidden) continue
    // Must be same day
    if (other.dzien !== newDay) continue
    // Check week type compatibility
    const otherTyg = other._originalTydzien ?? other.tydzien
    const otherEffTyg = otherOv?.forceWeekly ? 0 : otherTyg
    if (entryEffTyg !== 0 && otherEffTyg !== 0 && entryEffTyg !== otherEffTyg) continue
    // Check time overlap
    const otherStart = other.godzina
    const otherDuration = other.ilosc || 1
    const otherEnd = otherStart + otherDuration
    if (newStart < otherEnd && otherStart < newEnd) {
      // Allow perfect overlap (same start + same duration)
      if (newStart === otherStart && newDuration === otherDuration) continue
      return other
    }
  }
  return null
}

function applyCustomTime(entry) {
  const duration = Math.max(1, timeEnd.value - timeStart.value + 1)
  const blocking = checkOverlap(entry, timeDay.value, timeStart.value, duration)
  if (blocking) {
    const name = blocking.przedmiot || blocking.przedmiotSkrot || blocking.rodzaj
    timeError.value = `Ten termin koliduje z: ${name} (${blocking.rodzaj} gr. ${blocking.grupa})`
    return
  }
  timeError.value = ''
  const key = buildOverrideKey(entry)
  const current = props.overrides[key] || {}
  emit('override-change', key, {
    ...current,
    customDay: timeDay.value,
    customStartSlot: timeStart.value,
    customDuration: duration,
  })
  closeMenu()
}

function resetCustomTime(entry) {
  const key = buildOverrideKey(entry)
  const current = props.overrides[key] || {}
  const { customDay, customStartSlot, customDuration, ...rest } = current
  emit('override-change', key, rest)
  closeMenu()
}

// Keep timeEnd >= timeStart, clear error on change
watch(timeStart, (v) => { if (timeEnd.value < v) timeEnd.value = v; timeError.value = '' })
watch(timeEnd, () => { timeError.value = '' })
watch(timeDay, () => { timeError.value = '' })

// ─── Grid logic ───
const usedDays = computed(() => new Set(props.entries.map((e) => e.dzien)))
const activeWeekdays = computed(() => days.filter((d) => d.id <= 5 && usedDays.value.has(d.id)))
const activeWeekendDays = computed(() => days.filter((d) => d.id >= 6 && usedDays.value.has(d.id)))
const hasWeekday = computed(() => activeWeekdays.value.length > 0)
const hasWeekend = computed(() => activeWeekendDays.value.length > 0)
const showBothColumns = computed(() => hasWeekday.value && hasWeekend.value)

const range = computed(() => {
  if (props.entries.length === 0) return { min: 1, max: 14 }
  let min = 15, max = 1
  for (const e of props.entries) {
    if (e.godzina < min) min = e.godzina
    const end = e.godzina + (e.ilosc || 1) - 1
    if (end > max) max = end
  }
  return { min, max }
})

const slotNumbers = computed(() => {
  const r = range.value
  return Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i)
})

// Build a cell map: for each (day, slot) determine which entries to render and the rowspan.
// An entry is "anchored" at the slot where it starts (e.godzina).
// If a later entry's start slot is swallowed by an earlier entry's rowspan,
// we pull it into the earlier anchor cell so it renders side-by-side (not disappearing).
const cellMap = computed(() => {
  const map = {} // key: "day_slot" => { entries: [], rowspan: number }
  // Group entries by day
  const byDay = {}
  for (const e of props.entries) {
    const d = e.dzien
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(e)
  }
  for (const dayId in byDay) {
    const dayEntries = byDay[dayId]
    // Sort by start slot
    dayEntries.sort((a, b) => a.godzina - b.godzina)
    // Track which slots are "owned" by an anchor cell
    const slotOwner = {} // slot => anchor slot number
    for (const e of dayEntries) {
      const start = e.godzina
      const span = e.ilosc || 1
      // If this entry's start slot is already owned by an earlier anchor, merge into that anchor
      const anchor = slotOwner[start] !== undefined ? slotOwner[start] : start
      const cellKey = `${dayId}_${anchor}`
      if (!map[cellKey]) {
        map[cellKey] = { entries: [], rowspan: 1 }
      }
      map[cellKey].entries.push(e)
      // Expand the anchor cell's rowspan to cover this entry
      const neededSpan = (start - anchor) + span
      if (neededSpan > map[cellKey].rowspan) {
        map[cellKey].rowspan = neededSpan
      }
      // Mark all slots this entry covers as owned by the anchor
      for (let s = start; s < start + span; s++) {
        if (slotOwner[s] === undefined) {
          slotOwner[s] = anchor
        }
      }
    }
    // Also mark any remaining owned slots that have no entries starting there
    // (they are "occupied" and should not render a <td>)
    for (const s in slotOwner) {
      const anchor = slotOwner[s]
      if (Number(s) !== anchor) {
        const cellKey = `${dayId}_${s}`
        if (!map[cellKey]) {
          map[cellKey] = null // mark as occupied (no <td>)
        }
      }
    }
  }
  return map
})

function getEntries(dayId, slotNum) {
  const cell = cellMap.value[`${dayId}_${slotNum}`]
  return cell ? cell.entries : []
}

function isOccupied(dayId, slotNum) {
  const key = `${dayId}_${slotNum}`
  // Occupied if the slot is mapped to null (consumed by an earlier anchor)
  // or simply not an anchor slot
  return cellMap.value[key] === null
}

function maxIlosc(dayId, slotNum) {
  const cell = cellMap.value[`${dayId}_${slotNum}`]
  return cell ? cell.rowspan : 1
}

function getSlotLabel(slotNum, isWeekend) {
  const slots = isWeekend ? weekendSlots : weekdaySlots
  return slots[slotNum - 1] || ''
}

function getTooltip(entry) {
  if (entry.rodzaj === 'Kon' || entry.rodzaj === 'Inne') {
    const parts = [entry.rodzaj === 'Kon' ? 'Konsultacje' : 'Inne']
    if (entry.opis) parts.push(entry.opis)
    if (entry.czas) parts.push(entry.czas)
    return parts.join('\n')
  }
  const parts = [entry.przedmiot || entry.przedmiotSkrot]
  if (entry.nauczyciel) parts.push(entry.nauczyciel)
  if (entry.sala) parts.push(`Sala: ${entry.sala}`)
  if (entry.czas) parts.push(entry.czas)
  const tyg = getWeekLabel(entry.tydzien)
  if (tyg) parts.push(tyg)
  if (entry.isUpdated) parts.push('*** ZAKTUALIZOWANO ***')
  return parts.join('\n')
}
</script>

<template>
  <div v-if="entries.length === 0" class="text-center py-8 text-gray-500">
    Brak danych do wyświetlenia
  </div>

  <div v-else ref="wrapperRef" class="relative" @click="closeMenu">
    <div class="overflow-x-auto">
    <table class="w-full border-collapse text-sm timetable-table">
      <thead>
        <tr>
          <th class="border border-gray-300 bg-blue-800 text-white px-2 py-2 text-xs font-bold timetable-hour-col">Godzina</th>
          <th v-for="day in activeWeekdays" :key="day.id" class="border border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-semibold">{{ day.name }}</th>
          <th v-if="showBothColumns" class="border border-gray-300 bg-blue-800 text-white px-2 py-2 text-xs font-bold timetable-hour-col">Godzina</th>
          <th v-for="day in activeWeekendDays" :key="day.id" class="border border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-semibold">{{ day.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="slot in slotNumbers" :key="slot" class="timetable-row">
          <td class="border border-gray-300 bg-blue-50 px-2 py-1 text-xs text-center whitespace-nowrap font-mono font-semibold text-blue-900 align-middle">
            {{ hasWeekday ? getSlotLabel(slot, false) : getSlotLabel(slot, true) }}
          </td>

          <!-- Weekday cells -->
          <template v-for="day in activeWeekdays" :key="day.id">
            <template v-if="isOccupied(day.id, slot)" />
            <td v-else :rowspan="maxIlosc(day.id, slot)" class="border border-gray-300 p-0">
              <div class="flex flex-row h-full">
                <div
                  v-for="(entry, idx) in getEntries(day.id, slot)"
                  :key="idx"
                  class="relative flex-1 min-w-0 border-l-4 overflow-hidden"
                  :class="[getColor(entry.rodzaj), editable && entry.rodzaj !== 'Kon' && entry.rodzaj !== 'Inne' ? 'cursor-pointer hover:brightness-95' : '']"
                  :style="idx > 0 ? 'box-shadow: -1px 0 0 0 rgb(209 213 219)' : ''"
                  :title="getTooltip(entry)"
                  @click="openMenu(entry, $event)"
                >
                  <!-- Content (gets dimmed when hidden) -->
                  <div class="p-1.5 text-xs leading-tight break-words" :class="isHidden(entry) ? 'opacity-30 grayscale' : ''">
                    <span v-if="entry.isUpdated" class="absolute top-0.5 right-0.5 px-1 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded leading-none z-10">ZMIANA</span>
                    <template v-if="entry.rodzaj === 'Kon' || entry.rodzaj === 'Inne'">
                      <div class="font-semibold">{{ entry.rodzaj === 'Kon' ? 'Konsultacje' : 'Inne' }}</div>
                      <div class="opacity-75">{{ entry.opis }}</div>
                    </template>
                    <template v-else>
                      <div class="font-semibold">{{ entry.przedmiotSkrot || entry.przedmiot }}</div>
                      <div v-if="isForceWeekly(entry)" class="text-[10px] font-bold text-green-700">Co tydzien</div>
                      <div v-else-if="getWeekLabel(entry.tydzien)" class="text-[10px] font-bold opacity-80">{{ getWeekLabel(entry.tydzien) }}</div>
                      <div>{{ entry.rodzaj }} gr. {{ entry.grupa }}<span v-if="hasGroupOverride(entry)" class="text-[9px] text-blue-600 ml-1">(zmieniona)</span></div>
                      <div class="opacity-75">{{ entry.nauczycielSkrot || entry.nauczyciel }}</div>
                      <div class="opacity-75">{{ entry.sala }}</div>
                      <div v-if="hasCustomTime(entry)" class="text-[9px] font-semibold text-indigo-600 mt-0.5">Termin zmieniony</div>
                      <div v-if="hasConflict(entry)" class="text-[9px] font-bold text-orange-600 mt-0.5">KONFLIKT</div>
                      <div v-if="isForceWeekly(entry)" class="text-[9px] font-semibold text-orange-700 mt-0.5">Koniec: ~{{ getForceWeeklyEndDate(entry) }}</div>
                      <div v-if="showStudyInfo && entry.studia" class="opacity-60 mt-0.5">{{ entry.studia }} sem. {{ entry.semestr }}</div>
                    </template>
                  </div>
                  <!-- UKRYTE overlay -->
                  <div v-if="editable && isHidden(entry)" class="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] rounded">
                    <span class="text-white font-bold text-sm bg-gray-800/80 px-3 py-1 rounded-lg shadow">UKRYTE</span>
                  </div>
                </div>
              </div>
            </td>
          </template>

          <!-- Weekend hour column -->
          <td v-if="showBothColumns" class="border border-gray-300 bg-blue-50 px-2 py-1 text-xs text-center whitespace-nowrap font-mono font-semibold text-blue-900 align-middle">
            {{ getSlotLabel(slot, true) }}
          </td>

          <!-- Weekend cells -->
          <template v-for="day in activeWeekendDays" :key="day.id">
            <template v-if="isOccupied(day.id, slot)" />
            <td v-else :rowspan="maxIlosc(day.id, slot)" class="border border-gray-300 p-0">
              <div class="flex flex-row h-full">
                <div
                  v-for="(entry, idx) in getEntries(day.id, slot)"
                  :key="idx"
                  class="relative flex-1 min-w-0 border-l-4 overflow-hidden"
                  :class="[getColor(entry.rodzaj), editable && entry.rodzaj !== 'Kon' && entry.rodzaj !== 'Inne' ? 'cursor-pointer hover:brightness-95' : '']"
                  :style="idx > 0 ? 'box-shadow: -1px 0 0 0 rgb(209 213 219)' : ''"
                  :title="getTooltip(entry)"
                  @click="openMenu(entry, $event)"
                >
                  <div class="p-1.5 text-xs leading-tight break-words" :class="isHidden(entry) ? 'opacity-30 grayscale' : ''">
                    <span v-if="entry.isUpdated" class="absolute top-0.5 right-0.5 px-1 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded leading-none z-10">ZMIANA</span>
                    <template v-if="entry.rodzaj === 'Kon' || entry.rodzaj === 'Inne'">
                      <div class="font-semibold">{{ entry.rodzaj === 'Kon' ? 'Konsultacje' : 'Inne' }}</div>
                      <div class="opacity-75">{{ entry.opis }}</div>
                    </template>
                    <template v-else>
                      <div class="font-semibold">{{ entry.przedmiotSkrot || entry.przedmiot }}</div>
                      <div v-if="isForceWeekly(entry)" class="text-[10px] font-bold text-green-700">Co tydzien</div>
                      <div v-else-if="getWeekLabel(entry.tydzien)" class="text-[10px] font-bold opacity-80">{{ getWeekLabel(entry.tydzien) }}</div>
                      <div>{{ entry.rodzaj }} gr. {{ entry.grupa }}<span v-if="hasGroupOverride(entry)" class="text-[9px] text-blue-600 ml-1">(zmieniona)</span></div>
                      <div class="opacity-75">{{ entry.nauczycielSkrot || entry.nauczyciel }}</div>
                      <div class="opacity-75">{{ entry.sala }}</div>
                      <div v-if="hasCustomTime(entry)" class="text-[9px] font-semibold text-indigo-600 mt-0.5">Termin zmieniony</div>
                      <div v-if="hasConflict(entry)" class="text-[9px] font-bold text-orange-600 mt-0.5">KONFLIKT</div>
                      <div v-if="isForceWeekly(entry)" class="text-[9px] font-semibold text-orange-700 mt-0.5">Koniec: ~{{ getForceWeeklyEndDate(entry) }}</div>
                      <div v-if="showStudyInfo && entry.studia" class="opacity-60 mt-0.5">{{ entry.studia }} sem. {{ entry.semestr }}</div>
                    </template>
                  </div>
                  <div v-if="editable && isHidden(entry)" class="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] rounded">
                    <span class="text-white font-bold text-sm bg-gray-800/80 px-3 py-1 rounded-lg shadow">UKRYTE</span>
                  </div>
                </div>
              </div>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
      <span class="font-medium">Legenda:</span>
      <span v-for="(cls, key) in typeColors" :key="key" class="inline-flex items-center gap-1">
        <span class="inline-block w-3 h-3 rounded border-l-4" :class="cls" />
        {{ key }}
      </span>
    </div>
    </div><!-- /overflow-x-auto -->

    <!-- Backdrop to close menu on outside click -->
    <div v-if="activeMenuEntry" class="fixed inset-0 z-40" @click="closeMenu" />
    <!-- Menu panel (absolute, anchored under tile) -->
    <div
      v-if="activeMenuEntry"
      class="absolute z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-2.5 w-max flex flex-col"
      :style="menuStyle"
      @click.stop
    >
      <div class="text-[10px] font-bold text-gray-400 uppercase mb-1.5 px-1 whitespace-nowrap">Edytuj kafelek</div>

      <!-- Hide toggle -->
      <button @click="toggleHidden(activeMenuEntry)" class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 whitespace-nowrap">
        {{ isHidden(activeMenuEntry) ? 'Pokaz zajecia' : 'Ukryj zajecia' }}
      </button>

      <!-- Change group (Student only) -->
      <template v-if="scheduleType !== 'Teacher'">
        <button @click="loadGroups(activeMenuEntry)" class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 whitespace-nowrap">
          Zmien grupe
        </button>
        <div v-if="groupsLoading" class="px-2 py-1 text-[10px] text-gray-400 whitespace-nowrap">Ladowanie...</div>
        <div v-if="availableGroups.length > 0" class="mt-1 border-t border-gray-100 pt-1 flex flex-col">
          <button
            v-for="g in availableGroups"
            :key="g.grupa"
            @click="changeGroup(activeMenuEntry, g.grupa)"
            class="w-full text-left px-2 py-1 text-xs rounded hover:bg-blue-50 flex justify-between gap-3 whitespace-nowrap"
            :class="{ 'bg-blue-100 font-semibold': activeMenuEntry.grupa === g.grupa }"
          >
            <span>gr. {{ g.grupa }}</span>
            <span class="text-gray-400 text-[10px]">{{ g.dzienNazwa }} {{ g.czas }} | {{ g.sala }}</span>
          </button>
        </div>
      </template>

      <!-- Force weekly (biweekly-only) - use _originalTydzien if entry was moved -->
      <button
        v-if="(activeMenuEntry._originalTydzien ?? activeMenuEntry.tydzien) === 1 || (activeMenuEntry._originalTydzien ?? activeMenuEntry.tydzien) === 2"
        @click="toggleForceWeekly(activeMenuEntry)"
        class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 whitespace-nowrap"
      >
        {{ isForceWeekly(activeMenuEntry) ? 'Przywroc co 2 tygodnie' : 'Zmien na co tydzien' }}
      </button>

      <!-- Teacher-only: custom time editor -->
      <template v-if="scheduleType === 'Teacher'">
        <div class="mt-1 border-t border-gray-100 pt-1">
          <button v-if="!showTimeEditor" @click="openTimeEditor" class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 whitespace-nowrap">
            Zmien termin
          </button>
          <div v-if="showTimeEditor" class="px-2 py-1.5 space-y-1.5">
            <div class="text-[10px] font-bold text-gray-500 uppercase">Nowy termin</div>
            <label class="flex items-center gap-2 text-xs">
              <span class="w-12 text-gray-500">Dzien:</span>
              <select v-model.number="timeDay" class="flex-1 border border-gray-300 rounded px-1.5 py-1 text-xs">
                <option v-for="d in days" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-xs">
              <span class="w-12 text-gray-500">Od:</span>
              <select v-model.number="timeStart" class="flex-1 border border-gray-300 rounded px-1.5 py-1 text-xs">
                <option v-for="(label, i) in slotsForDay(timeDay)" :key="i" :value="i + 1">{{ i + 1 }}. {{ label }}</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-xs">
              <span class="w-12 text-gray-500">Do:</span>
              <select v-model.number="timeEnd" class="flex-1 border border-gray-300 rounded px-1.5 py-1 text-xs">
                <option v-for="(label, i) in slotsForDay(timeDay)" :key="i" :value="i + 1" :disabled="i + 1 < timeStart">{{ i + 1 }}. {{ label }}</option>
              </select>
            </label>
            <div class="flex gap-1.5 pt-1">
              <button @click="applyCustomTime(activeMenuEntry)" class="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Zastosuj</button>
              <button v-if="hasCustomTime(activeMenuEntry)" @click="resetCustomTime(activeMenuEntry)" class="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Resetuj</button>
            </div>
            <div v-if="timeError" class="mt-1.5 px-2 py-1.5 bg-red-50 border border-red-300 rounded text-[10px] text-red-700 font-medium leading-snug">
              {{ timeError }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div><!-- /relative wrapper -->
</template>

<style scoped>
.timetable-table {
  table-layout: fixed;
}
.timetable-hour-col {
  width: 90px;
  min-width: 90px;
  max-width: 90px;
}
.timetable-row {
  height: 60px;
}
.timetable-row td {
  height: inherit;
  vertical-align: top;
}
.timetable-table th:not(.timetable-hour-col),
.timetable-table td:not(.timetable-hour-col) {
  min-width: 150px;
}
</style>
