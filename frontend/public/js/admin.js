// admin.js - GrowOnboard
const API_BASE = (location.hostname === 'localhost') ? 'http://localhost:5000' : 'https://YOUR_BACKEND_DOMAIN';

// ---------- Firebase client config ----------
const firebaseConfig = {
    apiKey: "AIzaSyA2l62f8TUs_GMXX7pQPG9NxTe-upcAJ64",
    authDomain: "learninghub-7ac22.firebaseapp.com",
    projectId: "learninghub-7ac22",
    storageBucket: "learninghub-7ac22.firebasestorage.app",
    messagingSenderId: "609739909915",
    appId: "1:609739909915:web:c1adf2550fcb6e8ce401be"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ---------- UI refs ----------
const loginBox = document.getElementById('loginBox');
const adminDashboard = document.getElementById('adminDashboard');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const adminEmailSpan = document.getElementById('adminEmail');
const subsList = document.getElementById('subsList');
const editModal = document.getElementById('editModal');
const editModalTitle = document.getElementById('editModalTitle');
const editForm = document.getElementById('editForm');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// ---------- Login & Logout ----------
btnLogin.addEventListener('click', async () => {
    try {
        const email = emailInput.value;
        const pass = passInput.value;
        const user = await auth.signInWithEmailAndPassword(email, pass);

        // Check admin claim
        const idTokenResult = await user.user.getIdTokenResult();
        if (!idTokenResult.claims.admin) {
            alert('User is not an admin. Add admin custom claim in Firebase console or via Admin SDK.');
            await auth.signOut();
            return;
        }
        initAdminUI(user.user);
    } catch (err) {
        alert('Login failed: ' + err.message);
        console.error(err);
    }
});

btnLogout.addEventListener('click', async () => {
    await auth.signOut();
    location.reload();
});

// ---------- Auth state change ----------
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const token = await user.getIdTokenResult();
        if (!token.claims.admin) {
            console.warn('Signed in user not admin');
            return;
        }
        initAdminUI(user);
    }
});

// ---------- Initialize Admin UI ----------
async function initAdminUI(user) {
    loginBox.style.display = 'none';
    adminDashboard.style.display = 'block';
    adminEmailSpan.textContent = user.email;

    // Initial data load for the active tab
    await handleTabChange('videos');

    // Setup tab listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`${tabName}-panel`).classList.add('active');

            handleTabChange(tabName);
        });
    });
}

async function handleTabChange(tabName) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    if (tabName === 'videos') {
        await refreshAdminVideos(user);
    } else if (tabName === 'jobs') {
        await refreshAdminJobs(user);
    } else if (tabName === 'subscribers') {
        await refreshSubscribers(user);
    } else if (tabName === 'video-subs') {
        await refreshVideoSubscribers(user);
    } else if (tabName === 'job-subs') {
        await refreshJobSubscribers(user);
    }
}

// ---------- API helpers ----------
async function apiPost(path, payload, user) {
    const idToken = await user.getIdToken();
    const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(payload)
    });
    return res.json();
}

async function apiGet(path, user) {
    const idToken = await user.getIdToken();
    const res = await fetch(API_BASE + path, { headers: { Authorization: `Bearer ${idToken}` } });
    return res.json();
}

async function apiDelete(path, user) {
    const idToken = await user.getIdToken();
    const res = await fetch(API_BASE + path, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
    return res.json();
}

async function apiPut(path, payload, user) {
    const idToken = await user.getIdToken();
    const res = await fetch(API_BASE + path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(payload)
    });
    return res.json();
}
// ---------- Subscribers ----------
async function refreshSubscribers(user) {
    const subs = await apiGet('/api/admin/subscribers', user);
    subsList.innerHTML = subs.map(s =>
        `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.02)">
            <strong>${s.name || s.email || s.whatsapp}</strong>
            <div class="small">
                ${s.email || ''} ${s.whatsapp ? ' • ' + s.whatsapp : ''} ${s.telegram ? ' • ' + s.telegram : ''}
            </div>
        </div>`).join('');
}

