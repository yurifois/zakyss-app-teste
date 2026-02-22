/**
 * Validate CNPJ number
 * @param {string} cnpj - CNPJ to validate
 * @returns {boolean} True if valid
 */
export function validateCNPJ(cnpj) {
    // Remove non-digits
    cnpj = cnpj.replace(/[^\d]/g, '')

    // Must have 14 digits
    if (cnpj.length !== 14) return false

    // Check for known invalid patterns
    if (/^(\d)\1+$/.test(cnpj)) return false

    // Validate check digits
    let size = cnpj.length - 2
    let numbers = cnpj.substring(0, size)
    const digits = cnpj.substring(size)
    let sum = 0
    let pos = size - 7

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--
        if (pos < 2) pos = 9
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (result !== parseInt(digits.charAt(0))) return false

    size = size + 1
    numbers = cnpj.substring(0, size)
    sum = 0
    pos = size - 7

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--
        if (pos < 2) pos = 9
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    return result === parseInt(digits.charAt(1))
}

/**
 * Format CNPJ for display
 * @param {string} cnpj - Raw CNPJ
 * @returns {string} Formatted CNPJ (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(cnpj) {
    const digits = cnpj.replace(/[^\d]/g, '')

    if (digits.length !== 14) return cnpj

    return digits.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5'
    )
}

/**
 * Remove CNPJ formatting
 * @param {string} cnpj - Formatted CNPJ
 * @returns {string} Raw digits only
 */
export function unformatCNPJ(cnpj) {
    return cnpj.replace(/[^\d]/g, '')
}

/**
 * Apply mask while typing
 * @param {string} value - Current input value
 * @returns {string} Masked value
 */
export function maskCNPJ(value) {
    const digits = value.replace(/[^\d]/g, '').slice(0, 14)

    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

/**
 * Mock CNPJ lookup (simulates API call)
 * @param {string} cnpj - CNPJ to lookup
 * @returns {Promise<Object|null>} Company data or null
 */
export async function lookupCNPJ(cnpj) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))

    // Mock data for demonstration
    const cleanCnpj = unformatCNPJ(cnpj)

    if (!validateCNPJ(cleanCnpj)) {
        throw new Error('CNPJ inválido')
    }

    // Return mock data
    return {
        cnpj: formatCNPJ(cleanCnpj),
        razaoSocial: 'Empresa Exemplo LTDA',
        nomeFantasia: '',
        situacao: 'ATIVA',
        dataAbertura: '2020-01-15',
        naturezaJuridica: 'Empresário Individual',
        endereco: {
            logradouro: 'Rua das Flores',
            numero: '123',
            bairro: 'Centro',
            cidade: 'São Paulo',
            uf: 'SP',
            cep: '01310-100',
        },
    }
}
