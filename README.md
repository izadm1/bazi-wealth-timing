# Bazi Wealth Timing

A Four Pillars (Bazi) website focused on money and wealth timing.

- **Wealth chart**: four pillars, Day Master strength, wealth element, Wealth Vault, Nobleman, favourable elements, ten-year luck pillars with wealth scores.
- **Daily / Monthly / Quarterly / Yearly** wealth reports: scores, best money days and hours, recommended actions, what colour to wear, days to protect cash.

Every report has **Copy text**, **Download PDF** and **Email report** buttons. Download works on iPhone and Android (Safari/Chrome open the PDF; use Share > Save to Files to keep it).

## Emailing reports

**Email report** asks for a recipient address. It works in two ways:

1. **Direct from your Gmail (recommended):** set up the small sender in `tools/email-sender.gs` (instructions at the top of that file, about 5 minutes), then paste its web-app address and your secret phrase under *Email sending* in the left panel. Reports are then sent straight from your Gmail with the PDF attached.
2. **Without the sender:** on iPhone/Mac the share sheet opens with the PDF (choose Mail; the recipient is copied to your clipboard). Elsewhere the PDF downloads and an email draft to the recipient opens for you to attach it.

Everything runs in the browser. Saved profiles stay in your own browser (localStorage) and are never uploaded.

`tools/daily-pdf.js` generates the daily PDF report:

```
node tools/daily-pdf.js --date 2026-11-18 --birth "1988-08-15 10:30" --gender M \
  --tz Asia/Kuala_Lumpur --lon 101.69 --zi midnight --name "Me" --out report.html
google-chrome --headless --no-pdf-header-footer --print-to-pdf=report.pdf report.html
```

Scores are a rule-based timing guide using a simplified strength method, not financial advice.
