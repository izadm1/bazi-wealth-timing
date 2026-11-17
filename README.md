# Bazi Wealth Timing

A Four Pillars (Bazi) website focused on money and wealth timing.

- **Wealth chart**: four pillars, Day Master strength, wealth element, Wealth Vault, Nobleman, favourable elements, ten-year luck pillars with wealth scores.
- **Daily / Monthly / Quarterly / Yearly** wealth reports: scores, best money days and hours, recommended actions, what colour to wear, days to protect cash.

Everything runs in the browser. Saved profiles stay in your own browser (localStorage) and are never uploaded.

`tools/daily-pdf.js` generates the daily PDF report:

```
node tools/daily-pdf.js --date 2026-11-18 --birth "1988-08-15 10:30" --gender M \
  --tz Asia/Kuala_Lumpur --lon 101.69 --zi midnight --name "Me" --out report.html
google-chrome --headless --no-pdf-header-footer --print-to-pdf=report.pdf report.html
```

Scores are a rule-based timing guide using a simplified strength method, not financial advice.
