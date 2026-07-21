const crypto = require('crypto');

// sgVerify (Singpass Verify) — in-person QR verification.
// The QR encodes a callback your app hosts; the customer scans it with the
// Singpass app, consents, and Singpass POSTs their verified identity to
// the callback. Docs: https://api.singpass.gov.sg/library/verify/developers/overview

const config = {
  clientId: process.env.SGVERIFY_CLIENT_ID || process.env.SINGPASS_CLIENT_ID,
  qrBaseUrl: process.env.SGVERIFY_QR_BASE_URL || 'https://app.singpass.gov.sg/sgverify',
  callbackUrl: `${process.env.APP_URL || 'http://localhost:3000'}/webhook/sgverify`,
};

// In-memory map of pending counter verification sessions keyed by session ref.
const pendingSessions = new Map();

function createCounterSession({ orderId, customerId, staffNote }) {
  const ref = crypto.randomBytes(12).toString('hex');
  const session = {
    ref,
    orderId: orderId || null,
    customerId: customerId || null,
    staffNote: staffNote || '',
    status: 'pending',
    result: null,
    createdAt: new Date().toISOString(),
  };
  pendingSessions.set(ref, session);
  // expire after 15 minutes
  setTimeout(() => {
    const s = pendingSessions.get(ref);
    if (s && s.status === 'pending') pendingSessions.delete(ref);
  }, 15 * 60 * 1000).unref?.();
  return session;
}

function buildQrPayload(session) {
  // v2 sgVerify QR payload format
  const params = new URLSearchParams({
    callback: config.callbackUrl,
    client_id: config.clientId || 'PENDING_ONBOARDING',
    nonce: session.ref,
    state: session.ref,
    qr_type: 'dynamic',
    v: '2',
  });
  return `${config.qrBaseUrl}?${params.toString()}`;
}

function getSession(ref) {
  return pendingSessions.get(ref) || null;
}

function completeSession(ref, result) {
  const session = pendingSessions.get(ref);
  if (!session) return null;
  session.status = 'verified';
  session.result = result;
  session.verifiedAt = new Date().toISOString();
  return session;
}

function listActiveSessions() {
  return Array.from(pendingSessions.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

module.exports = {
  createCounterSession,
  buildQrPayload,
  getSession,
  completeSession,
  listActiveSessions,
};
