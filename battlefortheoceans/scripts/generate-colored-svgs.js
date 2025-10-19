#!/usr/bin/env node
// scripts/generate-colored-svgs.js
// Generates colored variants of ship SVGs

const fs = require('fs');
const path = require('path');

// Default colors
let BLUE_COLOR = '#2563EB'; // rgb(37, 99, 235)
let RED_COLOR = '#DC2626';  // rgb(220, 38, 38)

// Parse command line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--blue' && args[i + 1]) {
    BLUE_COLOR = args[i + 1];
    i++;
  } else if (args[i] === '--red' && args[i + 1]) {
    RED_COLOR = args[i + 1];
    i++;
  }
}

console.log('Ship SVG Color Generator');
console.log('========================');
console.log(`Blue color: ${BLUE_COLOR}`);
console.log(`Red color: ${RED_COLOR}`);
console.log('');

const SHIPS_DIR = path.join(__dirname, '..', 'public', 'assets', 'ships');

// Ship filenames (without extension)
const SHIP_NAMES = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
  'pt-boat'
];

// Find all era directories
const eras = fs.readdirSync(SHIPS_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

console.log(`Found eras: ${eras.join(', ')}`);
console.log('');

let totalProcessed = 0;
let totalGenerated = 0;

eras.forEach(era => {
  const eraDir = path.join(SHIPS_DIR, era);
  console.log(`Processing era: ${era}`);
  
  SHIP_NAMES.forEach(shipName => {
    const originalPath = path.join(eraDir, `${shipName}.svg`);
    
    if (!fs.existsSync(originalPath)) {
      console.log(`  ⚠️  ${shipName}.svg not found, skipping`);
      return;
    }
    
    // Read original SVG (DO NOT MODIFY ORIGINAL)
    const svgContent = fs.readFileSync(originalPath, 'utf8');
    totalProcessed++;
    
    // Generate blue version (COPY to new file)
    const blueSvg = colorizeDark(svgContent, BLUE_COLOR);
    const bluePath = path.join(eraDir, `${shipName}-blue.svg`);
    fs.writeFileSync(bluePath, blueSvg, 'utf8');
    totalGenerated++;
    console.log(`  ✅ ${shipName}-blue.svg created (original preserved)`);
    
    // Generate red version (COPY to new file)
    const redSvg = colorizeDark(svgContent, RED_COLOR);
    const redPath = path.join(eraDir, `${shipName}-red.svg`);
    fs.writeFileSync(redPath, redSvg, 'utf8');
    totalGenerated++;
    console.log(`  ✅ ${shipName}-red.svg created (original preserved)`);
  });
  
  console.log('');
});

console.log('Summary');
console.log('=======');
console.log(`Original SVGs processed: ${totalProcessed}`);
console.log(`Colored SVGs generated: ${totalGenerated}`);
console.log('');
console.log('Done! 🎨');

/**
 * Replace dark colors in SVG with the specified color
 * Only replaces colors darker than 75% brightness (192/255)
 * Preserves light colors and transparency
 */
function colorizeDark(svgContent, newColor) {
  let result = svgContent;
  
  // Function to check if a color is dark (below 75% brightness)
  function isDark(colorStr) {
    if (!colorStr || colorStr === 'none') return false;
    
    let r, g, b;
    
    // Parse hex colors
    if (colorStr.startsWith('#')) {
      const hex = colorStr.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
      }
    }
    // Parse rgb colors
    else if (colorStr.startsWith('rgb')) {
      const matches = colorStr.match(/\d+/g);
      if (matches && matches.length >= 3) {
        r = parseInt(matches[0]);
        g = parseInt(matches[1]);
        b = parseInt(matches[2]);
      }
    }
    // Named colors - just replace common dark ones
    else if (['black', 'gray', 'grey', 'darkgray', 'darkgrey', 'dimgray', 'dimgrey'].includes(colorStr.toLowerCase())) {
      return true;
    }
    
    // Calculate brightness (0-255)
    if (r !== undefined && g !== undefined && b !== undefined) {
      const brightness = (r + g + b) / 3;
      return brightness < 192; // 75% of 255
    }
    
    return false;
  }
  
  // Replace fill attributes
  result = result.replace(/fill="([^"]*)"/gi, (match, color) => {
    return isDark(color) ? `fill="${newColor}"` : match;
  });
  result = result.replace(/fill='([^']*)'/gi, (match, color) => {
    return isDark(color) ? `fill='${newColor}'` : match;
  });
  result = result.replace(/fill:\s*([^;}"]+)/gi, (match, color) => {
    return isDark(color.trim()) ? `fill: ${newColor}` : match;
  });
  
  // Replace stroke attributes
  result = result.replace(/stroke="([^"]*)"/gi, (match, color) => {
    return isDark(color) ? `stroke="${newColor}"` : match;
  });
  result = result.replace(/stroke='([^']*)'/gi, (match, color) => {
    return isDark(color) ? `stroke='${newColor}'` : match;
  });
  result = result.replace(/stroke:\s*([^;}"]+)/gi, (match, color) => {
    return isDark(color.trim()) ? `stroke: ${newColor}` : match;
  });
  
  // Replace stop-color in gradients
  result = result.replace(/stop-color="([^"]*)"/gi, (match, color) => {
    return isDark(color) ? `stop-color="${newColor}"` : match;
  });
  result = result.replace(/stop-color='([^']*)'/gi, (match, color) => {
    return isDark(color) ? `stop-color='${newColor}'` : match;
  });
  
  return result;
}
