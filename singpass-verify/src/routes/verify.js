const express = require('express');
const router = express.Router();
const store = require('../services/store');

router.get('/', (req, res) => {
  const { order_id, customer_id, email } = req.query;
  res.render('verify', { orderId: order_id, customerId: customer_id, email });
});

router.get('/status/:customerId', (req, res) => {
  const verification = store.findVerificationByCustomerId(req.params.customerId);
  res.json({
    verified: !!verification,
    verifiedAt: verification?.verifiedAt || null,
    name: verification?.name || null,
  });
});

module.exports = router;
