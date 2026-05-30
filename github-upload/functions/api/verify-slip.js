const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/jfif',
  'image/webp'
]);

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function base64ToBlob(imageBase64, contentType) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('ไม่พบรูปภาพสลิป');
  }

  const base64 = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  const binary = atob(base64);

  if (!binary.length) throw new Error('ไฟล์สลิปไม่ถูกต้อง');
  if (binary.length > MAX_IMAGE_BYTES) throw new Error('ไฟล์สลิปต้องมีขนาดไม่เกิน 8MB');

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: contentType });
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

export async function onRequestPost(context) {
  const apiKey = context.env.SLIPOK_API_KEY || '';
  const branchId = context.env.SLIPOK_BRANCH_ID || '';

  if (!apiKey || !branchId) {
    return json(500, {
      ok: false,
      verified: false,
      message: 'ยังไม่ได้ตั้งค่า SLIPOK_API_KEY หรือ SLIPOK_BRANCH_ID บน Cloudflare Pages'
    });
  }

  try {
    const payload = await context.request.json();
    const contentType = payload.contentType || 'image/jpeg';

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return json(400, {
        ok: false,
        verified: false,
        message: 'รองรับเฉพาะไฟล์ JPG, JPEG, PNG, JFIF หรือ WEBP'
      });
    }

    const formData = new FormData();
    const slipFile = base64ToBlob(payload.imageBase64, contentType);
    formData.append('files', slipFile, payload.filename || 'slip.jpg');

    if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
      formData.append('amount', String(Number(payload.amount)));
    }

    formData.append('log', context.env.SLIPOK_LOG === 'false' ? 'false' : 'true');

    const slipOkResponse = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: 'POST',
      headers: { 'x-authorization': apiKey },
      body: formData
    });

    const slipOkResult = await slipOkResponse.json().catch(() => ({}));
    const slipData = slipOkResult.data || {};
    const verified = Boolean(slipOkResponse.ok && slipOkResult.success && slipData.success);

    return json(verified ? 200 : (slipOkResponse.status || 400), {
      ok: verified,
      verified,
      message: slipData.message || slipOkResult.message || 'SlipOK ตรวจสลิปไม่ผ่าน',
      slip: normalizeSlip(slipData, payload.amount),
      code: slipOkResult.code || slipData.code || null
    });
  } catch (error) {
    return json(400, {
      ok: false,
      verified: false,
      message: error.message || 'ตรวจสลิปไม่สำเร็จ'
    });
  }
}

export function onRequest(context) {
  return json(405, { ok: false, verified: false, message: 'Method not allowed' });
}
