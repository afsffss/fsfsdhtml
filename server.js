// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ملف البيانات
const DATA_FILE = './data.json';

// قراءة البيانات من ملف JSON
function readData() {
  if (!fs.existsSync(DATA_FILE)) return { users: [], logs: [], leaves: [], banned: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

// حفظ البيانات في الملف
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.post('/login', (req, res) => {
  let { username, role } = req.body;
  if (!username || !role) return res.status(400).json({ error: 'مطلوب اسم المستخدم والرتبة' });

  let data = readData();

  // تحقق من الحظر
  if (data.banned.includes(username)) {
    return res.status(403).json({ error: 'محظور من الدخول' });
  }

  let user = data.users.find(u => u.username === username);
  const now = Date.now();

  if (user) {
    // إذا مسجل دخول من قبل، ما تكرر تسجيل دخول
    if (user.isLoggedIn) {
      return res.status(400).json({ error: 'المستخدم مسجل دخول بالفعل' });
    }
    // تحديث الرتبة لو تغيرت
    user.role = role;
    user.isLoggedIn = true;
    user.loginTime = now;
  } else {
    user = { username, role, points: 0, isLoggedIn: true, loginTime: now };
    data.users.push(user);
  }

  data.logs.push({ username, action: 'دخول', time: now });
  saveData(data);

  res.json({ success: true, user });
});

app.post('/logout', (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ error: 'مطلوب اسم المستخدم' });

  let data = readData();
  let user = data.users.find(u => u.username === username);
  if (!user || !user.isLoggedIn) return res.status(400).json({ error: 'المستخدم غير مسجل دخول' });

  // حساب النقاط: نقطة لكل ساعتين
  const now = Date.now();
  const hours = (now - user.loginTime) / 3600000;
  const gainedPoints = Math.floor(hours / 2);
  user.points += gainedPoints;
  user.isLoggedIn = false;
  user.loginTime = null;

  data.logs.push({ username, action: 'خروج', time: now, gainedPoints });
  saveData(data);

  res.json({ success: true, pointsGained: gainedPoints, totalPoints: user.points });
});

app.post('/leave', (req, res) => {
  let { username, reason, duration } = req.body;
  if (!username || !reason || !duration) return res.status(400).json({ error: 'مطلوب جميع بيانات الإجازة' });

  let data = readData();
  data.leaves.push({ username, reason, duration, date: Date.now() });
  data.logs.push({ username, action: 'طلب إجازة', time: Date.now(), reason, duration });
  saveData(data);

  res.json({ success: true });
});

// استرجاع بيانات لادمن
app.get('/admin/data', (req, res) => {
  const { adminKey } = req.headers;
  if (adminKey !== 'admin1234') {  // غيّر كلمة السر حسب ما تريد
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }
  const data = readData();
  res.json(data);
});

// حذف مستخدم (باند)
// مطلوب adminKey
app.post('/admin/ban', (req, res) => {
  const { adminKey } = req.headers;
  const { username } = req.body;
  if (adminKey !== 'admin1234') return res.status(403).json({ error: 'صلاحيات غير كافية' });
  if (!username) return res.status(400).json({ error: 'مطلوب اسم المستخدم' });

  let data = readData();
  if (!data.banned.includes(username)) data.banned.push(username);

  // اخرج المستخدم لو مسجل دخول
  let user = data.users.find(u => u.username === username);
  if (user) {
    user.isLoggedIn = false;
    user.loginTime = null;
  }
  data.logs.push({ username: 'SYSTEM', action: `تم حظر المستخدم ${username}`, time: Date.now() });
  saveData(data);
  res.json({ success: true });
});

// إزالة حظر مستخدم
app.post('/admin/unban', (req, res) => {
  const { adminKey } = req.headers;
  const { username } = req.body;
  if (adminKey !== 'admin1234') return res.status(403).json({ error: 'صلاحيات غير كافية' });
  if (!username) return res.status(400).json({ error: 'مطلوب اسم المستخدم' });

  let data = readData();
  data.banned = data.banned.filter(u => u !== username);
  data.logs.push({ username: 'SYSTEM', action: `تم رفع الحظر عن المستخدم ${username}`, time: Date.now() });
  saveData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
