const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(__dirname, '..', '..', 'data', 'verifications.json');

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore() {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return { sessions: {}, verifications: [] };
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function writeStore(data) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function saveSession(sessionId, data) {
  const store = readStore();
  store.sessions[sessionId] = { ...data, createdAt: new Date().toISOString() };
  writeStore(store);
}

function getSession(sessionId) {
  const store = readStore();
  return store.sessions[sessionId] || null;
}

function deleteSession(sessionId) {
  const store = readStore();
  delete store.sessions[sessionId];
  writeStore(store);
}

function saveVerification(record) {
  const store = readStore();
  const nricHash = crypto.createHash('sha256').update(record.nric_last4 + record.name).digest('hex').slice(0, 16);
  const entry = {
    id: crypto.randomUUID(),
    ...record,
    nricHash,
    verifiedAt: new Date().toISOString(),
  };
  store.verifications.push(entry);
  writeStore(store);
  return entry;
}

function getVerifications() {
  const store = readStore();
  return store.verifications;
}

function findVerificationByCustomerId(customerId) {
  const store = readStore();
  return store.verifications.find(v => v.booqableCustomerId === customerId) || null;
}

module.exports = {
  saveSession,
  getSession,
  deleteSession,
  saveVerification,
  getVerifications,
  findVerificationByCustomerId,
};
