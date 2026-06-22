import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    connectionTimeout: 10000, // 10 segundos
    greetingTimeout: 10000,
    socketTimeout: 15000,
})

export async function sendPasswordResetEmail(to, token) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const resetUrl = `${frontendUrl}/redefinir-senha?token=${token}`

    const mailOptions = {
        from: process.env.SMTP_FROM || '"Zakys" <noreply@zakys.com>',
        to,
        subject: 'Recuperação de Senha - Zakys',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Recuperação de Senha</h2>
                <p>Você solicitou a recuperação da sua senha na plataforma Zakys.</p>
                <p>Clique no botão abaixo para redefinir sua senha:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #EC4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Redefinir Minha Senha</a>
                </div>
                <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
                <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px;">Se você não solicitou a redefinição de senha, por favor ignore este e-mail.</p>
                <p style="color: #999; font-size: 12px;">Este link expira em 1 hora.</p>
            </div>
        `
    }

    try {
        await transporter.sendMail(mailOptions)
        console.log(`[Email] Password reset sent to ${to}`)
    } catch (error) {
        console.error(`[Email] Error sending to ${to}:`, error)
        throw new Error('Falha ao enviar e-mail de recuperação')
    }
}
