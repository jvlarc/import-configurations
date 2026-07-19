const express = require('express');
const router = express.Router();
const store = require('../services/store');

function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  res.status(401).send('Invalid credentials');
}

router.get('/', basicAuth, (req, res) => {
  const verifications = store.getVerifications();
  res.render('admin', { verifications });
});

module.exports = router;
