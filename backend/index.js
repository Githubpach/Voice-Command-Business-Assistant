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
    // Sales
    'gulitsa': 'sold',
    'anagulitsa': 'sold',
    'kugulitsa': 'sold',
    'malonda': 'sale',
    'ndagulitsa': 'sold',
    // Expenses or Purchases
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
    // numberrz
    'chimodzi': '1',
    'ziwiri': '2',
    'zitatu': '3',
    'zinayi': '4',
    'zisanu': '5',
    'zisanu ndi chimodzi': '6'
  };

  for (const [chichewa, english] of Object.entries(mappings)) {
    const regex = new RegExp(`\\b${chichewa}\\b`, 'gi');
    normalized = normalized.replace(regex, english);
  }

  return normalized;
}
//end of mapping some to be added latr 

app.post('/api/command', (req, res) => {
  const { command } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      success: false,
      message: "No command received",
      type: "error"
    });
  }

  const originalCommand = command;
  const normalized = normalizeCommand(command);
  const lower = normalized.toLowerCase();

  let response = { success: false, message: "", type: "error" };

  if (lower.includes('sold') || lower.includes('sale')) {
    const quantityMatch = lower.match(/(\d+)/);
    const priceMatch = lower.match(/at\s*(\d+)|for\s*(\d+)/);
    const itemMatch = lower.match(/(?:sold|sale)\s+(?:\d+\s+)?(.+?)(?:\s+at|\s+for|$)/i);

    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
    const price = priceMatch ? parseInt(priceMatch[1] || priceMatch[2]) : 0;
    let item = itemMatch ? itemMatch[1].trim() : 'item';

    if (price === 0) {
      response.message = "Please tell me the price. Example: gulitsa 3 buku pa 500";
      return res.json(response);
    }

    const amount = quantity * price;
    const date = new Date().toISOString();
    db.run(
      'INSERT INTO sales (date, item, quantity, price, amount) VALUES (?, ?, ?, ?, ?)',
      [date, item, quantity, price, amount],
      function (err) {
        if (err) {
          response.message = "Error saving sale";
          return res.status(500).json(response);
        }

        db.run(
          'INSERT OR REPLACE INTO inventory (item, quantity) ' +
          'VALUES (?, COALESCE((SELECT quantity FROM inventory WHERE item = ?), 0) - ?)',
          [item, item, quantity],
          (err2) => {
            if (err2) console.error('Inventory update error:', err2);
          }
        );
        response = {
          success: true,
          message: `Sale recorded: ${quantity} ${item} sold for ${amount} total.`,
          type: "success"
        };
        return res.json(response);
      }
    );
    return;
  }

  if (lower.includes('bought') || lower.includes('paid') || lower.includes('expense')) {
    const amountMatch = lower.match(/(\d+)/);
    const itemMatch =
      lower.match(/(?:bought|paid|expense)\s+(.+?)\s+(?:for|at)?\s*\d+/) ||
      lower.match(/(?:for|at)\s+(.+)/);

    const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
    const item = itemMatch ? itemMatch[1].trim() : 'expense';

    if (amount === 0) {
      response.message = "Please tell me the amount. Example: gula shuga pa 3000";
      return res.json(response);
    }

    const date = new Date().toISOString();

    db.run(
      'INSERT INTO expenses (date, item, amount) VALUES (?, ?, ?)',
      [date, item, amount],
      function (err) {
        if (err) {
          response.message = "Error saving expense";
          return res.status(500).json(response);
        }

        response = {
          success: true,
          message: `Expense recorded: ${item} for ${amount}.`,
          type: "success"
        };
        return res.json(response);
      }
    );
    return;
  }

  // ── ADDing  TO STOCK ───────────────────────────────
  if (lower.includes('add') && lower.includes('stock')) {
    const quantityMatch = lower.match(/(\d+)/);
    const itemMatch = lower.match(/(?:add|onjeza)\s+(?:\d+\s+)?(.+?)(?:\s+to|\s+in|$)/i);

    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 0;
    let item = itemMatch ? itemMatch[1].trim().replace(/to stock|to inventory/i, '').trim() : 'item';

    if (quantity === 0) {
      response.message = "Please tell me how many to add. Example: onjeza 10 buku ku stock";
      return res.json(response);
    }

    db.run(
      'INSERT OR REPLACE INTO inventory (item, quantity) ' +
      'VALUES (?, COALESCE((SELECT quantity FROM inventory WHERE item = ?), 0) + ?)',
      [item, item, quantity],
      (err) => {
        if (err) {
          response.message = "Error updating stock";
          return res.status(500).json(response);
        }

        response = {
          success: true,
          message: `Added ${quantity} ${item} to stock.`,
          type: "success"
        };
        return res.json(response);
      }
    );
    return;
  }

  if (lower.includes('stock') || lower.includes('inventory')) {
    db.all('SELECT * FROM inventory', [], (err, rows) => {
      if (err || rows.length === 0) {
        response.message = "Your inventory is empty.";
        response.type = "info";
      } else {
        let msg = "Current stock: ";
        rows.forEach((r, i) => {
          msg += `${r.quantity} ${r.item}`;
          if (i < rows.length - 1) msg += ", ";
        });
        response.message = msg;
        response.type = "info";
      }
      response.success = true;
      res.json(response);
    });
    return;
  }

  // Fallback if an error is raised
  response.message = "Sindinamve bwino. Yesani kuti: 'Gulitsa 3 buku pa 500' kapena 'Sold 3 books at 500'";
  res.json(response);
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
