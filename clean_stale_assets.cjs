const fs = require('fs');
const path = require('path');

const dirs = ['public/exam', 'public/tiger', 'public/simulation'];

for (const relDir of dirs) {
  const dir = path.join(__dirname, relDir);
  const htmlPath = path.join(dir, 'index.html');
  if (!fs.existsSync(htmlPath)) continue;
  const html = fs.readFileSync(htmlPath, 'utf8');

  const jsMatch = html.match(/src=["']\.\/assets\/(index-[^"']+\.js)["']/);
  const cssMatch = html.match(/href=["']\.\/assets\/(index-[^"']+\.css)["']/);

  const activeJs = jsMatch ? jsMatch[1] : null;
  const activeCss = cssMatch ? cssMatch[1] : null;

  console.log(`${relDir} active assets:`, { activeJs, activeCss });

  const assetsDir = path.join(dir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    for (const f of files) {
      if (f.startsWith('index-') && f.endsWith('.js') && f !== activeJs) {
        fs.unlinkSync(path.join(assetsDir, f));
        console.log('Removed stale asset:', f);
      }
      if (f.startsWith('index-') && f.endsWith('.css') && f !== activeCss) {
        fs.unlinkSync(path.join(assetsDir, f));
        console.log('Removed stale asset:', f);
      }
    }
  }
}
console.log('Dynamic cleanup done.');
