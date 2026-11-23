import { STORAGE_BLOCKED_HINT } from './safeStorage.js'

/**
 * Traduz a falha de um login para algo em que a pessoa consiga agir.
 *
 * Existe porque as telas de login antes ou mostravam a mensagem crua da
 * exceção, ou pior: o Portal do Parceiro anunciava "credenciais inválidas"
 * para QUALQUER falha. Servidor fora do ar, internet caindo e armazenamento
 * bloqueado viravam "senha errada", e o dono ficava trocando uma senha que
 * estava correta.
 */
export function loginErrorMessage(err) {
    const raw = err?.message || ''

    // 401 do servidor: aí sim é email ou senha errados de verdade.
    if (/credenciais inv/i.test(raw)) {
        return 'Email ou senha incorretos. Confira e tente de novo.'
    }

    // Armazenamento do navegador bloqueado. Checar antes da rede porque a
    // mensagem costuma citar "access denied", que confunde com falha de rede.
    if (/quota|securityerror|storage|access is denied|operation is insecure/i.test(raw)) {
        return STORAGE_BLOCKED_HINT
    }

    // Servidor dormindo, sem internet ou bloqueio de CORS.
    if (/não foi possível conectar|failed to fetch|networkerror|load failed/i.test(raw)) {
        return 'Não conseguimos falar com o servidor. Verifique sua internet e tente de novo em alguns segundos.'
    }

    return raw || 'Não foi possível entrar. Tente de novo em alguns instantes.'
}

/**
 * Login recusado por um motivo que a pessoa resolve sozinha (e-mail sem conta,
 * senha errada, e-mail do outro tipo de conta): devolve o aviso que fica na
 * tela e o(s) botão(ões) que levam ao próximo passo. Para qualquer outra
 * falha devolve null e a tela segue com o aviso rápido de sempre.
 *
 * kind: 'customer' (tela /entrar) ou 'admin' (Portal do Parceiro).
 */
export function loginProblem(err, kind, email = '') {
    const message = err?.message || ''
    const comEmail = (path) => email ? `${path}?email=${encodeURIComponent(email.trim())}` : path
    const esqueci = { label: 'Esqueci minha senha', to: '/recuperar-senha' }

    switch (err?.code) {
        case 'WRONG_PASSWORD':
            return { message, actions: [esqueci] }
        case 'EMAIL_NOT_FOUND':
            return {
                message,
                actions: kind === 'admin'
                    ? [{ label: 'Criar conta de estabelecimento', to: '/parceiro/cadastro' }]
                    : [{ label: 'Criar conta com este e-mail', to: comEmail('/cadastro') }],
            }
        case 'NO_ACCOUNT_HAS_BOOKINGS':
            return { message, actions: [{ label: 'Criar minha conta', to: comEmail('/cadastro') }] }
        case 'ACCOUNT_IS_PARTNER':
            return { message, actions: [{ label: 'Ir para o Portal do Parceiro', to: '/admin/login' }] }
        case 'ACCOUNT_IS_CUSTOMER':
            return { message, actions: [{ label: 'Ir para o login de cliente', to: '/entrar' }] }
        default:
            return null
    }
}

export default { loginErrorMessage, loginProblem }
