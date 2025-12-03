/**
 * Add Pirate Fleet Achievements to Supabase
 * v0.1.0
 * 
 * Adds achievements for defeating 2, 3, and 4 pirate fleets
 * Run with: node scripts/add-pirate-achievements.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const version = 'v0.1.0';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables:');
  console.error('   REACT_APP_SUPABASE_URL');
  console.error('   SUPABASE_SECRET_KEY');
  console.error('\nSet these in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const newAchievements = [
  {
    id: 'pirate-scourge',
    name: 'Pirate Scourge',
    description: 'Defeat two pirate fleets',
    badge_icon: 'Swords',
    requirement_type: 'pirate_fleets_sunk',
    requirement_value: 2,
    points: 30,
    tier: 'silver',
    created_at: new Date().toISOString(),
    tooltip: 'Defeat two pirate alliances in battle',
    category: 'pirate_fleets',
    sort_order: 6,
    reward_passes: 5
  },
  {
    id: 'pirate-terror',
    name: 'Pirate Terror',
    description: 'Defeat three pirate fleets',
    badge_icon: 'Flame',
    requirement_type: 'pirate_fleets_sunk',
    requirement_value: 3,
    points: 60,
    tier: 'gold',
    created_at: new Date().toISOString(),
    tooltip: 'Defeat three pirate alliances in battle',
    category: 'pirate_fleets',
    sort_order: 7,
    reward_passes: 10
  },
  {
    id: 'pirate-nemesis',
    name: 'Pirate Nemesis',
    description: 'Defeat four pirate fleets',
    badge_icon: 'Crown',
    requirement_type: 'pirate_fleets_sunk',
    requirement_value: 4,
    points: 120,
    tier: 'platinum',
    created_at: new Date().toISOString(),
    tooltip: 'Defeat four pirate alliances - complete domination!',
    category: 'pirate_fleets',
    sort_order: 8,
    reward_passes: 20
  }
];

/**
 * Insert achievements into database
 */
async function insertAchievements() {
  console.log(`\nAdding ${newAchievements.length} pirate fleet achievements to database...\n`);
  
  try {
    for (const achievement of newAchievements) {
      console.log(`Inserting: ${achievement.name} (${achievement.id})`);
      
      const { data, error } = await supabase
        .from('achievements')
        .insert(achievement)
        .select();

      if (error) {
        // Check if it already exists
        if (error.code === '23505') {
          console.log(`  ⚠️  Already exists, skipping...`);
        } else {
          throw error;
        }
      } else {
        console.log(`  ✅ Added successfully`);
      }
    }

    console.log('\n✅ All pirate fleet achievements processed successfully!');
    return true;
  } catch (error) {
    console.error('\n❌ Database insertion failed:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`Pirate Fleet Achievement Installer ${version}\n`);
  
  const success = await insertAchievements();
  
  if (success) {
    console.log('\n✅ Done!');
    process.exit(0);
  } else {
    console.log('\n❌ Failed!');
    process.exit(1);
  }
}

main();

