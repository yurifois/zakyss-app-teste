import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import * as api from '../../services/api'
import ClientNotesModal, { FLAG_LABELS } from '../../components/ClientNotesModal'

// CRM do salão: ficha de cada cliente, listas prontas, WhatsApp com 1 toque e
// cartão fidelidade. Tudo calculado a partir dos agendamentos — o salão não
// precisa cadastrar nada à parte.

const lastNotePreview = (note) => {
    if (!note) return ''
    const text = (note.note || '').trim()
    if (text) return text.length > 60 ? `${text.slice(0, 60)}...` : text
    if (note.flags?.length) return note.flags.map(f => FLAG_LABELS[f] || f).join(', ')
    return 'Anotação registrada'
}

const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const [year, month, day] = dateStr.split('-')
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}
const reais = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const diasDesde = (dateStr) => dateStr ? Math.floor((Date.now() - new Date(`${dateStr}T12:00:00`).getTime()) / 86400000) : null
const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || ''

// Telefone brasileiro no formato que o WhatsApp entende (55 + DDD + número).
function telefoneWhatsApp(phone) {
    const d = String(phone || '').replace(/\D/g, '')
    if (!d) return null
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
    if (d.length === 10 || d.length === 11) return `55${d}`
    return null
}

// Listas prontas. A ordem aqui é a ordem dos botões.
const LISTAS = [
    { id: 'todos', rotulo: 'Todos', dica: 'Todos os clientes', filtro: () => true },
    { id: 'vip', rotulo: '⭐ VIP', dica: '5 atendimentos ou mais, ou entre os que mais gastam', filtro: (c, ctx) => c.visitCount >= 5 || (c.totalSpent > 0 && c.totalSpent >= ctx.corteVip) },
    { id: 'sumidos', rotulo: '💤 Sumidos', dica: 'Não voltam há mais de 60 dias e não têm horário marcado', filtro: (c) => !c.nextAppointment && diasDesde(c.lastVisit) > 60 },
    { id: 'faltaram', rotulo: '⚠️ Faltaram', dica: 'Já faltaram sem avisar', filtro: (c) => c.noShows > 0 },
    { id: 'pacote', rotulo: '📦 Pacote acabando', dica: 'Pacote com 1 sessão sobrando', filtro: (c) => c.packages?.some(p => !p.expired && p.remaining === 1) },
    { id: 'novos', rotulo: '🌱 Novos', dica: 'Primeiro atendimento nos últimos 30 dias ou primeiro horário marcado', filtro: (c) => (c.firstVisit && diasDesde(c.firstVisit) <= 30) || (!c.firstVisit && c.nextAppointment) },
    { id: 'premio', rotulo: '🎁 Com prêmio', dica: 'Cartão fidelidade completo, prêmio para usar', filtro: (c) => c.loyalty?.available > 0, soComFidelidade: true },
]

// Mensagem pronta de acordo com a lista em que o cliente está.
function mensagemPara(cliente, lista, salao, link) {
    const nome = primeiroNome(cliente.name)
    if (cliente.loyalty?.available > 0) return `Oi ${nome}! Você completou seu cartão fidelidade aqui no ${salao} e ganhou ${cliente.loyalty.reward} 🎁 Quer agendar para usar? ${link}`
    if (lista === 'sumidos') return `Oi ${nome}, tudo bem? Faz tempo que você não vem aqui no ${salao}, sentimos sua falta! Que tal agendar um horário? ${link}`
    if (lista === 'pacote') return `Oi ${nome}! Seu pacote aqui no ${salao} está na última sessão. Quer agendar ou renovar? ${link}`
    return `Oi ${nome}, tudo bem? Aqui é do ${salao}. Quando quiser agendar, é só tocar no link: ${link}`
}

function BolinhasFidelidade({ loyalty }) {
    return (
        <div className="flex flex-wrap gap-1" aria-label={`${loyalty.progress} de ${loyalty.visitsRequired}`}>
            {Array.from({ length: loyalty.visitsRequired }).map((_, i) => (
                <span key={i} style={{
                    width: 18, height: 18, borderRadius: 999,
                    background: i < loyalty.progress ? 'var(--accent-400)' : 'transparent',
                    border: '2px solid var(--accent-400)', opacity: i < loyalty.progress ? 1 : 0.4
                }} />
            ))}
        </div>
    )
}

