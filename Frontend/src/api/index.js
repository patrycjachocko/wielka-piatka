import axios from 'axios'

const timetableBaseURL = import.meta.env.VITE_TIMETABLE_API_URL || 'http://localhost:5289/api'
const plansBaseURL = import.meta.env.VITE_PLANS_API_URL || timetableBaseURL

const api = axios.create({
  baseURL: timetableBaseURL,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const url = config.url || ''
  if (url.startsWith('/schedules') || url.startsWith('/projection')) {
    config.baseURL = plansBaseURL
  } else {
    config.baseURL = timetableBaseURL
  }

  return config
})

export default api
