import { Router } from 'express'
import { getRepository } from '../repositories/index.js'

const router = Router()
const servicesRepo = getRepository('services.json')

// Listar todos os serviços
router.get('/', async (req, res, next) => {
    try {
        let services = await servicesRepo.findAll()

        // Filtrar por categoria se fornecido
        if (req.query.category) {
            services = services.filter(s => s.categoryId === req.query.category)
        }

        res.json({
            success: true,
            data: services
        })
    } catch (error) {
        next(error)
    }
})

// Buscar serviço por ID
router.get('/:id', async (req, res, next) => {
    try {
        const service = await servicesRepo.findById(req.params.id)

        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Serviço não encontrado'
            })
        }

        res.json({
            success: true,
            data: service
        })
    } catch (error) {
        next(error)
    }
})

// Buscar múltiplos serviços por IDs
router.post('/batch', async (req, res, next) => {
    try {
        const { ids } = req.body
        const allServices = await servicesRepo.findAll()
        const services = allServices.filter(s => ids.includes(s.id))

        res.json({
            success: true,
            data: services
        })
    } catch (error) {
        next(error)
    }
})

export default router
