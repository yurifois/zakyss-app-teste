// WhatsApp do salão, conectado por QR code (Baileys — sem Evolution e sem API
// oficial, o mesmo caminho do CRM da Mind Sculptor).
//
// O que faz: SÓ ENVIA. Avisa o salão de agendamento novo e avisa o cliente
// quando o salão confirma. Não lê, não guarda e não responde conversas.
//
// Sessão: as credenciais de cada salão ficam na tabela wa_auth_keys, cifradas
// com AES-256-GCM. A chave (WA_AUTH_ENC_KEY, 32 bytes em base64 ou hex) fica
// só nas variáveis de ambiente. Sem ela, o WhatsApp fica desligado.
//
// Plano grátis do Render: o servidor reinicia em deploys; ao subir,
// restoreWhatsAppSessions() reconecta quem já tinha pareado.
import makeWASocket, { DisconnectReason, initAuthCreds, BufferJSON, fetchLatestBaileysVersion, Browsers } from 'baileys'
import QRCode from 'qrcode'
import crypto from 'node:crypto'
import { supabase } from '../repositories/supabase.repository.js'

// ---------- chave e criptografia ----------
function chave() {
    const raw = process.env.WA_AUTH_ENC_KEY || ''
    if (!raw) return null
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
    return buf.length === 32 ? buf : null
}

export const whatsappDisponivel = () => !!chave()

function selar(obj, aad) {
    const iv = crypto.randomBytes(12)
    const c = crypto.createCipheriv('aes-256-gcm', chave(), iv)
    c.setAAD(Buffer.from(aad))
    const dados = Buffer.concat([c.update(JSON.stringify(obj, BufferJSON.replacer), 'utf8'), c.final()])
    return Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64')
}

function abrir(texto, aad) {
    const b = Buffer.from(texto, 'base64')
    const d = crypto.createDecipheriv('aes-256-gcm', chave(), b.subarray(0, 12))
    d.setAAD(Buffer.from(aad))
    d.setAuthTag(b.subarray(12, 28))
    const claro = Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
    return JSON.parse(claro, BufferJSON.reviver)
}

// ---------- onde a sessão fica guardada ----------
// Supabase em produção; memória quando não há banco (testes/dev local).
const memoria = new Map()
const store = {
    async get(est, type, ids) {
        if (!supabase) return ids.map(id => memoria.get(`${est}|${type}|${id}`) ?? null)
        const { data, error } = await supabase.from('wa_auth_keys').select('keyId,value')
            .eq('establishmentId', est).eq('type', type).in('keyId', ids)
        if (error) throw error
        const porId = Object.fromEntries((data || []).map(r => [r.keyId, r.value]))
        return ids.map(id => porId[id] ?? null)
    },
    async set(est, linhas) { // [{type,keyId,value|null}]
        if (!linhas.length) return
        if (!supabase) {
            for (const l of linhas) {
                const k = `${est}|${l.type}|${l.keyId}`
                if (l.value === null) memoria.delete(k); else memoria.set(k, l.value)
            }
            return
        }
        const gravar = linhas.filter(l => l.value !== null)
            .map(l => ({ establishmentId: est, type: l.type, keyId: l.keyId, value: l.value, updatedAt: new Date().toISOString() }))
        if (gravar.length) {
            const { error } = await supabase.from('wa_auth_keys').upsert(gravar, { onConflict: 'establishmentId,type,keyId' })
            if (error) throw error
        }
        for (const l of linhas.filter(l => l.value === null)) {
            await supabase.from('wa_auth_keys').delete().eq('establishmentId', est).eq('type', l.type).eq('keyId', l.keyId)
        }
    },
    async clear(est) {
        if (!supabase) { for (const k of [...memoria.keys()]) if (k.startsWith(`${est}|`)) memoria.delete(k); return }
        await supabase.from('wa_auth_keys').delete().eq('establishmentId', est)
    },
    async pareados() {
        if (!supabase) return [...new Set([...memoria.keys()].filter(k => k.includes('|creds|')).map(k => Number(k.split('|')[0])))]
        const { data, error } = await supabase.from('wa_auth_keys').select('establishmentId').eq('type', 'creds')
        if (error) throw error
        return [...new Set((data || []).map(r => Number(r.establishmentId)))]
    },
}

