import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { NotificationProvider } from './contexts/NotificationContext'
import NotificationManager from './components/NotificationManager'
import ScrollToTop from './components/ScrollToTop'
import './index.css'

// Carregamento dinâmico do Google Maps
const loadGoogleMaps = () => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key || key.includes('%')) {
        console.error('❌ Google Maps API Key não configurada ou inválida.')
        return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.defer = true
    script.onerror = () => console.error('Falha ao carregar Google Maps API.')
    document.head.appendChild(script)
}

loadGoogleMaps()

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
                <ToastProvider>
                    <NotificationProvider>
                        <NotificationManager />
                        <App />
                    </NotificationProvider>
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
