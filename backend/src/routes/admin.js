const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const paymentService = require('../services/paymentService');

const adminOnly = [auth, requireRole('admin')];

// GET /api/admin/users
router.get('/users', ...adminOnly, async (req, res) => {
  const { role, status, search } = req.query;
  try {
    let where = '1=1';
    const params = [];
    let i = 1;
    if (role) { where += ` AND role = $${i++}`; params.push(role); }
    if (status) { where += ` AND status = $${i++}`; params.push(status); }
    if (search) { where += ` AND (name ILIKE $${i} OR email ILIKE $${i})`; params.push(`%${search}%`); i++; }

    const result = await pool.query(
      `SELECT id, email, name, role, status, created_at FROM users WHERE ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/freeze
router.put('/users/:id/freeze', ...adminOnly, async (req, res) => {
  try {
    await pool.query(`UPDATE users SET status = 'frozen' WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to freeze user' });
  }
});

// PUT /api/admin/users/:id/unfreeze
router.put('/users/:id/unfreeze', ...adminOnly, async (req, res) => {
  try {
    await pool.query(`UPDATE users SET status = 'active' WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unfreeze user' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1 AND role != 'admin'`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/seller-requests
router.get('/seller-requests', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sa.*, u.name, u.email FROM seller_approvals sa
       JOIN users u ON sa.user_id = u.id
       WHERE sa.status = 'pending' ORDER BY sa.created_at`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// POST /api/admin/seller-requests/:id/approve
router.post('/seller-requests/:id/approve', ...adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE seller_approvals SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2 RETURNING user_id`,
      [req.user.id, req.params.id]
    );
    if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
    await client.query(`UPDATE users SET role = 'seller' WHERE id = $1`, [result.rows[0].user_id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to approve' });
  } finally {
    client.release();
  }
});

// POST /api/admin/seller-requests/:id/reject
router.post('/seller-requests/:id/reject', ...adminOnly, async (req, res) => {
  try {
    await pool.query(
      `UPDATE seller_approvals SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// GET /api/admin/catalog-suggestions
router.get('/catalog-suggestions', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as suggested_by_name FROM products p
       LEFT JOIN users u ON p.suggested_by = u.id
       WHERE p.status = 'pending_approval' ORDER BY p.created_at`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// POST /api/admin/catalog-suggestions/:id/approve
router.post('/catalog-suggestions/:id/approve', ...adminOnly, async (req, res) => {
  try {
    await pool.query(`UPDATE products SET status = 'active' WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve product' });
  }
});

// POST /api/admin/catalog-suggestions/:id/reject
router.post('/catalog-suggestions/:id/reject', ...adminOnly, async (req, res) => {
  try {
    await pool.query(`DELETE FROM products WHERE id = $1 AND status = 'pending_approval'`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject product' });
  }
});

// POST /api/admin/refund/:membershipId
router.post('/refund/:membershipId', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gm.*, g.price FROM group_memberships gm JOIN purchase_groups g ON gm.group_id = g.id
       WHERE gm.id = $1`,
      [req.params.membershipId]
    );
    const membership = result.rows[0];
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.payment_status !== 'charged') return res.status(400).json({ error: 'Payment not charged' });

    const refund = await paymentService.refundTransaction(`TXN_${membership.id}`, membership.price);
    if (!refund.success) return res.status(500).json({ error: 'Refund failed' });

    await pool.query(`UPDATE group_memberships SET payment_status = 'refunded' WHERE id = $1`, [req.params.membershipId]);
    res.json({ success: true, refundId: refund.refundId });
  } catch (err) {
    res.status(500).json({ error: 'Refund failed' });
  }
});

// GET /api/admin/stats
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [users, groups, revenue, pending] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query(`SELECT status, COUNT(*) FROM purchase_groups GROUP BY status`),
      pool.query(`SELECT COALESCE(SUM(g.price), 0) as total FROM group_memberships gm JOIN purchase_groups g ON gm.group_id = g.id WHERE gm.payment_status = 'charged'`),
      pool.query(`SELECT COUNT(*) FROM seller_approvals WHERE status = 'pending'`),
    ]);
    res.json({
      total_users: parseInt(users.rows[0].count),
      groups_by_status: groups.rows,
      total_revenue: parseFloat(revenue.rows[0].total),
      pending_seller_requests: parseInt(pending.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
