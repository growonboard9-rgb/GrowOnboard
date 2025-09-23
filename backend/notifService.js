// notifService.js
require('dotenv').config();
const nodemailer = require('nodemailer');

let admin = null; // injected from server.js
let db = null;

// --- INIT FUNCTION (called from server.js after Firebase is initialized) ---
function init(firebaseAdmin) {
  admin = firebaseAdmin;
  db = admin.firestore();
}

// --- EMAIL (Nodemailer) ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, text, html) {
  if (!process.env.EMAIL_USER) return;
  const info = await transporter.sendMail({
    from: `"GrowOnboard" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return info;
}

// --- FETCH SUBSCRIBERS ---
async function fetchSubscribers() {
  if (!db) throw new Error("Firebase not initialized in notifService");
  const snap = await db.collection('subscribers').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- MAIN NOTIFY FUNCTION ---
async function notifyAll(payload = {}) {
  const subs = await fetchSubscribers();
  const { type, title } = payload; // type expected: 'videos' or 'jobs'

  const titleText = type === 'jobs'
    ? `🎯 New Job Alert: ${title}`
    : `📹 New Video Alert: ${title}`;

  const messagePlain =
    type === 'jobs'
      ? `${title}\n\n${payload.description || ''}\nApply: ${payload.applyLink || ''}\n\n---\nGrowOnboard - Learn.Grow.Acheive`
      : `${title}\nWatch: ${payload.link || ''}\n\n---\nGrowOnboard - Learn.Grow.Acheive`;

  const messageHtml =
    type === 'jobs'
      ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6c63ff;">🎯 New Job Alert</h2>
          <h3 style="color: #333;">${title}</h3>
          <p style="color: #666; line-height: 1.6;">${payload.description || ''}</p>
          <div style="margin: 20px 0;">
            <a href="${payload.applyLink || '#'}" style="background: #6c63ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Apply Now</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">GrowOnboard - Learn.Grow.Acheive</p>
        </div>`
      : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6c63ff;">📹 New Video Alert</h2>
          <h3 style="color: #333;">${title}</h3>
          <div style="margin: 20px 0;">
            <a href="${payload.link || '#'}" style="background: #6c63ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Watch Video</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">GrowOnboard - Learn.Grow.Acheive</p>
        </div>`;

  // Deduplicate by email and filter by subscription type
  const seenEmails = new Set();

  for (const s of subs) {
    if (!s.email || seenEmails.has(s.email)) continue; // skip duplicates
    
    // Check subscription type
    const subscriptionType = String(s.subscriptionType || '').toLowerCase();
    // Send ONLY to exact segment (exclude 'all')
    if (subscriptionType !== String(type).toLowerCase()) continue;
    
    seenEmails.add(s.email);

    try {
      await sendEmail(
        s.email,
        titleText,
        messagePlain,
        messageHtml
      );
    } catch (err) {
      console.error('Notify error for subscriber', s.id, err);
    }
  }
}


module.exports = { init, notifyAll, sendEmail };
