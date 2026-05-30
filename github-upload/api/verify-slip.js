const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/jfif',
  'image/webp'
]);

function getEnv(name) {
  return (typeof process !== 'undefined' && process.env && process.env[name]) || '';
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);

  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_IMAGE_BYTES * 2) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function decodeBase64Image(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('ไม่พบรูปภาพสลิป');
  }

  const base64 = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) throw new Error('ไฟล์สลิปไม่ถูกต้อง');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('ไฟล์สลิปต้องมีขนาดไม่เกิน 8MB');

  return buffer;
}

function normalizeSlip(data, requestedAmount) {
  return {
    amount: Number(data.amount || requestedAmount || 0),
    transRef: data.transRef || null,
    transDate: data.transDate || null,
    transTime: data.transTime || null,
    transTimestamp: data.transTimestamp || null,
    receivingBank: data.receivingBank || null,
    sendingBank: data.sendingBank || null,
    senderName: data.sender?.displayName || data.sender?.name || null,
    receiverName: data.receiver?.displayName || data.receiver?.name || null,
    message: data.message || null
  };
}

async function verifySlip(payload) {
  const apiKey = getEnv('SLIPOK_API_KEY');
  const branchId = getEnv('SLIPOK_BRANCH_ID');

  if (!apiKey || !branchId) {
    return {
      statusCode: 500,
      body: {
        ok: false,
        verified: false,
        message: 'ยังไม่ได้ตั้งค่า SLIPOK_API_KEY หรือ SLIPOK_BRANCH_ID บน server'
      }
    };
  }

  const contentType = payload.contentType || 'image/jpeg';
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return {
      statusCode: 400,
      body: { ok: false, verified: false, message: 'รองรับเฉพาะไฟล์ JPG, JPEG, PNG, JFIF หรือ WEBP' }
    };
  }

  const imageBuffer = decodeBase64Image(payload.imageBase64);
  const formData = new FormData();
  const file = new Blob([imageBuffer], { type: contentType });
  formData.append('files', file, payload.filename || 'slip.jpg');

  if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
    formData.append('amount', String(Number(payload.amount)));
  }

  const shouldLog = getEnv('SLIPOK_LOG') !== 'false';
  formData.append('log', shouldLog ? 'true' : 'false');

  const slipOkResponse = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
    method: 'POST',
    headers: { 'x-authorization': apiKey },
    body: formData
  });

  const slipOkResult = await slipOkResponse.json().catch(() => ({}));
  const slipData = slipOkResult.data || {};
  const verified = Boolean(slipOkResponse.ok && slipOkResult.success && slipData.success);

  return {
    statusCode: verified ? 200 : (slipOkResponse.status || 400),
    body: {
      ok: verified,
      verified,
      message: slipData.message || slipOkResult.message || 'SlipOK ตรวจสลิปไม่ผ่าน',
      slip: normalizeSlip(slipData, payload.amount),
      code: slipOkResult.code || slipData.code || null
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, verified: false, message: 'Method not allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const result = await verifySlip(payload);
    return json(res, result.statusCode, result.body);
  } catch (error) {
    return json(res, 400, { ok: false, verified: false, message: error.message || 'ตรวจสลิปไม่สำเร็จ' });
  }
};

module.exports.verifySlip = verifySlip;
