import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Home from './pages/customer/Home'
import Product from './pages/customer/Product'
import Checkout from './pages/customer/Checkout'
import CustomerOrders from './pages/customer/Orders'
import Profile from './pages/customer/Profile'
import Settings from './pages/customer/Settings'
import AmbassadorApply from './pages/customer/AmbassadorApply'
import AmbassadorStatus from './pages/customer/AmbassadorStatus'
import AmbDashboard from './pages/ambassador/Dashboard'
import AmbEarnings from './pages/ambassador/Earnings'
import AmbOrders from './pages/ambassador/Orders'
import AmbShop from './pages/ambassador/Shop'
import AmbCheckout from './pages/ambassador/Checkout'
import AmbProfile from './pages/ambassador/Profile'
import AmbSettings from './pages/ambassador/Settings'

function RootRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.roles?.includes('AMBASSADOR')) return <Navigate to="/ambassador/dashboard" replace />
  return <Navigate to="/customer/home" replace />
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/customer/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/customer/product/:id" element={<RequireAuth><Product /></RequireAuth>} />
      <Route path="/customer/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
      <Route path="/customer/orders" element={<RequireAuth><CustomerOrders /></RequireAuth>} />
      <Route path="/customer/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/customer/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/customer/ambassador-apply" element={<RequireAuth><AmbassadorApply /></RequireAuth>} />
      <Route path="/customer/ambassador-status" element={<RequireAuth><AmbassadorStatus /></RequireAuth>} />

      <Route path="/ambassador/dashboard" element={<RequireAuth><AmbDashboard /></RequireAuth>} />
      <Route path="/ambassador/earnings" element={<RequireAuth><AmbEarnings /></RequireAuth>} />
      <Route path="/ambassador/orders" element={<RequireAuth><AmbOrders /></RequireAuth>} />
      <Route path="/ambassador/shop" element={<RequireAuth><AmbShop /></RequireAuth>} />
      <Route path="/ambassador/product/:id" element={<RequireAuth><Product /></RequireAuth>} />
      <Route path="/ambassador/checkout" element={<RequireAuth><AmbCheckout /></RequireAuth>} />
      <Route path="/ambassador/profile" element={<RequireAuth><AmbProfile /></RequireAuth>} />
      <Route path="/ambassador/settings" element={<RequireAuth><AmbSettings /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
