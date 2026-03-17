import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/plan-studenta',
    name: 'StudentSchedule',
    component: () => import('../views/StudentScheduleView.vue'),
  },
  {
    path: '/plan-nauczyciela',
    name: 'TeacherSchedule',
    component: () => import('../views/TeacherScheduleView.vue'),
  },
  {
    path: '/moj-plan',
    name: 'MySchedule',
    component: () => import('../views/MyScheduleView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
