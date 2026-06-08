import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'
import { supabase } from '../repositories/supabase.repository.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()
const establishmentsRepo = getRepository('establishments.json')
const usersRepo = getRepository('users.json')

// Filtro de arquivos (apenas imagens)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new AppError('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.', 400), false)
    }
}

// Configuração do multer usando memória (pois vamos enviar direto pro Supabase)
const storage = multer.memoryStorage()
const upload = multer({
    storage: storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

// Funções Auxiliares para o Supabase Storage
const BUCKET_NAME = 'zakys-uploads'

const uploadToSupabase = async (file, folder, prefix) => {
    if (!supabase) throw new AppError('Serviço de armazenamento (Supabase) não configurado.', 500)
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    const fileName = `${folder}/${prefix}-${uniqueSuffix}${ext}`

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        })

    if (error) {
        throw new AppError(`Erro ao fazer upload: ${error.message}`, 500)
    }

    const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName)

    return publicUrlData.publicUrl
}

const deleteFromSupabaseByUrl = async (url) => {
    if (!supabase || !url) return
    
    try {
        // Ex: https://....supabase.co/storage/v1/object/public/zakys-uploads/avatars/avatar-123.jpg
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split(`${BUCKET_NAME}/`)
        
        if (pathParts.length > 1) {
            const filePath = pathParts[1]
            await supabase.storage.from(BUCKET_NAME).remove([filePath])
        } else if (url.startsWith('/uploads/')) {
            // Tratamento de fallback para arquivos antigos que ainda estão na pasta local (apenas tenta apagar se a pasta existir)
            const oldPath = path.join(__dirname, '..', url)
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath)
            }
        }
    } catch (err) {
        console.error('Erro ao deletar arquivo do storage:', err.message)
    }
}

// Upload de avatar do usuário
router.post('/avatar/:userId', authMiddleware, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) throw new AppError('Nenhuma imagem enviada', 400)

        const user = await usersRepo.findById(req.params.userId)
        if (!user) throw new AppError('Usuário não encontrado', 404)

        // Remove avatar anterior se existir
        if (user.avatar) {
            await deleteFromSupabaseByUrl(user.avatar)
        }

        // Upload para o Supabase
        const publicUrl = await uploadToSupabase(req.file, 'avatars', `avatar-${req.params.userId}`)

        // Atualiza o usuário com a nova URL
        const updated = await usersRepo.update(req.params.userId, {
            avatar: publicUrl
        })

        const { password: _, ...userWithoutPassword } = updated

        res.json({
            success: true,
            data: {
                avatar: publicUrl,
                user: userWithoutPassword
            }
        })
    } catch (error) {
        next(error)
    }
})

// Upload de logo do estabelecimento
router.post('/logo/:id', authMiddleware, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) throw new AppError('Nenhuma imagem enviada', 400)

        const establishment = await establishmentsRepo.findById(req.params.id)
        if (!establishment) throw new AppError('Estabelecimento não encontrado', 404)

        // Remove logo anterior se existir
        if (establishment.image) {
            await deleteFromSupabaseByUrl(establishment.image)
        }

        const publicUrl = await uploadToSupabase(req.file, 'logos', `logo-${req.params.id}`)

        // Atualiza o estabelecimento
        const updated = await establishmentsRepo.update(req.params.id, {
            image: publicUrl
        })

        res.json({
            success: true,
            data: {
                image: publicUrl,
                establishment: updated
            }
        })
    } catch (error) {
        next(error)
    }
})

// Upload de imagem de serviço
router.post('/service-image/:id', authMiddleware, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) throw new AppError('Nenhuma imagem enviada', 400)

        const establishment = await establishmentsRepo.findById(req.params.id)
        if (!establishment) throw new AppError('Estabelecimento não encontrado', 404)

        const publicUrl = await uploadToSupabase(req.file, 'services', `service-${req.params.id}`)

        // Adiciona a nova imagem ao array
        const serviceImages = establishment.serviceImages || []
        serviceImages.push(publicUrl)

        const updated = await establishmentsRepo.update(req.params.id, {
            serviceImages
        })

        res.json({
            success: true,
            data: {
                image: publicUrl,
                serviceImages: updated.serviceImages
            }
        })
    } catch (error) {
        next(error)
    }
})

// Remover imagem de serviço
router.delete('/service-image/:id/:imageIndex', authMiddleware, async (req, res, next) => {
    try {
        const establishment = await establishmentsRepo.findById(req.params.id)
        if (!establishment) throw new AppError('Estabelecimento não encontrado', 404)

        const imageIndex = parseInt(req.params.imageIndex)
        const serviceImages = establishment.serviceImages || []

        if (imageIndex < 0 || imageIndex >= serviceImages.length) {
            throw new AppError('Índice de imagem inválido', 400)
        }

        const imageToRemove = serviceImages[imageIndex]
        
        // Remove do storage
        await deleteFromSupabaseByUrl(imageToRemove)

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
