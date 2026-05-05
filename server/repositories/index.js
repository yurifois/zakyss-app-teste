import { JsonRepository } from './json.repository.js'
import { SupabaseRepository } from './supabase.repository.js'
import dotenv from 'dotenv'

dotenv.config()

const useSupabase = process.env.SUPABASE_URL && 
                   process.env.SUPABASE_ANON_KEY && 
                   !process.env.SUPABASE_URL.includes('placeholder') &&
                   process.env.SUPABASE_URL.startsWith('http')

export function getRepository(name) {
    if (useSupabase) {
        console.log(`[Database] Using Supabase for: ${name}`)
        // Remover o .json do nome se vier das rotas antigas
        const tableName = name.replace('.json', '')
        return new SupabaseRepository(tableName)
    }
    
    console.log(`[Database] Using JSON for: ${name}`)
    return new JsonRepository(name)
}
