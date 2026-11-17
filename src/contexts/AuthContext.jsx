import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [admin, setAdmin] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Load saved sessions
        const savedUser = api.getCurrentUser()
        const savedAdmin = api.getCurrentAdmin()

        if (savedUser) setUser(savedUser)
        if (savedAdmin) setAdmin(savedAdmin)

        setLoading(false)

        // O login guardado pode ter sido encerrado pelo servidor (ex.: numa
        // manutenção de segurança). Confere em segundo plano; se tiver sido,
        // api.js desconecta e dispara SESSION_ENDED_EVENT.
        if (savedUser) api.checkStoredSession('customer')
        if (savedAdmin) api.checkStoredSession('admin')

        const onSessionEnded = (e) => {
            if (e.detail?.kind === 'admin') setAdmin(null)
            else setUser(null)
        }
        window.addEventListener(api.SESSION_ENDED_EVENT, onSessionEnded)
        return () => window.removeEventListener(api.SESSION_ENDED_EVENT, onSessionEnded)
    }, [])

    const login = async (email, password, remember = true) => {
        const userData = await api.login(email, password, remember)
        setUser(userData)
        return userData
    }

    // Devolve { verificationRequired, email }: a conta só entra depois de
    // confirmar o e-mail (ver completeEmailVerification).
    const register = async (userData) => {
        return api.register(userData)
    }

    const completeEmailVerification = async (token) => {
        const result = await api.verifyEmail(token)
        if (result.kind === 'admin') setAdmin(result.admin)
        else setUser(result.user)
        return result
    }

    const logout = () => {
        api.logout()
        setUser(null)
    }

    const updateProfile = async (updates) => {
        if (!user) return null
        const updatedUser = await api.updateUser(user.id, updates)
        setUser(updatedUser)
        return updatedUser
    }

    // Recarregar usuário do localStorage (sem API call)
    const refreshUser = () => {
        const savedUser = api.getCurrentUser()
        if (savedUser) setUser(savedUser)
    }

    // Admin auth
    const adminLogin = async (email, password, remember = true) => {
        const adminData = await api.adminLogin(email, password, remember)
        setAdmin(adminData)
        return adminData
    }

    const adminLogout = () => {
        api.adminLogout()
        setAdmin(null)
    }

    const value = {
        user,
        admin,
        loading,
        isAuthenticated: !!user,
        isAdmin: !!admin,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
        adminLogin,
        adminLogout,
        completeEmailVerification,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
