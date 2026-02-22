// Brasília coordinates (default)
const DEFAULT_COORDS = {
    lat: -15.7942,
    lng: -47.8822,
}

/**
 * Get user's current position
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported, using default coordinates')
            resolve(DEFAULT_COORDS)
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                })
            },
            (error) => {
                console.warn('Error getting location, using default:', error.message)
                resolve(DEFAULT_COORDS)
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // 5 minutes cache
            }
        )
    })
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371 // Earth's radius in km
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    return Math.round(distance * 10) / 10 // Round to 1 decimal place
}

function toRad(deg) {
    return deg * (Math.PI / 180)
}

/**
 * Sort establishments by distance from user
 * @param {Array} establishments - Array of establishments with lat/lng
 * @param {Object} userLocation - User's coordinates {lat, lng}
 * @returns {Array} Sorted establishments with distance property
 */
export function sortByDistance(establishments, userLocation) {
    return establishments
        .map(establishment => ({
            ...establishment,
            distance: calculateDistance(
                userLocation.lat,
                userLocation.lng,
                establishment.lat,
                establishment.lng
            ),
        }))
        .sort((a, b) => a.distance - b.distance)
}

/**
 * Filter establishments within a radius
 * @param {Array} establishments - Array of establishments
 * @param {Object} userLocation - User's coordinates
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Array} Filtered establishments
 */
export function filterByRadius(establishments, userLocation, radiusKm) {
    const withDistance = sortByDistance(establishments, userLocation)
    return withDistance.filter(e => e.distance <= radiusKm)
}

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)}m`
    }
    return `${km.toFixed(1)}km`
}
