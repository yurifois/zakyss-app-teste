import dotenv from 'dotenv'
import { sendEmail } from './sendEmail.js'
import { maskEmail } from './logPrivacy.js'

dotenv.config()

export async function sendPasswordResetEmail(to, token) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const resetUrl = `${frontendUrl}/redefinir-senha?token=${token}`

    const subject = 'Recuperação de Senha - Zakys'
    const html = `
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
            <p style="color: #999; font-size: 12px;">Este link expira em 24 horas.</p>
        </div>
    `

    try {
        await sendEmail(to, subject, html)
        console.log(`[Email] Password reset sent to ${maskEmail(to)}`)
    } catch (error) {
        console.error(`[Email] Error sending to ${maskEmail(to)}:`, error)
        throw new Error('Falha ao enviar e-mail: ' + error.message)
    }
}

// Link para confirmar o e-mail de uma conta nova. Até clicar, a conta não
// entra — é o que impede alguém de criar conta com o e-mail de outra pessoa.
export async function sendEmailVerificationEmail(to, token) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const verifyUrl = `${frontendUrl}/verificar-email?token=${token}`

    const subject = 'Confirme seu e-mail - Zakys'
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Confirme seu e-mail</h2>
            <p>Sua conta na Zakys foi criada. Para começar a usar, confirme que este e-mail é seu:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background-color: #EC4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Confirmar meu e-mail</a>
            </div>
            <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${verifyUrl}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">Se você não criou uma conta na Zakys, ignore este e-mail: sem a confirmação, ninguém consegue entrar usando o seu endereço.</p>
            <p style="color: #999; font-size: 12px;">Este link vale por 7 dias.</p>
        </div>
    `

    try {
        await sendEmail(to, subject, html)
        console.log(`[Email] Verification sent to ${maskEmail(to)}`)
    } catch (error) {
        console.error(`[Email] Error sending verification to ${maskEmail(to)}:`, error)
        throw new Error('Falha ao enviar e-mail: ' + error.message)
    }
}

/**
 * Convite para criar conta.
 *
 * Enviado quando alguém pede "esqueci minha senha" com um e-mail que NÃO tem
 * conta, mas que já aparece em algum agendamento — o caso clássico de quem foi
 * agendado manualmente pelo estabelecimento e nunca se cadastrou.
 *
 * Antes disso essas pessoas recebiam a tela verde de "verifique seu e-mail" e
 * nada chegava nunca, porque a rota devolvia sucesso sem enviar coisa alguma.
 * Ficavam sem nenhum caminho de volta para a conta.
 *
 * O envio aqui é proposital para manter a resposta da rota idêntica nos dois
 * casos (com e sem conta), preservando a proteção contra enumeração de e-mails.
 */
export async function sendAccountInviteEmail(to) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const signupUrl = `${frontendUrl}/cadastro?email=${encodeURIComponent(to)}`

    const subject = 'Crie sua conta - Zakys'
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Você ainda não tem conta na Zakys</h2>
            <p>Recebemos um pedido de recuperação de senha para <strong>${to}</strong>.</p>
            <p>Esse e-mail está nos seus agendamentos, mas ainda não existe uma conta criada com ele — por isso não há senha para recuperar.</p>
            <p>Crie sua conta para acessar seus agendamentos, remarcar e acompanhar tudo pelo app:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${signupUrl}" style="background-color: #EC4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Criar Minha Conta</a>
            </div>
            <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${signupUrl}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">Se você não solicitou nada, pode ignorar este e-mail com segurança.</p>
        </div>
    `

    try {
        await sendEmail(to, subject, html)
        console.log(`[Email] Account invite sent to ${maskEmail(to)}`)
    } catch (error) {
        console.error(`[Email] Error sending invite to ${maskEmail(to)}:`, error)
        throw new Error('Falha ao enviar e-mail: ' + error.message)
    }
}
