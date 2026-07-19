const { SignJWT, importPKCS8, jwtVerify, createRemoteJWKSet, compactDecrypt, importJWK } = require('jose');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const config = {
  clientId: process.env.SINGPASS_CLIENT_ID,
  redirectUri: process.env.SINGPASS_REDIRECT_URI,
  authUrl: process.env.SINGPASS_AUTH_URL || 'https://stg-id.singpass.gov.sg/auth',
  tokenUrl: process.env.SINGPASS_TOKEN_URL || 'https://stg-id.singpass.gov.sg/token',
  jwksUrl: process.env.SINGPASS_JWKS_URL || 'https://stg-id.singpass.gov.sg/.well-known/keys',
  myinfoUrl: process.env.MYINFO_API_URL || 'https://sandbox.api.myinfo.gov.sg/com/v4',
  myinfoClientId: process.env.MYINFO_CLIENT_ID,
  myinfoApiKey: process.env.MYINFO_API_KEY,
};

let signingKey = null;
let encryptionKey = null;

async function getSigningKey() {
  if (signingKey) return signingKey;
  const pem = Buffer.from(process.env.SIGNING_PRIVATE_KEY_B64 || '', 'base64').toString('utf8');
  signingKey = await importPKCS8(pem, 'ES256');
  return signingKey;
}

async function getEncryptionKey() {
  if (encryptionKey) return encryptionKey;
  const pem = Buffer.from(process.env.ENCRYPTION_PRIVATE_KEY_B64 || '', 'base64').toString('utf8');
  encryptionKey = await importPKCS8(pem, 'ECDH-ES+A256KW');
  return encryptionKey;
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function buildAuthorizationUrl(state, nonce, codeChallenge) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    scope: 'openid',
    redirect_uri: config.redirectUri,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${config.authUrl}?${params.toString()}`;
}

async function buildClientAssertion() {
  const key = await getSigningKey();
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: config.clientId })
    .setIssuer(config.clientId)
    .setSubject(config.clientId)
    .setAudience(config.tokenUrl)
    .setJti(uuidv4())
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(key);
}

async function exchangeCodeForTokens(code, codeVerifier) {
  const clientAssertion = await buildClientAssertion();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
    code_verifier: codeVerifier,
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${errText}`);
  }

  return res.json();
}

async function decryptAndVerifyIdToken(idToken) {
  const encKey = await getEncryptionKey();
  const { plaintext } = await compactDecrypt(idToken, encKey);
  const jws = new TextDecoder().decode(plaintext);

  const JWKS = createRemoteJWKSet(new URL(config.jwksUrl));
  const { payload } = await jwtVerify(jws, JWKS, {
    issuer: config.authUrl.replace('/auth', ''),
    audience: config.clientId,
  });

  return payload;
}

async function fetchMyinfoPersonData(accessToken, sub) {
  const url = `${config.myinfoUrl}/person/${sub}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-API-Key': config.myinfoApiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Myinfo fetch failed: ${res.status} ${errText}`);
  }

  return res.json();
}

function extractPersonDetails(myinfoData) {
  return {
    name: myinfoData?.name?.value || '',
    nric_last4: (myinfoData?.uinfin?.value || '').slice(-4),
    phone: myinfoData?.mobileno?.nbr?.value || '',
    email: myinfoData?.email?.value || '',
    address: formatAddress(myinfoData?.regadd),
    dob: myinfoData?.dob?.value || '',
  };
}

function formatAddress(regadd) {
  if (!regadd) return '';
  const parts = [
    regadd.block?.value,
    regadd.street?.value,
    regadd.floor?.value ? `#${regadd.floor.value}-${regadd.unit?.value || ''}` : '',
    regadd.postal?.value ? `S(${regadd.postal.value})` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

module.exports = {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  decryptAndVerifyIdToken,
  fetchMyinfoPersonData,
  extractPersonDetails,
  generateCodeVerifier,
  generateCodeChallenge,
};
