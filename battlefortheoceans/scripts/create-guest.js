// scripts/create_guest.js (v0.1.3)
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
    .maybeSingle();

  if (error) {
    console.error('Error checking guest user:', error.message);
    return;
  }

  if (data) {
    console.log('Guest user already exists:', data.id);
    return;
  }

  console.log('Creating guest user...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'guest@battlefortheoceans.com',
    password: 'guest123',
    options: { emailRedirectTo: 'https://battlefortheoceans.com/welcome' }, // Optional redirect
  });

  if (signUpError) {
    console.error('Error signing up guest user:', signUpError.message);
    return;
  }

  // Simulate email confirmation using service role key (admin bypass)
  const { error: confirmError } = await supabase.auth.admin.confirmUser(signUpData.user.id, 'https://battlefortheoceans.com/welcome');
  if (confirmError) {
    console.error('Error confirming guest user:', confirmError.message);
    return;
  }

  const { error: insertError } = await supabase.from('users').insert({
    email: 'guest@battlefortheoceans.com',
    password_hash: '',
    is_guest: true,
    username: 'guest',
  });

  if (insertError) {
    console.error('Error inserting guest user:', insertError.message);
  } else {
    console.log('Guest user created and confirmed successfully');
  }
}

createGuest();

// EOF - EOF - EOF
