import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Confirmação desenhada pelo próprio app, no lugar de window.confirm/alert.
//
// Por quê: o navegador embutido do WhatsApp/Instagram (e alguns celulares)
// bloqueia as caixinhas do navegador sem mostrar nada — window.confirm devolve
// "não" na hora e window.alert simplesmente some. Para a pessoa, o botão
// "não funciona". Foi exatamente o que travou o "Excluir minha conta".
//
// Uso:
//   const confirm = useConfirm()
//   if (!(await confirm('Remover este produto?'))) return
//   await confirm('Cancelar?', { confirmLabel: 'Sim, cancelar', danger: true })

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
    const [pending, setPending] = useState(null)
    const cancelRef = useRef(null)

    const confirm = useCallback((message, options = {}) => {
        return new Promise(resolve => {
            setPending({
                message,
                title: options.title || 'Confirmar',
                confirmLabel: options.confirmLabel || 'Confirmar',
                cancelLabel: options.cancelLabel || 'Voltar',
                danger: options.danger ?? true,
                resolve,
            })
        })
    }, [])

    const close = useCallback((answer) => {
        setPending(current => {
            current?.resolve(answer)
            return null
        })
    }, [])

    useEffect(() => {
        if (!pending) return
        // Foco no "Voltar": num Enter distraído, o padrão é NÃO apagar nada.
        cancelRef.current?.focus()
        const onKey = (e) => { if (e.key === 'Escape') close(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [pending, close])

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {pending && (
                <div className="modal-backdrop" onClick={() => close(false)}>
                    <div
                        className="modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        aria-describedby="confirm-message"
                        style={{ maxWidth: '420px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-body">
                            <h3 id="confirm-title" className="text-lg font-bold mb-2">{pending.title}</h3>
                            <p id="confirm-message" className="text-secondary" style={{ whiteSpace: 'pre-line' }}>{pending.message}</p>
                        </div>
                        <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
                            <button ref={cancelRef} type="button" className="btn btn-outline" onClick={() => close(false)}>
                                {pending.cancelLabel}
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={pending.danger ? { background: '#dc2626', borderColor: '#dc2626', color: 'white', boxShadow: 'none' } : undefined}
                                onClick={() => close(true)}
                            >
                                {pending.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    )
}

export function useConfirm() {
    const confirm = useContext(ConfirmContext)
    if (!confirm) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>')
    return confirm
}
