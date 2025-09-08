// scripts/create_guest.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseSecretKey = process.env.REACT_APP_SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_SECRET_KEY is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function createGuest() {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('is_guest', true)
    .single();

  if (error) {
    console.error('Error checking guest user:', error.message);
    return;
  }

  if (data) {
    console.log('Guest user already exists:', data.id);
    return;
  }

  const { error: signUpError } = await supabase.auth.signUp({
    email: 'guest@battlefortheoceans.com',
    password: 'guest123',
  });

  if (signUpError) {
    console.error('Error signing up guest user:', signUpError.message);
    return;
  }

  const { error: insertError } = await supabase.from('users').insert({
    email: 'guest@battlefortheoceans.com',
    password_hash: '', // Adjust if needed
    is_guest: true,
  });

  if (insertError) {
    console.error('Error inserting guest user:', insertError.message);
  } else {
    console.log('Guest user created successfully');
  }
}

createGuest();

// EOF - EOF - EOF
