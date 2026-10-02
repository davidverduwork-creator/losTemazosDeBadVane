import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function crearClienteSupabase() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local.');
    }

    return createClient(supabaseUrl, supabaseAnonKey);
}
