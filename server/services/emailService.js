import nodemailer from 'nodemailer'

// Gateway Serverless da Vercel para envio de emails (dribla o bloqueio do Render)
const sendViaVercelGateway = async (to, subject, html) => {
    // Aponta diretamente para a API Serverless hospedada na Vercel
    const gatewayUrl = `https://zakyss-app-teste.vercel.app/api/send-email`;

    const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EMAIL_GATEWAY_SECRET || 'zakys-secret-gateway-123'}`
        },
        body: JSON.stringify({ to, subject, html })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro desconhecido no Gateway da Vercel');
    }
    return data;
}

/**
 * Formata data para exibição em português
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {string} Data formatada (ex: "15 de janeiro de 2026")
 */
const formatDate = (dateStr) => {
    const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ]
    const [year, month, day] = dateStr.split('-')
    return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`
}

/**
 * Gera template HTML para email de lembrete
 */
const generateEmailTemplate = (customerName, date, time, reminderType) => {
    const formattedDate = formatDate(date)
    const reminderText = {
        '24h': 'Faltam 24 horas',
        '12h': 'Faltam 12 horas',
        '4h': 'Faltam apenas 4 horas'
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #fdf2f8;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fdf2f8; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px;">💅 Zakys</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="color: #5c5752; font-size: 14px; margin: 0 0 10px 0;">${reminderText[reminderType]} para seu agendamento!</p>
                                
                                <h2 style="color: #171615; font-size: 24px; margin: 0 0 30px 0;">
                                    Olá <strong style="color: #ec4899;">${customerName}</strong>! 👋
                                </h2>
                                
                                <div style="background-color: #fdf2f8; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                                    <p style="color: #171615; font-size: 18px; margin: 0; line-height: 1.6;">
                                        Confirmado seu agendamento para o dia 
                                        <strong style="color: #db2777;">${formattedDate}</strong> 
                                        às <strong style="color: #db2777;">${time}</strong>.
                                    </p>
                                </div>
                                
                                <p style="color: #5c5752; font-size: 14px; margin: 0;">
                                    Não se esqueça! Estamos te esperando. ✨
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f5f0e8; padding: 20px 30px; text-align: center;">
                                <p style="color: #5c5752; font-size: 12px; margin: 0;">
                                    Este é um email automático do Zakys.<br>
                                    Por favor, não responda a esta mensagem.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `
}

/**
 * Envia email de lembrete de agendamento
 * @param {string} email - Email do destinatário
 * @param {string} customerName - Nome do cliente
 * @param {string} date - Data do agendamento (YYYY-MM-DD)
 * @param {string} time - Hora do agendamento (HH:mm)
 * @param {string} reminderType - Tipo de lembrete ('24h', '12h', '4h')
 * @returns {Promise<boolean>} Sucesso no envio
 */
export const sendAppointmentReminder = async (email, customerName, date, time, reminderType) => {
    if (!email) {
        console.log(`[EmailService] Sem email para enviar lembrete para ${customerName}`)
        return false
    }

    try {
        const transporter = createTransporter()

        const mailOptions = {
            from: process.env.SMTP_FROM || '"BeautyBook" <noreply@beautybook.com>',
            to: email,
            subject: `⏰ Lembrete: Seu agendamento é ${reminderType === '24h' ? 'amanhã' : 'hoje'}!`,
            html: generateEmailTemplate(customerName, date, time, reminderType)
        }

        await transporter.sendMail(mailOptions)
        console.log(`[EmailService] ✅ Email de lembrete (${reminderType}) enviado para ${email}`)
        return true
    } catch (error) {
        console.error(`[EmailService] ❌ Erro ao enviar email para ${email}:`, error.message)
        return false
    }
}

/**
 * Função de teste para verificar configuração de email
 */
export const testEmail = async () => {
    console.log('[EmailService] Testando configuração de email...')
    console.log('[EmailService] SMTP_HOST:', process.env.SMTP_HOST || 'smtp.gmail.com')
    console.log('[EmailService] SMTP_PORT:', process.env.SMTP_PORT || '587')
    console.log('[EmailService] SMTP_USER:', process.env.SMTP_USER ? '✓ configurado' : '✗ não configurado')
    console.log('[EmailService] SMTP_PASS:', process.env.SMTP_PASS ? '✓ configurado' : '✗ não configurado')

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('[EmailService] ⚠️  Credenciais SMTP não configuradas no .env')
        return false
    }

    try {
        const transporter = createTransporter()
        await transporter.verify()
        console.log('[EmailService] ✅ Conexão SMTP verificada com sucesso!')
        return true
    } catch (error) {
        console.error('[EmailService] ❌ Falha na verificação SMTP:', error.message)
        return false
    }
}

/**
 * Gera template HTML para email de confirmação imediata
 */
const generateConfirmationTemplate = (customerName, date, time, establishmentName) => {
    const formattedDate = formatDate(date)

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #fdf2f8;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fdf2f8; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✅ Agendamento Confirmado!</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="color: #171615; font-size: 24px; margin: 0 0 20px 0;">
                                    Olá <strong style="color: #ec4899;">${customerName}</strong>! 👋
                                </h2>
                                
                                <p style="color: #5c5752; font-size: 16px; margin: 0 0 30px 0;">
                                    Ótima notícia! Seu agendamento foi confirmado pelo estabelecimento.
                                </p>
                                
                                <div style="background-color: #fdf2f8; border-left: 4px solid #ec4899; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                                    <p style="color: #db2777; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
                                        📍 ${establishmentName}
                                    </p>
                                    <p style="color: #171615; font-size: 20px; margin: 0; line-height: 1.6;">
                                        📅 <strong>${formattedDate}</strong><br>
                                        🕐 <strong>${time}</strong>
                                    </p>
                                </div>
                                
                                <p style="color: #5c5752; font-size: 14px; margin: 0;">
                                    Você receberá lembretes antes do seu horário. Até lá! ✨
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f5f0e8; padding: 20px 30px; text-align: center;">
                                <p style="color: #5c5752; font-size: 12px; margin: 0;">
                                    Este é um email automático do Zakys.<br>
                                    Por favor, não responda a esta mensagem.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `
}

/**
 * Envia email de confirmação imediata quando agendamento é confirmado
 * @param {string} email - Email do destinatário
 * @param {string} customerName - Nome do cliente
 * @param {string} date - Data do agendamento (YYYY-MM-DD)
 * @param {string} time - Hora do agendamento (HH:mm)
 * @param {string} establishmentName - Nome do estabelecimento
 * @returns {Promise<boolean>} Sucesso no envio
 */
export const sendConfirmationEmail = async (email, customerName, date, time, establishmentName) => {
    if (!email) {
        console.log(`[EmailService] Sem email para enviar confirmação para ${customerName}`)
        return false
    }

    try {
        await sendViaVercelGateway(
            email,
            `✅ Agendamento Confirmado - ${establishmentName}`,
            generateConfirmationTemplate(customerName, date, time, establishmentName)
        )
        console.log(`[EmailService] ✅ Email de confirmação enviado para ${email}`)
        return true
    } catch (error) {
        console.error(`[EmailService] ❌ Erro ao enviar email de confirmação para ${email}:`, error.message)
        return false
    }
}

/**
 * Gera template HTML para notificar o estabelecimento sobre um novo agendamento
 */
const generateNewAppointmentTemplate = (establishmentName, customerName, date, time, servicesListStr) => {
    const formattedDate = formatDate(date)

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #fdf2f8;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fdf2f8; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #db2777 0%, #9d174d 100%); padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px;">📅 Novo Agendamento!</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="color: #171615; font-size: 24px; margin: 0 0 20px 0;">
                                    Olá, <strong style="color: #db2777;">${establishmentName}</strong>! 👋
                                </h2>
                                
                                <p style="color: #5c5752; font-size: 16px; margin: 0 0 30px 0;">
                                    Você recebeu um novo agendamento pelo aplicativo. Confira os detalhes abaixo:
                                </p>
                                
                                <div style="background-color: #fdf2f8; border-left: 4px solid #db2777; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                                    <p style="color: #171615; font-size: 18px; margin: 0 0 10px 0;">
                                        👤 <strong>Cliente:</strong> ${customerName}
                                    </p>
                                    <p style="color: #171615; font-size: 18px; margin: 0 0 10px 0;">
                                        📅 <strong>Data:</strong> ${formattedDate}
                                    </p>
                                    <p style="color: #171615; font-size: 18px; margin: 0 0 10px 0;">
                                        🕐 <strong>Horário:</strong> ${time}
                                    </p>
                                    <p style="color: #171615; font-size: 16px; margin: 0; line-height: 1.6;">
                                        💅 <strong>Serviços:</strong> ${servicesListStr}
                                    </p>
                                </div>
                                
                                <p style="color: #5c5752; font-size: 14px; margin: 0;">
                                    Acesse o painel para confirmar ou gerenciar este agendamento.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f5f0e8; padding: 20px 30px; text-align: center;">
                                <p style="color: #5c5752; font-size: 12px; margin: 0;">
                                    Este é um email automático do Zakys.<br>
                                    Por favor, não responda a esta mensagem.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `
}

/**
 * Envia email para o estabelecimento avisando de um novo agendamento
 */
export const sendNewAppointmentEmail = async (establishmentEmail, establishmentName, customerName, date, time, servicesListStr) => {
    if (!establishmentEmail) {
        console.log(`[EmailService] Sem email para notificar o estabelecimento ${establishmentName}`)
        return false
    }

    try {
        await sendViaVercelGateway(
            establishmentEmail,
            `📅 Novo Agendamento Recebido - ${customerName}`,
            generateNewAppointmentTemplate(establishmentName, customerName, date, time, servicesListStr)
        )
        console.log(`[EmailService] ✅ Email de novo agendamento enviado para o estabelecimento: ${establishmentEmail}`)
        return true
    } catch (error) {
        console.error(`[EmailService] ❌ Erro ao enviar email para o estabelecimento ${establishmentEmail}:`, error.message)
        return false
    }
}

export default {
    sendAppointmentReminder,
    sendConfirmationEmail,
    sendNewAppointmentEmail,
    testEmail
}
