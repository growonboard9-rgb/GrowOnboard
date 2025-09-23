// ----------------- CONFIG -----------------
const API_BASE =
  location.hostname === "localhost" || location.hostname === ""
    ? "http://localhost:5000"
    : "https://YOUR_BACKEND_DOMAIN";

// ----------------- UTILITIES -----------------
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function getYouTubeVideoId(url) {
    if (!url) return null;
    // Regex to find video ID from various YouTube URL formats
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    // Return the video ID if it's 11 characters long
    return (match && match[2].length === 11) ? match[2] : null;
}


// Toast notification system
function showToast(msg, type = "success") {
  const wrap =
    document.getElementById("toastWrap") ||
    (() => {
      const w = document.createElement("div");
      w.id = "toastWrap";
      w.className = "toast-wrap";
      document.body.appendChild(w);
      return w;
    })();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="tmsg">${msg}</span>`;
  wrap.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 30);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ----------------- SAFE FETCH -----------------
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Fetch failed:", url, err);
    showToast("⚠️ Failed to fetch data", "error");
    return [];
  }
}

// ----------------- API -----------------
async function fetchVideos() {
  return safeFetch(`${API_BASE}/api/videos`);
}

async function fetchJobs(category = "") {
  const url =
    `${API_BASE}/api/jobs` +
    (category ? `?category=${encodeURIComponent(category)}` : "");
  return safeFetch(url);
}

// ----------------- UI BUILDERS -----------------
function videoCardHTML(v) {
  let src = v.link || "";
  if (src.includes("watch?v=")) {
    src = src.replace("watch?v=", "embed/");
  }

  const videoId = getYouTubeVideoId(v.link);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
  const thumbStyle = thumbnailUrl ? `style="background-image: url('${thumbnailUrl}')"` : '';

  return `
    <a href="${src}" target="_blank" rel="noopener" class="video-card-link reveal">
      <div class="video-card">
        <div class="video-thumb" ${thumbStyle}>
          <div class="play">▶</div>
        </div>
        <div class="video-body">
          <div class="video-title">${escapeHtml(v.title || "Untitled")}</div>
          <div class="video-meta">${escapeHtml(v.language || "")} • ${escapeHtml(v.category || "")}</div>
        </div>
      </div>
    </a>
  `;
}

function jobCardHTML(j) {
  // Limit description to 150 chars for preview
  const description = j.description ? (j.description.length > 150 ? j.description.substring(0, 150) + '…' : j.description) : '';

  return `
    <div class="job-card reveal">
      <div>
        <div class="job-title">${escapeHtml(j.title)}</div>
        ${j.company ? `<div class="job-company">${escapeHtml(j.company)}</div>` : ''}
      </div>
      ${description ? `<div class="job-description">${escapeHtml(description)}</div>` : ''}
      <div class="job-meta">
        <span class="badge">${escapeHtml(j.category || "General")}</span>
      </div>
      <div class="apply-row">
        <a class="apply-btn" href="${j.applyLink || "#"}" target="_blank" rel="noopener">Apply</a>
        <span class="job-deadline">Deadline: ${escapeHtml(j.deadline || "N/A")}</span>
      </div>
    </div>
  `;
}

// ----------------- INIT -----------------
document.addEventListener("DOMContentLoaded", async () => {
  const videoList = document.getElementById("videoList");
  const jobList = document.getElementById("jobList");
  const langSelect = document.getElementById("langSelect");
  const levelSelect = document.getElementById("levelSelect");

  // Skeleton loaders
  videoList.innerHTML = `<div class="skeleton" style="height:96px"></div>
                         <div class="skeleton" style="height:96px"></div>`;
  jobList.innerHTML = `<div class="skeleton" style="height:120px"></div>
                       <div class="skeleton" style="height:120px"></div>`;

  // ----------------- Jobs -----------------
  async function loadJobs(category = "") {
    jobList.innerHTML = `<p class="empty">⏳ Loading jobs...</p>`;
    const jobs = await fetchJobs(category);
    jobList.innerHTML =
      jobs.length > 0
        ? jobs.map(jobCardHTML).join("")
        : `<div class="empty">No jobs found</div>`;
    revealAnimate();
  }

  // Tabs for jobs
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((t) =>
    t.addEventListener("click", (e) => {
      tabs.forEach((x) => x.classList.remove("active"));
      e.target.classList.add("active");
      const cat = e.target.dataset.cat || "";
      loadJobs(cat);
    })
  );

  // ----------------- Videos -----------------
  let videos = await fetchVideos();
  function renderVideos(list) {
    videoList.innerHTML =
      list.length > 0
        ? list.map(videoCardHTML).join("")
        : `<div class="empty">No videos found</div>`;
    revealAnimate();
  }
  renderVideos(videos);

  // Filter controls
  function applyFilters() {
    let filtered = videos.slice();
    const lang = langSelect.value;
    const lvl = levelSelect.value;
    if (lang)
      filtered = filtered.filter(
        (v) => (v.language || "").toLowerCase() === lang.toLowerCase()
      );
    if (lvl)
      filtered = filtered.filter(
        (v) => (v.category || "").toLowerCase() === lvl.toLowerCase()
      );
    renderVideos(filtered);
  }
  langSelect.addEventListener("change", applyFilters);
  levelSelect.addEventListener("change", applyFilters);

  // ----------------- Subscribe -----------------
  const subscribeForm = document.getElementById("subscribeForm");
  subscribeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(subscribeForm);
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      whatsapp: fd.get("whatsapp"),
      telegram: fd.get("telegram"),
    };
    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) {
        showToast("✅ Subscribed successfully!", "success");
        subscribeForm.reset();
      } else {
        showToast("❌ Failed: " + (j.error || "unknown"), "error");
      }
    } catch (err) {
      showToast("⚠️ Network error. Try again later.", "error");
    }
  });

  // Load initial jobs
  loadJobs();
});

// ----------------- Reveal Animations -----------------
function revealAnimate() {
  document.querySelectorAll(".reveal").forEach((el, i) => {
    setTimeout(() => el.classList.add("in"), i * 80);
  });
}

