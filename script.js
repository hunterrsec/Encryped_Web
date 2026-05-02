/* ================================================================
 * HACKER RECON TOOLKIT — script.js
 * USER-PROVIDED CODE
 * Paste your dork arrays, helper functions, or extensions below.
 * ================================================================ */
const USER_GOOGLE_DORKS = [ /* paste here */ ];
const USER_GITHUB_DORKS = [ /* paste here */ ];
const USER_EXTENSIONS  = { /* paste helpers here */ };

/* ================================================================
 * APP NAMESPACE
 * ================================================================ */
const App = { user: USER_EXTENSIONS };

/* ================================================================
 * UTILITIES — toast, copy, query string, debounce, dom
 * ================================================================ */
App.utils = (() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const el = (tag, attrs={}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs||{})) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k,'');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const k of kids.flat()) {
      if (k == null) continue;
      n.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return n;
  };
  const debounce = (fn, ms=200) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };
  const escHtml = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const escAttr = s => String(s).replace(/"/g,'&quot;');
  const toast = (msg, kind='') => {
    const t = el('div', { class:`toast ${kind}` }, msg);
    $('#toasts').append(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-6px)'; t.style.transition='all .2s'; setTimeout(()=>t.remove(),220); }, 2400);
  };
  const copy = async (text, label='Copied') => {
    try { await navigator.clipboard.writeText(text); toast(label,'ok'); }
    catch { toast('Copy failed','err'); }
  };
  const downloadFile = (name, data, type='text/plain') => {
    const blob = new Blob([data], { type });
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  };
  const sanitiseDomain = (raw) => {
    if (!raw) return '';
    let d = raw.trim();
    d = d.replace(/^https?:\/\//i,'').replace(/^[\/]+/,'').split(/[\/\?#]/)[0];
    return d.toLowerCase();
  };
  const isDomain = (d) => /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(d);
  return { $, $$, el, debounce, escHtml, escAttr, toast, copy, downloadFile, sanitiseDomain, isDomain };
})();
const { $, $$, el, debounce, escHtml, toast, copy, downloadFile, sanitiseDomain, isDomain } = App.utils;

/* ================================================================
 * THEME
 * ================================================================ */
App.theme = (() => {
  const KEY = 'rl.theme';
  const ALL = ['matrix','cyberpunk','amber','bloodmoon','stealth','dark','light'];
  const apply = (t) => {
    if (!ALL.includes(t)) t = 'matrix';
    document.documentElement.setAttribute('data-theme', t);
    $$('#themeMenu .opt').forEach(o => o.classList.toggle('is-active', o.dataset.themeSet===t));
    if (window.lucide) lucide.createIcons();
    document.dispatchEvent(new CustomEvent('rl:themechange', { detail:{ theme:t }}));
  };
  const get = () => localStorage.getItem(KEY) || 'matrix';
  const set = (t) => { localStorage.setItem(KEY, t); apply(t); };
  const cycle = () => {
    const cur = get();
    const i = ALL.indexOf(cur);
    set(ALL[(i+1) % ALL.length]);
  };
  const init = () => {
    apply(get());
    const btn = $('#themeToggle');
    const menu = $('#themeMenu');
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = menu.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
      menu.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-theme-set]');
        if (!opt) return;
        set(opt.dataset.themeSet);
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded','false');
        toast(`Theme: ${opt.textContent.trim()}`,'ok');
      });
      document.addEventListener('click', () => {
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded','false');
      });
    }
    $('#rotateTheme')?.addEventListener('click', cycle);
  };
  return { init, set, cycle, get };
})();

/* ================================================================
 * RECENT
 * ================================================================ */
App.recent = (() => {
  const KEY = 'rl.recent';
  const get = () => JSON.parse(localStorage.getItem(KEY)||'[]');
  const push = (id, label) => {
    const list = get().filter(x=>x.id!==id);
    list.unshift({ id, label, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0,8)));
    render();
  };
  const render = () => {
    const host = $('#recentList'); if (!host) return;
    host.innerHTML = '';
    const list = get();
    if (!list.length) { host.append(el('span',{class:'muted sm'},'No tools opened yet.')); return; }
    list.forEach(x => host.append(
      el('a', { class:'btn btn-sm', href:'#'+x.id, onclick: () => App.panels.open(x.id) }, x.label)
    ));
  };
  return { push, render };
})();

