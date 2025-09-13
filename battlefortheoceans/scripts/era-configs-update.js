// scripts/era-configs-update.js (v0.1.4)
// Copyright(c) 2025, Clint H. O'Connor
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateEraConfigs() {
  const configDir = path.resolve(__dirname, '..', 'src', 'config');
  try {
    const files = await fs.readdir(configDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(configDir, file);
      const configData = await fs.readFile(filePath, 'utf8');
      const eraConfig = JSON.parse(configData);
      const eraId = eraConfig.era;

      // Check if the era already exists
      const { data: existingConfig, error: fetchError } = await supabase
        .from('era_configs')
        .select('config, created_at, updated_at')
        .eq('id', eraId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
        throw fetchError;
      }

      const newConfig = {
        version: eraConfig.version,
        era: eraConfig.era,
        name: eraConfig.name,
        era_description: eraConfig.era_description,
        free: eraConfig.free,
        rows: eraConfig.rows,
        cols: eraConfig.cols,
        boundary: eraConfig.boundary,
        max_players: eraConfig.max_players,
        playerfleet: eraConfig.playerfleet,
        opponentfleet: eraConfig.opponentfleet,
        terrain: eraConfig.terrain,
        ai_captains: eraConfig.ai_captains,
        messages: eraConfig.messages
      };

      if (existingConfig) {
        // Normalize JSON for consistent comparison
        const existingConfigStr = JSON.stringify(existingConfig.config, Object.keys(newConfig).sort());
        const newConfigStr = JSON.stringify(newConfig, Object.keys(newConfig).sort());
//        console.log(`Comparing configs for ${eraId}:`);
//        console.log('Existing config:', existingConfigStr);
//        console.log('New config:', newConfigStr);

        const isConfigChanged = existingConfigStr !== newConfigStr;
        if (isConfigChanged) {
          const { error: updateError } = await supabase
            .from('era_configs')
            .update({ config: newConfig, updated_at: new Date().toISOString() })
            .eq('id', eraId);
          if (updateError) throw updateError;
          console.log(`UPDATED config for era "${eraId}" from ${file}`);
        } else {
//          console.log(`No changes detected for era ${eraId} from ${file}, skipping update`);
          continue;
        }
      } else {
        // Insert new era with created_at
        const { error: insertError } = await supabase
          .from('era_configs')
          .insert({ id: eraId, config: newConfig, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        if (insertError) throw insertError;
        console.log(`ADDED new era "${eraId}" from ${file}`);
      }
    }
  } catch (error) {
    console.error('Error updating era configs:', error.message);
    process.exit(1);
  }
}

updateEraConfigs();
// EOF - EOF - EOF
