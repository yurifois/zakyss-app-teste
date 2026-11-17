import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import routes from './routes/index.js'
import { errorHandler } from './middleware/error.middleware.js'
import { startNotificationScheduler } from './services/notificationScheduler.js'
import { startKeepAlive } from './services/keepAliveService.js'
import { getRepository } from './repositories/index.js'
import morgan from 'morgan'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.disable('x-powered-by')
// O Render fica atrás de um proxy: sem isto, req.ip seria o IP do proxy e o
// limite de tentativas (rateLimit) trataria todo mundo como uma pessoa só.
app.set('trust proxy', 1)

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : []
// Origens do app Android/iOS empacotado com Capacitor.
const nativeAppOrigins = ['capacitor://localhost', 'https://localhost', 'http://localhost']

app.use(cors({
    origin: function (origin, callback) {
        // Sem origem = app nativo, curl, servidor-a-servidor
        if (!origin) return callback(null, true)

        // Desenvolvimento local (qualquer porta)
        if (origin.startsWith('http://localhost:')) return callback(null, true)

        if (nativeAppOrigins.includes(origin) || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true)
        }

        // Não liberar mais *.vercel.app / *.onrender.com por curinga: qualquer
        // pessoa publica um site nesses domínios em minutos. Preview novo que
        // precise falar com a API entra em ALLOWED_ORIGINS no Render.
        console.warn(`🛑 Blocked by CORS: ${origin}`)
        callback(new Error('Not allowed by CORS'))
    },
    credentials: true
}))
app.use(express.json())
app.use(morgan('dev')) // Logging de requisições

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
app.get('/api/health', async (req, res) => {
    try {
        // Faz uma query muito leve para evitar que o banco (ex: Supabase) hiberne após 7 dias de inatividade
        if (process.env.SUPABASE_URL) {
            const establishmentsRepo = getRepository('establishments.json')
            await establishmentsRepo.findAll()
        }
        
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV,
            database: process.env.SUPABASE_URL ? 'supabase' : 'json'
        })
    } catch (error) {
        console.error('Health check database ping failed:', error.message)
        res.status(500).json({ status: 'error', message: 'Database ping failed' })
    }
})

// Error handling
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Zakys API running on http://localhost:${PORT}`)
    console.log(`📚 Endpoints available at http://localhost:${PORT}/api`)

    // Iniciar scheduler de notificações
    startNotificationScheduler()

    // Iniciar serviço de keep-alive para evitar adormecimento do backend
    startKeepAlive()
})
