import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

// Layouts
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'


// Public Pages
import Home from './pages/Home'
import Search from './pages/Search'
import Establishment from './pages/Establishment'
import Booking from './pages/Booking'
import BookingConfirmation from './pages/BookingConfirmation'
import Terms from './pages/Terms'

// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Profile from './pages/Profile'

// Partner Pages
import PartnerRegister from './pages/partner/Register'
import PartnerServices from './pages/partner/SelectServices'
import PartnerSetup from './pages/partner/Setup'

// Admin Pages
const AdminLogin = lazy(() => import('./pages/admin/Login'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminAppointments = lazy(() => import('./pages/admin/Appointments'))
const AdminClients = lazy(() => import('./pages/admin/Clients'))
const AdminSchedule = lazy(() => import('./pages/admin/Schedule'))
const AdminServices = lazy(() => import('./pages/admin/Services'))
const AdminEmployees = lazy(() => import('./pages/admin/Employees'))
const AdminEmployeeReport = lazy(() => import('./pages/admin/EmployeeReport'))
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'))
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'))
const AdminImages = lazy(() => import('./pages/admin/Images'))
const AdminLinks = lazy(() => import('./pages/admin/Links'))
const AdminProducts = lazy(() => import('./pages/admin/Products'))
const AdminCashFlow = lazy(() => import('./pages/admin/CashFlow'))
const AdminPackages = lazy(() => import('./pages/admin/Packages'))
const AdminAnamnesis = lazy(() => import('./pages/admin/Anamnesis'))
const AdminCalendarView = lazy(() => import('./pages/admin/CalendarView'))

// Fallback enquanto o pedaço da página admin baixa (só na primeira visita)
const Carregando = () => <div className="text-center py-16">⏳ Carregando...</div>

function App() {
    return (
        <Suspense fallback={<Carregando />}>
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<MainLayout />}>
                <Route index element={<Home />} />
                <Route path="buscar" element={<Search />} />
                <Route path="estabelecimento/:id" element={<Establishment />} />
                <Route path="agendar/:id" element={<Booking />} />
                <Route path="confirmacao/:id" element={<BookingConfirmation />} />
                <Route path="termos" element={<Terms />} />

                {/* Auth Routes */}
                <Route path="entrar" element={<Login />} />
                <Route path="cadastro" element={<Register />} />
                <Route path="recuperar-senha" element={<ForgotPassword />} />
                <Route path="redefinir-senha" element={<ResetPassword />} />
                <Route path="perfil" element={<Profile />} />

                {/* Partner Routes */}
                <Route path="parceiro">
                    <Route index element={<PartnerRegister />} />
                    <Route path="cadastro" element={<PartnerRegister />} />
                    <Route path="servicos" element={<PartnerServices />} />
                    <Route path="configuracao" element={<PartnerSetup />} />
                </Route>
            </Route>

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="agendamentos" element={<AdminAppointments />} />
                <Route path="calendario" element={<AdminCalendarView />} />
                <Route path="clientes" element={<AdminClients />} />
                <Route path="horarios" element={<AdminSchedule />} />
                <Route path="servicos" element={<AdminServices />} />
                <Route path="funcionarios" element={<AdminEmployees />} />
                <Route path="relatorio" element={<AdminEmployeeReport />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="dados" element={<AdminProfile />} />
                <Route path="imagens" element={<AdminImages />} />
                <Route path="links" element={<AdminLinks />} />
                <Route path="produtos" element={<AdminProducts />} />
                <Route path="fluxo-caixa" element={<AdminCashFlow />} />
                <Route path="pacotes" element={<AdminPackages />} />
                <Route path="anamnese" element={<AdminAnamnesis />} />
            </Route>
        </Routes>
        </Suspense>
    )
}

export default App
