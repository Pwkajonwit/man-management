# Google Apps Script

โปรเจ็กต์นี้ใช้ Google Apps Script เป็นตัวปลุก `POST /api/cron/trigger-report`
แล้วให้ฝั่ง Next.js รวมข้อมูลและส่ง LINE ต่อเอง

ไฟล์ที่ใช้จริง:

- `google-apps-script.js`

วิธีใช้:

1. เปิดไฟล์ `google-apps-script.js`
2. ตรวจค่า `APP_URL` และ `CRON_SECRET` ให้ตรงกับระบบปัจจุบัน
3. วางลงใน Google Apps Script
4. รัน `setupDailyTriggers()` หนึ่งครั้งเพื่อติดตั้ง trigger
5. ระบบจะเรียก `triggerNextjsReport()` อัตโนมัติที่เวลา 08:00 และ 17:00

หมายเหตุ:

- ถ้าขึ้น `404: DEPLOYMENT_NOT_FOUND` แปลว่า Apps Script กำลังยิงไปที่ Vercel URL เก่าหรือ deployment นั้นถูกลบไปแล้ว
- ถ้าคุณเปลี่ยนโดเมนระบบ ให้แก้ `APP_URL` ใน `google-apps-script.js`
- ถ้าคุณเปลี่ยน `CRON_SECRET` ฝั่งแอป ให้แก้ Bearer token ในไฟล์เดียวกันด้วย
