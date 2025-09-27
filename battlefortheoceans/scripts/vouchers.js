// scripts/vouchers.js
// Copyright(c) 2025, Clint H. O'Connor
// Voucher generation script for Battle for the Oceans

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const version = 'v0.2.0';

// Configuration - Fixed to match era-configs-update.js pattern
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Fixed: was SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   REACT_APP_SUPABASE_URL');
  console.error('   SUPABASE_SECRET_KEY');
  console.error('\nSet these in your .env file');
  process.exit(1);
}

// Initialize Supabase with service role
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    count: 1,
    type: 'midway'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' && i + 1 < args.length) {
      options.count = parseInt(args[i + 1]);
      i++;
    } else if (arg === '-type' && i + 1 < args.length) {
      options.type = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      showUsage();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
Voucher Generation Script ${version}

Usage: node scripts/vouchers.js [options]

Options:
  -n <number>     Number of vouchers to generate (default: 1)
  -type <type>    Voucher type (default: 'midway')
  -h, --help      Show this help message

Types:
  Era unlocks:    'midway', 'pirates' 
  Attack boosts:  'attack0.10', 'attack0.25', 'attack0.50'
  Defense boosts: 'defense0.10', 'defense0.25', 'defense0.50'

Examples:
  node scripts/vouchers.js -n 10 -type "midway"
  node scripts/vouchers.js -n 5 -type "attack0.25"
  node scripts/vouchers.js -n 20 -type "pirates"

Generated vouchers will be:
  - Listed in the console
  - Added to the Supabase vouchers table
  - Format: type-uuid (e.g., 'midway-abc123...')
`);
}

/**
 * Validate voucher type
 */
function validateType(type) {
  const validTypes = [
    // Era unlocks
    'midway', 'pirates',
    // Attack boosts
    'attack0.10', 'attack0.25', 'attack0.50',
    // Defense boosts
    'defense0.10', 'defense0.25', 'defense0.50'
  ];

  if (!validTypes.includes(type)) {
    console.error(`❌ Invalid voucher type: ${type}`);
    console.error(`Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
  }
}

/**
 * Generate voucher codes
 */
function generateVoucherCodes(count, type) {
  const vouchers = [];
  
  for (let i = 0; i < count; i++) {
    const uuid = randomUUID();
    const voucherCode = `${type}-${uuid}`;
    vouchers.push(voucherCode);
  }
  
  return vouchers;
}

/**
 * Insert vouchers into database
 */
async function insertVouchers(vouchers) {
  console.log(`📤 Inserting ${vouchers.length} vouchers into database...`);
  
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .insert(
        vouchers.map(code => ({ voucher_code: code }))
      );

    if (error) {
      throw error;
    }

    console.log('✅ Successfully inserted vouchers into database');
    return true;
  } catch (error) {
    console.error('❌ Database insertion failed:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`🎟️  Voucher Generator ${version}\n`);
  
  const options = parseArgs();
  
  // Validate inputs
  if (options.count <= 0 || options.count > 1000) {
    console.error('❌ Count must be between 1 and 1000');
    process.exit(1);
  }
  
  validateType(options.type);
  
  console.log(`Generating ${options.count} voucher(s) of type: ${options.type}`);
  console.log('─'.repeat(50));
  
  // Generate voucher codes
  const vouchers = generateVoucherCodes(options.count, options.type);
  
  // Display generated codes
  console.log('📋 Generated Voucher Codes:\n');
  vouchers.forEach((code, index) => {
    console.log(`${(index + 1).toString().padStart(3)}: ${code}`);
  });
  
  console.log('\n' + '─'.repeat(50));
  
  // Insert into database
  const success = await insertVouchers(vouchers);
  
  if (success) {
    console.log(`\n✅ Generated and stored ${options.count} voucher(s) successfully!`);
    console.log(`\n💡 Users can redeem these codes in the purchase flow.`);
  } else {
    console.log(`\n❌ Vouchers generated but database insertion failed.`);
    console.log('   Check your database connection and permissions.');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
// EOF