async function estadoDeAutenticacao(est) {
    const aad = (type, id) => `wa:${est}:${type}:${id}`
    const [credsSelado] = await store.get(est, 'creds', [''])
    const creds = credsSelado ? abrir(credsSelado, aad('creds', '')) : initAuthCreds()
    return {
        state: {
            creds,
            keys: {
                async get(type, ids) {
                    const valores = await store.get(est, type, ids)
                    const out = {}
                    ids.forEach((id, i) => {
                        if (!valores[i]) return
                        let v = abrir(valores[i], aad(type, id))
                        if (type === 'app-state-sync-key' && v) v = proto_AppStateSyncKeyData(v)
                        out[id] = v
                    })
                    return out
                },
                async set(dados) {
                    const linhas = []
                    for (const type of Object.keys(dados)) {
                        for (const id of Object.keys(dados[type])) {
                            const v = dados[type][id]
                            linhas.push({ type, keyId: id, value: v ? selar(v, aad(type, id)) : null })
                        }
                    }
                    await store.set(est, linhas)
                },
            },
        },
        saveCreds: () => store.set(est, [{ type: 'creds', keyId: '', value: selar(creds, aad('creds', '')) }]),
    }
}

// app-state-sync-key precisa voltar como objeto proto (como no useMultiFileAuthState do Baileys)
let protoMod = null
function proto_AppStateSyncKeyData(v) {
    return protoMod ? protoMod.Message.AppStateSyncKeyData.fromObject(v) : v
}

// Logger mudo: o Baileys fala demais e o Render guarda os logs.
const silencio = { level: 'silent', child() { return silencio }, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} }

// ---------- sessões em memória ----------
const sessoes = new Map() // est -> { sock, status, qr, number, tentativas, querConectado }

export function statusWhatsApp(est) {
    const s = sessoes.get(Number(est))
    return {
        available: whatsappDisponivel(),
        status: s?.status || 'disconnected', // disconnected | connecting | qr | connected
        qr: s?.status === 'qr' ? s.qr : null,
        number: s?.status === 'connected' ? s.number : null,
    }
}

export async function conectarWhatsApp(est) {
    est = Number(est)
    if (!whatsappDisponivel()) throw new Error('WhatsApp não configurado no servidor (WA_AUTH_ENC_KEY).')
    const atual = sessoes.get(est)
    if (atual && ['connecting', 'qr', 'connected'].includes(atual.status)) return statusWhatsApp(est)

    if (!protoMod) protoMod = (await import('baileys')).proto
    const sessao = { sock: null, status: 'connecting', qr: null, number: null, tentativas: atual?.tentativas || 0, querConectado: true }
    sessoes.set(est, sessao)

    const { state, saveCreds } = await estadoDeAutenticacao(est)
    let version
    try { ({ version } = await fetchLatestBaileysVersion()) } catch { version = undefined }

    const sock = makeWASocket({
        auth: state,
        version,
        logger: silencio,
        browser: Browsers.ubuntu('Zakys'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
    })
    sessao.sock = sock
    sock.ev.on('creds.update', () => saveCreds().catch(e => console.error('[WhatsApp] Falha ao salvar sessão:', e.message)))
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (sessoes.get(est) !== sessao) return
        if (qr) {
            sessao.status = 'qr'
            sessao.qr = await QRCode.toDataURL(qr, { margin: 1, width: 280 })
        }
        if (connection === 'open') {
            sessao.status = 'connected'
            sessao.qr = null
            sessao.tentativas = 0
            sessao.number = String(sock.user?.id || '').split(/[:@]/)[0] || null
            console.log(`[WhatsApp] Salão ${est} conectado`)
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode
            const pareado = !!state.creds?.registered || !!state.creds?.me
            if (code === DisconnectReason.loggedOut) {
                console.warn(`[WhatsApp] Salão ${est} saiu do WhatsApp (desconectado pelo celular).`)
                await store.clear(est).catch(() => {})
                sessao.status = 'disconnected'
                return
            }
            // Sem parear e o QR expirou: para e espera o salão pedir de novo.
            if (!pareado && code === DisconnectReason.timedOut) {
                sessao.status = 'disconnected'
                return
            }
            if (!sessao.querConectado) { sessao.status = 'disconnected'; return }
            // Queda normal (inclusive o "reinicie" que vem logo após ler o QR): reconecta.
            sessao.tentativas += 1
            const espera = Math.min(60000, 2000 * sessao.tentativas)
            sessao.status = 'connecting'
            sessoes.delete(est)
            setTimeout(() => conectarWhatsApp(est).catch(e => console.error('[WhatsApp] Reconexão falhou:', e.message)), espera)
        }
    })
    return statusWhatsApp(est)
}

