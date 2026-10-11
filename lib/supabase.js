import { createClient } from "@supabase/supabase-js";
import { isValidSupabaseConfig } from "./supabase-config";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// If the keys are missing, the site still works. It saves progress in the browser only.
export const supabase = isValidSupabaseConfig(url, key) ? createClient(url, key) : null;
