import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const packagesRepo = getRepository('packages.json')
const customerPackagesRepo = getRepository('customer_packages.json')
const packageUsageRepo = getRepository('package_usage.json')
const appointmentsRepo = getRepository('appointments.json')

// ===== Definições de pacote (o "cardápio" que o estabelecimento vende) =====

router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const packages = await packagesRepo.findAll({ establishmentId })
        res.json({ success: true, data: packages.sort((a, b) => a.name.localeCompare(b.name)) })
    } catch (error) {
        next(error)
    }
})

router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const { name, description, serviceIds, totalCredits, price, validityDays } = req.body

        if (!name?.trim() || !totalCredits || price === undefined) {
            throw new AppError('Nome, créditos e preço são obrigatórios', 400)
        }

        const pkg = await packagesRepo.create({
            establishmentId,
            name: name.trim(),
            description: description?.trim() || '',
            serviceIds: Array.isArray(serviceIds) ? serviceIds.map(id => parseInt(id)) : [],
            totalCredits: parseInt(totalCredits),
            price: parseFloat(price),
            validityDays: validityDays ? parseInt(validityDays) : null,
            active: true
        })

        res.status(201).json({ success: true, data: pkg })
    } catch (error) {
        next(error)
    }
})

router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const pkg = await packagesRepo.findById(req.params.id)
        if (!pkg) throw new AppError('Pacote não encontrado', 404)
        if (parseInt(pkg.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }

        const { name, description, serviceIds, totalCredits, price, validityDays, active } = req.body
        const updateData = {}
        if (name !== undefined) updateData.name = name.trim()
        if (description !== undefined) updateData.description = description.trim()
        if (serviceIds !== undefined) updateData.serviceIds = serviceIds.map(id => parseInt(id))
        if (totalCredits !== undefined) updateData.totalCredits = parseInt(totalCredits)
        if (price !== undefined) updateData.price = parseFloat(price)
        if (validityDays !== undefined) updateData.validityDays = validityDays ? parseInt(validityDays) : null
        if (active !== undefined) updateData.active = !!active

        const updated = await packagesRepo.update(req.params.id, updateData)
        res.json({ success: true, data: updated })
    } catch (error) {
        next(error)
    }
})

router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const pkg = await packagesRepo.findById(req.params.id)
        if (!pkg) throw new AppError('Pacote não encontrado', 404)
        if (parseInt(pkg.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }
        await packagesRepo.delete(req.params.id)
        res.json({ success: true })
    } catch (error) {
        next(error)
    }
})

// ===== Pacotes vendidos (instâncias associadas a um cliente) =====

// Calcula status derivado em vez de guardar campo mutável que possa
// dessincronizar (esgotado por uso, expirado por data).
const withStatus = (cp) => {
    const now = new Date()
    let status = 'ativo'
    if (cp.usedCredits >= cp.totalCredits) status = 'esgotado'
    else if (cp.expiresAt && new Date(cp.expiresAt) < now) status = 'expirado'
    const daysToExpire = cp.expiresAt ? Math.ceil((new Date(cp.expiresAt) - now) / 86400000) : null
    return { ...cp, status, remainingCredits: Math.max(0, cp.totalCredits - cp.usedCredits), daysToExpire }
}

router.get('/sold', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const { clientKey } = req.query
        const filter = clientKey ? { establishmentId, clientKey } : { establishmentId }
        const sold = await customerPackagesRepo.findAll(filter)
        res.json({
            success: true,
            data: sold.map(withStatus).sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
        })
    } catch (error) {
        next(error)
    }
})

// Vende um pacote pra um cliente: cria a instância + um "agendamento fantasma"
// concluído (mesmo mecanismo já usado em Produtos), pra o valor entrar
// automaticamente no faturamento do dia sem duplicar a lógica do Analytics.
router.post('/sell', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const { packageId, customerName, customerPhone, customerEmail } = req.body

        if (!packageId || !customerName?.trim() || !customerPhone?.trim()) {
            throw new AppError('Pacote, nome e telefone do cliente são obrigatórios', 400)
        }

        const pkg = await packagesRepo.findById(packageId)
        if (!pkg || parseInt(pkg.establishmentId) !== establishmentId) {
            throw new AppError('Pacote não encontrado', 404)
        }

        const normalizePhone = (phone) => (phone || '').replace(/\D/g, '')
        const clientKey = normalizePhone(customerPhone) || `email:${(customerEmail || '').toLowerCase()}`

        const purchaseDate = new Date().toISOString().split('T')[0]
        const expiresAt = pkg.validityDays
            ? new Date(Date.now() + pkg.validityDays * 86400000).toISOString().split('T')[0]
            : null

        const customerPackage = await customerPackagesRepo.create({
            establishmentId,
            packageId: pkg.id,
            packageName: pkg.name,
            serviceIds: pkg.serviceIds || [],
            totalCredits: pkg.totalCredits,
            usedCredits: 0,
            price: pkg.price,
            clientKey,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail?.trim() || null,
            purchaseDate,
            expiresAt
        })

        const saleEntry = await appointmentsRepo.create({
            establishmentId,
            userId: null,
            services: [],
            date: purchaseDate,
            time: '00:00',
            status: 'completed',
            totalPrice: pkg.price,
            totalDuration: 0,
            customerName: `Pacote: ${pkg.name}`,
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail?.trim() || null,
            notes: JSON.stringify({
                type: 'PACKAGE_SALE',
                packageId: pkg.id,
                packageName: pkg.name,
                customerPackageId: customerPackage.id
            })
        })

        res.status(201).json({ success: true, data: { customerPackage: withStatus(customerPackage), sale: saleEntry } })
    } catch (error) {
        next(error)
    }
})

// Consome um crédito de um pacote já vendido.
router.post('/:customerPackageId/use', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const cp = await customerPackagesRepo.findById(req.params.customerPackageId)
        if (!cp || parseInt(cp.establishmentId) !== establishmentId) {
            throw new AppError('Pacote do cliente não encontrado', 404)
        }

        const current = withStatus(cp)
        if (current.status === 'esgotado') throw new AppError('Esse pacote já esgotou os créditos', 400)
        if (current.status === 'expirado') throw new AppError('Esse pacote está vencido', 400)

        const { serviceId, quantity, note } = req.body
        const qty = parseInt(quantity) || 1
        if (current.remainingCredits < qty) {
            throw new AppError(`Só restam ${current.remainingCredits} crédito(s) nesse pacote`, 400)
        }

        const updated = await customerPackagesRepo.update(cp.id, { usedCredits: cp.usedCredits + qty })

        const usage = await packageUsageRepo.create({
            establishmentId,
            customerPackageId: cp.id,
            serviceId: serviceId ? parseInt(serviceId) : null,
            quantity: qty,
            note: note?.trim() || '',
            date: new Date().toISOString().split('T')[0]
        })

        res.json({ success: true, data: { customerPackage: withStatus(updated), usage } })
    } catch (error) {
        next(error)
    }
})

router.get('/:customerPackageId/usage', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const cp = await customerPackagesRepo.findById(req.params.customerPackageId)
        if (!cp || parseInt(cp.establishmentId) !== establishmentId) {
            throw new AppError('Pacote do cliente não encontrado', 404)
        }
        const usage = await packageUsageRepo.findAll({ customerPackageId: cp.id })
        res.json({ success: true, data: usage.sort((a, b) => new Date(b.date) - new Date(a.date)) })
    } catch (error) {
        next(error)
    }
})

export default router
