const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static('M3'));

const DATA_FILE = 'data.json';
const MSG_FILE = 'messages.json';

// Funkcje obsługi kont (data.json)
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) return {}; 
  const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
  return fileContent ? JSON.parse(fileContent) : {};
};
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Funkcje obsługi czatu (messages.json)
const readMessages = () => {
  if (!fs.existsSync(MSG_FILE)) return[]; 
  const fileContent = fs.readFileSync(MSG_FILE, 'utf8');
  return fileContent ? JSON.parse(fileContent) :[];
};
const saveMessages = (msgs) => fs.writeFileSync(MSG_FILE, JSON.stringify(msgs, null, 2));

// --- REJESTRACJA ---
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const data = readData();
  
  // Przechwytujemy IP
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

  if (data[username]) return res.json({ success: false, message: 'Użytkownik już istnieje!' });

  // --- NOWE: Data w formacie dd.mm.rrrr hh:mm:ss ---
  const now = new Date();
  
  // Dzień, miesiąc (z zerami) i pełny rok
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rrrr = now.getFullYear();
  
  // Godzina, minuta, sekunda (wszystko z zerami z przodu jeśli < 10)
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  
  // Składamy tekst: kropki dla daty, dwukropki dla czasu
  const creationDate = `${dd}.${mm}.${rrrr} ${hh}:${min}:${ss}`;

  // Zapisujemy nowe konto z finalnym formatem daty
  data[username] = { 
    password: password, 
    displayName: '', 
    avatar: '',
    createdAt: creationDate, // <-- np. 08.03.2026 13:42:05
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
    res.json({ success: true, profile: { displayName: data[username].displayName, avatar: data[username].avatar } });
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
    res.json({ success: true, message: 'Zapisano zmiany!', profile: { displayName: data[username].displayName, avatar: data[username].avatar } });
  } else {
    res.json({ success: false, message: 'Błąd autoryzacji.' });
  }
});

// --- USUWANIE KONTA (teraz usuwa też wiadomości!) ---
app.post('/delete', (req, res) => {
  const { username, password } = req.body;
  const data = readData();

  if (data[username] && data[username].password === password) {
    delete data[username]; 
    saveData(data); 

    // Wycieramy całkowicie historię tego użytkownika z czatu
    let msgs = readMessages();
    msgs = msgs.filter(m => m.username !== username);
    saveMessages(msgs);
    
    res.json({ success: true, message: 'Konto i wiadomości zostały usunięte.' });
  } else {
    res.json({ success: false, message: 'Błąd usuwania konta.' });
  }
});

// --- NOWE: WYSYŁANIE WIADOMOŚCI ---
app.post('/send', (req, res) => {
  const { username, password, text } = req.body;
  const data = readData();

  // Najpierw sprawdzamy, czy nadawca istnieje i ma poprawne hasło
  if (data[username] && data[username].password === password) {
    if (!text || text.trim() === '') return res.json({ success: false });
    
    const msgs = readMessages();
    msgs.push({ username: username, text: text.trim(), time: Date.now() });
    
    // Zostawiamy np. tylko 200 ostatnich wiadomości, żeby plik nie rósł w nieskończoność
    saveMessages(msgs.slice(-200)); 
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// --- NOWE: ODBIERANIE WIADOMOŚCI ---
app.get('/messages', (req, res) => {
  const msgs = readMessages();
  const data = readData();

  // Doklejamy do każdej wiadomości aktualną nazwę i zdjęcie użytkownika
  const enrichedMsgs = msgs.map(m => {
    const user = data[m.username] || { displayName: '', avatar: '' };
    return {
      username: m.username,
      displayName: user.displayName || m.username, // Jeśli brak displayName, używamy loginu
      avatar: user.avatar,
      text: m.text
    };
  });

  res.json(enrichedMsgs);
});

app.listen(3000, "0.0.0.0");