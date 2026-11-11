const fs = require('fs');

// 1. Update App.tsx
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

appContent = appContent.split("onClick={() => handleTabSelect('simulation')}").join("onClick={() => window.location.href = '/simulation/'}");
appContent = appContent.split("onClick={() => handleTabSelect('exam')}").join("onClick={() => window.location.href = '/exam/'}");
appContent = appContent.split("onClick={() => handleTabSelect('tiger')}").join("onClick={() => window.location.href = '/tiger/'}");

fs.writeFileSync('src/App.tsx', appContent, 'utf8');
console.log('App.tsx updated to direct URLs');

// 2. Update Navbar.tsx so dropdown and mobile drawer also open direct URLs
let navContent = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

navContent = navContent.split("onSelectTab('simulation' as any)").join("window.location.href = '/simulation/'");
navContent = navContent.split("onSelectTab('exam' as any)").join("window.location.href = '/exam/'");
navContent = navContent.split("onSelectTab('tiger' as any)").join("window.location.href = '/tiger/'");

navContent = navContent.split("handleTabClick('simulation')").join("window.location.href = '/simulation/'");
navContent = navContent.split("handleTabClick('exam')").join("window.location.href = '/exam/'");
navContent = navContent.split("handleTabClick('tiger')").join("window.location.href = '/tiger/'");

fs.writeFileSync('src/components/Navbar.tsx', navContent, 'utf8');
console.log('Navbar.tsx updated to direct URLs');

