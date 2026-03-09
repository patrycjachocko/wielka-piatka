<script setup lang="ts">
import SidebarNode from '@/components/sidebar/SidebarNode.vue'
import type { SidebarTreeNode } from '@/types/schedule'

defineProps<{
  nodes: SidebarTreeNode[]
  selectedLeafId: string
}>()

const emit = defineEmits<{
  selectLeaf: [leafId: string]
}>()
</script>

<template>
  <nav aria-label="Wybór planu zajęć" class="schedule-sidebar" data-testid="schedule-sidebar">
    <SidebarNode
      v-for="node in nodes"
      :key="node.id"
      :depth="0"
      :node="node"
      :selected-leaf-id="selectedLeafId"
      @select-leaf="emit('selectLeaf', $event)"
    />
  </nav>
</template>
