import { createRouter, createWebHistory } from 'vue-router'
import SchedulePlannerView from '@/views/SchedulePlannerView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'schedule-planner',
      component: SchedulePlannerView,
    },
  ],
})

export default router
