const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/catalog - browse products
router.get('/', async (req, res) => {
  const { search, category, status = 'active' } = req.query;
  try {
    let where = `status = $1`;
    const params = [status];
    let paramIdx = 2;

    if (search) {
      where += ` AND (name ILIKE $${paramIdx} OR brand ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (category) {
      where += ` AND category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    const result = await pool.query(
      `SELECT * FROM products WHERE ${where} ORDER BY name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// GET /api/catalog/categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT category FROM products WHERE status = 'active' ORDER BY category`
    );
    res.json(result.rows.map((r) => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/catalog/suggest - seller suggests new product
router.post('/suggest', auth, requireRole('seller', 'admin'), async (req, res) => {
  const { name, brand, category, image_url, description } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category required' });

  try {
    const result = await pool.query(
      `INSERT INTO products (name, brand, category, image_url, description, status, suggested_by)
       VALUES ($1, $2, $3, $4, $5, 'pending_approval', $6) RETURNING *`,
      [name, brand, category, image_url, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to suggest product' });
  }
});

module.exports = router;
