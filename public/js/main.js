const userId = parseInt(window.location.pathname.split("/").pop()); // ID المستخدم من الرابط
let currentFriendId = null;
let friends = [];
let messages = [];

// DOM
const usernameEl = document.getElementById("username");
const accountInfoEl = document.getElementById("account-info");
const friendsListEl = document.getElementById("friends");
const chatBoxEl = document.getElementById("chat-box");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const addFriendBtn = document.getElementById("add-friend-btn");
const friendIdInput = document.getElementById("friend-id");
const settingsModal = document.getElementById("settings-modal");
const settingsBtn = document.getElementById("settings");

// جلب الأصدقاء من السيرفر
async function loadFriends() {
    const res = await fetch(`/api/friends/${userId}`);
    friends = await res.json();
    updateFriendsList();
}

// عرض قائمة الأصدقاء
function updateFriendsList() {
    friendsListEl.innerHTML = "";
    friends.forEach(f => {
        let li = document.createElement("li");
        li.textContent = `${f.name} (ID: ${f.id})`;
        li.onclick = () => openChat(f.id, f.name);
        friendsListEl.appendChild(li);
    });
}

// فتح شات صديق
async function openChat(friendId, friendName) {
    currentFriendId = friendId;
    chatBoxEl.innerHTML = "";
    const res = await fetch(`/api/messages/${userId}/${friendId}`);
    messages = await res.json();
    messages.forEach(msg => addMessage(msg));
    chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
}

// إضافة رسالة للعرض
function addMessage(msg) {
    const div = document.createElement("div");
    div.textContent = (msg.from == userId ? "أنت: " : "صديق: ") + msg.text;
    div.className = "message";
    chatBoxEl.appendChild(div);
}

// إرسال رسالة
messageForm.onsubmit = async e => {
    e.preventDefault();
    if(!currentFriendId) return alert("اختر صديق للكتابة له");
    const text = messageInput.value.trim();
    if(!text) return;
    const res = await fetch("/api/send-message", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({from: userId, to: currentFriendId, text})
    });
    const data = await res.json();
    if(data.success) {
        addMessage({from: userId, to: currentFriendId, text});
        messageInput.value = "";
        chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
    }
}

// إضافة صديق
addFriendBtn.onclick = async () => {
    const friendId = parseInt(friendIdInput.value);
    if(!friendId) return alert("ادخل ID صحيح");
    const res = await fetch("/api/add-friend", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({userId, friendId})
    });
    const data = await res.json();
    alert(data.message);
    if(data.success) loadFriends();
    friendIdInput.value = "";
}

// إعدادات
settingsBtn.onclick = () => settingsModal.style.display = "block";
function closeSettings() { settingsModal.style.display = "none"; }

loadFriends();
