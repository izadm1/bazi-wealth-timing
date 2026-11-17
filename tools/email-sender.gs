/**
 * Bazi Wealth Timing – email sender (Google Apps Script web app)
 *
 * Lets the website email a report PDF from your own Gmail to any address you type.
 *
 * Setup (5 minutes):
 * 1. Go to https://script.google.com and click "New project".
 * 2. Delete the sample code, paste this whole file, and change SENDER_KEY below
 *    to a long secret phrase of your own.
 * 3. Click Deploy > New deployment > type "Web app".
 *    Execute as: Me.  Who has access: Anyone.  Click Deploy and authorise
 *    (Google will ask you to allow sending email as you).
 * 4. Copy the Web app URL (ends in /exec).
 * 5. On the website, open "Email sending" in the left panel, paste the URL and
 *    your secret phrase, and click "Save sender".
 *
 * Only requests carrying your secret phrase are accepted, recipients are
 * limited to 5 per email, and Gmail's own daily sending limit applies.
 */
const SENDER_KEY = 'CHANGE-THIS-TO-A-LONG-SECRET-PHRASE';
const MAX_RECIPIENTS = 5;

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!SENDER_KEY || SENDER_KEY.indexOf('CHANGE-THIS') === 0 || d.key !== SENDER_KEY) {
      return out_('forbidden');
    }
    const to = String(d.to || '')
      .split(/[,;\s]+/)
      .filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); })
      .slice(0, MAX_RECIPIENTS);
    if (!to.length) return out_('no valid recipient');
    const filename = String(d.filename || 'Bazi-Report.pdf').replace(/[^\w.\-]/g, '-');
    const pdf = Utilities.newBlob(Utilities.base64Decode(String(d.pdf || '')), 'application/pdf', filename);
    GmailApp.sendEmail(to.join(','), String(d.subject || 'Bazi Wealth Report').slice(0, 200),
      String(d.body || '').slice(0, 5000), { attachments: [pdf], name: 'Bazi Wealth Timing' });
    return out_('ok');
  } catch (err) {
    return out_('error: ' + err);
  }
}

function out_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
