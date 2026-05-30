const RESEND_API_URL = 'https://api.resend.com/emails';
const LOGO_URL = 'https://i.ibb.co/gLrBs6nH/dafault-images-account-jpg.png';

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
      if (raw.length > 1024 * 1024) {
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

function detailRow(label, value) {
  return `
    <tr>
      <td style="width:38%;padding:11px 14px;color:#64748b;border-bottom:1px solid #e2e8f0;background:#f8fafc;">${escapeHtml(label)}</td>
      <td style="padding:11px 14px;color:#0f172a;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(value || '-')}</td>
    </tr>
  `;
}

function buildHotelEmail(booking) {
  const paid = Number(booking.amountPaid || 0);
  const total = Number(booking.price || 0);
  const balance = Number(booking.balanceDue || 0);
  const reviewStatus = booking.slipVerified ? 'ตรวจสลิปแล้ว' : 'รอตรวจสลิปโดยแอดมิน';

  const details = [
    ['ชื่อผู้จอง', booking.guestName],
    ['เบอร์โทร', booking.guestPhone],
    ['เช็คอิน', booking.checkin],
    ['เช็คเอาท์', booking.checkout],
    ['ประเภทห้อง', booking.roomTypeName],
    ['ประเภทเตียง', booking.bedType],
    ['ผู้ใหญ่ / เด็ก', `${booking.adults || 0} / ${booking.children || 0}`],
    ['วิธีชำระเงิน', booking.payMethod],
    ['สถานะสลิป', reviewStatus],
    ['หมายเหตุ', booking.note || '-']
  ].map(([label, value]) => detailRow(label, value)).join('');

  return `
    <div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Helvetica Neue',sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;padding:24px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.08);">
          <div style="padding:24px 28px;background:#0f172a;color:#ffffff;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${LOGO_URL}" alt="MG THUNGSONG" width="58" style="display:block;width:58px;height:auto;border-radius:10px;background:#ffffff;">
                </td>
                <td style="vertical-align:middle;text-align:right;">
                  <div style="font-size:20px;font-weight:700;letter-spacing:.02em;">MG <span style="color:#fb923c;">THUNGSONG</span></div>
                  <div style="font-size:11px;color:#cbd5e1;letter-spacing:.18em;text-transform:uppercase;margin-top:4px;">New Web Booking</div>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding:26px 28px 10px;">
            <div style="font-size:13px;color:#f97316;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">มีการจองใหม่</div>
            <h1 style="margin:0;color:#0f172a;font-size:26px;line-height:1.25;">${escapeHtml(booking.guestName)} จอง ${escapeHtml(booking.roomTypeName)}</h1>
            <p style="margin:10px 0 0;color:#64748b;font-size:14px;">กรุณาตรวจสอบรายการและจัดสรรห้องพักในระบบ</p>
          </div>

          <div style="padding:16px 28px 8px;">
            <table style="width:100%;border-collapse:separate;border-spacing:0 10px;">
              <tr>
                <td style="width:33.33%;padding:14px;border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;">
                  <div style="font-size:11px;color:#c2410c;font-weight:700;text-transform:uppercase;">Check-in</div>
                  <div style="font-size:17px;font-weight:700;color:#0f172a;margin-top:4px;">${escapeHtml(booking.checkin)}</div>
                </td>
                <td style="width:33.33%;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                  <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">ยอดรวม</div>
                  <div style="font-size:17px;font-weight:700;color:#0f172a;margin-top:4px;">${formatMoney(total)}</div>
                </td>
                <td style="width:33.33%;padding:14px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;">
                  <div style="font-size:11px;color:#15803d;font-weight:700;text-transform:uppercase;">ชำระแล้ว</div>
                  <div style="font-size:17px;font-weight:700;color:#0f172a;margin-top:4px;">${formatMoney(paid)}</div>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding:10px 28px 28px;">
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              ${details}
              ${detailRow('ยอดคงเหลือ', formatMoney(balance))}
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function sendBookingEmail(booking) {
  const apiKey = getEnv('RESEND_API_KEY');
  const to = getEnv('BOOKING_NOTIFY_EMAIL');
  const from = getEnv('BOOKING_FROM_EMAIL');

  if (!apiKey || !to || !from) {
    return {
      statusCode: 500,
      body: {
        ok: false,
        message: 'ยังไม่ได้ตั้งค่า RESEND_API_KEY, BOOKING_NOTIFY_EMAIL หรือ BOOKING_FROM_EMAIL บน server'
      }
    };
  }

  if (!booking.guestName || !booking.guestPhone || !booking.checkin || !booking.checkout) {
    return {
      statusCode: 400,
      body: { ok: false, message: 'ข้อมูลการจองไม่ครบสำหรับส่งอีเมล' }
    };
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `มีการจองใหม่: ${booking.guestName} (${booking.checkin})`,
      html: buildHotelEmail(booking)
    })
  });

  const result = await response.json().catch(() => ({}));

  return {
    statusCode: response.ok ? 200 : response.status,
    body: {
      ok: response.ok,
      message: response.ok ? 'ส่งอีเมลแจ้งเตือนโรงแรมแล้ว' : (result.message || 'ส่งอีเมลไม่สำเร็จ'),
      id: result.id || null
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, message: 'Method not allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const result = await sendBookingEmail(payload.booking || payload);
    return json(res, result.statusCode, result.body);
  } catch (error) {
    return json(res, 400, { ok: false, message: error.message || 'ส่งอีเมลไม่สำเร็จ' });
  }
};

module.exports.sendBookingEmail = sendBookingEmail;
