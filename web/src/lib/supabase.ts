import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://dbynfabwfcakxayyggzi.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IEf9R9oJ5kbn513DdeqODQ_DwLeF35r'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY

// Only the browser-safe publishable key is used here. Never put a secret/service-role key in Vite client code.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
