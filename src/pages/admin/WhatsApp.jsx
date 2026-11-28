import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import * as api from '../../services/api'

// Painel > WhatsApp: o salão conecta o próprio WhatsApp lendo um QR code (como
// no WhatsApp Web). A partir daí o app manda sozinho:
//  - para o número de avisos: "chegou agendamento novo";
//  - para o cliente: "seu agendamento foi confirmado" quando o salão confirma.
export default function AdminWhatsApp() {
    const { success, error } = useToast()
    const confirm = useConfirm()
    const [st, setSt] = useState(null)
    const [alerta, setAlerta] = useState('')
    const [ocupado, setOcupado] = useState(false)
    const timer = useRef(null)

    const carregar = async () => {
        try {
            const s = await api.getWhatsAppStatus()
            setSt(s)
            setAlerta(a => a || s.alertPhone || '')
            return s
        } catch (err) {
            error(err.message || 'Não foi possível ver o WhatsApp.')
        }
    }

    // Enquanto espera a leitura do QR, atualiza a cada 2 segundos.
    useEffect(() => {
        carregar()
        return () => clearInterval(timer.current)
    }, [])
    useEffect(() => {
        clearInterval(timer.current)
        if (st && ['connecting', 'qr'].includes(st.status)) {
            timer.current = setInterval(carregar, 2000)
        }
    }, [st?.status])

    const conectar = async () => {
        setOcupado(true)
        try { setSt({ ...(await api.connectWhatsApp()), alertPhone: st?.alertPhone }) }
        catch (err) { error(err.message || 'Não foi possível iniciar a conexão.') }
        finally { setOcupado(false) }
    }
    const desconectar = async () => {
        if (!(await confirm('O app para de mandar avisos pelo WhatsApp do salão até você conectar de novo.', { title: 'Desconectar WhatsApp', confirmLabel: 'Desconectar' }))) return
        setOcupado(true)
        try { await api.disconnectWhatsApp(); await carregar(); success('WhatsApp desconectado.') }
        catch (err) { error(err.message) }
        finally { setOcupado(false) }
    }
    const salvarAlerta = async () => {
        try { await api.setWhatsAppAlertPhone(alerta); success('Número de avisos salvo.'); await carregar() }
        catch (err) { error(err.message) }
    }
    const testar = async () => {
        try { await api.testWhatsApp(); success('Mensagem de teste enviada. Confira o WhatsApp do número de avisos.') }
        catch (err) { error(err.message) }
    }

    if (!st) return <div className="card py-8 text-center">Carregando...</div>

    const conectado = st.status === 'connected'
    return (
        <div style={{ maxWidth: 720 }}>
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">WhatsApp</h1>
                <p className="text-secondary">
                    Conecte o WhatsApp do salão e o app avisa sozinho: você recebe cada agendamento novo, e o cliente recebe a confirmação quando você confirmar.
                </p>
            </div>

            {!st.available && (
                <div className="card mb-6" style={{ padding: '1rem', border: '1px solid var(--warning-500, #f59e0b)' }}>
                    O WhatsApp ainda não foi ativado no servidor do Zakys. Fale com o suporte.
                </div>
            )}

            <div className="card mb-6" style={{ padding: '1.25rem' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="font-semibold">
                        {conectado ? '🟢 Conectado' : st.status === 'qr' ? '📷 Leia o QR code' : st.status === 'connecting' ? '⏳ Conectando...' : '⚪ Desconectado'}
                    </h2>
                    {conectado && <span className="text-sm text-secondary">Número: +{st.number}</span>}
                </div>

                {st.status === 'qr' && st.qr && (
                    <div className="flex flex-wrap gap-6 items-center">
                        <img src={st.qr} alt="QR code para conectar o WhatsApp" width={240} height={240} style={{ background: 'white', borderRadius: 12, padding: 8 }} />
                        <ol className="text-sm text-secondary" style={{ paddingLeft: '1.1rem', listStyle: 'decimal', lineHeight: 1.7, flex: '1 1 220px' }}>
                            <li>Abra o WhatsApp do salão no celular.</li>
                            <li>Toque em <strong>⋮ (ou Configurações) › Aparelhos conectados</strong>.</li>
                            <li>Toque em <strong>Conectar um aparelho</strong> e aponte para este QR code.</li>
                        </ol>
                    </div>
                )}

                {!conectado && st.status === 'disconnected' && (
                    <button className="btn btn-primary" onClick={conectar} disabled={ocupado || !st.available}>
                        {ocupado ? 'Gerando QR code...' : 'Conectar WhatsApp'}
                    </button>
                )}
                {conectado && (
                    <button className="btn btn-outline" onClick={desconectar} disabled={ocupado}>Desconectar</button>
                )}
            </div>

            <div className="card mb-6" style={{ padding: '1.25rem' }}>
                <h2 className="font-semibold mb-1">Número que recebe os avisos</h2>
                <p className="text-sm text-secondary mb-3">
                    Quando chegar agendamento novo, a mensagem vai para este celular (o seu ou o da recepção). Se ficar em branco, vai para o telefone do salão.
                </p>
                <div className="flex flex-wrap gap-2">
                    <input type="tel" className="form-input" style={{ maxWidth: 260 }} placeholder="(61) 99999-9999"
                        value={alerta} onChange={e => setAlerta(e.target.value)} autoComplete="tel" />
                    <button className="btn btn-outline" onClick={salvarAlerta}>Salvar</button>
                    <button className="btn btn-outline" onClick={testar} disabled={!conectado}>Enviar teste</button>
                </div>
            </div>

            <p className="text-xs text-muted">
                O Zakys só envia os avisos de agendamento: não lê nem guarda as conversas do salão. A conexão é a mesma do WhatsApp Web e não é um serviço oficial do WhatsApp — use para avisos de agendamento, não para mensagens em massa.
            </p>
        </div>
    )
}
