import { useEffect, useRef, useState } from 'react'
import Calendar from './Calendar'
import * as api from '../services/api'
import { getClosedWeekdays, toDateString } from '../utils/schedule'

/**
 * As três escolhas do agendamento, na ordem que a agenda exige: dia, horário
 * e só então serviço. Só depois do horário dá pra saber o que cabe nele.
 *
 * As três etapas ficam sempre visíveis — inclusive a tabela de preços, antes
 * de destravar — porque o cliente precisa ver o que o estabelecimento oferece
 * para decidir o dia. O que ainda não pode ser escolhido aparece em cinza,
 * com o motivo.
 *
 * Vive num componente só porque a página do estabelecimento e a página de
 * agendamento fazem exatamente a mesma pergunta: duas cópias divergiriam.
 */

const Etapa = ({ titulo, subtitulo, travada, children }) => (
    <div className="card mb-6 p-3 sm:p-6" style={travada ? { opacity: 0.65 } : undefined}>
        <h2 className="text-lg font-semibold mb-1">{titulo}</h2>
        {subtitulo && <p className="text-sm text-muted mb-4">{subtitulo}</p>}
        {children}
    </div>
)

export default function EscolhaAgenda({
    establishmentId,
    establishment,
    servicosVitrine = [],
    date,
    onDateChange,
    time,
    onTimeChange,
    services = [],
    onServicesChange,
    onServicoRemovido,
    recarregarToken = 0
}) {
    const [daySchedule, setDaySchedule] = useState(null)
    const [carregando, setCarregando] = useState(false)
    const dateStr = toDateString(date)

    // Trocar de dia derruba o horário: ele era daquele outro dia. Guardamos o
    // dia anterior porque na primeira renderização não há troca nenhuma — e aí
    // apagaríamos o horário de um agendamento retomado.
    const diaAnterior = useRef(dateStr)
    useEffect(() => {
        if (diaAnterior.current !== dateStr) {
            diaAnterior.current = dateStr
            onTimeChange?.(null)
        }
    }, [dateStr])

    // Em celular a aba fica em segundo plano enquanto o cliente preenche o
    // resto; ao voltar, o estabelecimento pode ter bloqueado o horário nesse
    // meio tempo. Recarrega a agenda ao reaparecer.
    const [versao, setVersao] = useState(0)
    const [verPrecos, setVerPrecos] = useState(false)
    useEffect(() => {
        const aoVoltar = () => { if (document.visibilityState === 'visible') setVersao(v => v + 1) }
        document.addEventListener('visibilitychange', aoVoltar)
        window.addEventListener('focus', aoVoltar)
        return () => {
            document.removeEventListener('visibilitychange', aoVoltar)
            window.removeEventListener('focus', aoVoltar)
        }
    }, [])

    useEffect(() => {
        if (!dateStr || !establishmentId) {
            setDaySchedule(null)
            return
        }
        let atual = true
        setCarregando(true)
        api.getDaySchedule(establishmentId, dateStr)
            .then(res => { if (atual) setDaySchedule(res) })
            .catch(err => { console.error('Erro ao carregar a agenda do dia:', err); if (atual) setDaySchedule(null) })
            .finally(() => { if (atual) setCarregando(false) })
        return () => { atual = false }
    }, [dateStr, establishmentId, versao, recarregarToken])

    const currentSlot = daySchedule?.slots?.find(s => s.time === time) || null

    // Serviço pré-escolhido (retomada de agendamento, link direto) é revalidado
    // contra o horário: sem isso ele escaparia da restrição da agenda.
    useEffect(() => {
        if (!currentSlot || services.length === 0) return
        const cabe = sv => currentSlot.services.some(x => x.id === sv.id && x.available)
        if (services.every(cabe)) return
        const removidos = services.filter(sv => !cabe(sv))
        onServicesChange?.(services.filter(cabe))
        onServicoRemovido?.(removidos.map(sv => sv.name).join(', '), currentSlot.time)
    }, [currentSlot, services])

    const alternarServico = (item) => {
        const jaEscolhido = services.some(s => s.id === item.id)
        onServicesChange?.(jaEscolhido
            ? services.filter(s => s.id !== item.id)
            : [...services, { id: item.id, name: item.name, price: item.price, duration: item.duration }])
    }

    const diasFechados = getClosedWeekdays(establishment?.workingHours)
    const datasFechadas = Object.entries(establishment?.scheduleExceptions || {})
        .filter(([, exc]) => exc?.isClosed)
        .map(([dia]) => dia)

    // Antes de escolher o horário a lista mostra tudo, em cinza: é a vitrine de
    // preços. Depois, passa a valer a disponibilidade real daquele horário.
    const listaServicos = currentSlot
        ? currentSlot.services
        : servicosVitrine.map(s => ({ ...s, available: false, reason: null }))

    return (
        <>
            <Etapa titulo="📅 1. Escolha a data">
                <Calendar
                    selectedDate={date}
                    onSelectDate={onDateChange}
                    minDate={new Date().toISOString().split('T')[0]}
                    disabledDays={diasFechados}
                    disabledDates={datasFechadas}
                />
            </Etapa>

            <Etapa
                titulo="🕐 2. Escolha o horário"
                subtitulo={dateStr ? undefined : 'Escolha a data primeiro'}
                travada={!dateStr}
            >
                {!dateStr ? (
                    <p className="text-muted text-center py-4">🔒 Selecione um dia no calendário para ver os horários.</p>
                ) : carregando ? (
                    <p className="text-muted text-center py-4">Carregando horários...</p>
                ) : daySchedule?.closed ? (
                    <p className="text-muted text-center py-4">🚫 {daySchedule.closedReason}</p>
                ) : !daySchedule ? (
                    <p className="text-muted text-center py-4">Não foi possível carregar os horários deste dia.</p>
                ) : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                        {daySchedule.slots.map(slot => {
                            const livre = slot.status === 'disponivel'
                            const escolhido = time === slot.time
                            return (
                                <button
                                    key={slot.time}
                                    type="button"
                                    disabled={!livre}
                                    onClick={() => onTimeChange?.(slot.time)}
                                    title={slot.reason || ''}
                                    style={{
                                        padding: '0.6rem',
                                        borderRadius: '0.6rem',
                                        textAlign: 'left',
                                        cursor: livre ? 'pointer' : 'not-allowed',
                                        opacity: livre ? 1 : 0.55,
                                        border: `1px solid ${escolhido ? 'var(--primary-500)' : 'var(--border-color)'}`,
                                        background: escolhido ? 'var(--primary-500)' : livre ? 'transparent' : 'var(--secondary-500)',
                                        color: escolhido ? 'white' : 'inherit'
                                    }}
                                >
                                    <div className="font-semibold">{slot.time}</div>
                                    <div className="text-xs" style={{ opacity: 0.85 }}>
                                        {livre ? `${slot.availableCount} serviço(s)` : slot.reason}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </Etapa>

            <Etapa
                titulo="✨ 3. Escolha o serviço"
                subtitulo={currentSlot
                    ? `Disponibilidade para ${currentSlot.time}. Serviços em cinza não cabem neste horário.`
                    : 'Escolha o horário primeiro — estes são os preços do estabelecimento'}
                travada={!currentSlot}
            >
                {/* Sem horário escolhido a lista fica fechada: serviço exposto
                    antes do dia é justamente a ordem que este fluxo desfaz. A
                    tabela de preços continua a um clique pra quem só quer
                    consultar quanto custa. */}
                {!currentSlot && (
                    <div className="mb-1">
                        <p className="text-muted text-sm mb-3">🔒 Escolha um horário acima para liberar os serviços.</p>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setVerPrecos(v => !v)}
                        >
                            {verPrecos ? 'Ocultar tabela de preços' : 'Ver tabela de preços'}
                        </button>
                    </div>
                )}
                <div className="flex flex-col gap-2" hidden={!currentSlot && !verPrecos}>
                    {listaServicos.map(item => {
                        const escolhido = services.some(s => s.id === item.id)
                        return (
                            <button
                                key={item.id}
                                type="button"
                                disabled={!item.available}
                                title={item.reasonLong || ''}
                                onClick={() => alternarServico(item)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.75rem',
                                    textAlign: 'left',
                                    width: '100%',
                                    cursor: item.available ? 'pointer' : 'not-allowed',
                                    opacity: item.available ? 1 : 0.6,
                                    border: `1px solid ${escolhido ? 'var(--primary-500)' : 'var(--border-color)'}`,
                                    background: escolhido ? 'rgba(236, 72, 153, 0.12)' : item.available ? 'transparent' : 'var(--secondary-500)'
                                }}
                            >
                                {/* nome e preço na mesma linha; o motivo ganha linha própria
                                    pra caber inteiro sem espremer o preço */}
                                <div className="flex justify-between items-baseline gap-3">
                                    <span className="font-medium" style={{ minWidth: 0, wordBreak: 'break-word' }}>
                                        {escolhido ? '✓ ' : ''}{item.name}
                                    </span>
                                    <span className="font-semibold" style={{ flexShrink: 0 }}>
                                        R$ {Number(item.price || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-xs text-muted mt-1">{item.duration} min</div>
                                {currentSlot && !item.available && (
                                    <div
                                        className="text-xs mt-1"
                                        style={{ color: 'var(--error-500)', lineHeight: 1.35, wordBreak: 'break-word' }}
                                    >
                                        ⛔ {item.reason}
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </Etapa>
        </>
    )
}
