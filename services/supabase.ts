
import { createClient } from '@supabase/supabase-js';

// Estos valores deben venir de tus variables de entorno (.env)
// Crea un archivo .env en la raíz del proyecto con:
// VITE_SUPABASE_URL=tu_url_de_supabase
// VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Exportamos el cliente. Si no hay claves, será null (manejaremos esto en la UI)
export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Helper para verificar si Supabase está configurado
export const isSupabaseConfigured = () => {
    return !!supabase;
};
