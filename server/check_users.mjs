import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { data: admins, error: errA } = await supabase.from('admins').select('*')
  console.log('Admins:', admins?.map(a => ({ id: a.id, email: a.email, pass: a.password?.substring(0, 15) + '...' })))
  
  const { data: users, error: errU } = await supabase.from('users').select('*')
  console.log('Users:', users?.map(u => ({ id: u.id, email: u.email, pass: u.password?.substring(0, 15) + '...' })))
}
check()
