import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kxzywcfioxqburzobhdd.supabase.co';
const supabaseAnonKey = 'sb_publishable_d6a4DWlRb_cvdZzHvNHrjg_QZvO6KsX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = true;
