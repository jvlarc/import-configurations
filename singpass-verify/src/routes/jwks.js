const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Serves the public JWKS document Singpass fetches to verify our signatures
// and to encrypt the ID token to us. Only PUBLIC keys live here.
// Generate with: node scripts/generate-keys.js
const JWKS_PATH = path.join(__dirname, '..', '..', 'keys', 'jwks.json');

router.get('/jwks.json', (req, res) => {
  try {
    if (!fs.existsSync(JWKS_PATH)) {
      return res.status(503).json({
        error: 'JWKS not generated yet. Run: node scripts/generate-keys.js',
      });
    }
    const jwks = JSON.parse(fs.readFileSync(JWKS_PATH, 'utf8'));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(jwks);
  } catch (err) {
    console.error('JWKS serve error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
