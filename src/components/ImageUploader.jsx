import { useState, useRef } from 'react'

export default function ImageUploader({
    onUpload,
    currentImage,
    label = 'Imagem',
    accept = 'image/jpeg,image/png,image/webp,image/gif',
    maxSize = 5 * 1024 * 1024, // 5MB
    multiple = false,
    className = ''
}) {
    const [preview, setPreview] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [progress, setProgress] = useState(null) // { current, total }
    const [error, setError] = useState(null)
    const fileInputRef = useRef(null)

    const uploadOne = async (file) => {
        if (!file.type.startsWith('image/')) {
            throw new Error('Por favor, selecione um arquivo de imagem')
        }
        if (file.size > maxSize) {
            throw new Error(`O arquivo deve ter no máximo ${Math.round(maxSize / 1024 / 1024)}MB`)
        }
        await onUpload(file)
    }

    const handleFiles = async (fileList) => {
        const files = Array.from(fileList || [])
        if (files.length === 0) return

        setError(null)
        setIsUploading(true)

        // Preview só faz sentido pra um arquivo só (ex: logo); em lote, mostra progresso.
        if (files.length === 1 && !multiple) {
            const reader = new FileReader()
            reader.onload = (e) => setPreview(e.target.result)
            reader.readAsDataURL(files[0])
        }

        try {
            // Um de cada vez: o backend lê a galeria atual e regrava com a nova
            // imagem — em paralelo, uma requisição pode sobrescrever a outra.
            for (let i = 0; i < files.length; i++) {
                setProgress({ current: i + 1, total: files.length })
                await uploadOne(files[i])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setIsUploading(false)
            setProgress(null)
            // Volta pro estado "clique ou arraste" — sem isso a caixa fica presa
            // mostrando a última imagem enviada, em vez de ficar pronta pra próxima.
            setPreview(null)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        handleFiles(e.dataTransfer.files)
    }

    const handleChange = (e) => {
        handleFiles(e.target.files)
    }

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    const displayImage = preview || currentImage

    return (
        <div className={`image-uploader ${className}`}>
            <label className="form-label">{label}</label>

            <div
                className={`upload-area ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />

                {displayImage ? (
                    <div className="upload-preview">
                        <img src={displayImage} alt="Preview" />
                        {isUploading && (
                            <div className="upload-overlay">
                                <div className="spinner"></div>
                                <span>{progress ? `Enviando ${progress.current} de ${progress.total}...` : 'Enviando...'}</span>
                            </div>
                        )}
                    </div>
                ) : isUploading ? (
                    <div className="upload-placeholder">
                        <div className="spinner"></div>
                        <span className="upload-text">
                            {progress ? `Enviando ${progress.current} de ${progress.total}...` : 'Enviando...'}
                        </span>
                    </div>
                ) : (
                    <div className="upload-placeholder">
                        <span className="upload-icon">📷</span>
                        <span className="upload-text">
                            {isDragging
                                ? 'Solte as imagens aqui'
                                : multiple ? 'Clique ou arraste uma ou várias imagens' : 'Clique ou arraste uma imagem'}
                        </span>
                        <span className="upload-hint">
                            JPG, PNG, WEBP ou GIF (máx. {Math.round(maxSize / 1024 / 1024)}MB cada)
                        </span>
                    </div>
                )}
            </div>

            {error && <p className="form-error">{error}</p>}
        </div>
    )
}
