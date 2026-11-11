const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const stat = fs.lstatSync(path.join(from, element));
    if (stat.isDirectory()) {
      copyFolderSync(path.join(from, element), path.join(to, element));
    } else {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    }
  });
}

console.log('=== 1. Deploying Level Test (Orange) to public/exam ===');
copyFolderSync(path.join(root, 'mo7aky_extracted/level_test/dist'), path.join(root, 'public/exam'));
let examHtml = fs.readFileSync(path.join(root, 'public/exam/index.html'), 'utf8');
if (!examHtml.includes('<base href="/exam/">')) {
  examHtml = examHtml.replace('<head>', '<head>\n  <base href="/exam/">');
  fs.writeFileSync(path.join(root, 'public/exam/index.html'), examHtml, 'utf8');
}
fs.copyFileSync(path.join(root, 'public/orange.png'), path.join(root, 'public/exam/orange.png'));
fs.copyFileSync(path.join(root, 'public/green.png'), path.join(root, 'public/exam/green.png'));
fs.copyFileSync(path.join(root, 'public/blue.png'), path.join(root, 'public/exam/blue.png'));

console.log('=== 2. Deploying Tiger (Green) to public/tiger ===');
copyFolderSync(path.join(root, 'mo7aky_extracted/tiger/dist'), path.join(root, 'public/tiger'));
let tigerHtml = fs.readFileSync(path.join(root, 'public/tiger/index.html'), 'utf8');
if (!tigerHtml.includes('<base href="/tiger/">')) {
  tigerHtml = tigerHtml.replace('<head>', '<head>\n  <base href="/tiger/">');
  fs.writeFileSync(path.join(root, 'public/tiger/index.html'), tigerHtml, 'utf8');
}
fs.copyFileSync(path.join(root, 'public/orange.png'), path.join(root, 'public/tiger/orange.png'));
fs.copyFileSync(path.join(root, 'public/green.png'), path.join(root, 'public/tiger/green.png'));
fs.copyFileSync(path.join(root, 'public/blue.png'), path.join(root, 'public/tiger/blue.png'));

console.log('=== 3. Deploying Tarqa (Blue) to public/simulation ===');
copyFolderSync(path.join(root, 'mo7aky_extracted/tarqa/dist'), path.join(root, 'public/simulation'));
let simHtml = fs.readFileSync(path.join(root, 'public/simulation/index.html'), 'utf8');
if (!simHtml.includes('<base href="/simulation/">')) {
  simHtml = simHtml.replace('<head>', '<head>\n  <base href="/simulation/">');
  fs.writeFileSync(path.join(root, 'public/simulation/index.html'), simHtml, 'utf8');
}
fs.copyFileSync(path.join(root, 'public/orange.png'), path.join(root, 'public/simulation/orange.png'));
fs.copyFileSync(path.join(root, 'public/green.png'), path.join(root, 'public/simulation/green.png'));
fs.copyFileSync(path.join(root, 'public/blue.png'), path.join(root, 'public/simulation/blue.png'));

console.log('=== 4. Ensuring API and questions files in public ===');
fs.mkdirSync(path.join(root, 'public/api/banks'), { recursive: true });
fs.copyFileSync(path.join(root, 'public/api_banks.php'), path.join(root, 'public/api/banks/index.php'));
fs.copyFileSync(path.join(root, 'public/api_banks.php'), path.join(root, 'public/api/banks/api_banks.php'));

console.log('DONE step 1-4');
