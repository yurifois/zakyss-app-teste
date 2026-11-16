import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import EscolhaAgenda from '../components/EscolhaAgenda'
import { toDateString } from '../utils/schedule'
import EstablishmentLocationCard from '../components/EstablishmentLocationCard'
import SpamNotice from '../components/SpamNotice'
import { ArrowLeft, Clock, Calendar as CalendarIcon, User as UserIcon } from 'lucide-react'

export default function Booking() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { success, error } = useToast()

    const [establishment, setEstablishment] = useState(null)
    const [services, setServices] = useState([])
    const [selectedDate, setSelectedDate] = useState(null)
    const [selectedTime, setSelectedTime] = useState(null)
    const [recarregarAgenda, setRecarregarAgenda] = useState(0)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    // Depois de alguns segundos confirmando, o botão passa a dizer que ainda
    // está trabalhando. O backend dorme no Render e pode demorar; sem esse
    // aviso a espera silenciosa parece travamento e a pessoa fecha a tela.
    const [demorando, setDemorando] = useState(false)
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [showLoginPrompt, setShowLoginPrompt] = useState(false)
    // Quando dia, serviço e horário já vieram escolhidos da página do
    // estabelecimento, repetir os três seletores aqui empurrava o formulário e o
    // botão de confirmar para mais de 2.600px abaixo do topo — três telas de
    // rolagem. A pessoa reencontrava as mesmas perguntas que tinha acabado de
    // responder, concluía que a tela havia voltado ao início e desistia, às
    // vezes achando que já tinha agendado.
    //
    // Agora esse caso mostra um resumo compacto com um botão "Alterar". Quem
    // chega aqui sem as três escolhas feitas (link direto, rascunho parcial)
    // continua vendo os seletores — e segue vendo, mesmo depois de completar a
    // terceira escolha, para a tela não se reorganizar sob o dedo da pessoa.
    const [editandoEscolhas, setEditandoEscolhas] = useState(false)
    const [anamnesisForms, setAnamnesisForms] = useState([]) // fichas exigidas pelos serviços selecionados
    const [anamnesisAnswers, setAnamnesisAnswers] = useState({}) // { [formId]: { [questionId]: valor } }

    const calendarRef = useRef(null)

    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        notes: '',
    })

    // Sincroniza os dados do formulário quando o usuário carrega (pode vir depois da primeira renderização)
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: prev.name || user.name || '',
                phone: prev.phone || user.phone || '',
                email: prev.email || user.email || '',
            }))
        }
    }, [user])

    const escolhasCompletas = !!(selectedDate && selectedTime && services.length > 0)

    useEffect(() => {
        if (!loading && !escolhasCompletas) setEditandoEscolhas(true)
    }, [loading, escolhasCompletas])

    // Trava a página enquanto um modal está aberto.
    //
    // Sem isto o fundo continua rolando sob o modal no celular: ao abrir a
    // confirmação a página saltava sozinha (medido: de 3183px para 2249px), e
    // ao fechar a pessoa caía num ponto diferente de onde estava — com a
    // sensação de que "a tela voltou para o início do agendamento" e de que
    // algo já tinha sido feito.
    //
    // A posição é guardada e devolvida na saída, então fechar o modal traz a
    // pessoa de volta exatamente ao ponto em que ela estava.
    useEffect(() => {
        if (!submitting) { setDemorando(false); return }
        const t = setTimeout(() => setDemorando(true), 8000)
        return () => clearTimeout(t)
    }, [submitting])

    useEffect(() => {
        if (!showReviewModal && !showLoginPrompt) return

        const y = window.scrollY
        const estilo = document.body.style
        const anterior = { position: estilo.position, top: estilo.top, width: estilo.width, overflow: estilo.overflow }

        estilo.position = 'fixed'
        estilo.top = `-${y}px`
        estilo.width = '100%'
        estilo.overflow = 'hidden'

        return () => {
            estilo.position = anterior.position
            estilo.top = anterior.top
            estilo.width = anterior.width
            estilo.overflow = anterior.overflow
            window.scrollTo(0, y)
        }
    }, [showReviewModal, showLoginPrompt])

    // Salva o estado do agendamento incompleto no localStorage
    useEffect(() => {
        if (id && (services.length > 0 || selectedDate || selectedTime || formData.notes)) {
            const stateToSave = {
                establishmentId: id,
                services: services.map(s => s.id),
                selectedDate: selectedDate instanceof Date ? selectedDate.toISOString() : selectedDate,
                selectedTime,
                formData
            }
            localStorage.setItem('zakys_unfinished_booking', JSON.stringify(stateToSave))
        }
    }, [id, services, selectedDate, selectedTime, formData])

    useEffect(() => {
        // We no longer require login immediately to view the page.
        // Guests can see services and select dates.
        loadData()

        // Save current URL as redirect target in case they decide to login/register later
        if (!user) {
            sessionStorage.setItem('redirect_after_login', `/agendar/${id}`)
        }
    }, [id, user])

    const loadData = async () => {
        setLoading(true)
        try {
            // Get selected services from session or unfinished booking
            const storedServices = sessionStorage.getItem('booking_services')
            const unfinishedStr = localStorage.getItem('zakys_unfinished_booking')
            let serviceIds = []
            let unfinished = null

            if (unfinishedStr) {
                try {
                    const parsed = JSON.parse(unfinishedStr)
                    if (parsed.establishmentId === id) {
                        unfinished = parsed
                        serviceIds = parsed.services || []
                        if (parsed.selectedDate) setSelectedDate(new Date(parsed.selectedDate))
                        if (parsed.selectedTime) setSelectedTime(parsed.selectedTime)
                        if (parsed.formData) {
                            // Mesclado com o perfil, nunca substituído por ele.
                            //
                            // Esta função roda de novo quando a sessão termina de
                            // carregar (o efeito depende de `user`), e nesse
                            // segundo passe o rascunho já existe: foi salvo
                            // segundos antes, com o formulário ainda vazio porque
                            // `user` era null. Substituir aqui apagava o nome e o
                            // telefone que o efeito de pré-preenchimento tinha
                            // acabado de colocar, e a pessoa logada via "Agendar"
                            // falhar com "Preencha nome e telefone" sem entender
                            // por quê — o formulário parecia certo mas estava vazio.
                            //
                            // O que a pessoa digitou sempre vence; o perfil só
                            // preenche o que está em branco.
                            setFormData({
                                ...parsed.formData,
                                name: parsed.formData.name || user?.name || '',
                                phone: parsed.formData.phone || user?.phone || '',
                                email: parsed.formData.email || user?.email || '',
                            })
                        }
                    }
                } catch (e) {
                    console.error('Error parsing unfinished booking', e)
                }
            } else if (storedServices) {
                serviceIds = JSON.parse(storedServices)
                // Dia e horário já foram escolhidos na página do estabelecimento:
                // seguir com eles evita pedir as mesmas três coisas duas vezes.
                const dataEscolhida = sessionStorage.getItem('booking_date')
                const horaEscolhida = sessionStorage.getItem('booking_time')
                if (dataEscolhida) setSelectedDate(new Date(`${dataEscolhida.slice(0, 10)}T12:00:00`))
                if (horaEscolhida) setSelectedTime(horaEscolhida)
            }

            const [est, allEstServices] = await Promise.all([
                api.getEstablishmentById(id),
                api.getEstablishmentServices(id)
            ])

            setEstablishment(est)

            // Serviço pré-escolhido (veio da página do estabelecimento) continua
            // valendo; a etapa 3 revalida se ele cabe no horário escolhido.
            if (serviceIds.length > 0) {
                setServices(allEstServices.filter(s => serviceIds.includes(s.id)))
            }
        } catch (err) {
            error('Erro ao carregar dados')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    // Se o dia selecionado tem atendimento em domicílio configurado pelo
    // estabelecimento, devolve os detalhes (área, taxa, mensagem) pra avisar
    // o cliente antes de confirmar. Filtra por faixa de horário quando o
    // estabelecimento configurou uma; sem faixa, vale o dia inteiro.
    const getHomeVisitInfo = () => {
        if (!selectedDate || !establishment?.scheduleExceptions) return null
        const hv = establishment.scheduleExceptions[toDateString(selectedDate)]?.homeVisit
        if (!hv?.active) return null
        if (selectedTime && hv.startTime && hv.endTime && !(selectedTime >= hv.startTime && selectedTime < hv.endTime)) {
            return null
        }
        return hv
    }

    // Busca as fichas de anamnese anexadas aos serviços selecionados (se
    // houver) toda vez que a seleção mudar, pra já mostrar antes de o
    // cliente confirmar — sem precisar mandar nada depois.
    useEffect(() => {
        const loadAnamnesisForms = async () => {
            if (!establishment || services.length === 0) {
                setAnamnesisForms([])
                return
            }
            const formIds = [...new Set(
                services.map(s => establishment?.servicePreferences?.[s.id]?.anamnesisFormId).filter(Boolean)
            )]
            if (formIds.length === 0) {
                setAnamnesisForms([])
                return
            }
            try {
                const forms = await Promise.all(formIds.map(id => api.getAnamnesisFormPublic(id)))
                setAnamnesisForms(forms)
            } catch (err) {
                console.error('Erro ao carregar ficha de anamnese:', err)
            }
        }
        loadAnamnesisForms()
    }, [establishment, services])

    const setAnamnesisAnswer = (formId, questionId, value) => {
        setAnamnesisAnswers(prev => ({
            ...prev,
            [formId]: { ...(prev[formId] || {}), [questionId]: value }
        }))
    }

    const isAnamnesisComplete = () => {
        return anamnesisForms.every(form =>
            (form.questions || []).every(q => {
                if (!q.required) return true
                const value = anamnesisAnswers[form.id]?.[q.id]
                return value !== undefined && value !== null && value !== ''
            })
        )
    }

    const buildAnamnesisPayload = () => {
        return anamnesisForms.map(form => ({
            formId: form.id,
            answers: (form.questions || []).map(q => ({
                questionId: q.id,
                label: q.label,
                answer: anamnesisAnswers[form.id]?.[q.id] ?? ''
            }))
        }))
    }

    const getTotalPrice = () => services.reduce((sum, s) => sum + s.price, 0)
    const getTotalDuration = () => services.reduce((sum, s) => sum + s.duration, 0)

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleReview = (e) => {
        e.preventDefault()

        if (services.length === 0) {
            error('Escolha ao menos um serviço')
            return
        }

        if (!selectedDate || !selectedTime) {
            error('Selecione data e horário')
            return
        }

        if (!formData.name || !formData.phone) {
            // Leva a pessoa até o campo que falta. Sem isto o clique em
            // "Agendar" parecia não fazer nada: o aviso aparece no canto e some,
            // e o campo vazio pode estar fora da tela — foi exatamente assim que
            // o problema chegou ao suporte, descrito como "não finaliza".
            error('Preencha nome e telefone')
            const alvo = document.querySelector(!formData.name ? 'input[name="name"]' : 'input[name="phone"]')
            alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            alvo?.focus({ preventScroll: true })
            return
        }

        if (!isAnamnesisComplete()) {
            error('Preencha os campos obrigatórios da ficha de triagem antes de continuar')
            return
        }

        if (!user) {
            setShowLoginPrompt(true)
            return
        }

        setShowReviewModal(true)
    }

    const handleSubmit = async () => {
        setSubmitting(true)

        try {
            const dateStr = toDateString(selectedDate)

            // Get assignments from session
            const assignments = JSON.parse(sessionStorage.getItem('booking_assignments') || '[]')

            const appointment = await api.createAppointment({
                establishmentId: parseInt(id),
                userId: user?.id || null,
                services: services.map(s => s.id),
                date: dateStr,
                time: selectedTime,
                customerName: formData.name,
                customerPhone: formData.phone,
                customerEmail: formData.email,
                notes: formData.notes,
                assignments: assignments,
                anamnesisAnswers: buildAnamnesisPayload()
            })

            sessionStorage.removeItem('booking_services')
            sessionStorage.removeItem('booking_date')
            sessionStorage.removeItem('booking_time')
            sessionStorage.removeItem('booking_assignments')
            localStorage.removeItem('zakys_unfinished_booking')
            success('Agendamento realizado com sucesso!')
            navigate(`/confirmacao/${appointment.id}`)
        } catch (err) {
            error(err.message || 'Erro ao criar agendamento')
            // O horário selecionado pode ter sido bloqueado/ocupado nesse meio tempo;
            // atualiza a lista para não deixar um horário inválido marcado como disponível.
            setRecarregarAgenda(v => v + 1)
        } finally {
            setSubmitting(false)
        }
    }

    const formatDate = (dateInput) => {
        if (!dateInput) return ''
        let date
        if (dateInput instanceof Date) {
            date = dateInput
        } else {
            const [year, month, day] = dateInput.split('-')
            date = new Date(year, month - 1, day)
        }
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    }

    if (loading) {
        return (
            <div className="container py-8">
                <div className="skeleton" style={{ height: '400px' }}></div>
            </div>
        )
    }

    return (
        <div className="py-8">
            <div className="container">
                <div className="mb-8">
                    <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm mb-4 flex items-center gap-2">
                        <ArrowLeft size={16} />
                        Voltar
                    </button>

                    {establishment?.image && (
                        <div style={{ position: 'relative', borderRadius: '1rem', overflow: 'hidden', marginBottom: '1.5rem' }}>
                            <img
                                src={api.getImageUrl(establishment.image)}
                                alt={establishment.name}
                                style={{ width: '100%', height: '220px', objectFit: 'cover' }}
                            />
                        </div>
                    )}

                    <h1 className="text-3xl font-bold mb-2">Agendar horário</h1>
                    <p className="text-secondary mb-3">{establishment?.name}</p>

                    {(establishment?.accessible || establishment?.parking) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {establishment.accessible && <span className="badge">♿ Acessível</span>}
                            {establishment.parking && <span className="badge">🅿️ Estacionamento</span>}
                        </div>
                    )}

                    <EstablishmentLocationCard establishment={establishment} />

                    {establishment?.serviceImages && establishment.serviceImages.length > 0 && (
                        <div className="service-images-gallery">
                            {establishment.serviceImages.map((img, index) => (
                                <div key={index} className="service-image-item">
                                    <img src={api.getImageUrl(img)} alt={`Serviço ${index + 1}`} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Form */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSubmit}>
                            {/* As três etapas (dia, serviço, horário) vivem num
                                componente só, compartilhado com a página do
                                estabelecimento — duas cópias divergiriam. */}
                            <div ref={calendarRef}>
                                {escolhasCompletas && !editandoEscolhas ? (
                                    // Veio tudo escolhido da página anterior: mostra o que
                                    // foi escolhido e deixa o formulário logo abaixo, à mão.
                                    // Quem quiser trocar abre os seletores pelo botão.
                                    <div
                                        className="mb-6 p-4"
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius-xl)',
                                            border: '1px solid var(--border-color)'
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="text-sm">
                                                <p className="font-semibold mb-1">
                                                    📅 {formatDate(selectedDate)}
                                                    {selectedTime && <> às {selectedTime}</>}
                                                </p>
                                                <p className="text-muted">
                                                    {services.map(sv => sv.name).join(' + ')}
                                                </p>
                                                <p className="text-muted mt-1">
                                                    R$ {getTotalPrice().toFixed(2)} · {getTotalDuration()} min
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setEditandoEscolhas(true)}
                                            >
                                                Alterar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <EscolhaAgenda
                                        establishmentId={id}
                                        establishment={establishment}
                                        date={selectedDate}
                                        onDateChange={setSelectedDate}
                                        time={selectedTime}
                                        onTimeChange={setSelectedTime}
                                        services={services}
                                        onServicesChange={setServices}
                                        recarregarToken={recarregarAgenda}
                                        onAviso={error}
                                    />
                                )}
                            </div>

                            {/* Aviso de atendimento em domicílio nesse dia */}
                            {selectedDate && getHomeVisitInfo() && (
                                <div className="card mb-6 p-4" style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid var(--primary-500)' }}>
                                    <p className="font-semibold mb-1">🏠 Atendimento em domicílio neste dia</p>
                                    {getHomeVisitInfo().area && <p className="text-sm">Área atendida: {getHomeVisitInfo().area}</p>}
                                    {getHomeVisitInfo().fee > 0 && <p className="text-sm">Taxa de deslocamento: R$ {getHomeVisitInfo().fee.toFixed(2)}</p>}
                                    {getHomeVisitInfo().message && <p className="text-sm mt-1">{getHomeVisitInfo().message}</p>}
                                </div>
                            )}

                            {/* Ficha de anamnese/triagem, quando o serviço escolhido exige */}
                            {anamnesisForms.map(form => (
                                <div key={form.id} className="card mb-6 p-4 sm:p-6">
                                    <h2 className="text-lg font-semibold mb-1">📋 {form.name}</h2>
                                    <p className="text-sm text-muted mb-4">Preencha antes de confirmar o agendamento.</p>
                                    <div className="flex flex-col gap-4">
                                        {form.questions.map(q => (
                                            <div key={q.id} className="form-group">
                                                <label className="form-label">
                                                    {q.label}{q.required && <span style={{ color: 'var(--error-500)' }}> *</span>}
                                                </label>

                                                {q.type === 'texto_curto' && (
                                                    <input
                                                        type="text" className="form-input"
                                                        value={anamnesisAnswers[form.id]?.[q.id] || ''}
                                                        onChange={(e) => setAnamnesisAnswer(form.id, q.id, e.target.value)}
                                                    />
                                                )}

                                                {q.type === 'data' && (
                                                    <input
                                                        type="date" className="form-input"
                                                        value={anamnesisAnswers[form.id]?.[q.id] || ''}
                                                        onChange={(e) => setAnamnesisAnswer(form.id, q.id, e.target.value)}
                                                    />
                                                )}

                                                {q.type === 'sim_nao' && (
                                                    <div className="flex gap-2">
                                                        {['Sim', 'Não'].map(opt => (
                                                            <button
                                                                key={opt} type="button"
                                                                onClick={() => setAnamnesisAnswer(form.id, q.id, opt)}
                                                                className="btn btn-sm"
                                                                style={{
                                                                    background: anamnesisAnswers[form.id]?.[q.id] === opt ? 'var(--primary-500)' : 'transparent',
                                                                    color: anamnesisAnswers[form.id]?.[q.id] === opt ? 'white' : 'inherit',
                                                                    border: '1px solid var(--border-color)'
                                                                }}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {q.type === 'multipla_escolha' && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {(q.options || []).map(opt => (
                                                            <button
                                                                key={opt} type="button"
                                                                onClick={() => setAnamnesisAnswer(form.id, q.id, opt)}
                                                                className="btn btn-sm"
                                                                style={{
                                                                    background: anamnesisAnswers[form.id]?.[q.id] === opt ? 'var(--primary-500)' : 'transparent',
                                                                    color: anamnesisAnswers[form.id]?.[q.id] === opt ? 'white' : 'inherit',
                                                                    border: '1px solid var(--border-color)'
                                                                }}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {q.type === 'escala' && (
                                                    <div className="flex gap-2">
                                                        {[1, 2, 3, 4, 5].map(n => (
                                                            <button
                                                                key={n} type="button"
                                                                onClick={() => setAnamnesisAnswer(form.id, q.id, n)}
                                                                className="btn btn-sm"
                                                                style={{
                                                                    width: '2.5rem',
                                                                    background: anamnesisAnswers[form.id]?.[q.id] === n ? 'var(--primary-500)' : 'transparent',
                                                                    color: anamnesisAnswers[form.id]?.[q.id] === n ? 'white' : 'inherit',
                                                                    border: '1px solid var(--border-color)'
                                                                }}
                                                            >
                                                                {n}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {q.type === 'aceite' && (
                                                    <label className="form-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!anamnesisAnswers[form.id]?.[q.id]}
                                                            onChange={(e) => setAnamnesisAnswer(form.id, q.id, e.target.checked ? 'Aceito' : '')}
                                                        />
                                                        <span className="text-sm">Confirmo que li e estou de acordo</span>
                                                    </label>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Etapa 4: dados do cliente */}
                            {services.length > 0 && (
                                <div className="card mb-6 p-4 sm:p-6">
                                    <h2 className="text-lg font-semibold mb-4">👤 Seus dados</h2>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">Nome completo *</label>
                                            <input
                                                type="text"
                                                name="name"
                                                className="form-input"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Telefone *</label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                className="form-input"
                                                placeholder="(61) 99999-9999"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">E-mail</label>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-input"
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                        <SpamNotice className="mt-2" />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Observações</label>
                                        <textarea
                                            name="notes"
                                            className="form-textarea"
                                            rows={3}
                                            placeholder="Alguma informação adicional..."
                                            value={formData.notes}
                                            onChange={handleChange}
                                        ></textarea>
                                    </div>
                                </div>
                            )}

                            {/* Submit */}
                            {services.length > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-primary btn-lg w-full"
                                    onClick={handleReview}
                                >
                                    Agendar
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Summary Sidebar */}
                    <div>
                        <div className="card p-4 sm:p-6" style={{ position: 'sticky', top: '5rem' }}>
                            <h3 className="text-lg font-bold mb-4">Resumo</h3>

                            <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <p className="font-medium">{establishment?.name}</p>
                                <p className="text-sm text-muted">{establishment?.address}</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-sm font-medium mb-2">Serviços selecionados</h4>
                                {services.length === 0 ? (
                                    <p className="text-xs text-muted">Nenhum serviço selecionado</p>
                                ) : (
                                    services.map(service => (
                                        <div key={service.id} className="flex justify-between text-sm py-1">
                                            <span className="text-muted">{service.name}</span>
                                            <span>R$ {service.price.toFixed(2)}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {selectedDate && (
                                <div className="mb-4 text-sm">
                                    <span className="text-muted">📅 </span>
                                    {formatDate(selectedDate)}
                                    {selectedTime && <strong> às {selectedTime}</strong>}
                                </div>
                            )}

                            <div className="pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <div className="flex justify-between font-bold mb-1">
                                    <span>Total</span>
                                    <span className="text-gradient">R$ {getTotalPrice().toFixed(2)}</span>
                                </div>
                                <div className="text-sm text-muted">
                                    Duração: {getTotalDuration()} min
                                </div>
                            </div>

                            <div className="mt-4 p-3 rounded-xl border text-xs leading-relaxed" style={{ backgroundColor: '#fdf2f8', borderColor: 'rgba(236, 72, 153, 0.2)', color: '#171615' }}>
                                <strong style={{ color: '#db2777' }}>ℹ️ Aviso importante:</strong> Alguns serviços podem sofrer alteração de valor e necessitam de diagnóstico prévio presencial.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Review Modal */}
            {/* Simple Confirmation Modal */}
            {/* Confirmação do agendamento.
                Antes esta caixa tinha só o botão "Confirmar agendamento" solto no
                meio da tela escura, sem título, sem resumo e sem como voltar, e um
                toque em qualquer ponto fora dela fechava tudo em silêncio. Quem
                errava o alvo voltava para a página e achava que tinha agendado —
                foi assim que clientes relataram "achei que já tinha marcado" e o
                horário nunca existiu. Agora a caixa diz o que está sendo
                confirmado, tem saída explícita e só fecha por botão. */}
            {showReviewModal && (
                <div
                    className="modal-backdrop"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-confirmacao"
                >
                    <div
                        className="rounded-2xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-8 duration-300 p-6 flex flex-col gap-3"
                        style={{ maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 id="titulo-confirmacao" className="text-lg font-bold">Confirme seu agendamento</h3>
                        <p className="text-sm text-muted" style={{ marginTop: '-0.25rem' }}>
                            Falta só confirmar — ainda não está marcado.
                        </p>

                        <div className="text-sm" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                            <p className="font-medium">{establishment?.name}</p>
                            {selectedDate && (
                                <p className="mt-1">
                                    📅 {formatDate(selectedDate)}
                                    {selectedTime && <strong> às {selectedTime}</strong>}
                                </p>
                            )}
                        </div>

                        <div className="text-sm">
                            {services.map(service => (
                                <div key={service.id} className="flex justify-between py-1">
                                    <span className="text-muted">{service.name}</span>
                                    <span>R$ {Number(service.price || 0).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                            <div className="flex justify-between font-bold">
                                <span>Total</span>
                                <span className="text-gradient">R$ {getTotalPrice().toFixed(2)}</span>
                            </div>
                            <div className="text-sm text-muted">Duração: {getTotalDuration()} min</div>
                        </div>

                        <div className="text-xs text-muted" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                            Em nome de <strong>{formData.name}</strong> · {formData.phone}
                        </div>

                        <button
                            className="btn btn-primary btn-lg w-full text-lg shadow-lg shadow-primary/20"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting
                                ? (demorando ? 'Ainda confirmando, aguarde...' : 'Confirmando...')
                                : 'Confirmar agendamento'}
                        </button>
                        <button
                            className="btn btn-ghost w-full"
                            onClick={() => setShowReviewModal(false)}
                            disabled={submitting}
                        >
                            Voltar e revisar
                        </button>
                    </div>
                </div>
            )}

            {/* Login Prompt Modal */}
            {showLoginPrompt && (
                <div
                    className="modal-backdrop"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}
                >
                    <div
                        className="rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                    >
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserIcon size={32} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Identifique-se</h2>
                        <p className="text-muted mb-6 text-sm">Para concluir o agendamento, você precisa entrar na sua conta ou criar uma nova.</p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                className="btn btn-primary w-full"
                                onClick={() => {
                                    sessionStorage.setItem('redirect_after_login', `/agendar/${id}`)
                                    navigate('/entrar')
                                }}
                            >
                                Fazer Login
                            </button>
                            <button 
                                className="btn w-full"
                                style={{ backgroundColor: 'var(--base-200)' }}
                                onClick={() => {
                                    sessionStorage.setItem('redirect_after_login', `/agendar/${id}`)
                                    navigate('/cadastro')
                                }}
                            >
                                Criar Conta
                            </button>
                            <button 
                                className="btn btn-ghost w-full mt-2"
                                onClick={() => setShowLoginPrompt(false)}
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
