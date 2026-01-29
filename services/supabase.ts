
import { createClient } from '@supabase/supabase-js';

// Estos valores deben venir de tus variables de entorno (.env)
// Crea un archivo .env en la raíz del proyecto con:
// VITE_SUPABASE_URL=tu_url_de_supabase
// VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Exportamos el cliente con configuración avanzada de autenticación
export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            // Usar localStorage para persistir sesión
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            // Auto-refresh del token antes de que expire
            autoRefreshToken: true,
            // Persistir la sesión entre recargas
            persistSession: true,
            // IMPORTANTE: Detectar automáticamente tokens en URLs (para deep links)
            detectSessionInUrl: true,
            // Usar PKCE flow (más seguro que implicit flow)
            // PKCE = Proof Key for Code Exchange
            flowType: 'pkce'
        }
    })
    : null;

// Helper para verificar si Supabase está configurado
export const isSupabaseConfigured = () => {
    return !!supabase;
};
