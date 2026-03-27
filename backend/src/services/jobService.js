const pool = require('../db/pool');
const notificationService = require('./notificationService');

/**
 * Check for expired groups and cancel them.
 * Notifies all members. Runs every 60s.
 */
async function checkExpiredGroups() {
  const client = await pool.connect();
  try {
    // Find expired active groups
    const expiredResult = await client.query(
      `SELECT g.id, g.product_snapshot->>'name' as product_name
       FROM purchase_groups g
       WHERE g.status = 'active' AND g.expires_at < NOW()`
    );

    for (const group of expiredResult.rows) {
      console.log(`🕐 Cancelling expired group: ${group.product_name} (${group.id})`);

      // Get all members
      const membersResult = await client.query(
        `SELECT gm.buyer_id, u.email FROM group_memberships gm
         JOIN users u ON gm.buyer_id = u.id
         WHERE gm.group_id = $1`,
        [group.id]
      );

      // Cancel the group
      await client.query(
        `UPDATE purchase_groups SET status = 'cancelled' WHERE id = $1`,
        [group.id]
      );

      // Notify all members
      for (const member of membersResult.rows) {
        await notificationService.notifyGroupCancelled(
          client, member.buyer_id, group.product_name, member.email
        );
      }
    }

    if (expiredResult.rows.length > 0) {
      console.log(`✅ Cancelled ${expiredResult.rows.length} expired group(s)`);
    }
  } catch (err) {
    console.error('Error in checkExpiredGroups:', err);
  } finally {
    client.release();
  }
}

/**
 * Send 24-hour expiry reminders to group members.
 */
async function send24hReminders() {
  const client = await pool.connect();
  try {
    // Groups expiring in 23-25 hours (to avoid duplicate sends)
    const result = await client.query(
      `SELECT g.id, g.product_snapshot->>'name' as product_name,
              g.target_buyers - g.current_buyers as spots_left
       FROM purchase_groups g
       WHERE g.status = 'active'
         AND g.expires_at BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'`
    );

    for (const group of result.rows) {
      const membersResult = await client.query(
        `SELECT gm.buyer_id, u.email FROM group_memberships gm
         JOIN users u ON gm.buyer_id = u.id
         WHERE gm.group_id = $1`,
        [group.id]
      );

      for (const member of membersResult.rows) {
        await notificationService.notifyExpiryReminder(
          client, member.buyer_id, group.product_name, group.spots_left, member.email
        );
      }
    }
  } catch (err) {
    console.error('Error in send24hReminders:', err);
  } finally {
    client.release();
  }
}

function startJobs() {
  console.log('🔄 Background jobs started (60s interval)');
  const run = async () => {
    await checkExpiredGroups();
    await send24hReminders();
  };
  run(); // Run immediately on start
  setInterval(run, 60 * 1000);
}

module.exports = { startJobs };
