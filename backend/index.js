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

  normalized = normalized
    .replace(/pa mtengo wa|pa mtengo|mtengo wa/gi, 'at');

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
  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      success: false,
      message: "No command received",
      type: "error"
    });
  }

  const normalized = normalizeCommand(command);
  const lower = normalized.toLowerCase();

  // ── SALES 
  if (lower.includes('sold') || lower.includes('sale')) {
    //const itemMatch = lower.match(/(?:sold|sale)\s+(\d+)\s+([a-z\s]+?)(?:\s+at|\s+for|$)/i);       
    let quantity, item, price;

    let match1 = lower.match(/sold\s+(\d+)\s+([a-z\s]+?)\s+(?:at|for)\s+(\d+)/i);

    let match2 = lower.match(/sold\s+([a-z\s]+?)\s+(\d+)\s+(?:at|for)\s+(\d+)/i);
    // senteces come in diffarennt formarts thus why were trying to add two txt matching

    if (match1) {
      quantity = parseInt(match1[1]);
      item = match1[2].trim();
      price = parseInt(match1[3]);
    } else if (match2) {
      item = match2[1].trim();
      quantity = parseInt(match2[2]);
      price = parseInt(match2[3]);
    } else {
      return res.json({ success: false, message: "Could not understand sale format" });
    }

    if (!price || price === 0) {
      response.message = "chonde ndiwuzeni Mtengo. mwachitsanzo: ndagulitsa 3 buku pa 500";
      return res.json(response);
    }

    const amount = quantity * price;
    const date = new Date().toISOString();
    db.get('SELECT quantity FROM inventory WHERE item = ?', [item], (err, row) => { //forgooten to check invontory before slling
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Database error checking inventory",
          type: "error"
        });
      }
      const currentQty = row ? row.quantity : 0;
      if (currentQty < quantity) {
        response.message = `Mulibe zinthu zokwanira, ${currentQty} ${item}, koma mukufuna kugulitsa ${quantity}.`;
        return res.json(response);
      }

      db.run(
        'INSERT INTO sales (date, item, quantity, price, amount) VALUES (?, ?, ?, ?, ?)',
        [date, item, quantity, price, amount],
        function (err) {
          if (err) {
            console.error('Sales insert error:', err);
            return res.status(500).json({
              success: false,
              message: "Error saving sale",
              type: "error"
            });
          }

          const newQty = currentQty - quantity;
          db.run(
            'UPDATE inventory SET quantity = ? WHERE item = ?',
            [newQty, item],
            (err2) => {
              if (err2) {
                console.error('Inventory update error:', err2);
              }
            }
          );

          return res.json({
            success: true,
            message: `Zogulitsa zasungidwa: ${quantity} ${item} @ ${price} = ${amount} total.`,
            type: "success"
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

  // ── ADDing  TO Stok
   if (lower.includes('add') && (lower.includes('stock') || lower.includes('inventory'))) {
    const quantityMatch = lower.match(/(\d+)/);
    const itemMatch = lower.match(/(?:add|onjeza)\s+(?:\d+\s+)?(.+?)(?:\s+to|\s+in|$)/i);

    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 0;
    let item = itemMatch ? itemMatch[1].trim().replace(/to stock|to inventory|stock|inventory/gi, '').trim() : 'item';

    if (!quantity || quantity === 0) {
      return res.json({
        success: false,
        message: "Please tell me how many to add. Example: onjeza 10 buku ku stock",
        type: "error"
      });
    }

    db.run(
      'INSERT OR REPLACE INTO inventory (item, quantity) ' +
      'VALUES (?, COALESCE((SELECT quantity FROM inventory WHERE item = ?), 0) + ?)',
      [item, item, quantity],
      function (err) {
        if (err) {
          console.error('Stock update error:', err);
          return res.status(500).json({
            success: false,
            message: "Error updating stock",
            type: "error"
          });
        }

        return res.json({
          success: true,
          message: `Added ${quantity} ${item} to stock.`,
          type: "success"
        });
      }
    );
    return;
  }

  // VIEW STOCK/INVENTORY
  if (lower.includes('stock') || lower.includes('inventory')) {
    db.all('SELECT * FROM inventory ORDER BY item', [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error retrieving inventory",
          type: "error"
        });
      }

      if (rows.length === 0) {
        return res.json({
          success: true,
          message: "Your inventory is empty. Add items with: 'add 10 books to stock'",
          type: "info"
        });
      }

      let msg = "Current stock: ";
      rows.forEach((r, i) => {
        msg += `${r.quantity} ${r.item}`;
        if (i < rows.length - 1) msg += ", ";
      });

      return res.json({
        success: true,
        message: msg,
        type: "info"
      });
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
