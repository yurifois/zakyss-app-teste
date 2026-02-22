const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api'

// Helper para requisições
async function request(endpoint, options = {}) {
    // Check both user and admin tokens - use admin token if available (for admin operations)
    const userToken = localStorage.getItem('zakys_token')
    const adminToken = localStorage.getItem('zakys_admin_token')
    const token = adminToken || userToken

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    }

    const response = await fetch(`${API_URL}${endpoint}`, config)
    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.error || 'Erro na requisição')
    }

    return data.data
}

// ========== AUTH ==========

export async function login(email, password) {
    const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('zakys_token', result.token)
    localStorage.setItem('zakys_user', JSON.stringify(result.user))
    return result.user
}

export async function register(userData) {
    const result = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    })
    localStorage.setItem('zakys_token', result.token)
    localStorage.setItem('zakys_user', JSON.stringify(result.user))
    return result.user
}

export async function adminLogin(email, password) {
    const result = await request('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('zakys_admin_token', result.token)
    localStorage.setItem('zakys_admin', JSON.stringify(result.admin))
    return result.admin
}

export async function adminRegister(adminData) {
    const result = await request('/auth/admin/register', {
        method: 'POST',
        body: JSON.stringify(adminData),
    })
    localStorage.setItem('zakys_admin_token', result.token)
    localStorage.setItem('zakys_admin', JSON.stringify(result.admin))
    return result.admin
}

export function logout() {
    localStorage.removeItem('zakys_token')
    localStorage.removeItem('zakys_user')
}

export function adminLogout() {
    localStorage.removeItem('zakys_admin_token')
    localStorage.removeItem('zakys_admin')
}

export function getCurrentUser() {
    const user = localStorage.getItem('zakys_user')
    return user ? JSON.parse(user) : null
}

export function getCurrentAdmin() {
    const admin = localStorage.getItem('zakys_admin')
    return admin ? JSON.parse(admin) : null
}

export function getToken() {
    return localStorage.getItem('zakys_token')
}

export function getAdminToken() {
    return localStorage.getItem('zakys_admin_token')
}

// ========== CATEGORIES ==========

export async function getCategories() {
    return request('/categories')
}

// ========== SERVICES ==========

export async function getServices() {
    return request('/services')
}

export async function getServiceById(id) {
    return request(`/services/${id}`)
}

export async function getServicesByIds(ids) {
    return request('/services/batch', {
        method: 'POST',
        body: JSON.stringify({ ids }),
    })
}

export async function getServicesByCategory(categoryId) {
    return request(`/categories/${categoryId}/services`)
}

// ========== ESTABLISHMENTS ==========

export async function getEstablishments(params = {}) {
    const queryParams = new URLSearchParams()
    if (params.category) queryParams.append('category', params.category)
    if (params.q) queryParams.append('q', params.q)
    if (params.lat) queryParams.append('lat', params.lat)
    if (params.lng) queryParams.append('lng', params.lng)
    if (params.maxDistance) queryParams.append('maxDistance', params.maxDistance)

    const query = queryParams.toString()
    return request(`/establishments${query ? `?${query}` : ''}`)
}

export async function getEstablishmentById(id) {
    return request(`/establishments/${id}`)
}

export async function getEstablishmentServices(id) {
    return request(`/establishments/${id}/services`)
}

export async function getAvailableSlots(establishmentId, date) {
    return request(`/establishments/${establishmentId}/available-slots?date=${date}`)
}

export async function createEstablishment(data) {
    return request('/establishments', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateEstablishment(id, data) {
    return request(`/establishments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

// Preços de mercado (Premium only)
export async function getMarketPrices(establishmentId) {
    return request(`/establishments/${establishmentId}/market-prices`)
}

// ========== APPOINTMENTS ==========

export async function getAppointmentById(id) {
    return request(`/appointments/${id}`)
}

export async function getAppointmentsByEstablishment(establishmentId, params = {}) {
    const queryParams = new URLSearchParams()
    if (params.date) queryParams.append('date', params.date)
    if (params.status) queryParams.append('status', params.status)

    const query = queryParams.toString()
    return request(`/establishments/${establishmentId}/appointments${query ? `?${query}` : ''}`)
}

export async function getAppointmentsByUser(userId) {
    return request(`/users/${userId}/appointments`)
}

// Alias para compatibilidade com NotificationManager
export const getUserAppointments = getAppointmentsByUser

export async function createAppointment(data) {
    return request('/appointments', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateAppointmentStatus(id, status) {
    return request(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    })
}

export async function updateAppointment(id, data) {
    return request(`/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

// ========== USERS ==========

export async function updateUser(id, data) {
    // Use user token specifically for user profile updates
    const userToken = localStorage.getItem('zakys_token')

    const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(userToken && { Authorization: `Bearer ${userToken}` }),
        },
        body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
        throw new Error(result.error || 'Erro na requisição')
    }

    localStorage.setItem('zakys_user', JSON.stringify(result.data))
    return result.data
}

export async function getUserFavorites(userId) {
    return request(`/users/${userId}/favorites`)
}

export async function toggleFavorite(userId, establishmentId) {
    return request(`/users/${userId}/favorites/${establishmentId}`, {
        method: 'POST',
    })
}

export async function changePassword(userId, data) {
    const userToken = localStorage.getItem('zakys_token')

    const response = await fetch(`${API_URL}/users/${userId}/password`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(userToken && { Authorization: `Bearer ${userToken}` }),
        },
        body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar senha')
    }

    return result.data
}

// ========== UPLOAD ==========

const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:3002/api/upload'

export async function uploadEstablishmentLogo(establishmentId, file) {
    const adminToken = localStorage.getItem('zakys_admin_token')

    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${UPLOAD_URL}/logo/${establishmentId}`, {
        method: 'POST',
        headers: {
            ...(adminToken && { Authorization: `Bearer ${adminToken}` }),
        },
        body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer upload')
    }

    return data.data
}

export async function uploadServiceImage(establishmentId, file) {
    const adminToken = localStorage.getItem('zakys_admin_token')

    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${UPLOAD_URL}/service-image/${establishmentId}`, {
        method: 'POST',
        headers: {
            ...(adminToken && { Authorization: `Bearer ${adminToken}` }),
        },
        body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer upload')
    }

    return data.data
}

export async function deleteServiceImage(establishmentId, imageIndex) {
    return request(`/upload/service-image/${establishmentId}/${imageIndex}`, {
        method: 'DELETE',
    })
}

export async function uploadUserAvatar(userId, file) {
    const userToken = localStorage.getItem('zakys_token')

    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${UPLOAD_URL}/avatar/${userId}`, {
        method: 'POST',
        headers: {
            ...(userToken && { Authorization: `Bearer ${userToken}` }),
        },
        body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer upload')
    }

    // Atualiza o usuário no localStorage
    if (data.data.user) {
        localStorage.setItem('zakys_user', JSON.stringify(data.data.user))
    }

    return data.data
}

// Helper para construir URL de imagem
export function getImageUrl(imagePath) {
    if (!imagePath) return null
    if (imagePath.startsWith('http')) return imagePath
    return `${API_URL.replace('/api', '')}${imagePath}`
}

// ========== EMPLOYEES ==========

export async function getEmployees(establishmentId) {
    return request(`/employees/${establishmentId}`)
}

export async function getPublicEmployees(establishmentId) {
    return request(`/employees/${establishmentId}/public`)
}

export async function createEmployee(data) {
    return request('/employees', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateEmployee(id, data) {
    return request(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteEmployee(id) {
    return request(`/employees/${id}`, {
        method: 'DELETE',
    })
}

export async function updateAppointmentAssignments(appointmentId, assignments) {
    return request(`/appointments/${appointmentId}/assignments`, {
        method: 'PATCH',
        body: JSON.stringify({ assignments }),
    })
}

export async function getEmployeeReport(establishmentId, month, year) {
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    if (year) params.append('year', year)

    const query = params.toString()
    return request(`/employees/${establishmentId}/report${query ? `?${query}` : ''}`)
}

export async function getEmployeeDetailReport(establishmentId, months, year) {
    return request(`/employees/${establishmentId}/detail-report?months=${months.join(',')}&year=${year}`)
}

export async function getAnalytics(establishmentId, filters = {}) {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.months?.length) params.append('months', filters.months.join(','))
    if (filters.year) params.append('year', filters.year)
    if (filters.employees?.length) params.append('employees', filters.employees.join(','))
    if (filters.services?.length) params.append('services', filters.services.join(','))
    if (filters.statuses?.length) params.append('statuses', filters.statuses.join(','))
    if (filters.weekdays?.length) params.append('weekdays', filters.weekdays.join(','))

    const query = params.toString()
    return request(`/analytics/${establishmentId}${query ? `?${query}` : ''}`)
}



