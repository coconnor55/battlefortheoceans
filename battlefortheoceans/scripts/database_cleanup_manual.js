// database_cleanup_manual.js
// Copyright(c) 2025, Clint H. O'Connor
// v1.0.0: Manual cleanup script for expired/exhausted user_rights
//
// PURPOSE:
// Removes old, exhausted, non-purchased rights to keep database clean.
// Run this manually (e.g., monthly) via Node.js
//
// SAFETY:
// - Only deletes exhausted (uses_remaining = 0)
// - Only deletes expired entries older than 3 months
// - NEVER deletes purchased eras (stripe_payment_intent_id present)
// - NEVER deletes active rights (uses_remaining > 0 or -1)
//
// USAGE:
// node database_cleanup_manual.js --preview
// node database_cleanup_manual.js --execute

import { createClient } from '@supabase/supabase-js';

const version = 'v1.0.0';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_KEY';

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Preview mode - show what would be deleted
async function previewCleanup() {
  console.log(`\n[Cleanup ${version}] PREVIEW MODE - No deletions will occur\n`);
  
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  try {
    const { data, error } = await supabase
      .from('user_rights')
      .select('*')
      .eq('uses_remaining', 0)
      .not('expires_at', 'is', null)
      .lt('expires_at', threeMonthsAgo.toISOString())
      .is('stripe_payment_intent_id', null);

    if (error) {
      console.error('Error fetching preview:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('✅ No entries eligible for deletion.');
      console.log('   Database is clean!');
      return;
    }

    console.log(`Found ${data.length} entries eligible for deletion:\n`);
    
    // Group by rights_type
    const byType = {};
    data.forEach(entry => {
      const type = entry.rights_type;
      if (!byType[type]) byType[type] = [];
      byType[type].push(entry);
    });

    // Display summary
    Object.keys(byType).forEach(type => {
      console.log(`  ${type}: ${byType[type].length} entries`);
    });

    console.log('\nSample entries (first 5):');
    data.slice(0, 5).forEach((entry, i) => {
      console.log(`  ${i + 1}. ID: ${entry.id}`);
      console.log(`     Type: ${entry.rights_type} / ${entry.rights_value}`);
      console.log(`     Uses: ${entry.uses_remaining}`);
      console.log(`     Expired: ${entry.expires_at}`);
      console.log(`     Created: ${entry.created_at}\n`);
    });

    console.log(`\nTo delete these ${data.length} entries, run:`);
    console.log('node database_cleanup_manual.js --execute\n');

  } catch (error) {
    console.error('Preview failed:', error);
  }
}

// Execute cleanup - actually delete the entries
async function executeCleanup() {
  console.log(`\n[Cleanup ${version}] EXECUTE MODE - Deletions will occur!\n`);
  
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  try {
    // First, get count of what will be deleted
    const { data: previewData, error: previewError } = await supabase
      .from('user_rights')
      .select('id')
      .eq('uses_remaining', 0)
      .not('expires_at', 'is', null)
      .lt('expires_at', threeMonthsAgo.toISOString())
      .is('stripe_payment_intent_id', null);

    if (previewError) {
      console.error('Error fetching entries:', previewError);
      return;
    }

    if (!previewData || previewData.length === 0) {
      console.log('✅ No entries to delete. Database is clean!');
      return;
    }

    console.log(`⚠️  About to delete ${previewData.length} entries...`);
    console.log('   Waiting 5 seconds. Press Ctrl+C to cancel.\n');

    // Give user time to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Execute deletion
    const { error: deleteError } = await supabase
      .from('user_rights')
      .delete()
      .eq('uses_remaining', 0)
      .not('expires_at', 'is', null)
      .lt('expires_at', threeMonthsAgo.toISOString())
      .is('stripe_payment_intent_id', null);

    if (deleteError) {
      console.error('❌ Deletion failed:', deleteError);
      return;
    }

    console.log(`✅ Successfully deleted ${previewData.length} expired entries.`);
    console.log('   Database cleanup complete!\n');

  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (!mode || mode === '--help') {
    console.log('\nUSAGE:');
    console.log('  node database_cleanup_manual.js --preview   (show what would be deleted)');
    console.log('  node database_cleanup_manual.js --execute   (actually delete entries)\n');
    return;
  }

  if (mode === '--preview') {
    await previewCleanup();
  } else if (mode === '--execute') {
    await executeCleanup();
  } else {
    console.error(`Unknown mode: ${mode}`);
    console.log('Use --preview or --execute');
  }
}

main();

// EOF