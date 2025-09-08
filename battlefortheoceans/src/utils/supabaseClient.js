// src/utils/supabaseClient.js (v0.1.5)
// Copyright(c) 2025, Clint H. O'Connor

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error('REACT_APP_SUPABASE_URL is missing from environment variables');
}
if (!supabaseAnonKey) {
  throw new Error('REACT_APP_SUPABASE_KEY is missing from environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase };

// EOF - EOF - EOF
