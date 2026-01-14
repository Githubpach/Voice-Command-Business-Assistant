const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('business.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      item TEXT,
      quantity INTEGER,
      price INTEGER,
      amount INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      item TEXT,
      amount INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      item TEXT PRIMARY KEY,
      quantity INTEGER
    )
  `);
});

// ────────────────────────────────────────────────
// Helper: Normalize command (Chichewa → English mapping)
// ────────────────────────────────────────────────
function normalizeCommand(command) {
  let normalized = command.toLowerCase().trim();

  const mappings = {
    // Sales
    'gulitsa': 'sold',
    'anagulitsa': 'sold',
    'kugulitsa': 'sold',
    'malonda': 'sale',
    'ndagulitsa': 'sold',
    // Expenses / Purchases
    'gula': 'bought',
    'anagula': 'bought',
    'kugula': 'bought',
    'lipira': 'paid',
    'lipirani': 'paid',
    'chiwongola': 'expense',
    // Inventory
    'onjeza': 'add',
    'onjezerani': 'add',
    'katundu': 'stock',
    'zinthu': 'inventory',
    // Reports
    'phindu': 'profit',
    'chidule': 'summary',
    'thandizo': 'help',
    'lero': 'today',
    'tsiku lino': 'today',
    'mlungu': 'week',
    'mwezi': 'month',
    // Numbers (common Chichewa)
    'chimodzi': '1',
    'ziwiri': '2',
    'zitatu': '3',
    'zinayi': '4',
    'zisanu': '5',
    'zisanu ndi chimodzi': '6',
    // Add more as you test real speech results
  };

  for (const [chichewa, english] of Object.entries(mappings)) {
    const regex = new RegExp(`\\b${chichewa}\\b`, 'gi');
    normalized = normalized.replace(regex, english);
  }

  return normalized;
}

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});