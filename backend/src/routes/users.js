const router = require('express').Router();
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const QRCode = require('qrcode');

// GET /api/users/me/memberships - buyer's groups
router.get('/me/memberships', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gm.id, gm.payment_status, gm.pickup_code, gm.joined_at,
              g.id as group_id, g.status as group_status, g.price,
              g.product_snapshot, g.expires_at, g.pickup_location, g.pickup_hours,
              u.name as seller_name
       FROM group_memberships gm
       JOIN purchase_groups g ON gm.group_id = g.id
       JOIN users u ON g.seller_id = u.id
       WHERE gm.buyer_id = $1
       ORDER BY gm.joined_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch memberships' });
  }
});

// GET /api/users/me/memberships/:membershipId/qr - get QR code for pickup
router.get('/me/memberships/:membershipId/qr', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gm.pickup_code, gm.buyer_id FROM group_memberships gm WHERE gm.id = $1`,
      [req.params.membershipId]
    );
    const membership = result.rows[0];
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.buyer_id !== req.user.id) return res.status(403).json({ error: 'Not your membership' });
    if (!membership.pickup_code) return res.status(400).json({ error: 'No pickup code yet' });

    const qrDataUrl = await QRCode.toDataURL(membership.pickup_code, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 256,
    });
    res.json({ qr: qrDataUrl, code: membership.pickup_code });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// GET /api/users/me/payment-methods
router.get('/me/payment-methods', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, last4, card_type, is_default, created_at FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// POST /api/users/me/payment-methods - add card
router.post('/me/payment-methods', auth, async (req, res) => {
  const { card_number, expiry, cvv } = req.body;
  if (!card_number || !expiry || !cvv) return res.status(400).json({ error: 'Missing card details' });

  try {
    const validation = await paymentService.validateToken(card_number, expiry, cvv);
    if (!validation.valid) return res.status(400).json({ error: validation.error || 'Card validation failed' });

    // Set as default if first card
    const existingCount = await pool.query('SELECT COUNT(*) FROM payment_methods WHERE user_id = $1', [req.user.id]);
    const isDefault = parseInt(existingCount.rows[0].count) === 0;

    const result = await pool.query(
      `INSERT INTO payment_methods (user_id, tranzila_token, last4, card_type, is_default)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, last4, card_type, is_default, created_at`,
      [req.user.id, validation.token, validation.last4, validation.cardType, isDefault]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

// DELETE /api/users/me/payment-methods/:id
router.delete('/me/payment-methods/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM payment_methods WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Payment method not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// PUT /api/users/me/payment-methods/:id/default
router.put('/me/payment-methods/:id/default', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE payment_methods SET is_default = false WHERE user_id = $1', [req.user.id]);
    await client.query('UPDATE payment_methods SET is_default = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to set default' });
  } finally {
    client.release();
  }
});

// POST /api/users/me/reviews - submit review after pickup
router.post('/me/reviews', auth, async (req, res) => {
  const { group_id, rating, comment } = req.body;
  if (!group_id || !rating) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Verify buyer is a charged member of a completed group
    const memberCheck = await pool.query(
      `SELECT gm.id, g.seller_id FROM group_memberships gm
       JOIN purchase_groups g ON gm.group_id = g.id
       WHERE gm.group_id = $1 AND gm.buyer_id = $2 AND gm.payment_status = 'charged' AND g.status = 'completed'`,
      [group_id, req.user.id]
    );
    if (!memberCheck.rows[0]) return res.status(403).json({ error: 'Can only review completed purchases' });

    const result = await pool.query(
      `INSERT INTO reviews (buyer_id, seller_id, group_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, memberCheck.rows[0].seller_id, group_id, rating, comment]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already reviewed this purchase' });
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// POST /api/users/me/seller-request - request seller status
router.post('/me/seller-request', auth, async (req, res) => {
  try {
    const existing = await pool.query(
      `SELECT id FROM seller_approvals WHERE user_id = $1 AND status = 'pending'`,
      [req.user.id]
    );
    if (existing.rows[0]) return res.status(409).json({ error: 'Request already pending' });

    await pool.query(
      `INSERT INTO seller_approvals (user_id) VALUES ($1)`,
      [req.user.id]
    );
    res.status(201).json({ success: true, message: 'Seller request submitted for review' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// GET /api/users/me/notifications
router.get('/me/notifications', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/users/me/notifications/read - mark all read
router.put('/me/notifications/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

module.exports = router;
