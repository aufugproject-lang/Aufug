# منصة مراجعة جودة المنتج الرقمي

## التشغيل المحلي

```bash
clone the website using github link -> in cmd -> git clone<url>

git pull ( each time starting the project)
npm install (once)
npx playwright install chromium(once)
npm start(each time)
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
