import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const productsRepo = getRepository('products.json')
const appointmentsRepo = getRepository('appointments.json')
const stockMovementsRepo = getRepository('stock_movements.json')

const MOVEMENT_TYPES = ['entrada', 'perda', 'uso_interno', 'ajuste']

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
        const { name, price, quantity, cost, unit, minStock, supplier } = req.body
        if (!name?.trim() || price === undefined || quantity === undefined) {
            throw new AppError('Nome, preço e quantidade são obrigatórios', 400)
        }

        const product = await productsRepo.create({
            establishmentId: parseInt(req.user.establishmentId),
            name: name.trim(),
            price: parseFloat(price),
            quantity: parseInt(quantity),
            cost: cost !== undefined && cost !== '' ? parseFloat(cost) : 0,
            unit: unit?.trim() || 'un',
            minStock: minStock !== undefined && minStock !== '' ? parseInt(minStock) : 0,
            supplier: supplier?.trim() || ''
        })

        res.status(201).json({ success: true, data: product })
    } catch (error) {
        next(error)
    }
})

// Editar produto (nome, preço, custo, unidade, estoque mínimo, fornecedor).
// Não mexe em quantidade diretamente — isso passa a ser só via /movement,
// pra sempre deixar rastro de por que o estoque mudou.
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const product = await productsRepo.findById(req.params.id)
        if (!product) throw new AppError('Produto não encontrado', 404)
        if (parseInt(product.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }

        const { name, price, cost, unit, minStock, supplier } = req.body
        const updateData = {}
        if (name !== undefined) updateData.name = name.trim()
        if (price !== undefined) updateData.price = parseFloat(price)
        if (cost !== undefined) updateData.cost = parseFloat(cost) || 0
        if (unit !== undefined) updateData.unit = unit.trim() || 'un'
        if (minStock !== undefined) updateData.minStock = parseInt(minStock) || 0
        if (supplier !== undefined) updateData.supplier = supplier.trim()

        const updated = await productsRepo.update(req.params.id, updateData)
        res.json({ success: true, data: updated })
    } catch (error) {
        next(error)
    }
})

// Registrar movimentação de estoque: entrada (reposição), perda, uso
// interno ou ajuste de contagem. Mantém um histórico imutável em
// stock_movements e atualiza o saldo em products.quantity.
router.post('/:id/movement', authMiddleware, async (req, res, next) => {
    try {
        const product = await productsRepo.findById(req.params.id)
        if (!product) throw new AppError('Produto não encontrado', 404)
        if (parseInt(product.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }

        const { type, quantity, note, direction } = req.body
        if (!MOVEMENT_TYPES.includes(type)) {
            throw new AppError('Tipo de movimentação inválido', 400)
        }

        const qty = parseInt(quantity)
        if (!qty || qty < 1) {
            throw new AppError('Quantidade inválida', 400)
        }

        let delta
        if (type === 'entrada') delta = qty
        else if (type === 'perda' || type === 'uso_interno') delta = -qty
        else delta = direction === 'decrease' ? -qty : qty // ajuste: sinal escolhido pelo admin

        const newQuantity = (product.quantity || 0) + delta
        if (newQuantity < 0) {
            throw new AppError(`Isso deixaria o estoque negativo (atual: ${product.quantity})`, 400)
        }

        const updatedProduct = await productsRepo.update(product.id, { quantity: newQuantity })

        const movement = await stockMovementsRepo.create({
            establishmentId: product.establishmentId,
            productId: product.id,
            productName: product.name,
            type,
            quantity: delta,
            note: note?.trim() || '',
            date: new Date().toISOString().split('T')[0]
        })

        res.json({ success: true, data: { product: updatedProduct, movement } })
    } catch (error) {
        next(error)
    }
})

// Histórico de movimentações de estoque do estabelecimento (todas, de
// todos os produtos, incluindo as vendas registradas em /:id/sell).
router.get('/movements/history', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const movements = await stockMovementsRepo.findAll({ establishmentId })
        res.json({
            success: true,
            data: movements.sort((a, b) => new Date(b.date) - new Date(a.date))
        })
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

        // Também loga em stock_movements pra a venda aparecer junto no
        // histórico consolidado de movimentações, não só no de vendas.
        await stockMovementsRepo.create({
            establishmentId: product.establishmentId,
            productId: product.id,
            productName: product.name,
            type: 'venda',
            quantity: -quantitySold,
            note: `Venda (${quantitySold}x)`,
            date: today
        })

        res.json({ success: true, data: { product: updatedProduct, sale: saleEntry } })
    } catch (error) {
        next(error)
    }
})

export default router
