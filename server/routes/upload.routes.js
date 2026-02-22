import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()
const establishmentsRepo = getRepository('establishments.json')
const usersRepo = getRepository('users.json')

// Configuração do multer para avatars de usuários
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/avatars')
        cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname)
        cb(null, `avatar-${req.params.userId}-${uniqueSuffix}${ext}`)
    }
})

// Configuração do multer para logos
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/logos')
        cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname)
        cb(null, `logo-${req.params.id}-${uniqueSuffix}${ext}`)
    }
})

// Configuração do multer para imagens de serviços
const serviceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/services')
        cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname)
        cb(null, `service-${req.params.id}-${uniqueSuffix}${ext}`)
    }
})

// Filtro de arquivos (apenas imagens)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new AppError('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.', 400), false)
    }
}

const uploadLogo = multer({
    storage: logoStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

const uploadService = multer({
    storage: serviceStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

const uploadAvatar = multer({
    storage: avatarStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

// Upload de avatar do usuário
router.post('/avatar/:userId', authMiddleware, uploadAvatar.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('Nenhuma imagem enviada', 400)
        }

        const user = await usersRepo.findById(req.params.userId)
        if (!user) {
            fs.unlinkSync(req.file.path)
            throw new AppError('Usuário não encontrado', 404)
        }

        // Remove avatar anterior se existir e for local
        if (user.avatar && user.avatar.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, '..', user.avatar)
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath)
            }
        }

        // Atualiza o usuário com o novo avatar
        const avatarUrl = `/uploads/avatars/${req.file.filename}`
        const updated = await usersRepo.update(req.params.userId, {
            avatar: avatarUrl
        })

        const { password: _, ...userWithoutPassword } = updated

        res.json({
            success: true,
            data: {
                avatar: avatarUrl,
                user: userWithoutPassword
            }
        })
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path)
        }
        next(error)
    }
})

// Upload de logo do estabelecimento
router.post('/logo/:id', authMiddleware, uploadLogo.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('Nenhuma imagem enviada', 400)
        }

        const establishment = await establishmentsRepo.findById(req.params.id)
        if (!establishment) {
            // Remove o arquivo se o estabelecimento não existir
            fs.unlinkSync(req.file.path)
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        // Remove logo anterior se existir e for local
        if (establishment.image && establishment.image.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, '..', establishment.image)
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath)
            }
        }

        // Atualiza o estabelecimento com a nova imagem
        const imageUrl = `/uploads/logos/${req.file.filename}`
        const updated = await establishmentsRepo.update(req.params.id, {
            image: imageUrl
        })

        res.json({
            success: true,
            data: {
                image: imageUrl,
                establishment: updated
            }
        })
    } catch (error) {
        // Remove arquivo em caso de erro
        if (req.file) {
            fs.unlinkSync(req.file.path)
        }
        next(error)
    }
})

// Upload de imagem de serviço
router.post('/service-image/:id', authMiddleware, uploadService.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('Nenhuma imagem enviada', 400)
        }

        const establishment = await establishmentsRepo.findById(req.params.id)
        if (!establishment) {
            fs.unlinkSync(req.file.path)
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        const imageUrl = `/uploads/services/${req.file.filename}`

        // Adiciona a nova imagem ao array serviceImages
        const serviceImages = establishment.serviceImages || []
        serviceImages.push(imageUrl)

        const updated = await establishmentsRepo.update(req.params.id, {
            serviceImages
        })

        res.json({
            success: true,
            data: {
                image: imageUrl,
                serviceImages: updated.serviceImages
            }
        })
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path)
        }
        next(error)
    }
})

// Remover imagem de serviço
router.delete('/service-image/:id/:imageIndex', authMiddleware, async (req, res, next) => {
    try {
        const establishment = await establishmentsRepo.findById(req.params.id)
        if (!establishment) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        const imageIndex = parseInt(req.params.imageIndex)
        const serviceImages = establishment.serviceImages || []

        if (imageIndex < 0 || imageIndex >= serviceImages.length) {
            throw new AppError('Índice de imagem inválido', 400)
        }

        // Remove o arquivo físico
        const imageToRemove = serviceImages[imageIndex]
        if (imageToRemove.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', imageToRemove)
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
        }

        // Remove do array
        serviceImages.splice(imageIndex, 1)

        const updated = await establishmentsRepo.update(req.params.id, {
            serviceImages
        })

        res.json({
            success: true,
            data: {
                serviceImages: updated.serviceImages
            }
        })
    } catch (error) {
        next(error)
    }
})

export default router
