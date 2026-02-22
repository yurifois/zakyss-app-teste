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
    }, [])

    const login = async (email, password) => {
        const userData = await api.login(email, password)
        setUser(userData)
        return userData
    }

    const register = async (userData) => {
        const newUser = await api.register(userData)
        setUser(newUser)
        return newUser
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
    const adminLogin = async (email, password) => {
        const adminData = await api.adminLogin(email, password)
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
