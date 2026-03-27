require('dotenv').config();
const pool = require('./pool');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');
    await client.query('BEGIN');

    // Hash password for all demo users
    const passwordHash = await bcrypt.hash('password123', 10);

    // --- Users ---
    const adminId = uuidv4();
    const seller1Id = uuidv4();
    const seller2Id = uuidv4();
    const buyer1Id = uuidv4();
    const buyer2Id = uuidv4();
    const buyer3Id = uuidv4();

    await client.query(`
      INSERT INTO users (id, email, password_hash, name, role) VALUES
      ($1, 'admin@bundl.app', $7, 'Admin User', 'admin'),
      ($2, 'tech_seller@bundl.app', $7, 'TechDeals Store', 'seller'),
      ($3, 'gadget_world@bundl.app', $7, 'Gadget World', 'seller'),
      ($4, 'buyer1@bundl.app', $7, 'Alice Cohen', 'buyer'),
      ($5, 'buyer2@bundl.app', $7, 'Bob Levy', 'buyer'),
      ($6, 'buyer3@bundl.app', $7, 'Carol Mizrahi', 'buyer')
      ON CONFLICT (email) DO NOTHING
    `, [adminId, seller1Id, seller2Id, buyer1Id, buyer2Id, buyer3Id, passwordHash]);

    // --- Products ---
    const prod1Id = uuidv4();
    const prod2Id = uuidv4();
    const prod3Id = uuidv4();
    const prod4Id = uuidv4();
    const prod5Id = uuidv4();
    const prod6Id = uuidv4();
    const prod7Id = uuidv4();

    await client.query(`
      INSERT INTO products (id, name, brand, category, image_url, description, status) VALUES
      ($1, 'iPhone 15 Pro', 'Apple', 'Computing',
        'https://images.unsplash.com/photo-1696446700704-6e72d7b4b4e0?w=400',
        'Apple iPhone 15 Pro with A17 Pro chip, titanium design, and 48MP camera system.', 'active'),
      ($2, 'Samsung Galaxy S24', 'Samsung', 'Computing',
        'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400',
        'Galaxy S24 with Galaxy AI, 50MP camera, and Snapdragon 8 Gen 3.', 'active'),
      ($3, 'Sony WH-1000XM5', 'Sony', 'Audio',
        'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400',
        'Industry-leading noise canceling headphones with 30-hour battery life.', 'active'),
      ($4, 'MacBook Air M3', 'Apple', 'Computing',
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
        'MacBook Air with M3 chip, 18-hour battery, and stunning Liquid Retina display.', 'active'),
      ($5, 'DJI Mini 4 Pro', 'DJI', 'Photography',
        'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400',
        '4K HDR mini drone with omnidirectional obstacle sensing and 34-min flight time.', 'active'),
      ($6, 'LG C3 OLED 55"', 'LG', 'TV & Displays',
        'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=400',
        'OLED evo panel with perfect blacks, 120Hz, and Dolby Vision IQ.', 'active'),
      ($7, 'iPad Pro M4', 'Apple', 'Computing',
        'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400',
        'Ultra Retina XDR OLED display with M4 chip and Apple Pencil Pro support.', 'active')
      ON CONFLICT DO NOTHING
    `, [prod1Id, prod2Id, prod3Id, prod4Id, prod5Id, prod6Id, prod7Id]);

    // --- Purchase Groups ---
    const now = new Date();
    const in2days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const in5days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const in30hours = new Date(now.getTime() + 30 * 60 * 60 * 1000);
    const in20hours = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const group1Id = uuidv4();
    const group2Id = uuidv4();
    const group3Id = uuidv4();
    const group4Id = uuidv4();
    const group5Id = uuidv4();
    const group6Id = uuidv4();

    // Group 1: iPhone 15 Pro - almost full (last chance)
    await client.query(`
      INSERT INTO purchase_groups (id, seller_id, product_id, product_snapshot, price, target_buyers, current_buyers, status, expires_at, pickup_location, pickup_hours)
      VALUES ($1, $2, $3, $4, 3299, 10, 8, 'active', $5, 'Tel Aviv - Dizengoff Center', 'Sun-Thu 10:00-20:00')
    `, [group1Id, seller1Id, prod1Id, JSON.stringify({
      name: 'iPhone 15 Pro', brand: 'Apple', category: 'Computing',
      image_url: 'https://images.unsplash.com/photo-1696446700704-6e72d7b4b4e0?w=400',
      description: 'Apple iPhone 15 Pro with A17 Pro chip, titanium design, and 48MP camera system.'
    }), in30hours]);

    // Group 2: MacBook Air M3 - new today
    await client.query(`
      INSERT INTO purchase_groups (id, seller_id, product_id, product_snapshot, price, target_buyers, current_buyers, status, expires_at, pickup_location, pickup_hours)
      VALUES ($1, $2, $3, $4, 4999, 15, 3, 'active', $5, 'Herzliya - Kanyon', 'Mon-Fri 09:00-18:00')
    `, [group2Id, seller1Id, prod4Id, JSON.stringify({
      name: 'MacBook Air M3', brand: 'Apple', category: 'Computing',
      image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
      description: 'MacBook Air with M3 chip, 18-hour battery, and stunning Liquid Retina display.'
    }), in5days]);

    // Group 3: Sony Headphones - last chance by time
    await client.query(`
      INSERT INTO purchase_groups (id, seller_id, product_id, product_snapshot, price, target_buyers, current_buyers, status, expires_at, pickup_location, pickup_hours)
      VALUES ($1, $2, $3, $4, 999, 20, 14, 'active', $5, 'Ramat Gan - Azrieli', 'Daily 10:00-22:00')
    `, [group3Id, seller2Id, prod3Id, JSON.stringify({
      name: 'Sony WH-1000XM5', brand: 'Sony', category: 'Audio',
      image_url: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400',
      description: 'Industry-leading noise canceling headphones with 30-hour battery life.'
    }), in20hours]);

    // Group 4: DJI Drone - active
    await client.query(`
      INSERT INTO purchase_groups (id, seller_id, product_id, product_snapshot, price, target_buyers, current_buyers, status, expires_at, pickup_location, pickup_hours)
      VALUES ($1, $2, $3, $4, 2799, 8, 2, 'active', $5, 'Jerusalem - Malha Mall', 'Sun-Thu 10:00-21:00')
    `, [group4Id, seller2Id, prod5Id, JSON.stringify({
      name: 'DJI Mini 4 Pro', brand: 'DJI', category: 'Photography',
      image_url: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400',
      description: '4K HDR mini drone with omnidirectional obstacle sensing.'
    }), in7days]);

    // Group 5: LG OLED - last chance (4 spots left)
    await client.query(`
      INSERT INTO purchase_groups (id, seller_id, product_id, product_snapshot, price, target_buyers, current_buyers, status, expires_at, pickup_location, pickup_hours)
      VALUES ($1, $2, $3, $4, 6499, 12, 8, 'active', $5, 'Be''er Sheva - Grand Kenyon', 'Sun-Fri 09:30-21:00')
    `, [group5Id, seller1Id, prod6Id, JSON.stringify({
      name: 'LG C3 OLED 55"', brand: 'LG', category: 'TV & Displays',
      image_url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=400',
      description: 'OLED evo panel with perfect blacks, 120Hz, and Dolby Vision IQ.'
    }), in2days]);

    // Group 6: iPad Pro - new today
    await client.query(`
      INSERT INTO purchase_groups (id, seller_id, product_id, product_snapshot, price, target_buyers, current_buyers, status, expires_at, pickup_location, pickup_hours)
      VALUES ($1, $2, $3, $4, 3799, 10, 1, 'active', $5, 'Tel Aviv - Dizengoff Center', 'Sun-Thu 10:00-20:00')
    `, [group6Id, seller2Id, prod7Id, JSON.stringify({
      name: 'iPad Pro M4', brand: 'Apple', category: 'Computing',
      image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400',
      description: 'Ultra Retina XDR OLED display with M4 chip and Apple Pencil Pro support.'
    }), in7days]);

    // --- Payment methods for buyers ---
    const pm1Id = uuidv4();
    const pm2Id = uuidv4();
    const pm3Id = uuidv4();
    await client.query(`
      INSERT INTO payment_methods (id, user_id, tranzila_token, last4, card_type, is_default) VALUES
      ($1, $4, 'mock_token_alice_001', '4242', 'Visa', true),
      ($2, $5, 'mock_token_bob_001', '1234', 'Mastercard', true),
      ($3, $6, 'mock_token_carol_001', '5678', 'Visa', true)
    `, [pm1Id, pm2Id, pm3Id, buyer1Id, buyer2Id, buyer3Id]);

    // --- Add some memberships to group 1 (iphone - 8 buyers) ---
    const memberIds = [buyer1Id, buyer2Id, buyer3Id];
    for (let i = 0; i < 3; i++) {
      const membershipId = uuidv4();
      await client.query(`
        INSERT INTO group_memberships (id, group_id, buyer_id, payment_method_id, payment_status, joined_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW() - interval '${i+1} hours')
        ON CONFLICT DO NOTHING
      `, [membershipId, group1Id, memberIds[i], [pm1Id, pm2Id, pm3Id][i]]);
    }

    await client.query('COMMIT');
    console.log('✅ Seed complete');
    console.log('\nDemo accounts:');
    console.log('  Admin:  admin@bundl.app / password123');
    console.log('  Seller: tech_seller@bundl.app / password123');
    console.log('  Buyer:  buyer1@bundl.app / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