export default function AdminClients() {
    const { admin } = useAuth()
    const { success, error } = useToast()
    const confirm = useConfirm()
    const [clients, setClients] = useState([])
    const [establishment, setEstablishment] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [lista, setLista] = useState('todos')
    const [expandedKey, setExpandedKey] = useState(null)
    const [notesByKey, setNotesByKey] = useState({})
    const [loadingNotes, setLoadingNotes] = useState(false)
    const [notesClient, setNotesClient] = useState(null)

    // Configuração do cartão fidelidade
    const [editandoFidelidade, setEditandoFidelidade] = useState(false)
    const [fidelidade, setFidelidade] = useState({ enabled: false, visitsRequired: 10, reward: '' })
    const [salvandoFidelidade, setSalvandoFidelidade] = useState(false)

    useEffect(() => {
        if (admin) loadAll()
    }, [admin])

    const loadAll = async () => {
        setLoading(true)
        try {
            const [data, est] = await Promise.all([
                api.getEstablishmentClients(admin.establishmentId),
                api.getEstablishmentById(admin.establishmentId),
            ])
            setClients(data)
            setEstablishment(est)
            const p = est?.loyaltyProgram || {}
            setFidelidade({ enabled: !!p.enabled, visitsRequired: p.visitsRequired || 10, reward: p.reward || '' })
        } catch (err) {
            console.error('Error loading clients:', err)
            error('Não foi possível carregar os clientes.')
        } finally {
            setLoading(false)
        }
    }

    const salvarFidelidade = async () => {
        const visitas = parseInt(fidelidade.visitsRequired)
        if (fidelidade.enabled && (!Number.isInteger(visitas) || visitas < 2 || visitas > 50)) {
            return error('Escolha entre 2 e 50 atendimentos para completar o cartão.')
        }
        if (fidelidade.enabled && !fidelidade.reward.trim()) return error('Diga qual é o prêmio (ex.: um corte grátis).')
        setSalvandoFidelidade(true)
        try {
            await api.updateEstablishment(admin.establishmentId, {
                loyaltyProgram: { enabled: fidelidade.enabled, visitsRequired: visitas || 10, reward: fidelidade.reward.trim() }
            })
            success(fidelidade.enabled ? 'Cartão fidelidade ligado.' : 'Cartão fidelidade desligado.')
            setEditandoFidelidade(false)
            await loadAll()
        } catch (err) {
            error(err.message || 'Não foi possível salvar.')
        } finally {
            setSalvandoFidelidade(false)
        }
    }

    const usarPremio = async (client) => {
        const ok = await confirm(`Marcar que ${client.name} usou o prêmio "${client.loyalty.reward}"?`, { title: 'Prêmio usado', confirmLabel: 'Marcar como usado', danger: false })
        if (!ok) return
        try {
            await api.redeemLoyalty(admin.establishmentId, client.key)
            success('Prêmio marcado como usado.')
            await loadAll()
        } catch (err) {
            error(err.message || 'Não foi possível marcar o prêmio.')
        }
    }

    const toggleExpand = async (client) => {
        const key = client.key
        const opening = expandedKey !== key
        setExpandedKey(opening ? key : null)
        if (opening && !notesByKey[key]) {
            setLoadingNotes(true)
            try {
                const notes = await api.getClientNotes(key)
                setNotesByKey(prev => ({ ...prev, [key]: notes }))
            } catch (err) {
                console.error('Erro ao carregar notas internas:', err)
            } finally {
                setLoadingNotes(false)
            }
        }
    }

    const fidelidadeLigada = !!establishment?.loyaltyProgram?.enabled
    const listasVisiveis = LISTAS.filter(l => !l.soComFidelidade || fidelidadeLigada)

    // Corte do VIP: quem está entre os 20% que mais gastaram.
    const ctx = useMemo(() => {
        const gastos = clients.map(c => c.totalSpent).filter(v => v > 0).sort((a, b) => b - a)
        const indice = Math.max(0, Math.ceil(gastos.length * 0.2) - 1)
        return { corteVip: gastos.length ? gastos[indice] : Infinity }
    }, [clients])

    const contagem = useMemo(() => Object.fromEntries(listasVisiveis.map(l => [l.id, clients.filter(c => l.filtro(c, ctx)).length])), [clients, ctx, fidelidadeLigada])
    const listaAtual = listasVisiveis.find(l => l.id === lista) || listasVisiveis[0]
    const termo = search.toLowerCase()
    const filteredClients = clients
        .filter(c => listaAtual.filtro(c, ctx))
        .filter(c => !termo || c.name?.toLowerCase().includes(termo) || c.phone?.includes(search) || c.email?.toLowerCase().includes(termo))

    const salao = establishment?.name || 'salão'
    const linkAgendar = `${window.location.origin}/estabelecimento/${admin?.establishmentId}`
    const abrirWhatsApp = (client) => {
        const tel = telefoneWhatsApp(client.phone)
        if (!tel) return error('Este cliente não tem um telefone válido.')
        const texto = mensagemPara(client, lista, salao, linkAgendar)
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Clientes</h1>
                <p className="text-secondary">A ficha de cada cliente, listas prontas para chamar de volta e o cartão fidelidade.</p>
            </div>

            {/* Cartão fidelidade: opcional, o salão liga se quiser */}
            <div className="card mb-6" style={{ padding: '1rem 1.25rem' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold">🎁 Cartão fidelidade</h2>
                        <p className="text-sm text-secondary">
                            {fidelidadeLigada
                                ? `Ligado: a cada ${establishment.loyaltyProgram.visitsRequired} atendimentos, o cliente ganha ${establishment.loyaltyProgram.reward}.`
                                : 'Desligado. Ligue para premiar quem volta sempre — o app conta sozinho.'}
                        </p>
                    </div>
                    {!editandoFidelidade && (
                        <button className="btn btn-outline btn-sm" onClick={() => setEditandoFidelidade(true)}>
                            {fidelidadeLigada ? 'Alterar' : 'Configurar'}
                        </button>
                    )}
                </div>
                {editandoFidelidade && (
                    <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                        <label className="form-checkbox" style={{ alignSelf: 'end' }}>
                            <input type="checkbox" checked={fidelidade.enabled} onChange={e => setFidelidade(f => ({ ...f, enabled: e.target.checked }))} />
                            <span>Usar cartão fidelidade</span>
                        </label>
                        <label className="text-sm">
                            <span className="text-muted">Atendimentos para completar</span>
                            <input type="number" min="2" max="50" className="form-input mt-1" value={fidelidade.visitsRequired}
                                onChange={e => setFidelidade(f => ({ ...f, visitsRequired: e.target.value }))} disabled={!fidelidade.enabled} />
                        </label>
                        <label className="text-sm">
                            <span className="text-muted">Prêmio</span>
                            <input type="text" className="form-input mt-1" placeholder="ex.: um corte grátis" maxLength={80} value={fidelidade.reward}
                                onChange={e => setFidelidade(f => ({ ...f, reward: e.target.value }))} disabled={!fidelidade.enabled} />
                        </label>
                        <div className="flex gap-2" style={{ alignSelf: 'end' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditandoFidelidade(false)}>Cancelar</button>
                            <button className="btn btn-primary btn-sm" onClick={salvarFidelidade} disabled={salvandoFidelidade}>
                                {salvandoFidelidade ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Listas prontas */}
            <div className="flex gap-2 mb-3" style={{ overflowX: 'auto', paddingBottom: '0.25rem' }} role="tablist" aria-label="Listas de clientes">
                {listasVisiveis.map(l => (
                    <button
                        key={l.id}
                        role="tab"
                        aria-selected={lista === l.id}
                        title={l.dica}
                        onClick={() => setLista(l.id)}
                        className={`btn btn-sm ${lista === l.id ? 'btn-primary' : 'btn-outline'}`}
                        style={{ whiteSpace: 'nowrap', minHeight: 40, flexShrink: 0 }}
                    >
                        {l.rotulo} <span style={{ opacity: 0.75 }}>({contagem[l.id] ?? 0})</span>
                    </button>
                ))}
            </div>
            <p className="text-xs text-muted mb-4">{listaAtual.dica}</p>

            <div className="mb-4">
                <input type="text" className="form-input" style={{ maxWidth: '360px' }} placeholder="Buscar por nome, telefone ou e-mail"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {loading ? (
                <div className="card py-8 text-center">Carregando...</div>
            ) : filteredClients.length === 0 ? (
                <div className="card text-center py-12">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗂️</div>
                    <p className="text-secondary">
                        {clients.length === 0
                            ? 'Nenhum cliente ainda — a ficha aparece sozinha quando alguém agenda com você.'
                            : 'Nenhum cliente nesta lista.'}
                    </p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4 items-start">
                    {filteredClients.map(client => {
                        const key = client.key
                        const isExpanded = expandedKey === key
                        const notes = notesByKey[key] || []
                        return (
                            <div key={key} className="card" style={{ padding: '1.25rem' }}>
                                <div className="flex items-start justify-between gap-3">
                                    <button type="button" onClick={() => toggleExpand(client)} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }} aria-expanded={isExpanded}>
                                        <h3 className="text-base font-semibold">{client.name}</h3>
                                        <p className="text-sm text-secondary">📱 {client.phone || '—'}</p>
                                        <p className="text-xs text-muted mt-1">
                                            {client.visitCount} atendimento(s) · {reais(client.totalSpent)}
                                            {client.lastVisit && ` · último ${formatDate(client.lastVisit)}`}
                                        </p>
                                        {client.nextAppointment && (
                                            <p className="text-xs mt-1" style={{ color: 'var(--accent-400)' }}>
                                                📅 Próximo: {formatDate(client.nextAppointment.date)} às {client.nextAppointment.time}
                                            </p>
                                        )}
                                    </button>
                                    <button type="button" className="btn btn-sm" onClick={() => abrirWhatsApp(client)}
                                        style={{ background: '#25D366', color: '#0b2e17', fontWeight: 700, minHeight: 40, flexShrink: 0 }}
                                        aria-label={`Mandar WhatsApp para ${client.name}`}>
                                        WhatsApp
                                    </button>
                                </div>

                                {client.loyalty && (
                                    <div className="mt-3 flex flex-wrap items-center gap-3">
                                        <BolinhasFidelidade loyalty={client.loyalty} />
                                        {client.loyalty.available > 0 && (
                                            <button className="btn btn-sm btn-primary" onClick={() => usarPremio(client)}>
                                                🎁 Prêmio disponível — marcar usado
                                            </button>
                                        )}
                                    </div>
                                )}

                                {isExpanded && (
                                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                                            {[
                                                ['Atendimentos', client.visitCount],
                                                ['Gasto total', reais(client.totalSpent)],
                                                ['Ticket médio', reais(client.averageTicket)],
                                                ['Faltas', client.noShows],
                                                ['Cancelamentos', client.cancellations],
                                                ['Cliente desde', formatDate(client.firstVisit)],
                                            ].map(([rotulo, valor]) => (
                                                <div key={rotulo} style={{ background: 'var(--bg-tertiary)', borderRadius: '0.5rem', padding: '0.5rem 0.6rem' }}>
                                                    <div className="text-xs text-muted">{rotulo}</div>
                                                    <div className="font-semibold text-sm">{valor}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {client.email && <p className="text-sm text-secondary mb-3">✉️ {client.email}</p>}

                                        {client.packages?.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-sm text-muted mb-1">Pacotes</p>
                                                {client.packages.map(p => (
                                                    <p key={p.id} className="text-sm">
                                                        📦 {p.name}: <strong>{p.remaining}</strong> de {p.total} sessões
                                                        {p.expired ? ' · vencido' : p.expiresAt ? ` · vence ${new Date(p.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                                                    </p>
                                                ))}
                                            </div>
                                        )}

                                        {client.loyalty && (
                                            <p className="text-sm mb-4">
                                                🎁 Fidelidade: {client.loyalty.progress} de {client.loyalty.visitsRequired} para {client.loyalty.reward}
                                                {client.loyalty.redeemed > 0 && ` · ${client.loyalty.redeemed} prêmio(s) já usado(s)`}
                                            </p>
                                        )}

                                        <p className="text-sm text-muted mb-2">Histórico de serviços</p>
                                        <div className="flex flex-col gap-2 mb-4">
                                            {client.history.length === 0 && <p className="text-sm text-muted">Nenhum atendimento concluído ainda.</p>}
                                            {client.history.map((visit, index) => (
                                                <div key={index} className="flex items-center justify-between text-sm" style={{ padding: '0.4rem 0' }}>
                                                    <div>
                                                        <strong>{formatDate(visit.date)}</strong>{' '}
                                                        <span className="text-secondary">{visit.services.join(', ')}</span>
                                                        {visit.notes && <div className="text-xs text-muted italic">📝 {visit.notes}</div>}
                                                    </div>
                                                    <span className="text-muted">{reais(visit.totalPrice)}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Anotações privadas — o cliente não vê. */}
                                        <div className="pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <button type="button" onClick={() => setNotesClient(client)} title="Abrir anotações deste cliente"
                                                style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '0.75rem', cursor: 'pointer' }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <p className="text-sm font-medium">
                                                        📝 Anotações
                                                        {!loadingNotes && notes.length > 0 && (
                                                            <span className="badge badge-primary text-xs" style={{ marginLeft: '0.5rem' }}>{notes.length}</span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted">
                                                        {loadingNotes ? 'Carregando...' : notes.length === 0 ? 'Nenhuma anotação ainda — toque para escrever' : lastNotePreview(notes[0])}
                                                    </p>
                                                </div>
                                                <span className="text-secondary text-sm" style={{ flexShrink: 0 }}>Abrir ›</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {notesClient && (
                <ClientNotesModal
                    clientKey={notesClient.key}
                    clientName={notesClient.name}
                    initialNotes={notesByKey[notesClient.key]}
                    onClose={() => setNotesClient(null)}
                    onNotesChange={(next) => setNotesByKey(prev => ({ ...prev, [notesClient.key]: next }))}
                />
            )}
        </div>
    )
}
