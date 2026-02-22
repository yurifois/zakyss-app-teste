import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now()

        setToasts(prev => [...prev, { id, message, type }])

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)

        return id
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const success = useCallback((message) => addToast(message, 'success'), [addToast])
    const error = useCallback((message) => addToast(message, 'error'), [addToast])
    const warning = useCallback((message) => addToast(message, 'warning'), [addToast])
    const info = useCallback((message) => addToast(message, 'info'), [addToast])

    const value = {
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
    }

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                    onClick={() => onRemove(toast.id)}
                >
                    <span className="toast-icon">
                        {toast.type === 'success' && '✓'}
                        {toast.type === 'error' && '✕'}
                        {toast.type === 'warning' && '⚠'}
                        {toast.type === 'info' && 'ℹ'}
                    </span>
                    <span>{toast.message}</span>
                </div>
            ))}
        </div>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}
