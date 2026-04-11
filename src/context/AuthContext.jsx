import { createContext, useContext, useState } from 'react'
import api from '../services/api'
import { toast } from 'react-toastify'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [token, setToken]   = useState(() => localStorage.getItem('plc_token'))
  const [user, setUser]     = useState(() => {
    const u = localStorage.getItem('plc_user')
    return u ? JSON.parse(u) : null
  })

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { token: t, user: u } = res.data.data
    setToken(t)
    setUser(u)
    localStorage.setItem('plc_token', t)
    localStorage.setItem('plc_user', JSON.stringify(u))
    return u
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('plc_token')
    localStorage.removeItem('plc_user')
    toast.info('Logged out')
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
