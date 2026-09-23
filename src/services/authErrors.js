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

export default { loginErrorMessage }
