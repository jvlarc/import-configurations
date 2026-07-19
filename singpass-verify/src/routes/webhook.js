const express = require('express');
const router = express.Router();
const store = require('../services/store');

router.post('/booqable', (req, res) => {
  const event = req.body;
  console.log('Booqable webhook received:', event?.type);

  if (event?.type === 'order.created' || event?.type === 'order.updated') {
    const customerId = event?.data?.relationships?.customer?.data?.id;
    if (customerId) {
      const verification = store.findVerificationByCustomerId(customerId);
      if (!verification) {
        console.log(`Customer ${customerId} is NOT verified — may need Singpass verification`);
      }
    }
  }

  res.json({ received: true });
});

module.exports = router;
