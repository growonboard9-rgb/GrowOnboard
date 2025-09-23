require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');   // ✅ keep this only
const path = require('path');

const notif = require('./notifService');

const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

// ---------------- FIREBASE ADMIN INIT ----------------
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
notif.init(admin);


// ---------------- STATIC FILES (FRONTEND) ----------------
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ---------------- ROOT ROUTE ----------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Serve admin dashboard
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/admin.html'));
});

// ---------------- MIDDLEWARE: VERIFY FIREBASE TOKEN ----------------
async function verifyToken(req, res, next) {
  if (process.env.SKIP_AUTH === 'true') return next();

  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.*)$/);
  if (!match) return res.status(401).json({ error: 'Missing token' });

  const idToken = match[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.admin) return res.status(403).json({ error: 'Requires admin privileges' });
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ---------------- PUBLIC ROUTES ----------------
app.get('/api/videos', async (req, res) => {
  try {
    const snap = await db.collection('videos').orderBy('createdAt', 'desc').get();
    const videos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const { category } = req.query;
    let q = db.collection('jobs');
    if (category) q = q.where('category', '==', category);
    q = q.orderBy('createdAt', 'desc');
    const snap = await q.get();
    const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { name, email, whatsapp, telegram, subscriptionType } = req.body;
    if (!email && !whatsapp && !telegram)
      return res.status(400).json({ error: 'Provide at least one contact' });

    const docRef = await db.collection('subscribers').add({
      name: name || '',
      email: email || '',
      whatsapp: whatsapp || '',
      telegram: telegram || '',
      subscriptionType: subscriptionType || 'all', // 'videos', 'jobs', or 'all'
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ---------------- ADMIN ROUTES ----------------
app.use('/api/admin', verifyToken);

// Video routes
app.post('/api/admin/videos', async (req, res) => {
  try {
    const { title, language, category, link } = req.body;
    const docRef = await db.collection('videos').add({
      title,
      language,
      category,
      link,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify only subscribers interested in videos
    notif.notifyAll({ type: 'videos', title, link, language }).catch(console.error);
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add video' });
  }
});

app.put('/api/admin/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('videos').doc(id).update(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

app.delete('/api/admin/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('videos').doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Job routes
app.post('/api/admin/jobs', async (req, res) => {
  try {
    const { title, company, category, jobType, description, applyLink, deadline } = req.body;
    const docRef = await db.collection('jobs').add({
      title,
      company: company || '',
      category: category || 'Private', // Default to Private
      jobType: jobType || '',
      description,
      applyLink,
      deadline,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify only subscribers interested in jobs
    notif.notifyAll({ type: 'jobs', title, applyLink, category: category || 'Private', jobType, description }).catch(console.error);
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add job' });
  }
});

app.get('/api/admin/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('videos').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

app.get('/api/admin/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('jobs').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

app.put('/api/admin/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('jobs').doc(id).update(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

app.delete('/api/admin/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('jobs').doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Subscribers (admin)
app.get('/api/admin/subscribers', async (req, res) => {
  try {
    const snap = await db.collection('subscribers').orderBy('subscribedAt', 'desc').get();
    const subs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(subs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Manual notify (admin)
app.post('/api/admin/notify', async (req, res) => {
  try {
    const payload = req.body; // { type:'job'|'video', title, link...}
    await notif.notifyAll(payload);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Notification failed' });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}/`));
