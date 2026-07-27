import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import UnfinishedBookingBanner from '../components/UnfinishedBookingBanner'
import UpcomingAppointmentBanner from '../components/UpcomingAppointmentBanner'

export default function MainLayout() {
    return (
        <>
            <UnfinishedBookingBanner />
            <UpcomingAppointmentBanner />
            <Header />
            <main style={{ flex: 1 }}>
                <Outlet />
            </main>
            <Footer />
        </>
    )
}
