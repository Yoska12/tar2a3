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

console.log('Syncing simulators into dist...');
copyFolderSync(path.join(root, 'public/exam'), path.join(root, 'dist/exam'));
copyFolderSync(path.join(root, 'public/tiger'), path.join(root, 'dist/tiger'));
copyFolderSync(path.join(root, 'public/simulation'), path.join(root, 'dist/simulation'));

console.log('Syncing API and questions into dist...');
if (fs.existsSync(path.join(root, 'public/api/hostinger_api.php'))) {
  fs.mkdirSync(path.join(root, 'dist/api'), { recursive: true });
  fs.copyFileSync(path.join(root, 'public/api/hostinger_api.php'), path.join(root, 'dist/api/hostinger_api.php'));
}
if (fs.existsSync(path.join(root, 'public/Login'))) {
  copyFolderSync(path.join(root, 'public/Login'), path.join(root, 'dist/Login'));
  // Mirror to lowercase 'login' to ensure 100% case-insensitive safety on Linux Hostinger
  copyFolderSync(path.join(root, 'public/Login'), path.join(root, 'dist/login'));
}
if (fs.existsSync(path.join(root, 'public/api/course_content_backup.json'))) {
  fs.copyFileSync(path.join(root, 'public/api/course_content_backup.json'), path.join(root, 'dist/api/course_content_backup.json'));
}
if (fs.existsSync(path.join(root, 'public/api/course_pricing_backup.json'))) {
  fs.copyFileSync(path.join(root, 'public/api/course_pricing_backup.json'), path.join(root, 'dist/api/course_pricing_backup.json'));
}
if (fs.existsSync(path.join(root, 'public/api/promo_codes_backup.json'))) {
  fs.copyFileSync(path.join(root, 'public/api/promo_codes_backup.json'), path.join(root, 'dist/api/promo_codes_backup.json'));
}
fs.copyFileSync(path.join(root, 'public/api_banks.php'), path.join(root, 'dist/api_banks.php'));
fs.mkdirSync(path.join(root, 'dist/api/banks'), { recursive: true });
copyFolderSync(path.join(root, 'public/api/banks'), path.join(root, 'dist/api/banks'));
if (fs.existsSync(path.join(root, 'public/api/shared-questions.php'))) {
  fs.copyFileSync(path.join(root, 'public/api/shared-questions.php'), path.join(root, 'dist/api/shared-questions.php'));
}
if (fs.existsSync(path.join(root, 'public/vendor'))) {
  copyFolderSync(path.join(root, 'public/vendor'), path.join(root, 'dist/vendor'));
}
fs.copyFileSync(path.join(root, 'public/search.json'), path.join(root, 'dist/search.json'));
fs.copyFileSync(path.join(root, 'public/shared_questions.json'), path.join(root, 'dist/shared_questions.json'));

console.log('Syncing images and .htaccess into dist...');
['blue.png', 'green.png', 'orange.png', 'favicon1.ico', 'logo1.png', 'Watermark.png', 'Watermark1.png', '404.php', '404.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html', 'robots.txt', 'sitemap.xml', 'index.md', 'llms.txt'].forEach(f => {
  const srcPath = path.join(root, 'public', f);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(root, 'dist', f));
  }
});

const htaccessPath = path.join(root, 'public/.htaccess');
if (fs.existsSync(htaccessPath)) {
  fs.copyFileSync(htaccessPath, path.join(root, 'dist/.htaccess'));
}

const indexPhpPath = path.join(root, 'public/index.php');
if (fs.existsSync(indexPhpPath)) {
  fs.copyFileSync(indexPhpPath, path.join(root, 'dist/index.php'));
}

const userIniPath = path.join(root, 'public/.user.ini');
if (fs.existsSync(userIniPath)) {
  fs.copyFileSync(userIniPath, path.join(root, 'dist/.user.ini'));
}

if (fs.existsSync(path.join(root, 'public/vendor'))) {
  copyFolderSync(path.join(root, 'public/vendor'), path.join(root, 'dist/simulation/vendor'));
  copyFolderSync(path.join(root, 'public/vendor'), path.join(root, 'dist/exam/vendor'));
  copyFolderSync(path.join(root, 'public/vendor'), path.join(root, 'dist/tiger/vendor'));
}

console.log('Sync to dist completed successfully.');