export async function desconectarWhatsApp(est) {
    est = Number(est)
    const s = sessoes.get(est)
    if (s) {
        s.querConectado = false
        try { await s.sock?.logout() } catch { /* já caiu */ }
        try { s.sock?.end?.(undefined) } catch { /* ok */ }
    }
    sessoes.delete(est)
    await store.clear(est)
    return statusWhatsApp(est)
}

// Ao subir o servidor: reconecta os salões que já tinham pareado.
export async function restoreWhatsAppSessions() {
    if (!whatsappDisponivel()) {
        console.log('[WhatsApp] Desligado: falta WA_AUTH_ENC_KEY.')
        return
    }
    try {
        for (const est of await store.pareados()) {
            await conectarWhatsApp(est).catch(e => console.error(`[WhatsApp] Salão ${est}:`, e.message))
        }
    } catch (e) {
        console.error('[WhatsApp] Falha ao restaurar sessões:', e.message)
    }
}

// ---------- envio ----------
// Celular brasileiro → número internacional (55 + DDD + número).
export function numeroBR(phone) {
    const d = String(phone || '').replace(/\D/g, '')
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
    if (d.length === 10 || d.length === 11) return `55${d}`
    return null
}

// Fila por salão com um intervalo entre mensagens (parece gente, não robô).
const filas = new Map()
function enfileirar(est, tarefa) {
    const anterior = filas.get(est) || Promise.resolve()
    const proxima = anterior.then(tarefa, tarefa).then(r => new Promise(ok => setTimeout(() => ok(r), 1500)))
    filas.set(est, proxima.catch(() => {}))
    return proxima
}

export async function enviarTexto(est, phone, texto) {
    est = Number(est)
    const s = sessoes.get(est)
    if (!s || s.status !== 'connected') return { sent: false, reason: 'whatsapp-desconectado' }
    const numero = numeroBR(phone)
    if (!numero) return { sent: false, reason: 'telefone-invalido' }
    return enfileirar(est, async () => {
        // O WhatsApp diz qual é o endereço certo (resolve o 9º dígito no Brasil).
        const [info] = await s.sock.onWhatsApp(`${numero}@s.whatsapp.net`)
        if (!info?.exists) return { sent: false, reason: 'numero-sem-whatsapp' }
        await s.sock.sendMessage(info.jid, { text: texto })
        return { sent: true }
    })
}

// ---------- mensagens automáticas ----------
const dataBR = (d) => { const [a, m, dia] = String(d).split('-'); return `${dia}/${m}` }

export function mensagemNovoAgendamento({ salao, cliente, servicos, date, time, linkPainel }) {
    return `📅 *Novo agendamento no Zakys*\n\n` +
        `*Cliente:* ${cliente}\n*Serviço:* ${servicos || '—'}\n*Quando:* ${dataBR(date)} às ${time}\n\n` +
        `Confirme no painel do ${salao}: ${linkPainel}`
}

export function mensagemAgendamentoConfirmado({ salao, cliente, servicos, date, time, link }) {
    const nome = String(cliente || '').trim().split(/\s+/)[0] || ''
    return `✅ Olá${nome ? `, ${nome}` : ''}! Seu agendamento no *${salao}* foi *confirmado*.\n\n` +
        `*Serviço:* ${servicos || '—'}\n*Quando:* ${dataBR(date)} às ${time}\n\n` +
        `Se precisar desmarcar, use o app: ${link}`
}

// Dispara sem travar quem chamou: falha de WhatsApp nunca derruba agendamento.
export function avisarSemTravar(est, phone, texto, rotulo) {
    enviarTexto(est, phone, texto)
        .then(r => { if (!r.sent && r.reason !== 'whatsapp-desconectado') console.warn(`[WhatsApp] ${rotulo} não enviado (${r.reason})`) })
        .catch(e => console.error(`[WhatsApp] ${rotulo} falhou:`, e.message))
}

