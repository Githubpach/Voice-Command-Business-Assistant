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

// mapping chichewa lang
function normalizeCommand(command) {
  let normalized = command.toLowerCase().trim();

  const mappings = {
    'pa mtengo wa': 'at',
    // Sales
    'gulitsa': 'sold',
    'gulita': 'sold',
    'anagulitsa': 'sold',
    'ndanagulitsa pa mtengo': 'sold',
    'kugulitsa': 'sold',
    'malonda': 'sale',
    'ndagulitsa': 'sold',
    // Expenses or Purchases
    'gula': 'bought',
    'anagula': 'bought',
    'nagula': 'bought',
    'ndagula': 'bought',
    'ndagula pa mtengo': 'bought',
    'kugula': 'bought',
    'lipira': 'paid',
    'ndalipira': 'paid',
    'nalipira': 'paid',
    'lipirani': 'paid',
    'chiwongola': 'expense',
    // Inventory
    'onjeza': 'add',
    'onjezerani': 'add',
    'ndaonjezera': 'add',
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
    // numberrz
    'chimodzi': '1',
    'imodzi': '1',
    'ziwiri': '2',
    'awiri': '2',
    'zitatu': '3',
    'atatu': '3',
    'zinayi': '4',
    'anayi': '4',
    'zisanu': '5',
    'asanu': '5',
    'zisanu ndi chimodzi': '6',
    'zisanu ndi ziwiri': '7',
    'zisanu ndi zitatu': '8',
    'zisanu ndi zinayi': '9'
  };

  const numberWords = {
    'one': '1',
    'two': '2',
    'three': '3',
    'four': '4',
    'five': '5',
    'six': '6',
    'seven': '7',
    'eight': '8',
    'nine': '9',
    'ten': '10'
  };

  normalized = normalized.replace(/pa mtengo wa|pa mtengo|mtengo wa/gi, 'at');

  for (const [word, digit] of Object.entries(numberWords)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    normalized = normalized.replace(regex, digit);
  }

  for (const [chichewa, english] of Object.entries(mappings)) {
    const regex = new RegExp(`\\b${chichewa}\\b`, 'gi');
    normalized = normalized.replace(regex, english);
  }

  return normalized;
}
//end of mapping some to be added latr 

app.post('/api/command', (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.json({ success: false, message: "No command received" });
  }

  const lower = normalizeCommand(command);

  // ── SALES 
  if (lower.includes('sold')) {
    const match =
      lower.match(/sold\s+(\d+)\s+([a-z\s]+?)\s+(?:at|for)\s+(\d+)/i) ||
      lower.match(/sold\s+([a-z\s]+?)\s+(\d+)\s+(?:at|for)\s+(\d+)/i);

    if (!match) {
      return res.json({ success: false, message: "Could not understand sale format" });
    }

    const quantity = parseInt(match[1]) || parseInt(match[2]);
    let item = (match[2] || match[1]).replace(/s$/, '').trim();
    const price = parseInt(match[3]);

    const amount = quantity * price;
    const date = new Date().toISOString();

    db.get('SELECT quantity FROM inventory WHERE item = ?', [item], (err, row) => {
      const currentQty = row ? row.quantity : 0;

      if (currentQty < quantity) {
        return res.json({
          success: false,
          message: `Stock yochepa: muli ndi ${currentQty} ${item}`
        });
      }

      db.run(
        'INSERT INTO sales (date, item, quantity, price, amount) VALUES (?, ?, ?, ?, ?)',
        [date, item, quantity, price, amount],
        () => {
          db.run(
            'UPDATE inventory SET quantity = ? WHERE item = ?',
            [currentQty - quantity, item]
          );
          res.json({
            success: true,
            message: `Zagulitsa: ${quantity} ${item} @ ${price} = ${amount}`
          });
        }
      );
    });
    return;
  }

  // EXPENSES
  if (lower.includes('bought') || lower.includes('paid') || lower.includes('expense')) {
    const amountMatch = lower.match(/(\d+)/);
    const itemMatch =
      lower.match(/(?:bought|paid|expense)\s+(.+?)\s+(?:for|at)\s*\d+/) ||
      lower.match(/(?:bought|paid|expense)\s+(.+)/);

    const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
    const item = itemMatch ? itemMatch[1].trim().replace(/for|at/gi, '').trim() : 'expense';

    if (!amount || amount === 0) {
      return res.json({
        success: false,
        message: "Please tell me the amount. Example: gula shuga pa 3000",
        type: "error"
      });
    }

    const date = new Date().toISOString();

    db.run(
      'INSERT INTO expenses (date, item, amount) VALUES (?, ?, ?)',
      [date, item, amount],
      function (err) {
        if (err) {
          console.error('Expense insert error:', err);
          return res.status(500).json({
            success: false,
            message: "Error saving expense",
            type: "error"
          });
        }

        return res.json({
          success: true,
          message: `Expense recorded: ${item} for ${amount}.`,
          type: "success"
        });
      }
    );
    return;
  }

    //BUY STOCK
  if (lower.includes('bought')) {
    const match = lower.match(/bought\s+(\d+)\s+([a-z\s]+?)\s+(?:at|for)\s+(\d+)/i);
    if (!match) {
      return res.json({ success: false, message: "Could not understand purchase format" });
    }

    const quantity = parseInt(match[1]);
    let item = match[2].replace(/s$/, '').trim();
    const price = parseInt(match[3]);
    const total = quantity * price;
    const date = new Date().toISOString();

    db.serialize(() => {
      db.run(
        'INSERT OR REPLACE INTO inventory (item, quantity) VALUES (?, COALESCE((SELECT quantity FROM inventory WHERE item=?),0)+?)',
        [item, item, quantity]
      );
      db.run(
        'INSERT INTO expenses (date, item, amount) VALUES (?, ?, ?)',
        [date, item, total]
      );
    });

    return res.json({
      success: true,
      message: `Nagula ${quantity} ${item} pa ${total} ndipo zasungidwa ku stock`
    });
  }

  // ── ADDing  TO Stok
  if (lower.includes('stock')) {
    db.all('SELECT * FROM inventory', [], (err, rows) => {
      if (!rows.length) {
        return res.json({ success: true, message: "Stock ilibe kanthu pano" });
      }
      const msg = rows.map(r => `${r.quantity} ${r.item}`).join(', ');
      res.json({ success: true, message: `Stock pano: ${msg}` });
    });
    return;
  }

  // VIEW STOCK/INVENTORY
    if (lower.includes('stock')) {
    db.all('SELECT * FROM inventory', [], (err, rows) => {
      if (!rows.length) {
        return res.json({ success: true, message: "Stock ilibe kanthu pano" });
      }
      const msg = rows.map(r => `${r.quantity} ${r.item}`).join(', ');
      res.json({ success: true, message: `Stock pano: ${msg}` });
    });
    return;
  }

  // ── FALLBACK ────────────────────────────────────────
  return res.json({
    success: false,
    message: "Sindinamve bwino. Yesani kuti: 'Gulitsa 3 buku pa 500' kapena 'Sold 3 books at 500' or 'add 10 books to stock'",
    type: "error"
  });
});

//fast api's for testing data retrival

app.get('/api/sales', (req, res) => {
  db.all('SELECT * FROM sales ORDER BY date DESC LIMIT 50', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY date DESC LIMIT 50', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/inventory', (req, res) => {
  db.all('SELECT * FROM inventory', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const inv = {};
    rows.forEach(r => inv[r.item] = r.quantity);
    res.json(inv);
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
