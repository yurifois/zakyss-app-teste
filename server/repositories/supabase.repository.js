import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

export const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null

export class SupabaseRepository {
    constructor(tableName) {
        this.tableName = tableName
        if (!supabase) {
            console.error(`❌ Supabase client NOT initialized for table: ${tableName}. Check your environment variables.`)
        }
    }

    async findAll(filter = null) {
        if (!supabase) throw new Error('Serviço de banco de dados indisponível (Supabase não configurado)')
        let query = supabase.from(this.tableName).select('*')

        if (filter) {
            Object.entries(filter).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    query = query.eq(key, value)
                }
            })
        }

        const { data, error } = await query
        if (error) throw error
        return data
    }

    async findById(id) {
        if (!supabase) throw new Error('Serviço de banco de dados indisponível')
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .eq('id', id)
            .single()

        if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows found"
        return data || null
    }

    async findOne(filter) {
        if (!supabase) throw new Error('Serviço de banco de dados indisponível')
        let query = supabase.from(this.tableName).select('*')

        Object.entries(filter).forEach(([key, value]) => {
            if (typeof value === 'string') {
                query = query.ilike(key, value)
            } else {
                query = query.eq(key, value)
            }
        })

        const { data, error } = await query.limit(1).single()
        if (error && error.code !== 'PGRST116') throw error
        return data || null
    }

    async create(item) {
        if (!supabase) throw new Error('Serviço de banco de dados indisponível')
        // Remove id so PostgreSQL auto-generates it via sequence
        const { id, ...itemWithoutId } = item
        const newItem = { ...itemWithoutId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }

        let attempts = 0
        let lastError = null

        while (attempts < 5) {
            attempts++
            const { data, error } = await supabase
                .from(this.tableName)
                .insert([newItem])
                .select()
                .single()

            if (!error) return data

            lastError = error

            // Se o erro for de violação de chave única (sequence dessincronizada)
            if (error.code === '23505' && error.message?.includes('pkey')) {
                console.log(`[SupabaseRepository] Sequence out of sync for ${this.tableName}. Attempting to heal...`)
                const { data: maxIdData } = await supabase
                    .from(this.tableName)
                    .select('id')
                    .order('id', { ascending: false })
                    .limit(1)
                
                const maxId = maxIdData?.[0]?.id || 0
                newItem.id = maxId + 1
                continue
            }

            // Se o erro for de coluna inexistente no schema do Supabase
            const missingColMatch = error.message?.match(/Could not find the '([^']+)' column/i)
            if (missingColMatch && missingColMatch[1]) {
                const missingCol = missingColMatch[1]
                console.warn(`[SupabaseRepository] Column '${missingCol}' missing in table '${this.tableName}' on insert. Removing field and retrying...`)
                delete newItem[missingCol]
                continue
            }

            throw error
        }

        if (lastError) throw lastError
    }

    async update(id, updates) {
        if (!supabase) throw new Error('Serviço de banco de dados indisponível')
        const updatePayload = { ...updates, updatedAt: new Date().toISOString() }

        let attempts = 0
        let lastError = null

        while (attempts < 5) {
            attempts++
            const { data, error } = await supabase
                .from(this.tableName)
                .update(updatePayload)
                .eq('id', id)
                .select()
                .single()

            if (!error) return data

            lastError = error

            // Se o erro for de coluna inexistente no schema do Supabase (ex: cancelledAt, cancelledBy)
            const missingColMatch = error.message?.match(/Could not find the '([^']+)' column/i)
            if (missingColMatch && missingColMatch[1]) {
                const missingCol = missingColMatch[1]
                console.warn(`[SupabaseRepository] Column '${missingCol}' missing in table '${this.tableName}' on update. Removing field and retrying...`)
                delete updatePayload[missingCol]
                continue
            }

            throw error
        }

        if (lastError) throw lastError
    }

    async delete(id) {
        if (!supabase) throw new Error('Serviço de banco de dados indisponível')
        const { error } = await supabase
            .from(this.tableName)
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }

    async deleteMany(filter) {
        let query = supabase.from(this.tableName).delete()

        Object.entries(filter).forEach(([key, value]) => {
            query = query.eq(key, value)
        })

        const { error } = await query
        if (error) throw error
        return true
    }

    async search(queryText, fields) {
        // Supabase/PostgreSQL search is a bit different. 
        // For a simple implementation, we can use or() with ilike
        const orFilter = fields.map(field => `${field}.ilike.%${queryText}%`).join(',')
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .or(orFilter)

        if (error) throw error
        return data
    }
}
