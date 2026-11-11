const fs = require('fs');
const files = [
  'mo7aky_extracted/tarqa/src/utils/dataLoader.js',
  'mo7aky_extracted/level_test/src/utils/dataLoader.js',
  'mo7aky_extracted/tiger/src/utils/dataLoader.js'
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(
    /if \(!loadedBanksList \|\| loadedBanksList\.length === 0\) \{\s*return \[\s*\{ key: 'search', name: '[^']+', questionCount: 600 \},\s*\{ key: 'verbal', name: '[^']+', questionCount: 400 \}\s*\];\s*\}/,
    "if (!loadedBanksList || loadedBanksList.length === 0) {\n    return [];\n  }"
  );
  fs.writeFileSync(f, content, 'utf8');
}
console.log('Cleaned mock question counts in dataLoader.js');
