// Replace the Vercel api/check handler with this file.
// It does not log or return the submitted card number in error details.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const card = body.card;
    if (typeof card !== 'string' || !/^\d{16}$/.test(card)) {
      return res.status(400).json({ error: 'invalid card' });
    }

    const upstream = await fetch('https://api.croma.com/qwikcilver/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.croma.com',
        'Referer': 'https://www.croma.com/'
      },
      body: JSON.stringify({
        TransactionTypeId: 306,
        InputType: '1',
        Cards: [{ CardNumber: card }]
      })
    });

    const raw = await upstream.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
