const fs = require('fs');
const path = require('path');

const files = [
  'public/simulation/assets/index-2Rjozn0O.js',
  'public/exam/assets/index-fGf_M39l.js',
  'public/tiger/assets/index-CKiF52tY.js'
];

for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const importRegex = /import\s*(?:\{[^}]*\}|\*\s*as\s*\w+|\w+)?\s*from\s*['"]([^'"]+)['"]/g;
  const dynRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  
  const imports = new Set();
  let m;
  while ((m = importRegex.exec(code)) !== null) imports.add(m[1]);
  while ((m = dynRegex.exec(code)) !== null) imports.add(m[1]);

  console.log('=== ' + f + ' ===');
  console.log('Imports:', Array.from(imports));
  
  // Verify each import file exists
  for (const imp of imports) {
    const assetPath = path.resolve(path.dirname(f), imp);
    const exists = fs.existsSync(assetPath);
    console.log('  ' + imp + ' -> exists? ' + exists + ' (' + assetPath + ')');
  }
}

