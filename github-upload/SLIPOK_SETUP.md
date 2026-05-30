# SlipOK API setup

หน้า `publish/booking.html` เรียก `POST /api/verify-slip` อยู่แล้ว ไฟล์ backend ที่เพิ่มให้คือ:

- `api/verify-slip.js` สำหรับโฮสต์ที่รองรับ Serverless Function เส้นทาง `/api`
- `functions/api/verify-slip.js` สำหรับ Cloudflare Pages Functions
- `functions/api/send-booking-email.js` สำหรับส่งอีเมลแจ้งเตือนบน Cloudflare Pages Functions
- `netlify/functions/verify-slip.js` สำหรับ Netlify Function
- `publish/_redirects` เพื่อให้ Netlify map `/api/verify-slip` ไปยัง function

ต้องตั้ง Environment Variables บน hosting:

```txt
SLIPOK_API_KEY=...
SLIPOK_BRANCH_ID=...
SLIPOK_LOG=true
RESEND_API_KEY=...
BOOKING_NOTIFY_EMAIL=...
BOOKING_FROM_EMAIL=...
```

ห้ามใส่ SlipOK API key ใน `booking.html` เพราะผู้ใช้เปิดดู source ได้

หมายเหตุสำหรับ Cloudflare Pages: ถ้า deploy ด้วยปุ่ม Upload assets/Direct Upload ใน Dashboard จะเหมาะกับไฟล์ static เท่านั้น และไม่ควรใช้กับระบบตรวจสลิป เพราะ Pages Functions ในโฟลเดอร์ `functions` ต้อง deploy ผ่าน Git integration หรือ Wrangler CLI
