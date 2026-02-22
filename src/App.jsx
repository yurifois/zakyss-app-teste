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

// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Profile from './pages/Profile'

// Partner Pages
import PartnerRegister from './pages/partner/Register'
import PartnerServices from './pages/partner/SelectServices'
import PartnerSetup from './pages/partner/Setup'

// Admin Pages
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminAppointments from './pages/admin/Appointments'
import AdminSchedule from './pages/admin/Schedule'
import AdminServices from './pages/admin/Services'
import AdminEmployees from './pages/admin/Employees'
import AdminEmployeeReport from './pages/admin/EmployeeReport'
import AdminAnalytics from './pages/admin/Analytics'

function App() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<MainLayout />}>
                <Route index element={<Home />} />
                <Route path="buscar" element={<Search />} />
                <Route path="estabelecimento/:id" element={<Establishment />} />
                <Route path="agendar/:id" element={<Booking />} />
                <Route path="confirmacao/:id" element={<BookingConfirmation />} />

                {/* Auth Routes */}
                <Route path="entrar" element={<Login />} />
                <Route path="cadastro" element={<Register />} />
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
                <Route path="horarios" element={<AdminSchedule />} />
                <Route path="servicos" element={<AdminServices />} />
                <Route path="funcionarios" element={<AdminEmployees />} />
                <Route path="relatorio" element={<AdminEmployeeReport />} />
                <Route path="analytics" element={<AdminAnalytics />} />
            </Route>
        </Routes>
    )
}

export default App


