# منصة مراجعة جودة المنتج الرقمي

## التشغيل المحلي

```bash
npm install
npx playwright install chromium
npm start
```

افتح: http://localhost:3000

## تفعيل الحكم الآلي (اختياري)

```bash
export ANTHROPIC_API_KEY=...
npm start
```

أو ضع السطر `ANTHROPIC_API_KEY=...` في ملف `.env` في جذر المشروع.

## بيانات التجربة

```bash
npm start
```

ثم افتح: http://localhost:3000/results.html?id=demo

## الاختبارات

```bash
npm test
```
