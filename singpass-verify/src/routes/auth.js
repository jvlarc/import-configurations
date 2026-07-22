const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const singpass = require('../services/singpass');
const booqable = require('../services/booqable');
const store = require('../services/store');

router.get('/login', (req, res) => {
  const { order_id, customer_id, email, return_url } = req.query;

  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const codeVerifier = singpass.generateCodeVerifier();
  const codeChallenge = singpass.generateCodeChallenge(codeVerifier);

  store.saveSession(state, {
    nonce,
    codeVerifier,
    orderId: order_id,
    customerId: customer_id,
    email,
    returnUrl: return_url || process.env.BOOQABLE_RETURN_URL || 'https://www.justrentlah.com',
  });

  res.cookie('sp_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    maxAge: 10 * 60 * 1000,
    sameSite: 'lax',
  });

  const authUrl = singpass.buildAuthorizationUrl(state, nonce, codeChallenge);
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.render('error', {
        title: 'Verification Cancelled',
        message: 'You cancelled the Singpass verification. You can try again anytime.',
        returnUrl: 'https://www.justrentlah.com',
      });
    }

    const savedState = req.signedCookies.sp_state;
    if (!state || state !== savedState) {
      return res.render('error', {
        title: 'Session Expired',
        message: 'Your verification session has expired. Please try again.',
        returnUrl: 'https://www.justrentlah.com',
      });
    }

    const session = store.getSession(state);
    if (!session) {
      return res.render('error', {
        title: 'Session Not Found',
        message: 'Your verification session could not be found. Please try again.',
        returnUrl: 'https://www.justrentlah.com',
      });
    }

    const tokens = await singpass.exchangeCodeForTokens(code, session.codeVerifier);
    const idTokenPayload = await singpass.decryptAndVerifyIdToken(tokens.id_token);

    let personDetails = {
      name: idTokenPayload.name || '',
      nric_last4: (idTokenPayload.sub || '').slice(-4),
    };

    if (tokens.access_token) {
      try {
        const myinfoData = await singpass.fetchMyinfoPersonData(tokens.access_token);
        personDetails = singpass.extractPersonDetails(myinfoData);
      } catch (err) {
        console.warn('Myinfo fetch skipped:', err.message);
      }
    }

    if (session.customerId) {
      try {
        await booqable.updateCustomerVerification(session.customerId, personDetails);
      } catch (err) {
        console.warn('Booqable update skipped:', err.message);
      }
    }

    const verification = store.saveVerification({
      ...personDetails,
      booqableCustomerId: session.customerId || null,
      booqableOrderId: session.orderId || null,
      email: session.email || '',
      singpassSub: idTokenPayload.sub,
    });

    store.deleteSession(state);
    res.clearCookie('sp_state');

    res.render('success', {
      name: personDetails.name,
      verificationId: verification.id,
      returnUrl: session.returnUrl,
    });
  } catch (err) {
    console.error('Callback error:', err);
    res.render('error', {
      title: 'Verification Failed',
      message: 'Something went wrong during verification. Please try again or contact us.',
      returnUrl: 'https://www.justrentlah.com',
    });
  }
});

module.exports = router;
