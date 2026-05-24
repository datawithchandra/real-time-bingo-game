const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

let gameState = {
  hostNumbers: Array.from({ length: 25 }, (_, i) => i + 1),
  guestNumbers: Array.from({ length: 25 }, (_, i) => i + 1),
  markedNumbers: new Set(),
  currentTurn: 'host',
  gameActive: true,
  hostLines: 0,
  guestLines: 0,
  winner: null,
  isDraw: false
};

let chatMessages = [];
let nextChatId = 1;

function shuffleNumbers(numbers) {
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
}

function resetGame() {
  gameState.hostNumbers = Array.from({ length: 25 }, (_, i) => i + 1);
  gameState.guestNumbers = Array.from({ length: 25 }, (_, i) => i + 1);
  shuffleNumbers(gameState.hostNumbers);
  shuffleNumbers(gameState.guestNumbers);

  gameState.markedNumbers = new Set();
  gameState.currentTurn = 'host';
  gameState.gameActive = true;
  gameState.hostLines = 0;
  gameState.guestLines = 0;
  gameState.winner = null;
  gameState.isDraw = false;
}

function countLines(numbers, markedNumbers) {
  let lines = 0;

  for (let row = 0; row < 5; row++) {
    const rowNumbers = numbers.slice(row * 5, row * 5 + 5);
    if (rowNumbers.every(num => markedNumbers.includes(num))) lines++;
  }

  for (let col = 0; col < 5; col++) {
    const colNumbers = [0, 5, 10, 15, 20].map(i => numbers[i + col]);
    if (colNumbers.every(num => markedNumbers.includes(num))) lines++;
  }

  const mainDiagonal = [0, 6, 12, 18, 24].map(i => numbers[i]);
  if (mainDiagonal.every(num => markedNumbers.includes(num))) lines++;

  const antiDiagonal = [4, 8, 12, 16, 20].map(i => numbers[i]);
  if (antiDiagonal.every(num => markedNumbers.includes(num))) lines++;

  return lines;
}

function normalizeMessage(input) {
  return String(input ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

resetGame();

app.use(express.static('public'));
app.use(express.json());

app.get('/game/:type', (req, res) => {
  const type = req.params.type;
  const numbers = type === 'host' ? gameState.hostNumbers : gameState.guestNumbers;

res.json({
  numbers,
  markedNumbers: Array.from(gameState.markedNumbers),
  currentTurn: gameState.currentTurn,
  gameActive: gameState.gameActive,
  yourTurn: gameState.currentTurn === type && gameState.gameActive,
  winner: gameState.winner,
  isDraw: gameState.isDraw,
  hostLines: gameState.hostLines,
  guestLines: gameState.guestLines
});
});

app.post('/mark/:type', (req, res) => {
  const type = req.params.type;
  const { number } = req.body;

  if (!gameState.gameActive) {
    return res.json({ ok: false, reason: 'Game is over!' });
  }

  if (gameState.currentTurn !== type) {
    return res.json({ ok: false, reason: 'Not your turn!' });
  }

  const parsedNumber = Number(number);
  if (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > 25) {
    return res.json({ ok: false, reason: 'Invalid number!' });
  }

  if (gameState.markedNumbers.has(parsedNumber)) {
    return res.json({ ok: false, reason: 'Number already marked!' });
  }

  gameState.markedNumbers.add(parsedNumber);

  gameState.hostLines = countLines(gameState.hostNumbers, Array.from(gameState.markedNumbers));
  gameState.guestLines = countLines(gameState.guestNumbers, Array.from(gameState.markedNumbers));

  if (gameState.hostLines >= 5 && gameState.guestLines >= 5) {
    gameState.gameActive = false;
    gameState.winner = null;
    gameState.isDraw = true;
  } else if (gameState.hostLines >= 5) {
    gameState.gameActive = false;
    gameState.winner = 'host';
    gameState.isDraw = false;
  } else if (gameState.guestLines >= 5) {
    gameState.gameActive = false;
    gameState.winner = 'guest';
    gameState.isDraw = false;
  } else {
    gameState.currentTurn = type === 'host' ? 'guest' : 'host';
  }

  res.json({
    ok: true,
    gameActive: gameState.gameActive,
    winner: gameState.winner,
    isDraw: gameState.isDraw,
    currentTurn: gameState.currentTurn,
    markedNumbers: Array.from(gameState.markedNumbers)
  });
});

// Replace the existing /newgame/:type route in server.js with this updated version

app.post('/newgame/:type', (req, res) => {
  // Reset game state
  resetGame();

  // Clear all live chat messages
  chatMessages = [];
  nextChatId = 1;

  // Send success response
  res.json({ ok: true });
});

app.get('/chat', (req, res) => {
  const since = Number(req.query.since || 0);
  const messages = chatMessages.filter(msg => msg.id > since);
  res.json({ messages, latestId: nextChatId - 1 });
});

app.post('/chat/:type', (req, res) => {
  const type = req.params.type;
  const message = normalizeMessage(req.body?.message);

  if (!message) {
    return res.json({ ok: false, reason: 'Message is empty!' });
  }

  const msg = {
    id: nextChatId++,
    type,
    message,
    ts: Date.now()
  };

  chatMessages.push(msg);
  if (chatMessages.length > 100) chatMessages = chatMessages.slice(-100);

  res.json({ ok: true, message: msg });
});

app.post('/clear-chat', (req, res) => {
  // Clear chat for all players
  chatMessages = [];
  nextChatId = 1;

  res.json({
    ok: true,
    clearedFor: 'all'
  });
});

const os = require('os');

app.listen(PORT, '0.0.0.0', () => {

  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {

      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
      }

    }
  }

  console.log(`\n🎯 BINGO - FIRST TO 5 LINES!`);
  console.log(`🌐 HOST: http://${localIP}:${PORT}`);
  console.log(`🌐 GUEST: http://${localIP}:${PORT}?type=guest`);

});