// Filtered subscriber lists
async function refreshVideoSubscribers(user) {
    const listEl = document.getElementById('videoSubsList');
    if (!listEl) return;
    const subs = await apiGet('/api/admin/subscribers', user);
    const filtered = subs.filter(s => (s.subscriptionType || s.type) === 'videos');
    listEl.innerHTML = filtered.map((s) => `
        <div class="item-card" id="video-subscriber-${s.id || s._id}">
            <div>
                <div class="item-card-title">${s.name || s.email || s.whatsapp || 'Unknown'}</div>
                <div class="item-card-meta">${s.email || ''} ${s.whatsapp ? ' • ' + s.whatsapp : ''} ${s.telegram ? ' • ' + s.telegram : ''}</div>
            </div>
            <div class="item-actions">
                <button class="btn-delete-video-subscriber" data-id="${s.id || s._id}">Delete</button>
            </div>
        </div>
    `).join('');
}

async function refreshJobSubscribers(user) {
    const listEl = document.getElementById('jobSubsList');
    if (!listEl) return;
    const subs = await apiGet('/api/admin/subscribers', user);
    const filtered = subs.filter(s => (s.subscriptionType || s.type) === 'jobs');
    listEl.innerHTML = filtered.map((s) => `
        <div class="item-card" id="job-subscriber-${s.id || s._id}">
            <div>
                <div class="item-card-title">${s.name || s.email || s.whatsapp || 'Unknown'}</div>
                <div class="item-card-meta">${s.email || ''} ${s.whatsapp ? ' • ' + s.whatsapp : ''} ${s.telegram ? ' • ' + s.telegram : ''}</div>
            </div>
            <div class="item-actions">
                <button class="btn-delete-job-subscriber" data-id="${s.id || s._id}">Delete</button>
            </div>
        </div>
    `).join('');
}

// ---------- Videos Admin ----------
async function refreshAdminVideos(user) {
    const videos = await (await fetch(`${API_BASE}/api/videos`)).json();
    const listEl = document.getElementById('videoListAdmin');
    listEl.innerHTML = videos.map(v => `
        <div class="item-card" id="video-item-${v.id}">
            <div>
                <div class="item-card-title">${v.title}</div>
                <div class="item-card-meta">${v.language} | ${v.category}</div>
            </div>
            <div class="item-actions">
                <button class="btn-edit-video" data-id="${v.id}">Edit</button>
                <button class="btn-delete-video" data-id="${v.id}" style="background: #c0392b;">Delete</button>
            </div>
        </div>
    `).join('');
}

// ---------- Jobs Admin ----------
async function refreshAdminJobs(user) {
    const jobs = await (await fetch(`${API_BASE}/api/jobs`)).json();
    const listEl = document.getElementById('jobListAdmin');
    listEl.innerHTML = jobs.map(j => `
        <div class="item-card" id="job-item-${j.id}">
            <div>
                <div class="item-card-title">${j.title}</div>
                <div class="item-card-meta">${j.company || ''} | ${j.category}</div>
            </div>
            <div class="item-actions">
                <button class="btn-edit-job" data-id="${j.id}">Edit</button>
                <button class="btn-delete-job" data-id="${j.id}" style="background: #c0392b;">Delete</button>
            </div>
        </div>
    `).join('');
}

// ---------- Modal & Edit Logic ----------
function closeModal() {
    editModal.classList.remove('show');
}

modalCloseBtn.addEventListener('click', closeModal);
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeModal();
    }
});

async function openVideoEditModal(id, user) {
    const video = await apiGet(`/api/admin/videos/${id}`, user);
    editModalTitle.textContent = 'Edit Video';
    editForm.innerHTML = `
        <input type="hidden" name="id" value="${video.id}">
        <input type="hidden" name="type" value="video">
        <label>Title</label><input name="title" value="${video.title || ''}">
        <label>Language</label><input name="language" value="${video.language || ''}">
        <label>Category</label><input name="category" value="${video.category || ''}">
        <label>Link</label><input name="link" value="${video.link || ''}">
        <button type="submit">Save Changes</button>
    `;
    editModal.classList.add('show');
}

