const fs = require('fs');
const path = require('path');

const tigerDir = path.join(__dirname, 'mo7aky_extracted/tiger/src');
const levelTestDir = path.join(__dirname, 'mo7aky_extracted/level_test/src');

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

console.log('1. Copying modern engine from tiger to level_test...');
// Copy utils
copyFolderSync(path.join(tigerDir, 'utils'), path.join(levelTestDir, 'utils'));
// Copy store
copyFolderSync(path.join(tigerDir, 'store'), path.join(levelTestDir, 'store'));
// Copy components
copyFolderSync(path.join(tigerDir, 'components'), path.join(levelTestDir, 'components'));

console.log('2. Customizing StartScreen.jsx for Orange Level Test...');
const ssPath = path.join(levelTestDir, 'components/StartScreen.jsx');
let ss = fs.readFileSync(ssPath, 'utf8');

// Replace logo and title
ss = ss.replace(/\/green\.png/g, '/orange.png');
ss = ss.replace(/green\.png/g, 'orange.png');
ss = ss.replace(/محاكي واختبارات نمر/g, 'اختبار تحديد المستوى');
ss = ss.replace(/محاكي نمر/g, 'تحديد المستوى');
ss = ss.replace(/تدريب متقدم على صيغ ونماذج نمر المقفلة والأسئلة الأكثر تكراراً/g, 'اختبار تشخيصي دقيق يقيس مستواك الحقيقي في القدرات ويحدد نقاط ضعفك وقوتك');

// Replace green/emerald color classes with orange/amber
ss = ss.replace(/bg-cyan-500 hover:bg-cyan-600 text-slate-900/g, 'bg-orange-500 hover:bg-orange-600 text-slate-950 font-black');
ss = ss.replace(/border-cyan-400/g, 'border-orange-400');
ss = ss.replace(/text-cyan-400/g, 'text-orange-400');
ss = ss.replace(/from-cyan-400 to-teal-300/g, 'from-amber-400 to-orange-500');
ss = ss.replace(/from-cyan-500 to-blue-600/g, 'from-orange-500 to-amber-600');
ss = ss.replace(/hover:border-cyan-400/g, 'hover:border-orange-400');
ss = ss.replace(/hover:border-cyan-400\/50/g, 'hover:border-orange-400/50');
ss = ss.replace(/hover:shadow-cyan-400/g, 'hover:shadow-orange-400');
ss = ss.replace(/bg-cyan-500\/20/g, 'bg-orange-500/20');
ss = ss.replace(/bg-cyan-500\/10/g, 'bg-orange-500/10');
ss = ss.replace(/border-emerald-500/g, 'border-orange-500');

// Default category preference to level_test, then search
ss = ss.replace(
  /filteredCategories\.find\(c => c\.key === 'tiger'\)/g,
  "filteredCategories.find(c => c.key === 'level_test') || filteredCategories.find(c => c.key === 'search')"
);
ss = ss.replace(
  /validCat\.key \|\| 'tiger'/g,
  "validCat.key || 'level_test'"
);

fs.writeFileSync(ssPath, ss, 'utf8');

console.log('3. Customizing ResultsHistory.jsx for Orange Level Test...');
const rhPath = path.join(levelTestDir, 'components/ResultsHistory.jsx');
let rh = fs.readFileSync(rhPath, 'utf8');
rh = rh.replace(/\/green\.png/g, '/orange.png');
rh = rh.replace(/green\.png/g, 'orange.png');
rh = rh.replace(/محاكي واختبارات نمر/g, 'اختبار تحديد المستوى');
rh = rh.replace(/محاكي نمر/g, 'تحديد المستوى');
rh = rh.replace(/text-cyan-400/g, 'text-orange-400');
rh = rh.replace(/border-cyan-400/g, 'border-orange-400');
fs.writeFileSync(rhPath, rh, 'utf8');

console.log('4. Customizing QuestionDisplay.jsx for Orange Level Test...');
const qdPath = path.join(levelTestDir, 'components/QuestionDisplay.jsx');
if (fs.existsSync(qdPath)) {
  let qd = fs.readFileSync(qdPath, 'utf8');
  qd = qd.replace(/text-cyan-400/g, 'text-orange-400');
  qd = qd.replace(/border-cyan-400/g, 'border-orange-400');
  fs.writeFileSync(qdPath, qd, 'utf8');
}

console.log('SUCCESS: level_test upgraded with the modern engine!');
