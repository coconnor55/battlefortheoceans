// scripts/list-versions.js (v0.1.6)
// Copyright(c) 2025, Clint H. O'Connor

const fs = require('fs');
const path = require('path');

// Check if we're in scripts directory or parent directory
const currentDir = __dirname;
const isInScriptsDir = path.basename(currentDir) === 'scripts';
const rootDir = isInScriptsDir ? path.resolve(__dirname, '..') : __dirname;

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
      getAllFiles(filePath, fileList);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.css'))) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = getAllFiles(rootDir);

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
console.log(`Scanning from: ${rootDir}`);

allFiles.forEach(filePath => {
  const relative = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const firstLine = lines[0].trim();
  let version = 'unknown';
  let eofExpected;
  
  if (filePath.endsWith('.js')) {
    const match = firstLine.match(/^\/\/\s*.+\s*\(v([\d\.]+)\)$/);
    if (match) {
      version = match[1];
    }
    eofExpected = '// EOF - EOF - EOF';
  } else if (filePath.endsWith('.css')) {
    const match = firstLine.match(/^\/\*\s*.+\s*\(v([\d\.]+)\)\s*\*\//);
    if (match) {
      version = match[1];
    }
    eofExpected = '/* EOF - EOF - EOF */';
  }
  
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  const lastNonEmptyLine = nonEmptyLines[nonEmptyLines.length - 1]?.trim() || '';
  const eofStatus = lastNonEmptyLine === eofExpected ? 'ok' : 'missing-eof';
  
  console.log(`${relative} (v${version === 'unknown' ? '?' : version}) ${eofStatus}`);
});

// EOF - EOF - EOF
