/**
 * Validate CNPJ number
 */
export function validateCNPJ(cnpj) {
    if (!cnpj) return false
    cnpj = cnpj.replace(/[^\d]/g, '')
    if (cnpj.length !== 14) return false
    if (/^(\d)\1+$/.test(cnpj)) return false

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
 * Validate CPF number
 */
export function validateCPF(cpf) {
    if (!cpf) return false
    cpf = cpf.replace(/[^\d]/g, '')
    if (cpf.length !== 11) return false
    if (/^(\d)\1+$/.test(cpf)) return false

    let sum = 0
    let remainder

    for (let i = 1; i <= 9; i++) {
        sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i)
    }
    remainder = (sum * 10) % 11

    if ((remainder === 10) || (remainder === 11)) remainder = 0
    if (remainder !== parseInt(cpf.substring(9, 10))) return false

    sum = 0
    for (let i = 1; i <= 10; i++) {
        sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i)
    }
    remainder = (sum * 10) % 11

    if ((remainder === 10) || (remainder === 11)) remainder = 0
    if (remainder !== parseInt(cpf.substring(10, 11))) return false

    return true
}

/**
 * Format CNPJ
 */
export function formatCNPJ(cnpj) {
    const digits = cnpj.replace(/[^\d]/g, '')
    if (digits.length !== 14) return cnpj
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/**
 * Format CPF
 */
export function formatCPF(cpf) {
    const digits = cpf.replace(/[^\d]/g, '')
    if (digits.length !== 11) return cpf
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

/**
 * Remove formatting
 */
export function cleanDocument(doc) {
    return doc.replace(/[^\d]/g, '')
}

export const unformatCNPJ = cleanDocument

/**
 * Mask CNPJ input
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
 * Mask CPF input
 */
export function maskCPF(value) {
    const digits = value.replace(/[^\d]/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

/**
 * Lookup CEP using ViaCEP API
 */
export async function lookupCEP(cep) {
    const clean = cep.replace(/[^\d]/g, '')
    if (clean.length !== 8) throw new Error('CEP inválido')

    try {
        const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
        const data = await response.json()

        if (data.erro) {
            throw new Error('CEP não encontrado')
        }

        return {
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            uf: data.uf,
            cep: data.cep
        }
    } catch (err) {
        throw new Error(err.message || 'Erro ao buscar CEP')
    }
}

/**
 * Real CNPJ lookup using BrasilAPI
 */
export async function lookupCNPJ(cnpj) {
    const clean = cleanDocument(cnpj)
    if (!validateCNPJ(clean)) throw new Error('CNPJ inválido')

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)

        if (!response.ok) {
            if (response.status === 404) throw new Error('CNPJ não encontrado na base de dados')
            throw new Error('Erro ao consultar CNPJ')
        }

        const data = await response.json()

        return {
            cnpj: formatCNPJ(clean),
            razaoSocial: data.razao_social,
            nomeFantasia: data.nome_fantasia || data.razao_social,
            situacao: data.descricao_situacao_cadastral,
            endereco: {
                logradouro: data.logradouro,
                numero: data.numero,
                bairro: data.bairro,
                cidade: data.municipio,
                uf: data.uf,
                cep: data.cep,
            },
        }
    } catch (err) {
        console.error('Erro CNPJ API:', err)
        throw new Error(err.message || 'Erro ao buscar dados do CNPJ. Tente preencher manualmente.')
    }
}

