// scripts/check-supabase.js (v0.1.2)
// Copyright(c) 2025, Clint H. O'Connor
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabase() {
  try {
    const { data: tables, error: tablesError } = await supabase.rpc('list_tables');
    if (tablesError) throw tablesError;

    const now = new Date();
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    };
    const formattedDate = now.toLocaleString('en-GB', options).replace(/,/g, '');
    console.log(`Generated: ${formattedDate} BST`);

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table.table_name)
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      console.log(`${table.table_name} (${count})`);
    }
  } catch (error) {
    console.error('Error checking Supabase:', error.message);
    process.exit(1);
  }
}

checkSupabase();
// EOF - EOF - EOF
