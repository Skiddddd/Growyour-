import { createClient, SupabaseClient } from '@supabase/supabase-js';

// User's Supabase project credentials
export const DEFAULT_SUPABASE_URL = 'https://bttvoorzlzmxzppcigid.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dHZvb3J6bHpteHpwcGNpZ2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MjYyMTAsImV4cCI6MjEwNDMwMjIxMH0.Xl2O4zYctS5a6eo3oC-7DgLuMfukfTK7FPOG4arekqg';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('YOUR_SUPABASE')
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
