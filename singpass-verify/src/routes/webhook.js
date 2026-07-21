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

// sgVerify callback — Singpass POSTs the verified person data here after
// the customer scans the counter QR and consents.
router.post('/sgverify', async (req, res) => {
  try {
    const sgverify = require('../services/sgverify');
    const booqable = require('../services/booqable');
    const { state, person } = req.body || {};

    const session = sgverify.getSession(state);
    if (!session) return res.status(404).json({ error: 'unknown or expired session' });

    const result = {
      name: person?.name?.value || person?.name || '',
      nric_last4: (person?.uinfin?.value || person?.uinfin || '').slice(-4),
    };
    sgverify.completeSession(state, result);

    store.saveVerification({
      ...result,
      booqableCustomerId: session.customerId || null,
      booqableOrderId: session.orderId || null,
      email: '',
      singpassSub: null,
      method: 'counter-sgverify',
    });

    if (session.customerId) {
      try {
        await booqable.updateCustomerVerification(session.customerId, result);
      } catch (err) {
        console.warn('Booqable update skipped:', err.message);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('sgVerify webhook error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
