const fs = require('fs');

const syncScript = `  <script>
    try {
      if (localStorage.getItem('dev_bypass') === null) {
        localStorage.setItem('dev_bypass', 'true');
      }
      var raw = localStorage.getItem('tarqa_current_user');
      if (raw) {
        var u = JSON.parse(raw);
        if (u && (u.id || u.email)) {
          fetch('/Login/sync_tarqa_session.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user: u })
          }).catch(function(e) {});
        }
      }
    } catch(e) {}
  </script>`;

const files = ['public/simulation/index.html', 'public/exam/index.html', 'public/tiger/index.html'];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/<script>[\s\S]*?alaqsam[\s\S]*?<\/script>/g, '');
  if (!content.includes('sync_tarqa_session.php')) {
    content = content.replace('<head>', '<head>\n' + syncScript);
  }
  fs.writeFileSync(f, content, 'utf8');
  console.log('Cleaned and injected into:', f);
}

