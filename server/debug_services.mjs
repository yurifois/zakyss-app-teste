import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/home/yuri/procts/zakys app/server/.env' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

async function run() {
    const { data: est, error } = await supabase.from('establishments').select('id, name, services').eq('id', 17).single()
    console.log('Establishment:', est)
    
    if (est) {
        const { data: servs } = await supabase.from('services').select('*')
        console.log('Total services in DB:', servs.length)
        const myServs = servs.filter(s => est.services.includes(s.id))
        console.log('Matching services:', myServs)
    }
}
run()
