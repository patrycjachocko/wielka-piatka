import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5289/api',
  timeout: 30000,
})

export default api
