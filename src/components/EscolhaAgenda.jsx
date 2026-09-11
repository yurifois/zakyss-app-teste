import { useEffect, useRef, useState } from 'react'
import Calendar from './Calendar'
import * as api from '../services/api'
import { getClosedWeekdays, toDateString } from '../utils/schedule'

/**
 * As três escolhas do agendamento: dia, serviço e horário, nesta ordem.
 *
 * O serviço vem antes do horário porque é ele que define a duração — sabendo
 * o que o cliente quer, o app mostra só os horários que comportam aquele
 * tempo, em vez de deixar o cliente caçar horário por horário. Os horários
 * que não servem continuam visíveis, com o motivo.
 *
 * Nada aparece fora de ordem: a lista de serviços só existe depois do dia
 * escolhido (é ele que diz quais têm horário), e a de horários só depois do
 * serviço (é ele que diz quanto tempo precisa caber).
 *
 * Vive num componente só porque a página do estabelecimento e a de
 * agendamento fazem exatamente a mesma pergunta: duas cópias divergiriam.
 */

/**
 * Uma etapa do agendamento. O estado guia o olho para onde agir agora:
 * 'ativa' acende, 'concluida' fica neutra, 'bloqueada' recua.
 *
 * Fundo sólido de propósito: o card padrão é translúcido e o degradê do site
 * atravessava justamente a hora de escolher, embaralhando as cores.
 */
const Etapa = ({ titulo, subtitulo, estado, children }) => {
    const ativa = estado === 'ativa'
    return (
        <div
            className="mb-6 p-3 sm:p-6"
            style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-xl)',
                border: `1px solid ${ativa ? 'var(--primary-500)' : 'var(--border-color)'}`,
                boxShadow: ativa ? 'var(--shadow-glow)' : 'none',
                opacity: estado === 'bloqueada' ? 0.55 : 1,
                transition: 'box-shadow .25s ease, border-color .25s ease, opacity .25s ease'
            }}
        >
            <h2 className="text-lg font-semibold mb-1">{titulo}</h2>
            {subtitulo && <p className="text-sm text-muted mb-4">{subtitulo}</p>}
            {children}
        </div>
    )
}

// Caixa de escolha usada por serviços e horários: mesma aparência para
// disponível, escolhido e bloqueado-com-motivo.
const Opcao = ({ disponivel, escolhido, titulo, onClick, dica, children }) => (
    <button
        type="button"
        disabled={!disponivel}
        onClick={onClick}
        title={dica || ''}
        style={{
            padding: '0.6rem 0.75rem',
            borderRadius: '0.75rem',
            textAlign: 'left',
            width: '100%',
            cursor: disponivel ? 'pointer' : 'not-allowed',
            // Bloqueado recua com cor, não com opacidade: opacidade sobre um
            // fundo colorido apaga o texto e some com o motivo.
            background: escolhido
                ? 'rgba(236, 72, 153, 0.18)'
                : disponivel ? 'var(--secondary-500)' : 'var(--bg-primary)',
            border: `1px solid ${escolhido ? 'var(--primary-500)' : disponivel ? 'var(--border-color)' : 'transparent'}`,
            color: disponivel ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: escolhido ? 'var(--shadow-glow)' : 'none',
            transition: 'background .2s ease, border-color .2s ease'
        }}
    >
        {titulo}
        {children}
    </button>
)

const Motivo = ({ texto }) => (
    <div className="text-xs mt-1" style={{ color: '#fca5a5', lineHeight: 1.35, wordBreak: 'break-word' }}>
        ⛔ {texto}
    </div>
)

