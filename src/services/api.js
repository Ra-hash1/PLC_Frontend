import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Attach JWT on every request ──────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('plc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Global error handling ────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('plc_token')
      localStorage.removeItem('plc_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
