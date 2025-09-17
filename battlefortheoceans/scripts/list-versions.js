// scripts/list-versions.js
// Copyright(c) 2025, Clint H. O'Connor

const fs = require('fs');
const path = require('path');

const version = "v0.1.8";

function scanDirectory(dirPath, basePath = '') {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.join(basePath, item.name);

    if (item.isDirectory()) {
      // Skip common directories that don't contain versioned files
      if (['node_modules', '.git', 'build', 'dist', '.next'].includes(item.name)) {
        continue;
      }
      results.push(...scanDirectory(fullPath, relativePath));
    } else if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.css'))) {
      const fileInfo = analyzeFile(fullPath, relativePath);
      if (fileInfo) {
        results.push(fileInfo);
      }
    }
  }

  return results;
}

function analyzeFile(filePath, relativePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let version = null;
    let hasEOF = false;
    let versionSource = 'missing';
    
    // Check for version in different formats - increased from 10 to 20 lines
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim();
      
      // Look for const version = "vx.y.z" format (preferred)
      const constMatch = line.match(/const\s+version\s*=\s*["']([^"']+)["']/);
      if (constMatch) {
        version = constMatch[1];
        versionSource = 'const';
        break;
      }
      
      // Look for old comment format as fallback
      const commentMatch = line.match(/\/\/.*\(([v]\d+\.\d+\.\d+[^)]*)\)/);
      if (commentMatch) {
        version = commentMatch[1];
        versionSource = 'comment';
        break;
      }
      
      // CSS version format /* ... (vx.y.z) */
      const cssMatch = line.match(/\/\*.*\(([v]\d+\.\d+\.\d+[^)]*)\)/);
      if (cssMatch) {
        version = cssMatch[1];
        versionSource = 'css-comment';
        break;
      }
    }
    
    // Check for EOF marker
    const lastLines = lines.slice(-5); // Check last 5 lines
    for (const line of lastLines) {
      const trimmed = line.trim();
      if (trimmed === '// EOF' || trimmed === '// EOF - EOF - EOF' ||
          trimmed === '/* EOF */' || trimmed === '/* EOF - EOF - EOF */') {
        hasEOF = true;
        break;
      }
    }
    
    // Determine status
    let status;
    if (version && hasEOF) {
      status = 'ok';
    } else if (version && !hasEOF) {
      status = 'missing-eof';
    } else if (!version && hasEOF) {
      status = 'missing-version';
    } else {
      status = 'missing-both';
    }
    
    return {
      path: relativePath,
      version: version || '?',
      status: status,
      versionSource: versionSource
    };
    
  } catch (error) {
    return {
      path: relativePath,
      version: 'error',
      status: 'read-error',
      versionSource: 'error'
    };
  }
}

function formatResults(results) {
  const now = new Date();
  const timeString = now.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
    timeZoneName: 'short'
  });
  
  console.log(`Generated: ${timeString}`);
  console.log(`Scanning from: ${process.cwd()}`);
  
  // Sort results by path
  results.sort((a, b) => a.path.localeCompare(b.path));
  
  for (const result of results) {
    const versionDisplay = result.version === '?' ? '(?)' : `(${result.version})`;
    console.log(`${result.path} ${versionDisplay} ${result.status}`);
  }
  
  // Summary statistics
  const stats = {
    total: results.length,
    ok: results.filter(r => r.status === 'ok').length,
    missingEOF: results.filter(r => r.status === 'missing-eof').length,
    missingVersion: results.filter(r => r.status === 'missing-version').length,
    missingBoth: results.filter(r => r.status === 'missing-both').length,
    errors: results.filter(r => r.status === 'read-error').length
  };
  
  console.log('\nSummary:');
  console.log(`Total files: ${stats.total}`);
  console.log(`Complete (version + EOF): ${stats.ok}`);
  console.log(`Missing EOF: ${stats.missingEOF}`);
  console.log(`Missing version: ${stats.missingVersion}`);
  console.log(`Missing both: ${stats.missingBoth}`);
  if (stats.errors > 0) {
    console.log(`Read errors: ${stats.errors}`);
  }
}

// Main execution
const startPath = process.cwd();
const results = scanDirectory(startPath);
formatResults(results);

// EOF
