const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Serwuj pliki statyczne z public
app.use(express.static(path.join(__dirname, '..', 'public')));

const DATA_FILE = path.join(__dirname, '..', 'src', 'data.json');
const MSG_FILE = path.join(__dirname, '..', 'src', 'messages.json');

// --- Funkcje plikowe ---
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) return {};
  const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
  return fileContent ? JSON.parse(fileContent) : {};
};

const saveData = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

const readMessages = () => {
  if (!fs.existsSync(MSG_FILE)) return [];
  const fileContent = fs.readFileSync(MSG_FILE, 'utf8');
  return fileContent ? JSON.parse(fileContent) : [];
};

const saveMessages = (msgs) =>
  fs.writeFileSync(MSG_FILE, JSON.stringify(msgs, null, 2));

// --- REJESTRACJA ---
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const data = readData();

  const userIp =
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    req.ip;

  if (data[username])
    return res.json({ success: false, message: 'Użytkownik już istnieje!' });

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const creationDate = `${dd}.${mm}.${yyyy} ${hh}:${min}:${ss}`;

  data[username] = {
    password,
    displayName: '',
    avatar: '',
    createdAt: creationDate,
    ip: userIp
  };

  saveData(data);
  res.json({ success: true, message: 'Konto założone. Zaloguj się.' });
});

// --- LOGOWANIE ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const data = readData();

  if (data[username] && data[username].password === password) {
    res.json({
      success: true,
      profile: {
        displayName: data[username].displayName,
        avatar: data[username].avatar
      }
    });
  } else {
    res.json({ success: false, message: 'Błędny login lub hasło.' });
  }
});

// --- AKTUALIZACJA ---
app.post('/update', (req, res) => {
  const { username, password, displayName, avatar } = req.body;
  const data = readData();

  if (data[username] && data[username].password === password) {
    data[username].displayName = displayName || '';
    data[username].avatar = avatar || '';
    saveData(data);

    res.json({
      success: true,
      message: 'Zapisano zmiany!',
      profile: {
        displayName: data[username].displayName,
        avatar: data[username].avatar
      }
    });
  } else {
    res.json({ success: false, message: 'Błąd autoryzacji.' });
  }
});

// --- USUWANIE KONTA ---
app.post('/delete', (req, res) => {
  const { username, password } = req.body;
  const data = readData();

  if (data[username] && data[username].password === password) {
    delete data[username];
    saveData(data);

    let msgs = readMessages();
    msgs = msgs.filter((m) => m.username !== username);
    saveMessages(msgs);

    res.json({
      success: true,
      message: 'Konto i wiadomości zostały usunięte.'
    });
  } else {
    res.json({ success: false, message: 'Błąd usuwania konta.' });
  }
});

// --- WYSYŁANIE WIADOMOŚCI ---
app.post('/send', (req, res) => {
  const { username, password, text } = req.body;
  const data = readData();

  if (data[username] && data[username].password === password) {
    if (!text || text.trim() === '')
      return res.json({ success: false });

    const msgs = readMessages();
    msgs.push({
      username,
      text: text.trim(),
      time: Date.now()
    });

    saveMessages(msgs.slice(-200));
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// --- ODBIERANIE WIADOMOŚCI ---
app.get('/messages', (req, res) => {
  const msgs = readMessages();
  const data = readData();

  const enriched = msgs.map((m) => {
    const user = data[m.username] || {
      displayName: '',
      avatar: ''
    };

    return {
      username: m.username,
      displayName: user.displayName || m.username,
      avatar: user.avatar,
      text: m.text
    };
  });

  res.json(enriched);
});

// EKSPORT DLA VERCELA - NAJWAŻNIEJSZE!
module.exports = app;
