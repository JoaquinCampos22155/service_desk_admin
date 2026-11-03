export class SupabaseConfigError extends Error {
  constructor() {
    super("Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local para conectar Supabase.");
    this.name = "SupabaseConfigError";
  }
}

export function createSupabaseClient(env, createClient) {
  const url = String(env?.VITE_SUPABASE_URL || "").trim();
  const key = String(env?.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) throw new SupabaseConfigError();
  return createClient(url, key);
}
