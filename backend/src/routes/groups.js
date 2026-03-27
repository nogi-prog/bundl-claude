const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const groupService = require('../services/groupService');

// GET /api/groups - Browse with search, filter, homepage sections
router.get('/', async (req, res) => {
  const { search, category, section, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let where = `g.status = 'active'`;
    const params = [];
    let paramIdx = 1;

    if (search) {
      where += ` AND (g.product_snapshot->>'name' ILIKE $${paramIdx} OR g.product_snapshot->>'brand' ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (category) {
      where += ` AND g.product_snapshot->>'category' = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    // Homepage sections
    if (section === 'today') {
      where += ` AND g.created_at > NOW() - INTERVAL '24 hours'`;
    } else if (section === 'last_chance') {
      where += ` AND (g.expires_at < NOW() + INTERVAL '48 hours' OR (g.target_buyers - g.current_buyers) < 5)`;
    } else if (section === 'recommended') {
      const cat = req.query.user_category || 'Computing';
      where += ` AND g.product_snapshot->>'category' = $${paramIdx}`;
      params.push(cat);
      paramIdx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM purchase_groups g WHERE ${where}`,
      params
    );

    const result = await pool.query(
      `SELECT g.id, g.price, g.target_buyers, g.current_buyers, g.status,
              g.expires_at, g.pickup_location, g.created_at,
              g.product_snapshot,
              u.name as seller_name, u.id as seller_id,
              ROUND(AVG(r.rating), 1) as seller_rating,
              COUNT(r.id) as seller_reviews
       FROM purchase_groups g
       JOIN users u ON g.seller_id = u.id
       LEFT JOIN reviews r ON r.seller_id = u.id
       WHERE ${where}
       GROUP BY g.id, u.name, u.id
       ORDER BY g.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      groups: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/:id - Single group detail
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, u.name as seller_name, u.id as seller_id,
              ROUND(AVG(r.rating), 1) as seller_rating,
              COUNT(DISTINCT r.id) as seller_reviews
       FROM purchase_groups g
       JOIN users u ON g.seller_id = u.id
       LEFT JOIN reviews r ON r.seller_id = u.id
       WHERE g.id = $1
       GROUP BY g.id, u.name, u.id`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// POST /api/groups - Create group (seller only)
router.post('/', auth, requireRole('seller', 'admin'), async (req, res) => {
  const { product_id, price, target_buyers, expires_at, pickup_location, pickup_hours } = req.body;
  if (!product_id || !price || !target_buyers || !expires_at) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Fetch product and create snapshot
    const productResult = await pool.query(
      `SELECT * FROM products WHERE id = $1 AND status = 'active'`,
      [product_id]
    );
    if (!productResult.rows[0]) return res.status(404).json({ error: 'Product not found or not approved' });

    const product = productResult.rows[0];
    const snapshot = {
      name: product.name,
      brand: product.brand,
      category: product.category,
      image_url: product.image_url,
      description: product.description,
    };

    const result = await pool.query(
      `INSERT INTO purchase_groups (seller_id, product_id, product_snapshot, price, target_buyers, expires_at, pickup_location, pickup_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, product_id, JSON.stringify(snapshot), price, target_buyers, expires_at, pickup_location, pickup_hours]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// POST /api/groups/:id/join
router.post('/:id/join', auth, requireRole('buyer', 'admin'), async (req, res) => {
  const { payment_method_id } = req.body;
  if (!payment_method_id) return res.status(400).json({ error: 'payment_method_id required' });

  try {
    const result = await groupService.joinGroup(req.params.id, req.user.id, payment_method_id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to join group' });
  }
});

// DELETE /api/groups/:id/leave
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    await groupService.leaveGroup(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to leave group' });
  }
});

// POST /api/groups/:id/decision (seller decision on partial payments)
router.post('/:id/decision', auth, requireRole('seller', 'admin'), async (req, res) => {
  const { decision } = req.body;
  try {
    await groupService.handleSellerDecision(req.params.id, req.user.id, decision);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to process decision' });
  }
});

// GET /api/groups/:id/members (seller view)
router.get('/:id/members', auth, requireRole('seller', 'admin'), async (req, res) => {
  try {
    const groupCheck = await pool.query(
      'SELECT seller_id FROM purchase_groups WHERE id = $1',
      [req.params.id]
    );
    if (!groupCheck.rows[0]) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role !== 'admin' && groupCheck.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your group' });
    }

    const result = await pool.query(
      `SELECT gm.id, gm.payment_status, gm.pickup_code, gm.joined_at,
              u.name, u.email
       FROM group_memberships gm
       JOIN users u ON gm.buyer_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// GET /api/groups/seller/my - seller's own groups
router.get('/seller/my', auth, requireRole('seller', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, COUNT(gm.id) as member_count
       FROM purchase_groups g
       LEFT JOIN group_memberships gm ON gm.group_id = g.id
       WHERE g.seller_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch seller groups' });
  }
});

module.exports = router;
