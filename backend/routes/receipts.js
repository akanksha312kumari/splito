const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer  = require('multer');
const path    = require('path');
const db   = require('../database');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const Tesseract = require('tesseract.js');

// POST /api/receipts/scan — actual OCR + heuristics
router.post('/scan', auth, upload.single('receipt'), async (req, res) => {
  const { group_id } = req.body;
  const filename = req.file?.filename || null;

  let parsedItems = [];
  let total = 0;
  let allNumbers = [];

  if (req.file) {
    try {
      const filepath = path.join(__dirname, '../uploads', filename);
      const result = await Tesseract.recognize(filepath, 'eng');
      const text = result.data.text;
      
      console.log('--- OCR RAW START ---');
      console.log(text);
      console.log('--- OCR RAW END ---');

      const lines = text.split('\n');
      for (let l of lines) {
        l = l.trim().replace(/[|\[\]{}()]/g, ''); // Clean noise
        if (!l) continue;

        // Scavenge all numbers for fallback total detection
        // Matches prices like 120.50, 450, 1,200.00
        const foundNums = l.match(/\d+[.,]\d{2}/g) || l.match(/\d+/g);
        if (foundNums) {
          foundNums.forEach(n => {
            const val = parseFloat(n.replace(',', '.'));
            if (!isNaN(val)) allNumbers.push(val);
          });
        }

        // Smart match: "Any Item Name   450" or "Any Item Name Rs 450.00"
        const match = l.match(/(.+?)\s+(?:Rs\.?|₹|\$|INR)?\s*(\d+(?:[\.,]\d{1,2})?)\s*$/i);
        
        if (match) {
          const name = match[1].trim();
          const amt = parseFloat(match[2].replace(',', '.'));
          
          const isTotalLine = /total|grand|due|sum|pay|total amount|payable/i.test(name);
          const isNoiseLine = /tax|gst|sgst|cgst|service|vat|subtotal|balance|change|cash|bill/i.test(name);

          if (isTotalLine && amt > 0) {
            total = amt; // Explicit total found
          } else if (!isNoiseLine && !isTotalLine && name.length > 2 && amt > 0) {
             parsedItems.push({ name, qty: 1, unit_price: amt, amount: amt });
          }
        }
      }

      // If we didn't find an explicit "total" line but found items, sum them
      if (total === 0 && parsedItems.length > 0) {
        total = parsedItems.reduce((s, it) => s + it.amount, 0);
      }

      // Deep Scavenger: If still 0, use the largest logical number found in the receipt
      if (total === 0 && allNumbers.length > 0) {
        // Filter out obviously wrong numbers (e.g. years like 2024, or tiny amounts)
        const logicalTotals = allNumbers.filter(n => n > 10 && n < 50000); 
        if (logicalTotals.length > 0) {
          total = Math.max(...logicalTotals);
          if (parsedItems.length === 0) {
            parsedItems.push({ name: 'Detected Total', qty: 1, unit_price: total, amount: total });
          }
        }
      }

    } catch (e) {
      console.error('OCR Error:', e);
    }
  }

  // Fallback if OCR resulted in 0 (No more hardcoded 150)
  if (total === 0) {
    parsedItems = [{ name: 'Manual Entry Required', qty: 1, unit_price: 0, amount: 0 }];
    total = 0;
  }

  // Smart Category Guessing
  const fullText = (parsedItems.map(i => i.name).join(' ') + (req.file ? ' ' + filename : '')).toLowerCase();
  let suggested_category = 'other';
  if (/pizza|burger|naan|tikka|food|coke|drink|cafe|restaurant|dine|eat|meal/i.test(fullText)) suggested_category = 'food';
  else if (/taxi|uber|ola|cab|auto|fare|bus|petrol|fuel|gas|train|trip/i.test(fullText)) suggested_category = 'travel';
  else if (/hotel|stay|room|lodge|hostel|airbnb/i.test(fullText)) suggested_category = 'accommodation';
  else if (/movie|ticket|show|fun|entry|game|play|zoo/i.test(fullText)) suggested_category = 'fun';
  else if (/shop|store|mall|buy|purchase/i.test(fullText)) suggested_category = 'shopping';

  // Group Member Split Calculation
  let splitAmount = total;
  let memberCount = 1;
  if (group_id) {
    memberCount = db.prepare('SELECT COUNT(*) AS c FROM group_members WHERE group_id=?').get(group_id)?.c || 1;
    splitAmount  = Math.round((total / memberCount) * 100) / 100;
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO receipts (id,user_id,group_id,filename,parsed_items,total) VALUES (?,?,?,?,?,?)`)
    .run(id, req.userId, group_id || null, filename, JSON.stringify(parsedItems), total);

  res.status(201).json({
    receipt_id:    id,
    filename,
    items:         parsedItems,
    total,
    member_count:  memberCount,
    per_person:    splitAmount,
    ai_confidence: total > 0 ? (parsedItems.length > 1 ? 92 : 75) : 10,
    suggested_category,
  });
});

// GET /api/receipts — history
router.get('/', auth, (req, res) => {
  const receipts = db.prepare('SELECT * FROM receipts WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(req.userId);
  res.json(receipts.map(r => ({ ...r, parsed_items: JSON.parse(r.parsed_items || '[]') })));
});

module.exports = router;
