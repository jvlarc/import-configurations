#!/usr/bin/env node
// Generates the EC key pairs Singpass FAPI 2.0 requires:
//   - a signing key (ES256) for client assertions / DPoP
//   - an encryption key (ECDH-ES+A256KW) for decrypting the ID token
// Outputs: private keys (PEM, base64 for env vars) + a public JWKS document.
//
// Usage: node scripts/generate-keys.js
// Then copy the printed *_PRIVATE_KEY_B64 values into your .env, and commit
// nothing secret — only the public JWKS is served by the app.

const { generateKeyPair, exportJWK, exportPKCS8, calculateJwkThumbprint } = require('jose');
const fs = require('fs');
const path = require('path');

async function makeKey(use, alg, crv = 'P-256') {
  const { publicKey, privateKey } = await generateKeyPair(alg, { crv, extractable: true });
  const privatePem = await exportPKCS8(privateKey);
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);
  publicJwk.use = use;
  publicJwk.alg = alg;
  publicJwk.kid = kid;
  return { privatePem, publicJwk, kid };
}

async function main() {
  const signing = await makeKey('sig', 'ES256');
  const encryption = await makeKey('enc', 'ECDH-ES+A256KW');

  const jwks = { keys: [signing.publicJwk, encryption.publicJwk] };

  const outDir = path.join(__dirname, '..', 'keys');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'jwks.json'), JSON.stringify(jwks, null, 2));

  console.log('\n=== Public JWKS written to keys/jwks.json (served at /.well-known/jwks.json) ===\n');
  console.log('Add these to your .env (keep secret, never commit):\n');
  console.log('SIGNING_KID=' + signing.kid);
  console.log('ENCRYPTION_KID=' + encryption.kid);
  console.log('SIGNING_PRIVATE_KEY_B64=' + Buffer.from(signing.privatePem).toString('base64'));
  console.log('ENCRYPTION_PRIVATE_KEY_B64=' + Buffer.from(encryption.privatePem).toString('base64'));
  console.log('\nThe signing kid is also used as the client assertion header kid.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
