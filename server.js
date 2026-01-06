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

// وضع المطور (تم تعديله ليظهر كل البيانات: اسم، ID، عمر، كلمة سر + حذف متعدد)
app.post('/developer', (req, res) => {
    const { username, password } = req.body;
    if(username === 'user' && password === 'orangeuser') {
        const users = readUsers();
        let html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>🛠️ لوحة تحكم المطور - أنس مصطفى</h1>
            <p>يمكنك مراقبة الحسابات وحذفها من هنا:</p>
            <button onclick="deleteSelected()" style="background:red; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:15px;">حذف الحسابات المحددة 🗑️</button>
            
            <table border="1" style="width:100%; border-collapse: collapse; text-align: center;">
                <tr style="background-color: #eee;">
                    <th><input type="checkbox" onclick="toggleAll(this)"></th>
                    <th>الـ ID</th>
                    <th>الاسم</th>
                    <th>العمر</th>
                    <th>كلمة السر</th>
                </tr>`;
        
        users.forEach(u => {
            html += `
                <tr>
                    <td><input type="checkbox" class="user-checkbox" value="${u.id}"></td>
                    <td>${u.id}</td>
                    <td>${u.name}</td>
                    <td>${u.age}</td>
                    <td style="color: blue; font-weight: bold;">${u.password}</td>
                </tr>`;
        });
        
        html += `
            </table>
            <br><a href="/">العودة للرئيسية</a>
        </div>
        <script>
            function toggleAll(source) {
                const checkboxes = document.querySelectorAll('.user-checkbox');
                checkboxes.forEach(cb => cb.checked = source.checked);
            }

            async function deleteSelected() {
                const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
                const ids = Array.from(checkedBoxes).map(cb => cb.value);

                if(ids.length === 0) return alert('حدد حساب واحد على الأقل');

                if(confirm('هل أنت متأكد من حذف الحسابات المختارة؟')) {
                    const res = await fetch('/api/delete-multiple-users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: ids })
                    });
                    const data = await res.json();
                    if(data.success) {
                        alert('تم الحذف بنجاح');
                        location.reload();
                    }
                }
            }
        </script>`;
        res.send(html);
    } else {
        res.send('يوزر أو باسورد خطأ <a href="/developer">عودة</a>');
    }
});

// --- APIs الميزات الجديدة ---

// حذف مجموعة حسابات
app.post('/api/delete-multiple-users', (req, res) => {
    const { ids } = req.body;
    let users = readUsers();
    const updatedUsers = users.filter(u => !ids.includes(u.id.toString()));
    saveUsers(updatedUsers);
    res.json({ success: true });
});

// حذف صديق
app.post('/api/remove-friend', (req, res) => {
    const { userId, friendId } = req.body;
    let users = readUsers();
    const user = users.find(u => u.id == userId);
    if(user) {
        user.friends = user.friends.filter(f => f.id != friendId);
        saveUsers(users);
        res.json({ success: true });
    }
});

// حذف سجل دردشة
app.post('/api/delete-chat', (req, res) => {
    const { userId, friendId } = req.body;
    let msgs = readMessages();
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
    msgs.push({ from, to, text });
    saveMessages(msgs);
    res.json({ success: true });
});

app.get('/api/messages/:userId/:friendId', (req,res) => {
    const msgs = readMessages();
    const chat = msgs.filter(m => (m.from == req.params.userId && m.to == req.params.friendId) || 
                                   (m.from == req.params.friendId && m.to == req.params.userId));
    res.json(chat);
});

const PORT = 3000;
http.listen(PORT, () => console.log(`Server running on http://localhost:3000`));