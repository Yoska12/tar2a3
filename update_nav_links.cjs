const fs = require('fs');

// 1. Update Navbar.tsx
let nav = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

if (!nav.includes('FileText')) {
  nav = nav.replace('CreditCard,', 'CreditCard,\n  FileText,');
}

const simMarker = "window.location.href = '/tiger/'; setSimulatorDropdownOpen(false);";
const qLinkInSim = `
                  <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                  <a
                    href="/simulation/?questions=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-right text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-start">
                      <span>إدارة أسئلة المحاكي 📝</span>
                      <span className="text-[10px] text-slate-400 font-normal">إضافة وحذف وتعديل بنك الأسئلة</span>
                    </div>
                  </a>`;

const pos1 = nav.indexOf(simMarker);
if (pos1 !== -1) {
  const btnClose = nav.indexOf('</button>', pos1);
  if (btnClose !== -1 && !nav.includes('href="/simulation/?questions=true"')) {
    nav = nav.substring(0, btnClose + 9) + qLinkInSim + nav.substring(btnClose + 9);
    console.log('Added question manager link to simulator dropdown');
  }
}

const adminMarker = "onSelectTab('admin-lectures'); setAdminDropdownOpen(false);";
const qLinkInAdmin = `

                    {/* إدارة أسئلة المحاكي */}
                    <a
                      href="/simulation/?questions=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-right text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span>إدارة أسئلة المحاكي</span>
                        <span className="text-[10px] text-slate-400 font-normal">بنك الأسئلة والخيارات والصور 📝</span>
                      </div>
                    </a>`;

const pos2 = nav.indexOf(adminMarker);
if (pos2 !== -1) {
  const btnClose2 = nav.indexOf('</button>', pos2);
  if (btnClose2 !== -1 && !nav.includes('بنك الأسئلة والخيارات والصور')) {
    nav = nav.substring(0, btnClose2 + 9) + qLinkInAdmin + nav.substring(btnClose2 + 9);
    console.log('Added question manager link to admin dropdown');
  }
}

fs.writeFileSync('src/components/Navbar.tsx', nav, 'utf8');

// 2. Update App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
const cardEndMarker = "window.location.href = '/tiger/'";
const pTiger = app.indexOf(cardEndMarker);
if (pTiger !== -1) {
  const btnEnd = app.indexOf('</button>', pTiger);
  const divGridEnd = app.indexOf('</div>', btnEnd);
  if (divGridEnd !== -1 && !app.includes('فتح صفحة إدارة وبنك أسئلة المحاكي')) {
    const qActionBtn = `\n\n          {/* زر إدارة أسئلة المحاكي المباشر */}
          <div className="flex justify-center pt-2">
            <a
              href="/simulation/?questions=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-slate-900/90 border border-amber-500/40 text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition font-black text-xs sm:text-sm shadow-xl hover:shadow-amber-500/10 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>فتح صفحة إدارة وبنك أسئلة المحاكي 📝</span>
            </a>
          </div>`;
    app = app.substring(0, divGridEnd + 6) + qActionBtn + app.substring(divGridEnd + 6);
    fs.writeFileSync('src/App.tsx', app, 'utf8');
    console.log('Added question manager button to simulator selector in App.tsx');
  }
}

