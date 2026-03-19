import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kxzywcfioxqburzobhdd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4enl3Y2Zpb3hxYnVyem9iaGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTgyOTksImV4cCI6MjA4OTQ5NDI5OX0.7Ih5CfGm35XFK1Cb21QSOMaMnvbpitqr90-yV8soclA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = true;
