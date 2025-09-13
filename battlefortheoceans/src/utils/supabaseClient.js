// src/utils/supabaseClient.js (v0.1.6)
// Copyright(c) 2025, Clint H. O'Connor

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_KEY;

console.log('supabaseClient: Initializing with URL:', supabaseUrl);
if (!supabaseUrl) {
  console.error('supabaseClient: Missing Supabase environment variables - REACT_APP_SUPABASE_URL');
  throw new Error('REACT_APP_SUPABASE_URL is missing from environment variables');
}
if (!supabaseAnonKey) {
  console.error('supabaseClient: Missing Supabase environment variables - REACT_APP_SUPABASE_KEY');
  throw new Error('REACT_APP_SUPABASE_KEY is missing from environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('supabaseClient: Client created successfully');

export { supabase };

// EOF - EOF - EOF
