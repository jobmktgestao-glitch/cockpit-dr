import { createClient } from "@supabase/supabase-js";
const clean = (v) => (v || "").replace(/\s/g, "");
const url = clean(import.meta.env.VITE_SUPABASE_URL);
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);
if (!url || !anonKey) console.error("[supabase] variaveis de ambiente ausentes no build");
export const supabase = createClient(url, anonKey);
