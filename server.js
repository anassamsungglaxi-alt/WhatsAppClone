const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const usersFile = path.join(__dirname, 'data', 'users.json');
const messagesFile = path.join(__dirname, 'data', 'messages.json');

if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');
if (!fs.existsSync(messagesFile)) fs.writeFileSync(messagesFile, '[]');

function readUsers() { return JSON.parse(fs.readFileSync(usersFile)); }
function saveUsers(users) { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); }
function readMessages() { return JSON.parse(fs.readFileSync(messagesFile)); }
function saveMessages(msgs) { fs.writeFileSync(messagesFile, JSON.stringify(msgs, null, 2)); }

function generateID() {
    let id; const users = readUsers();
    do { id = Math.floor(100000 + Math.random() * 900000); }
    while(users.find(u => u.id == id));
    return id;
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/developer', (req, res) => res.sendFile(path.join(__dirname, 'views', 'developer.html')));
app.get('/chat/:id', (req, res) => res.sendFile(path.join(__dirname, 'views', 'chat.html')));

app.post('/register', (req, res) => {
    const { name, age, password } = req.body;
    const users = readUsers();
    users.push({ id: generateID(), name, age, password, friends: [] });
    saveUsers(users);
    res.redirect('/login');
});

app.post('/login', (req, res) => {
    const { name, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.name === name && u.password === password);
    if(user) res.redirect(`/chat/${user.id}`);
    else res.send('خطأ في البيانات <a href="/login">عودة</a>');
});

// وضع المطور المعدل (حذف متعدد)
app.post('/developer', (req, res) => {
    const { username, password } = req.body;
    if(username === 'user' && password === 'orangeuser') {
        const users = readUsers();
        let html = `<div dir="rtl"><h1>لوحة المطور</h1><button onclick="deleteSelected()">حذف المحددين</button><table border="1"><tr><th>#</th><th>ID</th><th>اسم</th></tr>`;
        users.forEach(u => {
            html += `<tr><td><input type="checkbox" class="user-cb" value="${u.id}"></td><td>${u.id}</td><td>${u.name}</td></tr>`;
        });
        html += `</table></div><script>
            async function deleteSelected(){
                const ids = Array.from(document.querySelectorAll('.user-cb:checked')).map(cb => cb.value);
                await fetch('/api/delete-users', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids})});
                location.reload();
            }
        </script>`;
        res.send(html);
    } else res.send('خطأ');
});

app.post('/api/delete-users', (req, res) => {
    const { ids } = req.body;
    saveUsers(readUsers().filter(u => !ids.includes(u.id.toString())));
    res.json({ success: true });
});

// --- الميزات الجديدة ---

// 1. حذف صديق
app.post('/api/remove-friend', (req, res) => {
    const { userId, friendId } = req.body;
    const users = readUsers();
    const user = users.find(u => u.id == userId);
    if(user) {
        user.friends = user.friends.filter(f => f.id != friendId);
        saveUsers(users);
        res.json({ success: true });
    }
});

// 2. حذف سجل الدردشة
app.post('/api/delete-chat', (req, res) => {
    const { userId, friendId } = req.body;
    let msgs = readMessages();
    // نحذف فقط الرسائل اللي بين الشخصين دول
    msgs = msgs.filter(m => !((m.from == userId && m.to == friendId) || (m.from == friendId && m.to == userId)));
    saveMessages(msgs);
    res.json({ success: true });
});

app.post('/api/add-friend', (req, res) => {
    const { userId, friendId } = req.body;
    const users = readUsers();
    const user = users.find(u => u.id == userId);
    const friend = users.find(u => u.id == friendId);
    if(!friend || user.friends.find(f => f.id == friend.id)) return res.json({ success: false });
    user.friends.push({ id: friend.id, name: friend.name });
    saveUsers(users);
    res.json({ success: true });
});

app.get('/api/friends/:userId', (req,res) => {
    const users = readUsers();
    const user = users.find(u => u.id == req.params.userId);
    res.json(user ? user.friends : []);
});

app.post('/api/send-message', (req,res) => {
    const { from, to, text } = req.body;
    const msgs = readMessages();
    msgs.push({ from, to, text, seen: false }); // إضافة حالة "لم يقرأ"
    saveMessages(msgs);
    res.json({ success: true });
});

app.get('/api/messages/:userId/:friendId', (req,res) => {
    const msgs = readMessages();
    // عند فتح الشات، نجعل الرسائل "مقروءة" (اختياري لتطوير ميزة الإشعارات)
    const chat = msgs.filter(m => (m.from == req.params.userId && m.to == req.params.friendId) || 
                                   (m.from == req.params.friendId && m.to == req.params.userId));
    res.json(chat);
});

const PORT = 3000;
http.listen(PORT, () => console.log(`Server running on http://localhost:3000`));