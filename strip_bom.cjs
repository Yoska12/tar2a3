const fs = require('fs');
const path = require('path');

const targetFiles = [
  'mo7aky/shared_questions.json',
  'public/api/banks/search.json',
  'mo7aky_extracted/tarqa/public/api/banks/search.json',
  'mo7aky_extracted/level_test/public/api/banks/search.json',
  'mo7aky_extracted/tiger/public/api/banks/search.json'
];

for (const rel of targetFiles) {
  const p = path.join(__dirname, rel);
  if (fs.existsSync(p)) {
    let text = fs.readFileSync(p, 'utf8');
    // Strip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    // Validate JSON
    try {
      const parsed = JSON.parse(text);
      // Write back pure UTF-8 without BOM
      fs.writeFileSync(p, JSON.stringify(parsed, null, 2), { encoding: 'utf8' });
      console.log('Fixed ' + rel + ' - ' + parsed.length + ' questions loaded successfully!');
    } catch (e) {
      console.error('Failed to parse ' + rel + ':', e.message);
    }
  }
}

