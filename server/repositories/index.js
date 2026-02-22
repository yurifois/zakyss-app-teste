import { JsonRepository } from './json.repository.js'
import { SupabaseRepository } from './supabase.repository.js'
import dotenv from 'dotenv'

dotenv.config()

const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY

export function getRepository(name) {
    if (useSupabase) {
        // Remover o .json do nome se vier das rotas antigas
        const tableName = name.replace('.json', '')
        return new SupabaseRepository(tableName)
    }
    return new JsonRepository(name)
}
