import { Router } from 'express'
import { getRepository } from '../repositories/index.js'

const router = Router()
const servicesRepo = getRepository('services.json')

// Listar todos os serviços
router.get('/', async (req, res, next) => {
    try {
        let services = await servicesRepo.findAll()

        // Filter out custom services belonging to other establishments
        const reqEstId = req.query.establishmentId
        if (reqEstId) {
            services = services.filter(s => !s.establishmentId || String(s.establishmentId) === String(reqEstId))
        } else {
            // Se não passar establishmentId, retorna só os globais (sem establishmentId)
            services = services.filter(s => !s.establishmentId)
        }

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

// Criar novo serviço customizado
router.post('/', async (req, res, next) => {
    try {
        const { name, categoryId, price, duration, establishmentId } = req.body
        if (!name || !categoryId || !price || !duration || !establishmentId) {
            return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando' })
        }
        
        const newService = await servicesRepo.create({
            name,
            categoryId,
            price: Number(price),
            duration: Number(duration),
            establishmentId: Number(establishmentId)
        })

        res.status(201).json({
            success: true,
            data: newService
        })
    } catch (error) {
        next(error)
    }
})

// Atualizar serviço customizado
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params
        const service = await servicesRepo.findById(id)

        if (!service) {
            return res.status(404).json({ success: false, error: 'Serviço não encontrado' })
        }

        if (req.body.establishmentId && String(service.establishmentId) !== String(req.body.establishmentId)) {
             return res.status(403).json({ success: false, error: 'Não autorizado' })
        }

        const dataToUpdate = { ...req.body }
        if (dataToUpdate.price) dataToUpdate.price = Number(dataToUpdate.price)
        if (dataToUpdate.duration) dataToUpdate.duration = Number(dataToUpdate.duration)

        const updated = await servicesRepo.update(id, dataToUpdate)

        res.json({
            success: true,
            data: updated
        })
    } catch (error) {
        next(error)
    }
})

// Remover serviço customizado
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params
        const service = await servicesRepo.findById(id)

        if (!service) {
            return res.status(404).json({ success: false, error: 'Serviço não encontrado' })
        }

        const deleted = await servicesRepo.delete(id)

        res.json({
            success: true,
            data: deleted
        })
    } catch (error) {
        next(error)
    }
})

export default router
