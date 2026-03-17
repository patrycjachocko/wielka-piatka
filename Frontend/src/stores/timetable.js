import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api'

export const useTimetableStore = defineStore('timetable', () => {
  const studia = ref([])
  const semestry = ref([])
  const specjalnosci = ref([])
  const grupy = ref([])
  const rozklad = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchStudia() {
    const { data } = await api.get('/studia')
    studia.value = data
  }

  async function fetchSemestry(idStudiow) {
    const { data } = await api.get(`/studia/${idStudiow}/semestry`)
    semestry.value = data
  }

  async function fetchSpecjalnosci(idStudiow, semestr) {
    const { data } = await api.get(`/studia/${idStudiow}/specjalnosci`, {
      params: { semestr },
    })
    specjalnosci.value = data
  }

  async function fetchGrupy(idStudiow, semestr, idSpec) {
    const { data } = await api.get(`/studia/${idStudiow}/grupy`, {
      params: { semestr, idSpec },
    })
    grupy.value = data
  }

  async function fetchRozklad(idStudiow, semestr, idSpec) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get('/rozklad', {
        params: { idStudiow, semestr, idSpec },
      })
      rozklad.value = data
    } catch (e) {
      error.value = 'Nie udało się pobrać rozkładu'
    } finally {
      loading.value = false
    }
  }

  return {
    studia, semestry, specjalnosci, grupy, rozklad, loading, error,
    fetchStudia, fetchSemestry, fetchSpecjalnosci, fetchGrupy, fetchRozklad,
  }
})
