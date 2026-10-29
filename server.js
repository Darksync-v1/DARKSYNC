const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'darksync.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 is_premium INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS configs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'General',
 version TEXT NOT NULL DEFAULT 'Any',
 premium INTEGER NOT NULL DEFAULT 0,
 filename TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
const count = db.prepare('SELECT COUNT(*) AS n FROM configs').get().n;
if (!count) {
  const add = db.prepare('INSERT INTO configs (title,description,category,version,premium,filename) VALUES (?,?,?,?,?,NULL)');
  add.run('Dark Purple', 'Пример карточки. Добавь свой реальный файл через панель администратора.', 'PvP', 'Java', 0);
  add.run('Void Night', 'Демонстрационная карточка бесплатного конфига.', 'Visual', 'Java', 0);
  add.run('Phantom Pro', 'Демонстрационная Premium-карточка. Файл пока не добавлен.', 'Premium', 'Java', 1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-local-dev-secret-before-deploying',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    cb(null, Date.now() + '-' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.zip', '.rar', '.7z', '.json', '.txt', '.cfg', '.ini'];
    if (!allowed.includes(ext)) return cb(new Error('Разрешены только ZIP, RAR, 7Z, JSON, TXT, CFG и INI.'));
    cb(null, true);
  }
});

function currentUser(req) {
  if (!req.session.userId) return null;
  return db.prepare('SELECT id,email,is_premium,created_at FROM users WHERE id=?').get(req.session.userId) || null;
}
function isAdmin(user) {
  return !!(user && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL);
}
function esc(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function page(req, title, body) {
  const user = currentUser(req);
  const admin = isAdmin(user);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — DARKSYNC</title>
<style>
:root{--bg:#08070d;--panel:#13101c;--line:#302044;--purple:#9d5cff;--light:#d4b6ff;--text:#f7f3ff;--muted:#aaa0ba}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 50% -10%,#2b1746,transparent 48%),var(--bg);color:var(--text);font:15px Arial,sans-serif;min-height:100vh}
a{color:inherit;text-decoration:none}header{position:sticky;top:0;background:#090710ed;backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:17px 5%;display:flex;justify-content:space-between;align-items:center;gap:18px;z-index:3}
.logo{font-weight:900;letter-spacing:2px;font-size:23px}.logo span,h1 span,.accent{color:var(--purple)}nav{display:flex;gap:16px;align-items:center;flex-wrap:wrap}nav a{color:var(--muted);font-size:13px}nav a:hover{color:white}
main{max-width:1120px;margin:auto;padding:40px 22px 80px}.hero{text-align:center;padding:75px 0 55px}.pill,.tag{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:7px 11px;color:var(--light);font-size:11px;letter-spacing:1px;background:#a45cff12}
h1{font-size:clamp(42px,8vw,76px);letter-spacing:-2px;margin:20px 0 14px}h2{font-size:29px;margin:0 0 12px}p{color:var(--muted);line-height:1.7}.hero p{max-width:650px;margin:0 auto 24px}
.btn,button{display:inline-block;border:1px solid var(--line);background:#1a1426;color:white;border-radius:9px;padding:11px 15px;cursor:pointer;font-weight:700}.primary{background:var(--purple);border-color:var(--purple)}.btn:hover,button:hover{filter:brightness(1.15)}
.row{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;margin:22px 0}.muted{color:var(--muted);font-size:13px}
input,select,textarea{width:100%;padding:12px;background:#0c0a12;border:1px solid var(--line);border-radius:8px;color:white;outline:none}input:focus,textarea:focus,select:focus{border-color:var(--purple)}
.search{max-width:350px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card,.box{background:linear-gradient(145deg,#181322,#0e0c14);border:1px solid var(--line);border-radius:14px;padding:20px}.cover{height:105px;border-radius:9px;background:radial-gradient(circle at 50% 100%,#8f49db66,transparent 65%),#171021;display:grid;place-items:center;font-size:39px;margin-bottom:17px}.card h3{margin:10px 0}.card p{font-size:13px;min-height:40px}.tag.free{color:#73e6b1;border-color:#20563d}.tag.pro{color:var(--light)}
.form{max-width:480px;margin:30px auto}.form label{display:block;margin:14px 0 7px;color:#d8cdea}.notice{padding:13px 15px;border:1px solid var(--line);border-radius:9px;background:#a45cff10;margin:15px 0;color:#e2d3fa}.error{border-color:#8c3849;color:#ffb9c5}.admin-list{display:grid;gap:12px}.admin-item{display:flex;justify-content:space-between;gap:15px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:12px 0}
footer{border-top:1px solid var(--line);padding:25px;text-align:center;color:var(--muted);font-size:12px;line-height:1.8}
@media(max-width:780px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header{align-items:flex-start;flex-direction:column}.hero{padding-top:45px}}
@media(max-width:520px){.grid{grid-template-columns:1fr}main{padding:25px 15px 55px}h1{letter-spacing:-1px}}
</style></head><body>
<header><a class="logo" href="/">DARK<span>SYNC</span></a><nav>
<a href="/">Каталог</a><a href="/premium">Premium</a>
${user ? `<a href="/profile">Профиль</a>${admin?'<a href="/admin">Админ-панель</a>':''}<form method="post" action="/logout" style="margin:0"><button>Выйти</button></form>` : '<a href="/login">Войти</a><a class="btn primary" href="/register">Создать аккаунт</a>'}
</nav></header><main>${body}</main><footer><b>DARKSYNC</b> · Независимый проект сообщества Minecraft.<br>Демонстрационный локальный запуск. Платежи не подключены.</footer>
<script>
const search=document.querySelector('#search');
if(search)search.addEventListener('input',()=>{const q=search.value.toLowerCase();document.querySelectorAll('[data-search]').forEach(el=>el.style.display=el.dataset.search.includes(q)?'':'none')});
</script></body></html>`;
}
function requireLogin(req,res,next){if(!currentUser(req))return res.redirect('/login');next();}
function requireAdmin(req,res,next){const u=currentUser(req);if(!isAdmin(u))return res.status(403).send(page(req,'Нет доступа','<div class="box"><h2>Доступ запрещён</h2><p>Настрой ADMIN_EMAIL по инструкции в README-RU.txt и войди снова.</p></div>'));next();}

app.get('/', (req,res) => {
 const user=currentUser(req);
 const configs=db.prepare('SELECT * FROM configs ORDER BY id DESC').all();
 const cards=configs.map(c=>{
   const locked=!!c.premium && !(user && (user.is_premium || isAdmin(user)));
   return `<article class="card" data-search="${esc((c.title+' '+c.description+' '+c.category).toLowerCase())}">
   <div class="cover">${c.premium?'👑':'✦'}</div><span class="tag ${c.premium?'pro':'free'}">${c.premium?'PREMIUM':'FREE'}</span>
   <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="row"><span class="muted">${esc(c.category)} · ${esc(c.version)}</span>
   ${locked?'<a class="btn primary" href="/premium">Открыть Premium</a>':c.filename?`<a class="btn primary" href="/download/${c.id}">Скачать</a>`:'<span class="muted">Файл пока не добавлен</span>'}</div></article>`;
 }).join('');
 res.send(page(req,'Каталог',`<section class="hero"><span class="pill">MINECRAFT CONFIG PLATFORM</span><h1>UPGRADE YOUR<br><span>GAME.</span></h1><p>Тёмная игровая платформа для коллекции конфигов. Ищи материалы, сохраняй избранное в своей коллекции и открывай дополнительные возможности.</p><a class="btn primary" href="#catalog">Смотреть каталог ↘</a> <a class="btn" href="/premium">DARKSYNC PREMIUM</a></section>
 <section id="catalog"><div class="row"><div><h2>Библиотека <span class="accent">конфигов.</span></h2><p>Материалы для разных версий и стилей игры.</p></div><input id="search" class="search" placeholder="Поиск по каталогу..."></div>
 <div class="grid">${cards||'<p>Пока нет конфигов.</p>'}</div></section>`));
});

app.get('/register',(req,res)=>res.send(page(req,'Регистрация',`<div class="box form"><h2>Создать аккаунт</h2><p>Зарегистрируйся, чтобы управлять своим профилем.</p>${req.query.error?'<div class="notice error">Проверь email и пароль. Email должен быть корректным, пароль — минимум 8 символов.</div>':''}<form method="post" action="/register"><label>Email</label><input type="email" name="email" required maxlength="254" autocomplete="email"><label>Пароль (минимум 8 символов)</label><input type="password" name="password" minlength="8" required autocomplete="new-password"><p class="muted">Не используй пароль от своей почты или других сервисов.</p><button class="primary" style="width:100%">Зарегистрироваться</button></form><p>Уже есть аккаунт? <a class="accent" href="/login">Войти</a></p></div>`)));
app.post('/register',(req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>200)return res.redirect('/register?error=1');
 try{const hash=bcrypt.hashSync(password,12);const result=db.prepare('INSERT INTO users(email,password_hash) VALUES(?,?)').run(email,hash);req.session.userId=result.lastInsertRowid;res.redirect('/profile');}
 catch(e){res.redirect('/register?error=1');}
});
app.get('/login',(req,res)=>res.send(page(req,'Вход',`<div class="box form"><h2>С возвращением.</h2><p>Войди в свой DARKSYNC аккаунт.</p>${req.query.error?'<div class="notice error">Не удалось войти. Проверь данные.</div>':''}<form method="post" action="/login"><label>Email</label><input type="email" name="email" required autocomplete="email"><label>Пароль</label><input type="password" name="password" required autocomplete="current-password"><button class="primary" style="width:100%;margin-top:18px">Войти</button></form><p>Нет аккаунта? <a class="accent" href="/register">Создать аккаунт</a></p></div>`)));
app.post('/login',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!u||!bcrypt.compareSync(password,u.password_hash))return res.redirect('/login?error=1');req.session.regenerate(err=>{if(err)return res.redirect('/login?error=1');req.session.userId=u.id;res.redirect('/profile');});});
app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));
app.get('/profile',requireLogin,(req,res)=>{const u=currentUser(req);res.send(page(req,'Профиль',`<div class="box"><span class="pill">USER PROFILE</span><h2 style="margin-top:18px">Твой профиль</h2><p>Email: <b>${esc(u.email)}</b></p><p>Статус: <span class="accent">${u.is_premium?'PREMIUM':'FREE'}</span></p><p class="muted">Аккаунт создан: ${esc(u.created_at)}</p>${!u.is_premium?'<a class="btn primary" href="/premium">Посмотреть Premium</a>':''}</div>`));});

app.get('/premium',(req,res)=>{const u=currentUser(req);res.send(page(req,'Premium',`<div class="box" style="text-align:center;padding:45px 25px"><span class="pill">DARKSYNC MEMBERSHIP</span><h1 style="font-size:clamp(35px,6vw,58px)">Unlock <span>PREMIUM.</span></h1><p style="max-width:600px;margin:0 auto">Дополнительные материалы и доступ к Premium-конфигам. Стартовая цена проекта — 199 ₽/месяц.</p><h2 style="font-size:42px;margin:25px">199 ₽ <small class="muted">/ месяц</small></h2><div class="notice" style="max-width:650px;margin:20px auto">Демонстрационный режим: реальные платежи не подключены. Не вводи данные банковской карты.</div>${u?(!u.is_premium?`<form method="post" action="/demo-premium"><button class="primary">Включить тестовый Premium</button></form><p class="muted">Только локальная проверка функций, деньги не списываются.</p>`:'<div class="pill">Тестовый Premium активен</div>'):'<a class="btn primary" href="/register">Создать аккаунт</a>'}</div>`));});
app.post('/demo-premium',requireLogin,(req,res)=>{db.prepare('UPDATE users SET is_premium=1 WHERE id=?').run(req.session.userId);res.redirect('/profile');});

app.get('/download/:id',requireLogin,(req,res)=>{const c=db.prepare('SELECT * FROM configs WHERE id=?').get(Number(req.params.id));if(!c||!c.filename)return res.status(404).send(page(req,'Файл не найден','<div class="box"><h2>Файл не найден</h2><p>Администратор ещё не загрузил файл.</p><a href="/">Назад</a></div>'));const u=currentUser(req);if(c.premium&&!(u.is_premium||isAdmin(u)))return res.redirect('/premium');const file=path.join(UPLOAD_DIR,path.basename(c.filename));if(!fs.existsSync(file))return res.status(404).send('Файл не найден.');res.download(file,c.filename.replace(/^\d+-/,''));});

app.get('/admin',requireLogin,requireAdmin,(req,res)=>{const list=db.prepare('SELECT * FROM configs ORDER BY id DESC').all();const items=list.map(c=>`<div class="admin-item"><div><b>${esc(c.title)}</b> <span class="tag ${c.premium?'pro':'free'}">${c.premium?'PREMIUM':'FREE'}</span><div class="muted">${c.filename?'Файл: '+esc(c.filename):'Файл не загружен'}</div></div><form method="post" action="/admin/delete/${c.id}" onsubmit="return confirm('Удалить конфиг?')"><button>Удалить</button></form></div>`).join('');
res.send(page(req,'Админ-панель',`<h1 style="font-size:45px">ADMIN <span>PANEL.</span></h1><p>Добавляй конфиги в каталог. Разрешены ZIP, RAR, 7Z, JSON, TXT, CFG и INI до 25 МБ.</p><div class="box" style="margin:25px 0"><h2>Добавить конфиг</h2><form method="post" action="/admin/add" enctype="multipart/form-data"><label>Название</label><input name="title" required maxlength="80"><label>Описание</label><textarea name="description" required maxlength="500" rows="3"></textarea><div class="row"><div style="flex:1"><label>Категория</label><input name="category" value="General" maxlength="40"></div><div style="flex:1"><label>Версия / платформа</label><input name="version" value="Java" maxlength="40"></div></div><label>Тип доступа</label><select name="premium"><option value="0">FREE</option><option value="1">PREMIUM</option></select><label>Файл (необязательно)</label><input type="file" name="configFile" accept=".zip,.rar,.7z,.json,.txt,.cfg,.ini"><button class="primary" style="margin-top:18px">Добавить в каталог</button></form></div><div class="box"><h2>Каталог</h2><div class="admin-list">${items||'Пока пусто.'}</div></div>`));});
app.post('/admin/add',requireLogin,requireAdmin,(req,res)=>{upload.single('configFile')(req,res,err=>{if(err)return res.status(400).send(page(req,'Ошибка загрузки',`<div class="box"><h2>Не удалось загрузить файл</h2><p>${esc(err.message)}</p><a href="/admin">Назад</a></div>`));const title=String(req.body.title||'').trim().slice(0,80),description=String(req.body.description||'').trim().slice(0,500),category=String(req.body.category||'General').trim().slice(0,40),version=String(req.body.version||'Java').trim().slice(0,40),premium=req.body.premium==='1'?1:0;if(!title||!description){if(req.file)fs.unlinkSync(req.file.path);return res.redirect('/admin');}db.prepare('INSERT INTO configs(title,description,category,version,premium,filename) VALUES(?,?,?,?,?,?)').run(title,description,category||'General',version||'Any',premium,req.file?req.file.filename:null);res.redirect('/admin');});});
app.post('/admin/delete/:id',requireLogin,requireAdmin,(req,res)=>{const c=db.prepare('SELECT * FROM configs WHERE id=?').get(Number(req.params.id));if(c){db.prepare('DELETE FROM configs WHERE id=?').run(c.id);if(c.filename){const f=path.join(UPLOAD_DIR,path.basename(c.filename));if(fs.existsSync(f))fs.unlinkSync(f);}}res.redirect('/admin');});

app.use((err,req,res,next)=>{console.error(err);res.status(500).send(page(req,'Ошибка','<div class="box"><h2>Что-то пошло не так</h2><p>Перезапусти локальный сервер и попробуй снова.</p></div>'));});
app.listen(PORT,()=>console.log(`DARKSYNC V2 работает: http://localhost:${PORT}`));
