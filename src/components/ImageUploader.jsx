import { useState, useRef } from 'react'

export default function ImageUploader({
    onUpload,
    currentImage,
    label = 'Imagem',
    accept = 'image/jpeg,image/png,image/webp,image/gif',
    maxSize = 5 * 1024 * 1024, // 5MB
    className = ''
}) {
    const [preview, setPreview] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState(null)
    const fileInputRef = useRef(null)

    const handleFile = async (file) => {
        if (!file) return

        // Validar tipo
        if (!file.type.startsWith('image/')) {
            setError('Por favor, selecione um arquivo de imagem')
            return
        }

        // Validar tamanho
        if (file.size > maxSize) {
            setError(`O arquivo deve ter no máximo ${Math.round(maxSize / 1024 / 1024)}MB`)
            return
        }

        setError(null)

        // Preview
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target.result)
        reader.readAsDataURL(file)

        // Upload
        setIsUploading(true)
        try {
            await onUpload(file)
        } catch (err) {
            setError(err.message)
            setPreview(null)
        } finally {
            setIsUploading(false)
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
        const file = e.dataTransfer.files[0]
        handleFile(file)
    }

    const handleChange = (e) => {
        const file = e.target.files[0]
        handleFile(file)
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
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />

                {displayImage ? (
                    <div className="upload-preview">
                        <img src={displayImage} alt="Preview" />
                        {isUploading && (
                            <div className="upload-overlay">
                                <div className="spinner"></div>
                                <span>Enviando...</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="upload-placeholder">
                        <span className="upload-icon">📷</span>
                        <span className="upload-text">
                            {isDragging ? 'Solte a imagem aqui' : 'Clique ou arraste uma imagem'}
                        </span>
                        <span className="upload-hint">
                            JPG, PNG, WEBP ou GIF (máx. {Math.round(maxSize / 1024 / 1024)}MB)
                        </span>
                    </div>
                )}
            </div>

            {error && <p className="form-error">{error}</p>}
        </div>
    )
}
