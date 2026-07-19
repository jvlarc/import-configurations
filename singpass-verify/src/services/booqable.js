const fetch = require('node-fetch');

const BASE_URL = `https://${process.env.BOOQABLE_COMPANY_SLUG || 'justrentlah'}.booqable.com/api/4`;
const API_KEY = process.env.BOOQABLE_API_KEY;

function headers() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

function url(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${BASE_URL}${path}${sep}api_key=${API_KEY}`;
}

async function getCustomer(customerId) {
  const res = await fetch(url(`/customers/${customerId}`), { headers: headers() });
  if (!res.ok) throw new Error(`Booqable getCustomer failed: ${res.status}`);
  return res.json();
}

async function findCustomerByEmail(email) {
  const res = await fetch(url(`/customers?filter[email]=${encodeURIComponent(email)}`), {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Booqable findCustomer failed: ${res.status}`);
  const data = await res.json();
  return data.data?.[0] || null;
}

async function updateCustomerVerification(customerId, verificationData) {
  const payload = {
    data: {
      type: 'customers',
      id: customerId,
      attributes: {
        properties: {
          singpass_verified: 'true',
          singpass_verified_at: new Date().toISOString(),
          verified_name: verificationData.name,
          verified_nric_last4: verificationData.nric_last4,
        },
      },
    },
  };

  const res = await fetch(url(`/customers/${customerId}`), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Booqable updateCustomer failed: ${res.status} ${errText}`);
  }

  return res.json();
}

async function getOrder(orderId) {
  const res = await fetch(url(`/orders/${orderId}`), { headers: headers() });
  if (!res.ok) throw new Error(`Booqable getOrder failed: ${res.status}`);
  return res.json();
}

module.exports = {
  getCustomer,
  findCustomerByEmail,
  updateCustomerVerification,
  getOrder,
};