// Fim previsto do atendimento, pra o cliente ver quanto tempo vai ocupar
const somarMinutos = (hora, minutos) => {
    const [h, m] = hora.split(':').map(Number)
    const total = h * 60 + m + minutos
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function EscolhaAgenda({
    establishmentId,
    establishment,
    date,
    onDateChange,
    time,
    onTimeChange,
    services = [],
    onServicesChange,
    onAviso,
    recarregarToken = 0
}) {
    const [daySchedule, setDaySchedule] = useState(null)
    const [carregando, setCarregando] = useState(false)
    const dateStr = toDateString(date)

    // Ordenado pra virar chave estável: a mesma seleção não pode refazer a
    // requisição só porque o cliente clicou numa ordem diferente.
    const idsEscolhidos = services.map(s => s.id).sort((a, b) => a - b).join(',')

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
        // Pequena espera: marcar três serviços seguidos dispararia três
        // requisições, e só a última interessa.
        const ids = idsEscolhidos ? idsEscolhidos.split(',').map(Number) : []
        const agendado = setTimeout(() => {
            api.getDaySchedule(establishmentId, dateStr, ids)
                .then(res => { if (atual) setDaySchedule(res) })
                .catch(err => { console.error('Erro ao carregar a agenda do dia:', err); if (atual) setDaySchedule(null) })
                .finally(() => { if (atual) setCarregando(false) })
        }, 200)
        return () => { atual = false; clearTimeout(agendado) }
    }, [dateStr, establishmentId, idsEscolhidos, versao, recarregarToken])

    const resumoServicos = daySchedule?.resumoServicos || []
    const slots = daySchedule?.slots || []
    const slotEscolhido = slots.find(s => s.time === time) || null

    // Serviço escolhido que não tem horário nenhum neste dia sai da seleção —
    // senão o cliente segue com uma escolha impossível de agendar.
    useEffect(() => {
        if (!daySchedule || daySchedule.closed || services.length === 0 || resumoServicos.length === 0) return
        const cabe = sv => resumoServicos.some(x => x.id === sv.id && x.available)
        if (services.every(cabe)) return
        const fora = services.filter(sv => !cabe(sv)).map(sv => sv.name).join(', ')
        onServicesChange?.(services.filter(cabe))
        onAviso?.(`${fora} não tem horário disponível neste dia. Escolha outro dia ou outro serviço.`)
    }, [daySchedule])

    // Mudou o serviço, mudou a duração: o horário marcado pode não comportar
    // mais o que foi escolhido.
    useEffect(() => {
        if (!time || !slotEscolhido?.combo || slotEscolhido.combo.available) return
        onTimeChange?.(null)
        onAviso?.(`O horário ${time} não comporta mais os serviços escolhidos: ${slotEscolhido.combo.reason.toLowerCase()}.`)
    }, [slotEscolhido])

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

    const duracaoTotal = services.reduce((soma, s) => soma + (s.duration || 0), 0)
    const algumHorarioServe = slots.some(s => s.combo?.available)

    // Qual etapa pede ação agora. É ela que acende; as anteriores ficam
    // neutras e as seguintes recuam.
    const etapaAtual = !dateStr ? 1 : services.length === 0 ? 2 : !time ? 3 : 0
    const estadoDa = (n, liberada) =>
        etapaAtual === n ? 'ativa' : liberada ? 'concluida' : 'bloqueada'

    return (
        <>
            <Etapa titulo="📅 1. Escolha a data" estado={estadoDa(1, true)}>
                <Calendar
                    selectedDate={date}
                    onSelectDate={onDateChange}
                    minDate={toDateString(new Date())}
                    disabledDays={diasFechados}
                    disabledDates={datasFechadas}
                />
            </Etapa>

            {/* Etapa 2: o dia escolhido já diz quais serviços têm horário nele */}
            <Etapa
                titulo="✨ 2. Escolha o serviço"
                subtitulo={dateStr ? 'Serviços em cinza não têm horário livre neste dia' : 'Escolha a data primeiro'}
                estado={estadoDa(2, !!dateStr)}
            >
                {!dateStr ? (
                    <p className="text-muted text-center py-4">🔒 Selecione um dia no calendário para ver os serviços.</p>
                ) : daySchedule?.closed ? (
                    <p className="text-muted text-center py-4">🚫 {daySchedule.closedReason}</p>
                ) : carregando && resumoServicos.length === 0 ? (
                    <p className="text-muted text-center py-4">Carregando serviços...</p>
                ) : resumoServicos.length === 0 ? (
                    <p className="text-muted text-center py-4">Nenhum serviço cadastrado neste estabelecimento.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {resumoServicos.map(item => {
                            const escolhido = services.some(s => s.id === item.id)
                            return (
                                <Opcao
                                    key={item.id}
                                    disponivel={item.available}
                                    escolhido={escolhido}
                                    onClick={() => alternarServico(item)}
                                    dica={item.reasonLong}
                                    titulo={
                                        <div className="text-sm font-medium" style={{ wordBreak: 'break-word', lineHeight: 1.3 }}>
                                            {escolhido ? '✓ ' : ''}{item.name}
                                        </div>
                                    }
                                >
                                    <div className="font-semibold mt-1">R$ {Number(item.price || 0).toFixed(2)}</div>
                                    <div className="text-xs text-muted">
                                        {item.duration} min
                                        {item.available && ` · ${item.slotsDisponiveis} horário(s)`}
                                    </div>
                                    {!item.available && <Motivo texto={item.reason} />}
                                </Opcao>
                            )
                        })}
                    </div>
                )}
            </Etapa>

            {/* Etapa 3: horários avaliados pela SOMA das durações escolhidas */}
            <Etapa
                titulo="🕐 3. Escolha o horário"
                subtitulo={services.length > 0
                    ? `Horários que comportam os ${duracaoTotal} min escolhidos`
                    : 'Escolha o serviço primeiro'}
                estado={estadoDa(3, services.length > 0)}
            >
                {services.length === 0 ? (
                    <p className="text-muted text-center py-4">🔒 Escolha um serviço acima para ver os horários.</p>
                ) : carregando ? (
                    <p className="text-muted text-center py-4">Carregando horários...</p>
                ) : (
                    <>
                        {!algumHorarioServe && (
                            <p className="text-sm mb-3" style={{ color: 'var(--error-500)', lineHeight: 1.35 }}>
                                ⛔ Nenhum horário deste dia comporta os {duracaoTotal} min escolhidos.
                                Tente outro dia ou remova um serviço.
                            </p>
                        )}
                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                            {slots.map(slot => {
                                const livre = !!slot.combo?.available
                                return (
                                    <Opcao
                                        key={slot.time}
                                        disponivel={livre}
                                        escolhido={time === slot.time}
                                        onClick={() => onTimeChange?.(slot.time)}
                                        dica={slot.combo?.reason}
                                        titulo={<div className="font-semibold">{slot.time}</div>}
                                    >
                                        {livre
                                            ? <div className="text-xs text-muted mt-1">até {somarMinutos(slot.time, duracaoTotal)}</div>
                                            : <Motivo texto={slot.combo?.reason} />}
                                    </Opcao>
                                )
                            })}
                        </div>
                    </>
                )}
            </Etapa>
        </>
    )
}
