import nodemailer from 'nodemailer'

/**
 * ⚠️ ATENÇÃO — pegadinha de infraestrutura, leia antes de "simplificar" isto:
 *
 * Em produção o backend roda no RENDER, que BLOQUEIA conexões SMTP de saída.
 * `transporter.sendMail` direto trava/falha silenciosamente lá — não é bug de código.
 * Por isso em produção o envio passa pelo gateway serverless da VERCEL
 * (api/send-email.js), que roda em outra infraestrutura e consegue falar com o SMTP.
 *
 * Isso já quebrou os emails de confirmação/lembrete/novo-agendamento DUAS VEZES por
 * alguém trocar para SMTP direto em produção "pra simplificar" (commits b42e0d7,
 * 9b6ed23 corrigiram na primeira vez; 9685dc4 reintroduziu o bug na segunda).
 * Se mexer aqui, mantenha o gateway como caminho de produção.
 *
 * Em desenvolvimento local o SMTP direto funciona normalmente (o bloqueio é
 * específico do Render), então é o que usamos — mais simples e não depende do
 * deploy da Vercel estar de pé.
 */

const directTransporter = () => nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    connectionTimeout: 10000,
    tls: { rejectUnauthorized: false }
})

const sendDirect = (to, subject, html) => directTransporter().sendMail({
    from: process.env.SMTP_FROM || `"Zakys" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
})

const sendViaVercelGateway = async (to, subject, html) => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://zakyss-app-teste.vercel.app'
    const response = await fetch(`${frontendUrl}/api/send-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EMAIL_GATEWAY_SECRET || 'zakys-secret-gateway-123'}`
        },
        body: JSON.stringify({ to, subject, html })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro no gateway de email da Vercel')
    }
    return data
}

/** Verifica se as credenciais SMTP conseguem autenticar (uso em diagnóstico/testEmail). */
export const verifySmtpConfig = () => directTransporter().verify()

/**
 * Ponto único de envio de email do backend. Em produção usa o gateway da
 * Vercel (com fallback pra SMTP direto se o gateway estiver fora do ar);
 * em desenvolvimento usa SMTP direto.
 */
export async function sendEmail(to, subject, html) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('[Email] Credenciais SMTP não configuradas. Email não enviado.')
        return false
    }

    if (process.env.NODE_ENV === 'production') {
        try {
            return await sendViaVercelGateway(to, subject, html)
        } catch (err) {
            console.error('[Email] Gateway da Vercel falhou, tentando SMTP direto como fallback:', err.message)
            return await sendDirect(to, subject, html)
        }
    }

    return await sendDirect(to, subject, html)
}
