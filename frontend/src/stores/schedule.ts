import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  defaultLeafId,
  partTimeDays,
  scheduleEvents,
  scheduleSidebarTree,
  weekdayDays,
  weekdaySlots,
  weekendDays,
  weekendSlots,
} from '@/mocks/schedule'
import type {
  ScheduleDayLayout,
  ScheduleViewDto,
  ScheduleViewState,
  SidebarLeaf,
  SidebarTreeNode,
} from '@/types/schedule'

function collectLeaves(nodes: SidebarTreeNode[], leaves: SidebarLeaf[] = []): SidebarLeaf[] {
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      leaves.push(node)
      continue
    }

    collectLeaves(node.children, leaves)
  }

  return leaves
}

const sidebarLeaves = collectLeaves(scheduleSidebarTree)
const leavesById = new Map(sidebarLeaves.map((leaf) => [leaf.id, leaf]))

export const useScheduleStore = defineStore('schedule', () => {
  const selectedLeafId = ref(defaultLeafId)

  const selectedLeaf = computed<SidebarLeaf>(() => {
    return leavesById.get(selectedLeafId.value) ?? leavesById.get(defaultLeafId)!
  })

  const selectedAudience = computed(() => selectedLeaf.value.audience)
  const selectedStudyMode = computed(() => selectedLeaf.value.studyMode)
  const dayLayout = computed<ScheduleDayLayout>(() => {
    if (selectedAudience.value === 'teacher') {
      return {
        weekdayDays,
        weekendDays,
      }
    }

    if (selectedStudyMode.value === 'part-time') {
      return {
        weekdayDays: [],
        weekendDays: partTimeDays,
      }
    }

    return {
      weekdayDays,
      weekendDays: [],
    }
  })

  const filteredEvents = computed(() => {
    return scheduleEvents.filter((event) => event.leafId === selectedLeafId.value)
  })

  const viewState = computed<ScheduleViewState>(() => ({
    selectedLeafId: selectedLeafId.value,
    selectedAudience: selectedAudience.value,
    selectedStudyMode: selectedStudyMode.value,
    weekdayDays: dayLayout.value.weekdayDays,
    weekendDays: dayLayout.value.weekendDays,
  }))

  const currentView = computed<ScheduleViewDto>(() => ({
    contextLabel: selectedLeaf.value.label,
    audience: selectedAudience.value,
    studyMode: selectedStudyMode.value,
    weekdayDays: dayLayout.value.weekdayDays,
    weekendDays: dayLayout.value.weekendDays,
    weekdaySlots: dayLayout.value.weekdayDays.length > 0 ? weekdaySlots : [],
    weekendSlots: dayLayout.value.weekendDays.length > 0 ? weekendSlots : [],
    events: filteredEvents.value,
  }))

  function selectLeaf(leafId: string) {
    if (!leavesById.has(leafId)) {
      return
    }

    selectedLeafId.value = leafId
  }

  return {
    currentView,
    selectLeaf,
    selectedAudience,
    selectedLeaf,
    selectedLeafId,
    selectedStudyMode,
    sidebarTree: scheduleSidebarTree,
    viewState,
  }
})
