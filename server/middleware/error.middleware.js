export function errorHandler(err, req, res, next) {
    console.error('Error:', err.message)

    const status = err.status || 500
    const message = err.message || 'Internal server error'

    res.status(status).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    })
}

export class AppError extends Error {
    constructor(message, status = 400) {
        super(message)
        this.status = status
    }
}
