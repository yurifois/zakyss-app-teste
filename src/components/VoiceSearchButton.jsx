import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'

// Busca por voz (item do contrato: Web Speech API). Usa o reconhecimento de
// voz do próprio navegador — sem custo e sem mandar áudio para servidor nosso.
// Funciona no Chrome/Android e no Safari recente; onde não existe, o botão
// simplesmente não aparece.
const Reconhecedor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

export default function VoiceSearchButton({ onResult, onError }) {
    const [ouvindo, setOuvindo] = useState(false)
    const rec = useRef(null)

    useEffect(() => () => rec.current?.abort?.(), [])

    if (!Reconhecedor) return null

    const alternar = () => {
        if (ouvindo) {
            rec.current?.stop()
            return
        }
        const r = new Reconhecedor()
        r.lang = 'pt-BR'
        r.interimResults = false
        r.maxAlternatives = 1
        r.onresult = (e) => {
            const texto = e.results?.[0]?.[0]?.transcript?.trim()
            if (texto) onResult(texto)
        }
        r.onerror = (e) => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                onError?.('Permita o uso do microfone para buscar por voz.')
            } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
                onError?.('Não entendi. Tente de novo ou digite.')
            }
        }
        r.onend = () => setOuvindo(false)
        rec.current = r
        setOuvindo(true)
        r.start()
    }

    return (
        <button
            type="button"
            onClick={alternar}
            className={`voice-btn ${ouvindo ? 'voice-btn--ouvindo' : ''}`}
            aria-label={ouvindo ? 'Parar de ouvir' : 'Buscar por voz'}
            aria-pressed={ouvindo}
            title={ouvindo ? 'Ouvindo… toque para parar' : 'Buscar por voz'}
        >
            <Mic size={20} />
        </button>
    )
}
