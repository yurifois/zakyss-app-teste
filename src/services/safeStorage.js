/**
 * Armazenamento à prova de navegador restrito.
 *
 * Por que isso existe: no Android, muita gente abre o link do estabelecimento
 * pelo navegador embutido do WhatsApp/Instagram, ou com dados de site
 * bloqueados nas configurações. Nesses casos `localStorage.getItem` e
 * `setItem` não devolvem vazio: eles LANÇAM SecurityError/QuotaExceededError.
 *
 * Como o app chama storage em dezenas de lugares sem proteção, uma dessas
 * exceções subia no meio do login e a tela anunciava "credenciais inválidas"
 * mesmo com a senha certa, porque o servidor já tinha aceitado e o erro
 * aconteceu só na hora de guardar a sessão.
 *
 * A correção é trocar o objeto global uma única vez, aqui, por uma versão que
 * nunca lança. Assim todos os `localStorage.x` espalhados pelo app continuam
 * funcionando sem precisar ser reescritos. Quando o navegador bloqueia, a
 * sessão passa a viver em memória: o login funciona normalmente, só não
 * sobrevive ao fechar a aba — e a interface avisa isso.
 */

const memoryStores = {}

function createMemoryStorage(name) {
    const map = memoryStores[name] || (memoryStores[name] = new Map())
    return {
        get length() { return map.size },
        key(i) { return Array.from(map.keys())[i] ?? null },
        getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null },
        setItem(k, v) { map.set(String(k), String(v)) },
        removeItem(k) { map.delete(String(k)) },
        clear() { map.clear() },
    }
}

// Testa de verdade: ler, escrever e apagar. Alguns navegadores expõem o
// objeto mas explodem só no setItem, então checar a existência não basta.
function isUsable(storage) {
    try {
        if (!storage) return false
        const probe = '__zakys_probe__'
        storage.setItem(probe, '1')
        const ok = storage.getItem(probe) === '1'
        storage.removeItem(probe)
        return ok
    } catch {
        return false
    }
}

const status = { local: true, session: true }

function install(name) {
    let native = null
    try {
        native = window[name]
    } catch {
        native = null // só acessar a propriedade já pode lançar
    }

    if (isUsable(native)) return true

    console.warn(
        `[safeStorage] ${name} bloqueado por este navegador. ` +
        `A sessão vai funcionar, mas só até fechar a aba.`
    )
    try {
        Object.defineProperty(window, name, {
            value: createMemoryStorage(name),
            configurable: true,
            writable: false,
        })
    } catch (err) {
        console.error(`[safeStorage] Não foi possível substituir ${name}:`, err)
    }
    return false
}

if (typeof window !== 'undefined') {
    status.local = install('localStorage')
    status.session = install('sessionStorage')
}

/** true quando a sessão sobrevive ao fechar a aba (armazenamento real). */
export function isStoragePersistent() {
    return status.local
}

/** Mensagem pronta pra interface quando o armazenamento está bloqueado. */
export const STORAGE_BLOCKED_HINT =
    'Seu navegador está bloqueando o armazenamento do site, então você vai ' +
    'precisar entrar de novo ao reabrir. Se você abriu por dentro do WhatsApp ' +
    'ou do Instagram, toque nos três pontos e escolha "Abrir no Chrome".'

export default { isStoragePersistent, STORAGE_BLOCKED_HINT }
