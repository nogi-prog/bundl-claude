const pool = require('../db/pool');

/**
 * Create an in-app notification + log email to console (mock).
 * In production: replace console.log with real Nodemailer SMTP call.
 */
async function sendNotification(client, userId, type, title, message, emailData = null) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)`,
    [userId, type, title, message]
  );

  // Mock email: log to console (replace with nodemailer in production)
  if (emailData) {
    console.log(`📧 [EMAIL] To: ${emailData.to} | Subject: ${title}`);
    console.log(`   ${message}`);
  }
}

async function notifyJoinConfirm(client, userId, groupName, userEmail) {
  await sendNotification(
    client, userId, 'join_confirm',
    `You joined: ${groupName}`,
    `You've successfully joined the group buy for ${groupName}. Your card has been validated and will only be charged if the group reaches its target.`,
    { to: userEmail }
  );
}

async function notifyGroupSuccess(client, userId, groupName, pickupCode, userEmail) {
  await sendNotification(
    client, userId, 'group_success',
    `Group buy succeeded: ${groupName}`,
    `Great news! The group buy for ${groupName} has reached its target. Your pickup code is: ${pickupCode}`,
    { to: userEmail }
  );
}

async function notifyGroupCancelled(client, userId, groupName, userEmail) {
  await sendNotification(
    client, userId, 'group_cancelled',
    `Group buy cancelled: ${groupName}`,
    `Unfortunately, the group buy for ${groupName} did not reach its target and has been cancelled. No charge was made to your card.`,
    { to: userEmail }
  );
}

async function notifyExpiryReminder(client, userId, groupName, spotsLeft, userEmail) {
  await sendNotification(
    client, userId, 'expiry_reminder',
    `24 hours left: ${groupName}`,
    `The group buy for ${groupName} expires in 24 hours. ${spotsLeft} spots still needed. Share with friends!`,
    { to: userEmail }
  );
}

async function notifySellerDecision(client, userId, groupName, userEmail) {
  await sendNotification(
    client, userId, 'seller_decision',
    `Action required: ${groupName}`,
    `The group buy for ${groupName} has reached its target but some payments failed. Please decide whether to proceed with partial group or re-open the remaining spots.`,
    { to: userEmail }
  );
}

module.exports = {
  notifyJoinConfirm,
  notifyGroupSuccess,
  notifyGroupCancelled,
  notifyExpiryReminder,
  notifySellerDecision,
};
