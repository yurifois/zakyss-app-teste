/**
 * Ponto único de envio de email do backend — via Resend (API HTTPS).
 *
 * Histórico: antes disso o envio passava por Gmail SMTP + um gateway
 * serverless na Vercel, pra contornar o bloqueio de SMTP de saída do
 * Render. Isso já quebrou a produção duas vezes por alguém trocar pra
 * SMTP direto "pra simplificar" (ver git log antigo desse arquivo).
 * Migramos pra Resend em 2026-08 porque:
 *   (a) fala HTTPS puro, não SMTP — funciona direto do Render, sem
 *       gateway nenhum, elimina essa classe inteira de bug;
 *   (b) o Gmail usado até então tem teto de 500 envios/dia por conta,
 *       que a Zakys estourou em produção assim que o uso cresceu —
 *       passou a bloquear TODO email do sistema (confirmação, lembrete,
 *       recuperação de senha) até o limite resetar no dia seguinte.
 *
 * Se precisar mexer no envio de email, edite só esta função. Não crie
 * um transporte SMTP novo em outro lugar do backend.
 */
export async function sendEmail(to, subject, html) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[Email] RESEND_API_KEY não configurada. Email não enviado.')
        return false
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Zakys <onboarding@resend.dev>',
            to,
            subject,
            html
        })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        console.error('[Email] Resend recusou o envio:', data)
        throw new Error(data.message || 'Erro ao enviar email pelo Resend')
    }
    return data
}