/* ================================================================
 * PANELS
 * ================================================================ */
App.panels = (() => {
  const labelOf = (id) => ({
    'p-google':'Google Dorks', 'p-github':'GitHub Recon', 'p-sitemap':'Sitemap Inspector',
    'p-encoder':'Encoder/Decoder', 'p-jwt':'JWT Inspector', 'p-cookies':'Cookie Analyzer',
    'p-seo':'SEO Audit', 'p-extras':'Workflow & Notes',
    'p-hash':'Hash Identifier','p-ipcidr':'IP / CIDR','p-passwd':'Password Strength','p-headers':'HTTP Headers'
  }[id]||id);
  const open = (id) => {
    const p = document.getElementById(id); if (!p) return;
    p.classList.add('is-open');
    setTimeout(()=>p.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
    App.recent.push(id, labelOf(id));
    if (window.lucide) lucide.createIcons();
  };
  const close = (id) => document.getElementById(id)?.classList.remove('is-open');
  const closeAll = () => $$('.panel.is-open').forEach(p=>p.classList.remove('is-open'));
  const init = () => {
    $$('[data-open]').forEach(b => b.addEventListener('click', () => open(b.dataset.open)));
    $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('.panel')?.classList.remove('is-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  };
  return { open, close, closeAll, init };
})();

/* ================================================================
 * TABS
 * ================================================================ */
App.tabs = (() => {
  const init = (root=document) => {
    $$('.tabs', root).forEach(group => {
      group.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.tab;
          const scope = group.parentElement;
          group.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t===tab));
          scope.querySelectorAll(':scope > .panel-body > .tab-panel').forEach(p =>
            p.classList.toggle('is-active', p.id === target));
        });
      });
    });
  };
  return { init };
})();

/* ================================================================
 * COMMAND PALETTE — Cmd/Ctrl+K
 * ================================================================ */
App.palette = (() => {
  const items = [
    { id:'p-google', label:'Open Google Dorks', kind:'tool' },
    { id:'p-github', label:'Open GitHub Recon', kind:'tool' },
    { id:'p-sitemap', label:'Open Sitemap Inspector', kind:'tool' },
    { id:'p-encoder', label:'Open Encoder/Decoder', kind:'tool' },
    { id:'p-jwt', label:'Open JWT Inspector', kind:'tool' },
    { id:'p-cookies', label:'Open Cookie Analyzer', kind:'tool' },
    { id:'p-seo', label:'Open SEO Audit', kind:'tool' },
    { id:'p-extras', label:'Open Workflow & Notes', kind:'tool' },
    { id:'p-hash', label:'Open Hash Identifier', kind:'tool' },
    { id:'p-ipcidr', label:'Open IP / CIDR Calculator', kind:'tool' },
    { id:'p-passwd', label:'Open Password Strength', kind:'tool' },
    { id:'p-headers', label:'Open HTTP Header Analyzer', kind:'tool' },
    { id:'#privacy', label:'Go to Privacy Policy', kind:'section' },
    { id:'#disclaimer', label:'Go to Legal Disclaimer', kind:'section' },
    { id:'#workflow', label:'Go to Workflow', kind:'section' },
    { id:'#support', label:'Buy me a Coffee (Stripe)', kind:'section' },
    { id:'__theme', label:'Cycle theme', kind:'action' },
    { id:'__theme:matrix', label:'Theme: Matrix', kind:'action' },
    { id:'__theme:cyberpunk', label:'Theme: Cyberpunk', kind:'action' },
    { id:'__theme:amber', label:'Theme: Amber CRT', kind:'action' },
    { id:'__theme:bloodmoon', label:'Theme: Bloodmoon', kind:'action' },
    { id:'__theme:stealth', label:'Theme: Stealth', kind:'action' },
    { id:'__theme:dark', label:'Theme: Lab Dark', kind:'action' },
    { id:'__theme:light', label:'Theme: Light', kind:'action' },
  ];
  let activeIdx = 0;
  const back = () => $('#cmdBack');
  const input = () => $('#cmdInput');
  const open = () => { back().classList.add('is-open'); input().value=''; render(''); setTimeout(()=>input().focus(),20); };
  const close = () => back().classList.remove('is-open');
  const filter = (q) => items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase()));
  const render = (q) => {
    const host = $('#cmdResults'); host.innerHTML='';
    const list = filter(q);
    activeIdx = 0;
    list.forEach((i, idx) => {
      const node = el('div', { class:`cmd-item ${idx===0?'is-active':''}`, role:'option' },
        el('span',{}, i.label), el('span',{class:'desc'}, i.kind));
      node.addEventListener('click', ()=>execute(i));
      node.dataset.idx = idx;
      host.append(node);
    });
    if (!list.length) host.append(el('div',{class:'cmd-item'},'No matches'));
  };
  const execute = (i) => {
    close();
    if (i.kind === 'tool') App.panels.open(i.id);
    else if (i.kind === 'section') document.querySelector(i.id)?.scrollIntoView({behavior:'smooth'});
    else if (i.id === '__theme') App.theme.cycle();
    else if (i.id?.startsWith('__theme:')) App.theme.set(i.id.split(':')[1]);
  };
  const init = () => {
    $('#cmdOpen')?.addEventListener('click', open);
    back().addEventListener('click', e => { if (e.target === back()) close(); });
    input().addEventListener('input', e => render(e.target.value));
    document.addEventListener('keydown', e => {
      if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); open(); }
      else if (back().classList.contains('is-open')) {
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const list = $$('.cmd-item', $('#cmdResults'));
          activeIdx = (activeIdx + (e.key==='ArrowDown'?1:-1) + list.length) % list.length;
          list.forEach((n,i)=>n.classList.toggle('is-active', i===activeIdx));
          list[activeIdx]?.scrollIntoView({block:'nearest'});
        } else if (e.key === 'Enter') {
          const q = input().value;
          const i = filter(q)[activeIdx]; if (i) execute(i);
        }
      }
    });
  };
  return { init, open, close };
})();

