export function errorHandler(err, req, res, next) {
    console.error('Error:', err.message)

    const status = err.status || 500
    const message = err.message || 'Internal server error'

    res.status(status).json({
        success: false,
        error: message,
        // Código estável para a tela reagir (ex.: EMAIL_NOT_VERIFIED mostra
        // o botão "reenviar confirmação") sem depender do texto da mensagem.
        ...(err.code && typeof err.code === 'string' && /^[A-Z_]+$/.test(err.code) && { code: err.code }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    })
}

export class AppError extends Error {
    constructor(message, status = 400, code) {
        super(message)
        this.status = status
        if (code) this.code = code
    }
}