async function openJobEditModal(id, user) {
    const job = await apiGet(`/api/admin/jobs/${id}`, user);
    editModalTitle.textContent = 'Edit Job';
    editForm.innerHTML = `
        <input type="hidden" name="id" value="${job.id}">
        <input type="hidden" name="type" value="job">
        <label>Title</label><input name="title" value="${job.title || ''}">
        <label>Company</label><input name="company" value="${job.company || ''}">
        <label>Category</label>
        <select name="category">
            <option ${job.category === 'Government' ? 'selected' : ''}>Government</option>
            <option ${job.category === 'Private' ? 'selected' : ''}>Private</option>
        </select>
        <label>Description</label><textarea name="description" rows="4">${job.description || ''}</textarea>
        <label>Apply Link</label><input name="applyLink" value="${job.applyLink || ''}">
        <label>Deadline</label><input name="deadline" type="date" value="${job.deadline || ''}">
        <button type="submit">Save Changes</button>
    `;
    editModal.classList.add('show');
}

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) return alert('Not logged in');

    const formData = new FormData(editForm);
    const id = formData.get('id');
    const type = formData.get('type');
    let payload = {};
    let apiPath = '';

    if (type === 'video') {
        payload = {
            title: formData.get('title'),
            language: formData.get('language'),
            category: formData.get('category'),
            link: formData.get('link'),
        };
        apiPath = `/api/admin/videos/${id}`;
        await apiPut(apiPath, payload, user);
        await refreshAdminVideos(user);
    } else if (type === 'job') {
        payload = {
            title: formData.get('title'),
            company: formData.get('company'),
            category: formData.get('category'),
            description: formData.get('description'),
            applyLink: formData.get('applyLink'),
            deadline: formData.get('deadline'),
        };
        apiPath = `/api/admin/jobs/${id}`;
        await apiPut(apiPath, payload, user);
        await refreshAdminJobs(user);
    }
    alert('Item updated successfully!');
    closeModal();
});

// ---------- Event Delegation for Actions ----------
document.addEventListener('click', async (e) => {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Delete Video
    if (e.target.classList.contains('btn-delete-video')) {
        const videoId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this video?')) {
            await apiDelete(`/api/admin/videos/${videoId}`, user);
            document.getElementById(`video-item-${videoId}`).remove();
            alert('Video deleted.');
        }
    }

    // Delete Job
    if (e.target.classList.contains('btn-delete-job')) {
        const jobId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this job?')) {
            await apiDelete(`/api/admin/jobs/${jobId}`, user);
            document.getElementById(`job-item-${jobId}`).remove();
            alert('Job deleted.');
        }
    }

    // Edit Video
    if (e.target.classList.contains('btn-edit-video')) {
        openVideoEditModal(e.target.dataset.id, user);
    }

    // Edit Job
    if (e.target.classList.contains('btn-edit-job')) {
        openJobEditModal(e.target.dataset.id, user);
    }

    // Delete Video Subscriber
    if (e.target.classList.contains('btn-delete-video-subscriber')) {
        const sid = e.target.dataset.id;
        if (confirm('Remove this video subscriber?')) {
            await apiDelete(`/api/admin/subscribers/${sid}`, user);
            const row = document.getElementById(`video-subscriber-${sid}`);
            if (row) row.remove();
            alert('Subscriber removed.');
        }
    }

    // Delete Job Subscriber
    if (e.target.classList.contains('btn-delete-job-subscriber')) {
        const sid = e.target.dataset.id;
        if (confirm('Remove this job subscriber?')) {
            await apiDelete(`/api/admin/subscribers/${sid}`, user);
            const row = document.getElementById(`job-subscriber-${sid}`);
            if (row) row.remove();
            alert('Subscriber removed.');
        }
    }
});
// ---------- Event listeners for admin actions (attach only once) ----------
document.getElementById('btnAddVideo').addEventListener('click', async () => {
    const user = firebase.auth().currentUser;
    if (!user) return alert('Not logged in');

    const payload = {
        title: document.getElementById('v_title').value,
        language: document.getElementById('v_language').value,
        category: document.getElementById('v_category').value,
        link: document.getElementById('v_link').value
    };
    await apiPost('/api/admin/videos', payload, user);
    alert('Video added');
    refreshAdminVideos(user); // Refresh list
});

document.getElementById('btnAddJob').addEventListener('click', async () => {
    const user = firebase.auth().currentUser;
    if (!user) return alert('Not logged in');

    const payload = {
        title: document.getElementById('j_title').value,
        company: document.getElementById('j_company').value,
        category: document.getElementById('j_category').value,
        jobType: document.getElementById('j_jobType').value,
        description: document.getElementById('j_description').value,
        applyLink: document.getElementById('j_applyLink').value,
        deadline: document.getElementById('j_deadline').value
    };
    await apiPost('/api/admin/jobs', payload, user);
    alert('Job added');
    refreshAdminJobs(user); // Refresh list
});

document.getElementById('btnNotify').addEventListener('click', async () => {
    const user = firebase.auth().currentUser;
    if (!user) return alert('Not logged in');

    const payload = {
        type: 'manual',
        title: document.getElementById('notify_title').value,
        description: document.getElementById('notify_msg').value
    };
    await apiPost('/api/admin/notify', payload, user);
    alert('Notification sent (async).');
});

