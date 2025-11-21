import { createClient } from '@supabase/supabase-js';

// --- Supabase Configuration ---
// The credentials below have been provided to get the application running.
// For production, it is strongly recommended to use environment variables
// to keep sensitive keys out of the source code.

const supabaseUrl = 'https://dtztncolvxufxlofowir.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0enRuY29sdnh1Znhsb2Zvd2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NzkzODQsImV4cCI6MjA3NzU1NTM4NH0.bhowLx8wnBEoGcM9dikTXmumIBSz_kcpjCF_ufX7E9M';

/*
// Example for using environment variables (recommended for production):
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
*/

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key are required. Please check your configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
