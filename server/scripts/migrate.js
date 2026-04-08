import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

const tables = [
    'users',
    'admins',
    'establishments',
    'categories',
    'services',
    'appointments',
    'employees'
]

async function migrate() {
    console.log('🚀 Iniciando migração JSON -> Supabase...')

    for (const table of tables) {
        try {
            const filePath = path.join(dataDir, `${table}.json`)
            const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))

            console.log(`📦 Migrando ${data.length} registros para a tabela "${table}"...`)

            // Limpar tabela antes (opcional)
            // await supabase.from(table).delete().neq('id', -1)

            // Inserir em lotes para evitar problemas de limite
            const batchSize = 50
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize)
                const { error } = await supabase.from(table).upsert(batch)

                if (error) {
                    console.error(`❌ Erro em ${table} (lote ${i}):`, error.message)
                }
            }

            console.log(`✅ Tabela "${table}" migrada com sucesso!`)
        } catch (error) {
            console.error(`❌ Falha na migração da tabela "${table}":`, error.message)
        }
    }

    console.log('🏁 Migração concluída!')
}

migrate()
