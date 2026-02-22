import { Router } from 'express'
import { getRepository } from '../repositories/index.js'

const router = Router()
const categoriesRepo = getRepository('categories.json')
const servicesRepo = new JsonRepository('services.json')

// Listar categorias
router.get('/', async (req, res, next) => {
    try {
        const categories = await categoriesRepo.findAll()

        res.json({
            success: true,
            data: categories
        })
    } catch (error) {
        next(error)
    }
})

// Serviços por categoria
router.get('/:id/services', async (req, res, next) => {
    try {
        const services = await servicesRepo.findAll({ categoryId: req.params.id })

        res.json({
            success: true,
            data: services
        })
    } catch (error) {
        next(error)
    }
})

export default router
