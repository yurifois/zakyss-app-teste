import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

export class SupabaseRepository {
    constructor(tableName) {
        this.tableName = tableName
    }

    async findAll(filter = null) {
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
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .eq('id', id)
            .single()

        if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows found"
        return data || null
    }

    async findOne(filter) {
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
        const { data, error } = await supabase
            .from(this.tableName)
            .insert([{ ...item, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
            .select()
            .single()

        if (error) throw error
        return data
    }

    async update(id, updates) {
        const { data, error } = await supabase
            .from(this.tableName)
            .update({ ...updates, updatedAt: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    }

    async delete(id) {
        const { error } = await supabase
            .from(this.tableName)
            .delete()
            .eq('id', id)

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
