import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are valid and not placeholders
export const isSupabaseConfigured = 
  !!(supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'seu_url_do_supabase' && 
  supabaseAnonKey !== 'sua_chave_anon_do_supabase');

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ [iRec] Supabase não está configurado no arquivo .env ou contém valores padrões de exemplo.\n' +
    'A plataforma iniciará em MODO DEMONSTRAÇÃO OFFLINE (memória local do navegador).'
  );
}

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
