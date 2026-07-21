const express = require('express');
const router = express.Router();
const sgverify = require('../services/sgverify');
const booqable = require('../services/booqable');
const store = require('../services/store');

function staffAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Counter"');
    return res.status(401).send('Authentication required');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Counter"');
  res.status(401).send('Invalid credentials');
}

// Staff counter page: enter/select order, show QR for customer to scan
router.get('/', staffAuth, (req, res) => {
  res.render('counter', { session: null, qrPayload: null, orderId: req.query.order_id || '' });
});

// Start a counter verification session for an order
router.post('/start', staffAuth, (req, res) => {
  const { order_id, customer_id, staff_note } = req.body;
  const session = sgverify.createCounterSession({
    orderId: order_id,
    customerId: customer_id,
    staffNote: staff_note,
  });
  const qrPayload = sgverify.buildQrPayload(session);
  res.render('counter', { session, qrPayload, orderId: order_id || '' });
});

// Polled by the counter page to detect completion
router.get('/status/:ref', staffAuth, (req, res) => {
  const session = sgverify.getSession(req.params.ref);
  if (!session) return res.json({ status: 'expired' });
  res.json({
    status: session.status,
    name: session.result?.name || null,
    nric_last4: session.result?.nric_last4 || null,
    verifiedAt: session.verifiedAt || null,
  });
});

module.exports = router;
