const fs = require('fs');
const path = require('path');

const targets = [
  { file: 'public/simulation/index.html', base: '/simulation/' },
  { file: 'public/exam/index.html', base: '/exam/' },
  { file: 'public/tiger/index.html', base: '/tiger/' },
  { file: 'mo7aky_extracted/tarqa/dist/index.html', base: '/simulation/' },
  { file: 'mo7aky_extracted/level_test/dist/index.html', base: '/exam/' },
  { file: 'mo7aky_extracted/tiger/dist/index.html', base: '/tiger/' }
];

for (const { file, base } of targets) {
  const p = path.join(__dirname, file);
  if (fs.existsSync(p)) {
    let html = fs.readFileSync(p, 'utf8');
    if (!html.includes('<base')) {
      html = html.replace('<head>', `<head>\n  <base href="${base}">`);
      fs.writeFileSync(p, html, 'utf8');
      console.log('Added base tag to ' + file);
    } else {
      console.log('Base tag already in ' + file);
    }
  }
}

