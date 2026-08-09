import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const productsRepo = getRepository('products.json')
const appointmentsRepo = getRepository('appointments.json')

// Listar produtos do estabelecimento logado
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const products = await productsRepo.findAll({ establishmentId })
        res.json({
            success: true,
            data: products.sort((a, b) => a.name.localeCompare(b.name))
        })
    } catch (error) {
        next(error)
    }
})

// Histórico de vendas de produtos do estabelecimento
router.get('/sales/history', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const appointments = await appointmentsRepo.findAll({ establishmentId })

        const sales = appointments
            .filter(a => a.notes && typeof a.notes === 'string' && a.notes.includes('"type":"PRODUCT_SALE"'))
            .map(a => {
                let parsed = {}
                try { parsed = JSON.parse(a.notes) } catch (e) { /* ignore */ }
                return {
                    id: a.id,
                    date: a.date,
                    productId: parsed.productId,
                    productName: parsed.productName,
                    quantity: parsed.quantity,
                    unitPrice: parsed.unitPrice,
                    total: a.totalPrice
                }
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))

        res.json({ success: true, data: sales })
    } catch (error) {
        next(error)
    }
})

// Cadastrar novo produto
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { name, price, quantity } = req.body
        if (!name?.trim() || price === undefined || quantity === undefined) {
            throw new AppError('Nome, preço e quantidade são obrigatórios', 400)
        }

        const product = await productsRepo.create({
            establishmentId: parseInt(req.user.establishmentId),
            name: name.trim(),
            price: parseFloat(price),
            quantity: parseInt(quantity)
        })

        res.status(201).json({ success: true, data: product })
    } catch (error) {
        next(error)
    }
})

// Editar produto (nome, preço, ou reabastecer estoque manualmente)
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const product = await productsRepo.findById(req.params.id)
        if (!product) throw new AppError('Produto não encontrado', 404)
        if (parseInt(product.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }

        const { name, price, quantity } = req.body
        const updateData = {}
        if (name !== undefined) updateData.name = name.trim()
        if (price !== undefined) updateData.price = parseFloat(price)
        if (quantity !== undefined) updateData.quantity = parseInt(quantity)

        const updated = await productsRepo.update(req.params.id, updateData)
        res.json({ success: true, data: updated })
    } catch (error) {
        next(error)
    }
})

// Remover produto
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const product = await productsRepo.findById(req.params.id)
        if (!product) throw new AppError('Produto não encontrado', 404)
        if (parseInt(product.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }

        await productsRepo.delete(req.params.id)
        res.json({ success: true })
    } catch (error) {
        next(error)
    }
})

// Dar baixa: registra a venda, reduz o estoque e soma o valor na
// contabilidade do dia/mês/ano do estabelecimento (Analytics).
router.post('/:id/sell', authMiddleware, async (req, res, next) => {
    try {
        const product = await productsRepo.findById(req.params.id)
        if (!product) throw new AppError('Produto não encontrado', 404)
        if (parseInt(product.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }

        const quantitySold = parseInt(req.body.quantity) || 1
        if (quantitySold < 1) {
            throw new AppError('Quantidade inválida', 400)
        }
        if (quantitySold > product.quantity) {
            throw new AppError(`Estoque insuficiente: só há ${product.quantity} unidade(s) de ${product.name}`, 400)
        }

        const updatedProduct = await productsRepo.update(product.id, {
            quantity: product.quantity - quantitySold
        })

        const totalValue = product.price * quantitySold
        const today = new Date().toISOString().split('T')[0]

        // Reaproveita o mesmo mecanismo dos lançamentos manuais (um
        // "agendamento" concluído sem serviço, marcado por um type no notes)
        // pra a venda entrar automaticamente no faturamento do dia/mês/ano
        // no Analytics, sem duplicar a lógica de contabilidade que já existe.
        const saleEntry = await appointmentsRepo.create({
            establishmentId: product.establishmentId,
            userId: null,
            services: [],
            date: today,
            time: '00:00',
            status: 'completed',
            totalPrice: totalValue,
            totalDuration: 0,
            customerName: `Venda: ${product.name}`,
            customerPhone: '00000000000',
            customerEmail: null,
            notes: JSON.stringify({
                type: 'PRODUCT_SALE',
                productId: product.id,
                productName: product.name,
                quantity: quantitySold,
                unitPrice: product.price
            })
        })

        res.json({ success: true, data: { product: updatedProduct, sale: saleEntry } })
    } catch (error) {
        next(error)
    }
})

export default router