/* ================================================================
 * DORKS DATA — built-in Google + GitHub dork catalogues
 * ================================================================ */
App.dorkData = (() => {
  const G = [];
  const addG = (cat, title, query) => G.push({ category: cat, title, query });

  const EXT_FILES = [
    ['log','Server / app log files'],['bak','Generic backup files'],['old','Legacy / old files'],
    ['sql','SQL dump files'],['env','Environment / dotenv files'],['conf','Configuration files'],
    ['config','Configuration files (.config)'],['ini','INI config files'],['yml','YAML config files'],
    ['yaml','YAML config files'],['json','JSON config files'],['xml','XML config / data files'],
    ['txt','Plain text dumps'],['csv','CSV exports'],['db','Database files (.db)'],
    ['mdb','Microsoft Access databases'],['sqlite','SQLite databases'],['sqlite3','SQLite v3 databases'],
    ['pem','PEM certificates / keys'],['key','Private key files'],['crt','Certificates'],
    ['cer','Certificates (.cer)'],['p12','PKCS#12 keystores'],['pfx','PFX certificates'],
    ['rdp','Remote Desktop config'],['ovpn','OpenVPN profiles'],['inc','PHP include files'],
    ['php~','PHP backup tilde files'],['swp','Vim swap files'],['orig','Merge .orig leftovers'],
    ['cfg','Generic .cfg config'],['properties','Java .properties'],['lst','List/index files'],
    ['dat','Data files'],['action','Struts action endpoints']
  ];
  EXT_FILES.forEach(([e,t]) => addG('Exposed Files', t, `site:{d} ext:${e}`));

  const DOC_EXT = ['pdf','doc','docx','xls','xlsx','ppt','pptx','rtf','odt','ods','odp'];
  const DOC_KEYS = ['confidential','internal','private','restricted','classified','salary','password','NDA','proprietary'];
  DOC_EXT.forEach(e => addG('Document Leaks', `${e.toUpperCase()} files (no keyword)`, `site:{d} ext:${e}`));
  DOC_KEYS.forEach(k => addG('Document Leaks', `Documents tagged "${k}"`, `site:{d} (ext:pdf OR ext:doc OR ext:docx OR ext:xls OR ext:xlsx) "${k}"`));
  addG('Document Leaks', 'PDF resumes / personnel info', `site:{d} ext:pdf intext:"resume" OR intext:"curriculum vitae"`);
  addG('Document Leaks', 'Internal HR docs', `site:{d} (ext:doc OR ext:docx) intext:"employee" intext:"internal"`);
  addG('Document Leaks', 'Bank statements', `site:{d} ext:pdf intext:"account number" intext:"statement"`);

  const LOGIN_PATHS = [
    ['admin','Admin panels'],['administrator','Administrator panels'],['login','Login pages'],
    ['signin','Sign-in pages'],['portal','User portals'],['dashboard','Dashboards'],
    ['cpanel','cPanel'],['plesk','Plesk panel'],['webmail','Webmail interfaces'],
    ['phpmyadmin','phpMyAdmin'],['wp-admin','WordPress admin'],['wp-login','WordPress login'],
    ['xmlrpc.php','WordPress xmlrpc'],['drupal','Drupal admin'],['joomla','Joomla admin'],
    ['administrator/index.php','Joomla admin entry'],['user/login','Drupal login'],
    ['manager/html','Tomcat manager'],['jmx-console','JBoss JMX console'],['jenkins','Jenkins'],
    ['grafana','Grafana'],['kibana','Kibana'],['elastic','ElasticSearch'],['rancher','Rancher'],
    ['gitlab','GitLab'],['gitea','Gitea'],['bitbucket','Bitbucket'],['confluence','Confluence'],
    ['jira','JIRA'],['nessus','Nessus'],['sonarqube','SonarQube']
  ];
  LOGIN_PATHS.forEach(([p,t]) => addG('Login & Admin Panels', t, `site:{d} inurl:${p}`));
  addG('Login & Admin Panels','"Index of" with auth keywords',`site:{d} intitle:"index of" (login OR auth OR admin)`);
  addG('Login & Admin Panels','HTTP basic auth prompts',`site:{d} intext:"401 Unauthorized"`);

  const DIR_KEYS = ['backup','db','config','private','uploads','logs','.git','tmp','old','dev','test','staging','data','dump','export','sql','mail','user','media','docs','env','secret'];
  DIR_KEYS.forEach(k => addG('Open Directories', `Index of /${k}`, `site:{d} intitle:"index of /" "${k}"`));
  addG('Open Directories','Apache "Index of" parent directory',`site:{d} intitle:"index of" "parent directory"`);
  addG('Open Directories','Open IIS directory listing',`site:{d} "Directory Listing Denied" OR intitle:"Index Of"`);

  addG('Config & Secrets','Dotenv files','site:{d} filename:.env OR ext:env');
  addG('Config & Secrets','wp-config.php','site:{d} filename:wp-config.php OR inurl:wp-config.php');
  addG('Config & Secrets','config.php with DB strings','site:{d} filename:config.php intext:"DB_PASSWORD"');
  addG('Config & Secrets','htpasswd files','site:{d} filename:.htpasswd');
  addG('Config & Secrets','htaccess files','site:{d} filename:.htaccess');
  addG('Config & Secrets','credentials files','site:{d} (filename:credentials OR filename:credential.json)');
  addG('Config & Secrets','RSA private key bodies','site:{d} intext:"BEGIN RSA PRIVATE KEY"');
  addG('Config & Secrets','OpenSSH private key bodies','site:{d} intext:"BEGIN OPENSSH PRIVATE KEY"');
  addG('Config & Secrets','EC private key bodies','site:{d} intext:"BEGIN EC PRIVATE KEY"');
  addG('Config & Secrets','PGP private key blocks','site:{d} intext:"BEGIN PGP PRIVATE KEY BLOCK"');
  addG('Config & Secrets','Generic api_key tokens','site:{d} intext:"api_key"');
  addG('Config & Secrets','Generic api-key headers','site:{d} intext:"api-key"');
  addG('Config & Secrets','AWS access keys (AKIA...)','site:{d} intext:"AKIA"');
  addG('Config & Secrets','AWS secret access keys','site:{d} intext:"aws_secret_access_key"');
  addG('Config & Secrets','Google API keys (AIza...)','site:{d} intext:"AIza"');
  addG('Config & Secrets','Google OAuth tokens (ya29.)','site:{d} intext:"ya29."');
  addG('Config & Secrets','Stripe live keys','site:{d} intext:"sk_live_"');
  addG('Config & Secrets','Stripe restricted live keys','site:{d} intext:"rk_live_"');
  addG('Config & Secrets','Stripe publishable keys','site:{d} intext:"pk_live_"');
  addG('Config & Secrets','Slack bot tokens','site:{d} intext:"xoxb-"');
  addG('Config & Secrets','Slack user tokens','site:{d} intext:"xoxp-"');
  addG('Config & Secrets','Slack legacy tokens','site:{d} intext:"xoxa-" OR intext:"xoxr-"');
  addG('Config & Secrets','GitHub personal tokens','site:{d} intext:"ghp_"');
  addG('Config & Secrets','GitHub fine-grained PATs','site:{d} intext:"github_pat_"');
  addG('Config & Secrets','GitLab tokens','site:{d} intext:"glpat-"');
  addG('Config & Secrets','SendGrid API keys','site:{d} intext:"SG."');
  addG('Config & Secrets','Mailgun API keys','site:{d} intext:"key-" intext:"mailgun"');
  addG('Config & Secrets','Twilio account SID','site:{d} intext:"AC" intext:"twilio"');
  addG('Config & Secrets','Heroku API keys','site:{d} intext:"heroku" intext:"api_key"');
  addG('Config & Secrets','Firebase database URLs','site:{d} intext:"firebaseio.com"');
  addG('Config & Secrets','JWT secrets in source','site:{d} intext:"JWT_SECRET"');
  addG('Config & Secrets','OAuth client secrets','site:{d} intext:"client_secret"');
  addG('Config & Secrets','SMTP credentials','site:{d} intext:"smtp.password" OR intext:"SMTP_PASS"');
  addG('Config & Secrets','Database password literals','site:{d} intext:"DB_PASSWORD" OR intext:"db_pass"');
  addG('Config & Secrets','Connection strings','site:{d} intext:"connectionstring"');
  addG('Config & Secrets','Redis URIs','site:{d} intext:"redis://"');
  addG('Config & Secrets','Mongo URIs','site:{d} intext:"mongodb://" OR intext:"mongodb+srv://"');
  addG('Config & Secrets','Postgres URIs','site:{d} intext:"postgres://"');
  addG('Config & Secrets','MySQL URIs','site:{d} intext:"mysql://"');
  addG('Config & Secrets','MS SQL connection strings','site:{d} intext:"Data Source=" intext:"Initial Catalog="');

  const SQL_ERR = [
    ['"SQL syntax"','MySQL syntax errors'],['"mysql_fetch_array()"','MySQL fetch_array errors'],
    ['"mysql_num_rows()"','MySQL num_rows errors'],['"PDOException"','PHP PDO exceptions'],
    ['"ORA-00933"','Oracle ORA-00933'],['"ORA-00942"','Oracle ORA-00942'],
    ['"ORA-01756"','Oracle ORA-01756'],['"Microsoft OLE DB Provider"','MS OLE DB errors'],
    ['"Unclosed quotation mark"','MS SQL string errors'],
    ['"You have an error in your SQL syntax"','MySQL syntax errors (literal)'],
    ['"sqlite3.OperationalError"','SQLite operational errors'],['"psql: error"','psql client errors'],
    ['"DB_DataObject"','PEAR DB errors'],['"Warning: pg_"','PostgreSQL pg_* warnings']
  ];
  SQL_ERR.forEach(([q,t]) => addG('SQL / Database Errors', t, `site:{d} intext:${q}`));

  const ERR = [
    ['"Whitelabel Error Page"','Spring Boot whitelabel'],['"Fatal error"','PHP fatal errors'],
    ['"stack trace"','Generic stack traces'],['"Warning: include"','PHP include warnings'],
    ['"Warning: require"','PHP require warnings'],['"Debug Trace"','Debug trace dumps'],
    ['"DEBUG = True"','Django debug mode pages'],['"Exception in thread"','Java exceptions'],
    ['"NoMethodError"','Ruby NoMethodError'],['"unhandled exception"','.NET unhandled exceptions'],
    ['"Server Error in"','ASP.NET server errors'],['"phpinfo()"','phpinfo dumps'],
    ['"Apache Status"','Apache mod_status'],['"Server-Status"','Apache server-status']
  ];
  ERR.forEach(([q,t]) => addG('Server Errors & Debug', t, `site:{d} intext:${q}`));

  addG('Subdomains & Infra','All subdomains (level 1)','site:*.{d}');
  addG('Subdomains & Infra','All subdomains (deeper)','site:*.*.{d}');
  addG('Subdomains & Infra','Non-www / non-marketing subdomains','-www site:{d}');
  addG('Subdomains & Infra','Dev environments','site:{d} (inurl:dev OR inurl:development)');
  addG('Subdomains & Infra','Staging environments','site:{d} inurl:staging');
  addG('Subdomains & Infra','Test environments','site:{d} inurl:test');
  addG('Subdomains & Infra','UAT environments','site:{d} inurl:uat');
  addG('Subdomains & Infra','Beta environments','site:{d} inurl:beta');
  addG('Subdomains & Infra','QA environments','site:{d} inurl:qa');
  addG('Subdomains & Infra','Sandbox environments','site:{d} inurl:sandbox');
  addG('Subdomains & Infra','Demo environments','site:{d} inurl:demo');
  addG('Subdomains & Infra','Internal-tagged hosts','site:{d} inurl:internal');
  addG('Subdomains & Infra','Mailservers','site:mail.{d} OR site:smtp.{d}');
  addG('Subdomains & Infra','VPN portals','site:{d} (inurl:vpn OR intitle:"VPN")');
  addG('Subdomains & Infra','RDP / Citrix portals','site:{d} (inurl:citrix OR inurl:rdp OR inurl:remote)');

  const PASTE = ['pastebin.com','gist.github.com','trello.com','jsfiddle.net','codepen.io','codesandbox.io','replit.com','glitch.com','codebeautify.org','rentry.co','controlc.com','justpaste.it','dpaste.com','ideone.com','ghostbin.com'];
  PASTE.forEach(s => addG('Paste & Code Sites', `${s} mentions`, `site:${s} "{d}"`));

  const CLOUD = [
    ['s3.amazonaws.com','Amazon S3 buckets'],['storage.googleapis.com','Google Cloud Storage'],
    ['blob.core.windows.net','Azure Blob Storage'],['digitaloceanspaces.com','DigitalOcean Spaces'],
    ['oraclecloud.com','Oracle Cloud Storage'],['cdn.shopify.com','Shopify CDN'],
    ['firebaseio.com','Firebase Realtime DB'],['herokuapp.com','Heroku app instances'],
    ['amazonaws.com','Generic AWS endpoints']
  ];
  CLOUD.forEach(([s,t]) => addG('Cloud Buckets & CDN', t, `site:${s} "{d}"`));
  addG('Cloud Buckets & CDN','S3 listing XML','site:s3.amazonaws.com "{d}" intitle:"Index of"');
  addG('Cloud Buckets & CDN','Public S3 buckets named after target','intitle:"index of" inurl:s3.amazonaws.com {d}');

  addG('APIs & Docs','API endpoints','site:{d} inurl:api');
  addG('APIs & Docs','Swagger UIs','site:{d} (inurl:swagger OR inurl:swagger-ui OR inurl:api-docs)');
  addG('APIs & Docs','OpenAPI JSON','site:{d} inurl:openapi.json');
  addG('APIs & Docs','GraphQL endpoints','site:{d} inurl:graphql');
  addG('APIs & Docs','GraphiQL playgrounds','site:{d} (intitle:"GraphiQL" OR intitle:"GraphQL Playground")');
  addG('APIs & Docs','WSDL files','site:{d} (inurl:wsdl OR ext:wsdl)');
  addG('APIs & Docs','SOAP endpoints','site:{d} ext:asmx');
  addG('APIs & Docs','Redoc pages','site:{d} inurl:redoc');
  addG('APIs & Docs','API documentation pages','site:{d} intitle:"API documentation"');
  addG('APIs & Docs','Postman collections','site:{d} ext:postman_collection');
