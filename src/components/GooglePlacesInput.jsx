import { useEffect, useRef, useState } from 'react'

export default function GooglePlacesInput({ onPlaceSelected, className, placeholder }) {
    const inputRef = useRef(null)
    const autocompleteRef = useRef(null)
    const [status, setStatus] = import.meta.env.DEV ? useState('loading') : useState('ready') // Always show as ready in prod unless we have a better check

    useEffect(() => {
        // Global handler for Google Maps Auth failures
        window.gm_authFailure = () => {
            console.error('Google Maps authentication failed.')
            setStatus('error')
        }

        const initAutocomplete = () => {
            if (!window.google) {
                console.warn('Google Maps script not loaded yet, retrying...')
                setStatus('loading')
                return false
            }

            try {
                if (!window.google.maps.places) {
                    console.error('Google Places library not loaded. Check if libraries=places is in the script tag.')
                    setStatus('error')
                    return true // stop retrying but set error
                }

                autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                    componentRestrictions: { country: 'br' },
                    fields: ['address_components', 'geometry', 'name', 'formatted_address'],
                    types: ['establishment', 'geocode']
                })

                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace()
                    console.log('Place selected:', place)
                    if (onPlaceSelected) {
                        onPlaceSelected(place)
                    }
                })

                console.log('Google Places Autocomplete initialized successfully')
                setStatus('ready')
                return true
            } catch (err) {
                console.error('Error initializing Google Places:', err)
                setStatus('error')
                return false
            }
        }

        // Try to initialize
        let interval
        if (!initAutocomplete()) {
            interval = setInterval(() => {
                if (initAutocomplete()) {
                    clearInterval(interval)
                }
            }, 1000)
        }

        // Prevent form submission on enter
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
            }
        }

        const inputElement = inputRef.current
        inputElement.addEventListener('keydown', handleKeyDown)

        return () => {
            if (interval) clearInterval(interval)
            if (window.google && window.google.maps.event && autocompleteRef.current) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
            }
            inputElement.removeEventListener('keydown', handleKeyDown)
        }
    }, [onPlaceSelected])

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                ref={inputRef}
                type="text"
                className={className}
                placeholder={placeholder || "Busque pelo nome ou endereço do negócio"}
                style={{ paddingRight: '2.5rem' }}
            />
            <div style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center'
            }}>
                {status === 'loading' && (
                    <div className="animate-spin" style={{ width: '1rem', height: '1rem', border: '2px solid var(--primary-200)', borderTopColor: 'var(--primary-500)', borderRadius: '50%' }}></div>
                )}
                {status === 'ready' && (
                    <span title="Google Maps Ativo" style={{ color: 'var(--success-500)', fontSize: '0.8rem' }}>●</span>
                )}
                {status === 'error' && (
                    <span title="Erro ao carregar Google Maps" style={{ color: 'var(--error-500)', fontSize: '0.8rem' }}>⚠️</span>
                )}
            </div>
        </div>
    )
}
