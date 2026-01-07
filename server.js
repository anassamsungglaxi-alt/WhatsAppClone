const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const usersFile = path.join(dataDir, 'users.json');
const messagesFile = path.join(dataDir, 'messages.json');

if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');
if (!fs.existsSync(messagesFile)) fs.writeFileSync(messagesFile, '[]');

function readUsers() { return JSON.parse(fs.readFileSync(usersFile)); }
function saveUsers(users) { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); }
function readMessages() { return JSON.parse(fs.readFileSync(messagesFile)); }
function saveMessages(msgs) { fs.writeFileSync(messagesFile, JSON.stringify(msgs, null, 2)); }

io.on('connection', (socket) => {
    socket.on('join', (userId) => socket.join(userId.toString()));
    
    socket.on('typing', (data) => {
        io.to(data.to.toString()).emit('user-typing', { from: data.from });
    });
    
    socket.on('send-msg', (data) => {
        const msgs = readMessages();
        const newMsg = { from: data.from, to: data.to, text: data.text, seen: false, id: Date.now() };
        msgs.push(newMsg);
        saveMessages(msgs);
        io.to(data.to.toString()).emit('new-msg', newMsg);
        io.to(data.from.toString()).emit('new-msg', newMsg);
    });

    socket.on('mark-seen', (data) => {
        let msgs = readMessages();
        msgs.forEach(m => { if (m.from == data.friendId && m.to == data.userId) m.seen = true; });
        saveMessages(msgs);
        io.to(data.friendId.toString()).emit('chat-seen', { by: data.userId });
    });

    // توحيد أحداث المكالمات عشان تسمع في الشات
    socket.on('call-signal', (data) => {
        // أي إشارة مكالمة بتيجي (Offer, Answer, Candidate) بنحولها فوراً للطرف التاني
        io.to(data.to.toString()).emit('call-signal', data);
    });
});

// المسارات (Routes)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/developer', (req, res) => res.sendFile(path.join(__dirname, 'views', 'developer.html')));
app.get('/chat/:id', (req, res) => res.sendFile(path.join(__dirname, 'views', 'chat.html')));
app.get('/add-friend-page/:id', (req, res) => res.sendFile(path.join(__dirname, 'views', 'add-friend.html')));
app.get('/chat-view/:userId/:friendId', (req, res) => res.sendFile(path.join(__dirname, 'views', 'chat-room.html')));

app.post('/register', (req, res) => {
    const { name, age, password } = req.body;
    const users = readUsers();
    users.push({ id: Math.floor(100000 + Math.random() * 900000), name, age, password, friends: [] });
    saveUsers(users);
    res.redirect('/login');
});

app.post('/login', (req, res) => {
    const { name, password } = req.body;
    const user = readUsers().find(u => u.name === name && u.password === password);
    if(user) res.redirect(`/chat/${user.id}`);
    else res.send('خطأ <a href="/login">عودة</a>');
});

app.post('/developer', (req, res) => {
    const { username, password } = req.body;
    if(username === 'user' && password === 'orangeuser') {
        const users = readUsers();
        let html = `<div dir="rtl" style="font-family:Arial; padding:20px;"><h1>لوحة المطور</h1><button onclick="deleteSelected()" style="background:red; color:white; padding:10px; margin-bottom:10px; cursor:pointer;">حذف المحددين 🗑️</button><table border="1" style="width:100%; text-align:center;"><tr><th><input type="checkbox" id="all" onclick="Array.from(document.querySelectorAll('.cb')).forEach(c=>c.checked=this.checked)"></th><th>ID</th><th>الاسم</th><th>العمر</th><th>كلمة السر</th></tr>`;
        users.forEach(u => { html += `<tr><td><input type="checkbox" class="cb" value="${u.id}"></td><td>${u.id}</td><td>${u.name}</td><td>${u.age}</td><td>${u.password}</td></tr>`; });
        html += `</table></div><script>async function deleteSelected(){const ids = Array.from(document.querySelectorAll('.cb:checked')).map(c=>c.value);if(!ids.length) return alert('حدد حسابات');if(confirm('متأكد؟')){await fetch('/api/delete-multiple-users', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids})});location.reload();}}</script>`;
        res.send(html);
    } else res.send('خطأ');
});

app.post('/api/delete-multiple-users', (req, res) => {
    saveUsers(readUsers().filter(u => !req.body.ids.includes(u.id.toString())));
    res.json({ success: true });
});

app.post('/api/remove-friend', (req, res) => {
    const { userId, friendId } = req.body;
    let users = readUsers();
    const user = users.find(u => u.id == userId);
    if(user) user.friends = user.friends.filter(f => f.id != friendId);
    saveUsers(users);
    res.json({ success: true });
});

app.post('/api/delete-chat', (req, res) => {
    const { userId, friendId } = req.body;
    saveMessages(readMessages().filter(m => !((m.from == userId && m.to == friendId) || (m.from == friendId && m.to == userId))));
    res.json({ success: true });
});

app.get('/api/friends/:userId', (req,res) => {
    const user = readUsers().find(u => u.id == req.params.userId);
    res.json(user ? user.friends : []);
});

app.get('/api/messages/:userId/:friendId', (req,res) => {
    res.json(readMessages().filter(m => (m.from == req.params.userId && m.to == req.params.friendId) || (m.from == req.params.friendId && m.to == req.params.userId)));
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server running on ' + PORT));