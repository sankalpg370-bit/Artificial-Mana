import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// If the keys are missing, the site still works. It saves progress in the browser only.
export const supabase = url && key ? createClient(url, key) : null;
