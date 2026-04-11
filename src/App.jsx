import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginModal    from './components/LoginModal'
import Dashboard     from './components/Dashboard'
import LiveView      from './components/LiveView'

const PrivateRoute = ({ children }) => {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginModal />} />
        <Route path="/" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />
        <Route path="/machine/:machineId" element={
          <PrivateRoute><LiveView /></PrivateRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}

export default App