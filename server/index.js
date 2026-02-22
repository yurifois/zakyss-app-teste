import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import routes from './routes/index.js'
import { errorHandler } from './middleware/error.middleware.js'
import { startNotificationScheduler } from './services/notificationScheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true)

        // Allow any localhost port
        if (origin.startsWith('http://localhost:')) {
            return callback(null, true)
        }

        // Allow production origins
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true)
        }

        // Allow any vercel/render preview URL in development
        if (process.env.NODE_ENV !== 'production' && (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com'))) {
            return callback(null, true)
        }

        callback(new Error('Not allowed by CORS'))
    },
    credentials: true
}))
app.use(express.json())

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Prevent API caching
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    next()
})

// Routes
app.use('/api', routes)

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Zakys API running on http://localhost:${PORT}`)
    console.log(`📚 Endpoints available at http://localhost:${PORT}/api`)

    // Iniciar scheduler de notificações
    startNotificationScheduler()
})
