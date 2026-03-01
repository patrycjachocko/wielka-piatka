<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SidebarBranch, SidebarLeaf, SidebarTreeNode } from '@/types/schedule'

defineOptions({
  name: 'SidebarNode',
})

const props = withDefaults(
  defineProps<{
    node: SidebarTreeNode
    selectedLeafId: string
    depth?: number
  }>(),
  {
    depth: 0,
  },
)

const emit = defineEmits<{
  selectLeaf: [leafId: string]
}>()

const branchNode = computed<SidebarBranch | null>(() => {
  return props.node.kind === 'branch' ? props.node : null
})

const leafNode = computed<SidebarLeaf | null>(() => {
  return props.node.kind === 'leaf' ? props.node : null
})

const isOpen = ref(branchNode.value?.defaultOpen ?? false)
const isActive = computed(() => leafNode.value?.id === props.selectedLeafId)
const indentationStyle = computed(() => ({
  '--depth': String(props.depth),
}))

function toggleBranch() {
  if (!branchNode.value) {
    return
  }

  isOpen.value = !isOpen.value
}

function selectLeaf() {
  if (!leafNode.value) {
    return
  }

  emit('selectLeaf', leafNode.value.id)
}
</script>

<template>
  <div class="sidebar-node" :style="indentationStyle">
    <button
      v-if="branchNode"
      :aria-expanded="isOpen"
      :data-testid="`branch-${branchNode.id}`"
      class="sidebar-node__button sidebar-node__button--branch"
      type="button"
      @click="toggleBranch"
    >
      <span class="sidebar-node__chevron" :class="{ 'is-open': isOpen }" aria-hidden="true" />
      <span class="sidebar-node__label">{{ branchNode.label }}</span>
    </button>

    <button
      v-else-if="leafNode"
      :class="{ 'is-active': isActive }"
      :data-testid="`leaf-${leafNode.id}`"
      class="sidebar-node__button sidebar-node__button--leaf"
      type="button"
      @click="selectLeaf"
    >
      <span class="sidebar-node__label">{{ leafNode.label }}</span>
    </button>

    <div v-if="branchNode && isOpen" class="sidebar-node__children">
      <SidebarNode
        v-for="child in branchNode.children"
        :key="child.id"
        :depth="depth + 1"
        :node="child"
        :selected-leaf-id="selectedLeafId"
        @select-leaf="emit('selectLeaf', $event)"
      />
    </div>
  </div>
</template>
