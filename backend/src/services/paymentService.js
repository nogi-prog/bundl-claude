/**
 * Mock Tranzila Payment Service
 * Implements the correct interface for easy swap to real Tranzila API.
 * In production: replace the mock functions with real HTTP calls to Tranzila.
 */

// Simulate network delay
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Validate a card token (simulates $0 hold / $1 auth).
 * Returns { valid: bool, token: string, last4: string, cardType: string }
 */
async function validateToken(cardNumber, expiry, cvv) {
  await delay(300);
  // In production: POST to https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi
  // with terminal, token request, card details
  if (cardNumber === '0000000000000000') {
    return { valid: false, error: 'Card declined' };
  }
  const last4 = cardNumber.slice(-4);
  const cardType = cardNumber.startsWith('4') ? 'Visa' : 'Mastercard';
  const token = `mock_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return { valid: true, token, last4, cardType };
}

/**
 * Charge a previously validated token.
 * Returns { success: bool, transactionId: string }
 */
async function chargeToken(token, amountILS) {
  await delay(500);
  // Simulate ~10% failure rate for realism
  if (Math.random() < 0.05) {
    return { success: false, error: 'Insufficient funds' };
  }
  return {
    success: true,
    transactionId: `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  };
}

/**
 * Refund a transaction.
 * Returns { success: bool }
 */
async function refundTransaction(transactionId, amountILS) {
  await delay(300);
  return { success: true, refundId: `REF_${transactionId}` };
}

module.exports = { validateToken, chargeToken, refundTransaction };
