import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isAdmin as checkIsAdmin } from './store/auth.store'
import Login from './pages/auth/Login'
import Dashboard from './pages/admin/Dashboard'
import Orders from './pages/admin/Orders'
import Stock from './pages/admin/Stock'
import People from './pages/admin/People'
import Bohlale from './pages/admin/Bohlale'
import Ambassadors from './pages/admin/Ambassadors'
import CustomerHome from './pages/customer/Home'
import CustomerProduct from './pages/customer/Product'
import CustomerCheckout from './pages/customer/Checkout'
import CustomerOrders from './pages/customer/Orders'
import CustomerProfile from './pages/customer/Profile'
import AmbDashboard from './pages/ambassador/Dashboard'
import AmbEarnings from './pages/ambassador/Earnings'
import AmbOrders from './pages/ambassador/Orders'
import AmbShop from './pages/ambassador/Shop'
import AmbCheckout from './pages/ambassador/Checkout'
import AmbProfile from './pages/ambassador/Profile'

function RootRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  const isAdm = checkIsAdmin(user)
  if (isAdm) return <Navigate to="/admin/dashboard" replace />
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

      {/* Admin routes */}
      <Route path="/admin/dashboard"   element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/admin/orders"      element={<RequireAuth><Orders /></RequireAuth>} />
      <Route path="/admin/stock"       element={<RequireAuth><Stock /></RequireAuth>} />
      <Route path="/admin/people"      element={<RequireAuth><People /></RequireAuth>} />
      <Route path="/admin/bohlale"     element={<RequireAuth><Bohlale /></RequireAuth>} />
      <Route path="/admin/ambassadors" element={<RequireAuth><Ambassadors /></RequireAuth>} />

      {/* Customer routes */}
      <Route path="/customer/home"     element={<RequireAuth><CustomerHome /></RequireAuth>} />
      <Route path="/customer/product/:id" element={<RequireAuth><CustomerProduct /></RequireAuth>} />
      <Route path="/customer/checkout" element={<RequireAuth><CustomerCheckout /></RequireAuth>} />
      <Route path="/customer/orders"   element={<RequireAuth><CustomerOrders /></RequireAuth>} />
      <Route path="/customer/profile"  element={<RequireAuth><CustomerProfile /></RequireAuth>} />

      {/* Ambassador routes */}
      <Route path="/ambassador/dashboard" element={<RequireAuth><AmbDashboard /></RequireAuth>} />
      <Route path="/ambassador/earnings"  element={<RequireAuth><AmbEarnings /></RequireAuth>} />
      <Route path="/ambassador/orders"    element={<RequireAuth><AmbOrders /></RequireAuth>} />
      <Route path="/ambassador/shop"      element={<RequireAuth><AmbShop /></RequireAuth>} />
      <Route path="/ambassador/product/:id" element={<RequireAuth><CustomerProduct /></RequireAuth>} />
      <Route path="/ambassador/checkout"  element={<RequireAuth><AmbCheckout /></RequireAuth>} />
      <Route path="/ambassador/profile"   element={<RequireAuth><AmbProfile /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
