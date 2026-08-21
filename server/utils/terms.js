import { getRepository } from '../repositories/index.js'

const termsAcceptanceRepo = getRepository('terms_acceptance.json')

// Bump isso sempre que o texto dos Termos de Uso/Política de Privacidade
// mudar de verdade — cada aceite fica gravado com a versão vigente na hora,
// então dá pra saber quem aceitou o quê depois de uma mudança futura.
export const CURRENT_TERMS_VERSION = '2026-08'

export async function recordTermsAcceptance({ userId, userType }) {
    try {
        await termsAcceptanceRepo.create({
            userId,
            userType,
            version: CURRENT_TERMS_VERSION,
            acceptedAt: new Date().toISOString()
        })
    } catch (err) {
        // Nunca deixa isso derrubar o cadastro — o aceite já foi validado
        // como obrigatório antes de chegar aqui, isso é só o registro.
        console.error('[Terms] Falha ao registrar aceite (cadastro seguiu normalmente):', err.message)
    }
}
