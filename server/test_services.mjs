import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/home/yuri/procts/zakys app/server/.env' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

async function run() {
    const { data: services, error } = await supabase.from('services').select('*').order('id', { ascending: false }).limit(10)
    console.log(services)
}
run()
