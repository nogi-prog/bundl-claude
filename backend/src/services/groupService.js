const pool = require('../db/pool');
const { customAlphabet } = require('nanoid');
const paymentService = require('./paymentService');
const notificationService = require('./notificationService');

const generatePickupCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/**
 * Join a group — core transactional logic with row-level locking.
 * Prevents over-filling via SELECT FOR UPDATE.
 */
async function joinGroup(groupId, buyerId, paymentMethodId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the group row to prevent race conditions
    const groupResult = await client.query(
      `SELECT g.*, g.current_buyers, g.target_buyers, g.status, g.expires_at,
              g.product_snapshot->>'name' as product_name
       FROM purchase_groups g
       WHERE g.id = $1
       FOR UPDATE`,
      [groupId]
    );

    const group = groupResult.rows[0];
    if (!group) throw { status: 404, message: 'Group not found' };
    if (group.status !== 'active') throw { status: 400, message: 'Group is no longer accepting buyers' };
    if (new Date(group.expires_at) < new Date()) throw { status: 400, message: 'Group has expired' };
    if (group.current_buyers >= group.target_buyers) throw { status: 400, message: 'Group is already full' };

    // Check buyer not already in group
    const existingMember = await client.query(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND buyer_id = $2',
      [groupId, buyerId]
    );
    if (existingMember.rows[0]) throw { status: 400, message: 'Already a member of this group' };

    // Get payment method
    const pmResult = await client.query(
      'SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2',
      [paymentMethodId, buyerId]
    );
    if (!pmResult.rows[0]) throw { status: 400, message: 'Payment method not found' };

    const pm = pmResult.rows[0];

    // Validate token (mock $0 hold)
    const validation = await paymentService.chargeToken(pm.tranzila_token, 0);
    if (!validation.success) throw { status: 400, message: 'Card validation failed' };

    // Increment buyer count
    const newCount = group.current_buyers + 1;
    await client.query(
      `UPDATE purchase_groups SET current_buyers = $1 WHERE id = $2`,
      [newCount, groupId]
    );

    // Create membership
    const membershipResult = await client.query(
      `INSERT INTO group_memberships (group_id, buyer_id, payment_method_id, payment_status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [groupId, buyerId, paymentMethodId]
    );

    // Get buyer email for notifications
    const buyerResult = await client.query('SELECT email, name FROM users WHERE id = $1', [buyerId]);
    const buyer = buyerResult.rows[0];

    // Notify buyer: join confirmation
    await notificationService.notifyJoinConfirm(
      client, buyerId, group.product_name, buyer.email
    );

    // If target reached, flip status and trigger payment
    if (newCount >= group.target_buyers) {
      await client.query(
        `UPDATE purchase_groups SET status = 'processing_payment' WHERE id = $1`,
        [groupId]
      );
      await client.query('COMMIT');
      // Process payments outside transaction (async, best-effort)
      processGroupPayments(groupId).catch(console.error);
    } else {
      await client.query('COMMIT');
    }

    return { membershipId: membershipResult.rows[0].id, newCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Process payments for all members once group target is hit.
 * Handles the fail-safe: if some payments fail → PENDING_SELLER_DECISION.
 */
async function processGroupPayments(groupId) {
  console.log(`💳 Processing payments for group ${groupId}`);
  const client = await pool.connect();
  try {
    // Get group info
    const groupResult = await client.query(
      `SELECT g.*, g.product_snapshot->>'name' as product_name, u.email as seller_email, u.id as seller_user_id
       FROM purchase_groups g
       JOIN users u ON g.seller_id = u.id
       WHERE g.id = $1`,
      [groupId]
    );
    const group = groupResult.rows[0];

    // Get all memberships with payment methods
    const membershipsResult = await client.query(
      `SELECT gm.*, pm.tranzila_token, u.email, u.id as user_id, u.name
       FROM group_memberships gm
       JOIN payment_methods pm ON gm.payment_method_id = pm.id
       JOIN users u ON gm.buyer_id = u.id
       WHERE gm.group_id = $1 AND gm.payment_status = 'pending'`,
      [groupId]
    );

    let successCount = 0;
    let failCount = 0;

    for (const membership of membershipsResult.rows) {
      const result = await paymentService.chargeToken(membership.tranzila_token, group.price);
      if (result.success) {
        const pickupCode = generatePickupCode();
        await client.query(
          `UPDATE group_memberships SET payment_status = 'charged', pickup_code = $1 WHERE id = $2`,
          [pickupCode, membership.id]
        );
        // Notify buyer: success
        await notificationService.notifyGroupSuccess(
          client, membership.user_id, group.product_name, pickupCode, membership.email
        );
        successCount++;
      } else {
        await client.query(
          `UPDATE group_memberships SET payment_status = 'failed' WHERE id = $1`,
          [membership.id]
        );
        failCount++;
      }
    }

    if (failCount === 0) {
      // All payments succeeded
      await client.query(
        `UPDATE purchase_groups SET status = 'completed' WHERE id = $1`,
        [groupId]
      );
      console.log(`✅ Group ${groupId} completed. All ${successCount} payments succeeded.`);
    } else {
      // Some payments failed → seller must decide
      await client.query(
        `UPDATE purchase_groups SET status = 'pending_seller_decision' WHERE id = $1`,
        [groupId]
      );
      // Notify seller
      await notificationService.notifySellerDecision(
        client, group.seller_user_id, group.product_name, group.seller_email
      );
      console.log(`⚠️ Group ${groupId} has ${failCount} failed payments. Awaiting seller decision.`);
    }
  } catch (err) {
    console.error('Payment processing error:', err);
  } finally {
    client.release();
  }
}

/**
 * Leave a group — enforces the No-Escape Rule.
 */
async function leaveGroup(groupId, buyerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const groupResult = await client.query(
      `SELECT * FROM purchase_groups WHERE id = $1 FOR UPDATE`,
      [groupId]
    );
    const group = groupResult.rows[0];
    if (!group) throw { status: 404, message: 'Group not found' };

    // No-escape rule 1: group already reached target
    if (group.current_buyers >= group.target_buyers) {
      throw { status: 403, message: 'Cannot leave — group has already reached its target' };
    }

    // No-escape rule 2: within 24h of expiry
    const hoursUntilExpiry = (new Date(group.expires_at) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilExpiry <= 24) {
      throw { status: 403, message: 'Cannot leave — group expires within 24 hours' };
    }

    if (!['active'].includes(group.status)) {
      throw { status: 400, message: 'Cannot leave a group in this state' };
    }

    // Remove membership
    const deleteResult = await client.query(
      `DELETE FROM group_memberships WHERE group_id = $1 AND buyer_id = $2 RETURNING id`,
      [groupId, buyerId]
    );
    if (!deleteResult.rows[0]) throw { status: 404, message: 'Membership not found' };

    // Decrement buyer count
    await client.query(
      `UPDATE purchase_groups SET current_buyers = current_buyers - 1 WHERE id = $1`,
      [groupId]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Seller decision after partial payment failure.
 */
async function handleSellerDecision(groupId, sellerId, decision) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const groupResult = await client.query(
      `SELECT * FROM purchase_groups WHERE id = $1 AND seller_id = $2 FOR UPDATE`,
      [groupId, sellerId]
    );
    const group = groupResult.rows[0];
    if (!group) throw { status: 404, message: 'Group not found' };
    if (group.status !== 'pending_seller_decision') {
      throw { status: 400, message: 'Group is not awaiting seller decision' };
    }

    if (decision === 'accept_partial') {
      // Mark group as completed
      await client.query(
        `UPDATE purchase_groups SET status = 'completed' WHERE id = $1`,
        [groupId]
      );
      // Remove failed members
      await client.query(
        `DELETE FROM group_memberships WHERE group_id = $1 AND payment_status = 'failed'`,
        [groupId]
      );
    } else if (decision === 'reopen') {
      // Count failed payments to determine how many spots to re-open
      const failedResult = await client.query(
        `SELECT COUNT(*) FROM group_memberships WHERE group_id = $1 AND payment_status = 'failed'`,
        [groupId]
      );
      const failedCount = parseInt(failedResult.rows[0].count);
      // Remove failed members and reopen spots
      await client.query(
        `DELETE FROM group_memberships WHERE group_id = $1 AND payment_status = 'failed'`,
        [groupId]
      );
      await client.query(
        `UPDATE purchase_groups
         SET status = 'active',
             current_buyers = current_buyers - $1,
             expires_at = NOW() + INTERVAL '7 days'
         WHERE id = $2`,
        [failedCount, groupId]
      );
    } else {
      throw { status: 400, message: 'Invalid decision. Use accept_partial or reopen' };
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { joinGroup, leaveGroup, handleSellerDecision, processGroupPayments };
