import { getRepository } from '../repositories/index.js'

const termsAcceptanceRepo = getRepository('terms_acceptance.json')

// Bump isso sempre que o texto dos Termos de Uso/Política de Privacidade
// mudar de verdade — cada aceite fica gravado com a versão vigente na hora,
// então dá pra saber quem aceitou o quê depois de uma mudança futura.
export const CURRENT_TERMS_VERSION = '2026-11'

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

// A pessoa já aceitou a versão vigente? Sem registro nenhum (conta muito
// antiga) também conta como "precisa aceitar".
export async function hasAcceptedCurrentTerms({ userId, userType }) {
    try {
        const registros = await termsAcceptanceRepo.findAll({ userId, userType, version: CURRENT_TERMS_VERSION })
        return registros.length > 0
    } catch (err) {
        // Se o banco falhar aqui, não trava ninguém: o aviso aparece de novo depois.
        console.error('[Terms] Falha ao consultar aceite:', err.message)
        return true
    }
}
