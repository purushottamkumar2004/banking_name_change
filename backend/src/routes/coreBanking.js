// backend/src/routes/coreBanking.js
// Mock Core Banking (RPS) API integration.
// In production, replace this with actual bank API calls.
// This module is ONLY ever called from the /approve endpoint — never by AI agents.

/**
 * Simulates a core banking name update request.
 * Logs the call, returns a mock confirmation reference.
 *
 * @param {Object} params
 * @param {string} params.customer_id
 * @param {string} params.old_name
 * @param {string} params.new_name
 * @param {string} params.request_id
 * @param {string} params.approved_by
 */
async function mockCoreBankingUpdate({ customer_id, old_name, new_name, request_id, approved_by }) {
  console.log(`[CoreBanking] Updating name for customer ${customer_id}: "${old_name}" → "${new_name}"`);
  console.log(`[CoreBanking] Authorized by: ${approved_by} | Request: ${request_id}`);

  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 200));

  // Mock successful response
  const reference = `RPS-${Date.now()}-${customer_id.slice(-4).toUpperCase()}`;

  console.log(`[CoreBanking] Success. Reference: ${reference}`);

  return {
    success:           true,
    reference_id:      reference,
    customer_id,
    old_name,
    new_name,
    updated_at:        new Date().toISOString(),
    system:            'MOCK_RPS',
    authorised_by:     approved_by,
    verification_ref:  request_id,
  };
}

module.exports = { mockCoreBankingUpdate };
