import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import NotificationManager from './components/NotificationManager'
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
            <AuthProvider>
                <ToastProvider>
                    <NotificationManager />
                    <App />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
