import { Router } from 'express'
import authRoutes from './auth.routes.js'
import usersRoutes from './users.routes.js'
import categoriesRoutes from './categories.routes.js'
import servicesRoutes from './services.routes.js'
import establishmentsRoutes from './establishments.routes.js'
import appointmentsRoutes from './appointments.routes.js'
import uploadRoutes from './upload.routes.js'
import employeesRoutes from './employees.routes.js'
import analyticsRoutes from './analytics.routes.js'
import productsRoutes from './products.routes.js'
import cashflowRoutes from './cashflow.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', usersRoutes)
router.use('/categories', categoriesRoutes)
router.use('/services', servicesRoutes)
router.use('/establishments', establishmentsRoutes)
router.use('/appointments', appointmentsRoutes)
router.use('/upload', uploadRoutes)
router.use('/employees', employeesRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/products', productsRoutes)
router.use('/cashflow', cashflowRoutes)

export default router
