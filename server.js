const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// الملفات
const usersFile = path.join(__dirname, 'data', 'users.json');
const messagesFile = path.join(__dirname, 'data', 'messages.json');

// تأكد من وجود الملفات
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');
if (!fs.existsSync(messagesFile)) fs.writeFileSync(messagesFile, '[]');

// دوال المساعدة
function readUsers() { return JSON.parse(fs.readFileSync(usersFile)); }
function saveUsers(users) { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); }
function readMessages() { return JSON.parse(fs.readFileSync(messagesFile)); }
function saveMessages(msgs) { fs.writeFileSync(messagesFile, JSON.stringify(msgs, null, 2)); }

function generateID() {
    let id;
    const users = readUsers();
    do { id = Math.floor(100000 + Math.random() * 900000); }
    while(users.find(u => u.id == id));
    return id;
}

// الصفحات
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/developer', (req, res) => res.sendFile(path.join(__dirname, 'views', 'developer.html')));
app.get('/chat/:id', (req, res) => res.sendFile(path.join(__dirname, 'views', 'chat.html')));

// إنشاء حساب
app.post('/register', (req, res) => {
    const { name, age, password } = req.body;
    const users = readUsers();
    const id = generateID();
    users.push({ id, name, age, password, friends: [] });
    saveUsers(users);
    res.redirect('/login');
});

// تسجيل الدخول
app.post('/login', (req, res) => {
    const { name, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.name === name && u.password === password);
    if(user) res.redirect(`/chat/${user.id}`);
    else res.send('اسم المستخدم أو كلمة السر خطأ <a href="/login">عودة</a>');
});

// وضع المطور
app.post('/developer', (req, res) => {
    const { username, password } = req.body;
    if(username === 'user' && password === 'orangeuser') {
        const users = readUsers();
        let html = `<h1>لوحة المطور</h1><table border="1"><tr><th>ID</th><th>اسم</th><th>العمر</th><th>كلمة السر</th></tr>`;
        users.forEach(u => {
            html += `<tr><td>${u.id}</td><td>${u.name}</td><td>${u.age}</td><td>${u.password}</td></tr>`;
        });
        html += `</table>`;
        res.send(html);
    } else {
        res.send('يوزر أو باسورد خطأ <a href="/developer">عودة</a>');
    }
});

// API لإضافة صديق
app.post('/api/add-friend', (req, res) => {
    const { userId, friendId } = req.body;
    const users = readUsers();
    const user = users.find(u => u.id == userId);
    const friend = users.find(u => u.id == friendId);
    if(!friend) return res.json({ success: false, message: "الـ ID غير موجود" });
    if(user.friends.find(f => f.id == friend.id)) return res.json({ success: false, message: "الصديق موجود بالفعل" });
    user.friends.push({ id: friend.id, name: friend.name });
    saveUsers(users);
    res.json({ success: true, message: `تمت إضافة ${friend.name}` });
});

// API لجلب الأصدقاء
app.get('/api/friends/:userId', (req,res) => {
    const users = readUsers();
    const user = users.find(u => u.id == req.params.userId);
    res.json(user ? user.friends : []);
});

// API إرسال رسالة
app.post('/api/send-message', (req,res) => {
    const { from, to, text } = req.body;
    const msgs = readMessages();
    msgs.push({ from, to, text });
    saveMessages(msgs);
    res.json({ success: true });
});

// API جلب الرسائل بين مستخدم وصديق
app.get('/api/messages/:userId/:friendId', (req,res) => {
    const msgs = readMessages();
    const chat = msgs.filter(m => (m.from == req.params.userId && m.to == req.params.friendId) || 
                                   (m.from == req.params.friendId && m.to == req.params.userId));
    res.json(chat);
});

const PORT = 3000;
http.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
