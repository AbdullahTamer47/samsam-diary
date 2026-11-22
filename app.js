// ==========================================
// دفتر ذكريات صمصم | 3D Interactive Flipbook
// ==========================================

const STORAGE_KEY = "sama_samsam_memories_v2";
const IDB_NAME = "SamaDiaryDB";
const IDB_STORE = "bookDataStore";

let bookData = JSON.parse(JSON.stringify(window.DEFAULT_BOOK_DATA));
let currentLeaf = 0;
let totalLeaves = 0;
let soundEnabled = true;
let audioCtx = null;
let activeSongBtn = null;
let pendingCompressedImage = "";

// عناصر DOM
const bookEl = document.getElementById("book");
const bookSceneEl = document.getElementById("bookScene");
const pageCounterEl = document.getElementById("pageCounter");
const progressFillEl = document.getElementById("progressFill");
const progressTrackEl = document.getElementById("progressTrack");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const soundToggleBtn = document.getElementById("soundToggleBtn");
const soundIcon = document.getElementById("soundIcon");
const offlinePill = document.getElementById("offlinePill");

const lightboxModal = document.getElementById("lightboxModal");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCaption = document.getElementById("lightboxCaption");
const closeLightbox = document.getElementById("closeLightbox");

const studioModal = document.getElementById("studioModal");
const openStudioBtn = document.getElementById("openStudioBtn");
const closeStudio = document.getElementById("closeStudio");

// ==========================================
// تخزين IndexedDB (يدعم مئات الصور أوفلاين بدون مشاكل المساحة)
// ==========================================
function openDiaryDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("No IndexedDB"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadBookDataAsync() {
  try {
    const db = await openDiaryDB();
    const data = await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (data) {
      bookData = data;
      return;
    }
  } catch (e) {
    console.warn("IndexedDB fallback:", e);
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      bookData = JSON.parse(saved);
    }
  } catch (e) {
    console.warn("localStorage read error:", e);
  }
}

async function saveBookData() {
  try {
    const db = await openDiaryDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(bookData, STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookData));
    } catch (err) {
      alert("تعذر حفظ البيانات في المتصفح.");
    }
  }
}

// ==========================================
// صوت تقليب الصفحات عبر Web Audio API
// ==========================================
function playFlipSound() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    const duration = 0.16;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.12;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 1.2;

    noise.connect(filter);
    filter.connect(audioCtx.destination);
    noise.start();
  } catch (e) {
    // تجاهل إذا المتصفح منع الصوت
  }
}

// ==========================================
// بناء صفحات الكتاب ثلاثي الأبعاد
// ==========================================
function renderBook() {
  bookEl.innerHTML = "";
  const pages = bookData.pages || [];
  const leavesData = [];

  // الورقة الأولى: الغلاف الأمامي + أول صفحة داخلية
  const firstPage = pages[0] || createEmptyPage();
  leavesData.push({
    front: { isCover: true },
    back: firstPage
  });

  // باقي الصفحات
  for (let i = 1; i < pages.length; i += 2) {
    const frontPage = pages[i];
    const backPage = pages[i + 1] || { isEndCover: true };
    leavesData.push({
      front: frontPage,
      back: backPage
    });
  }

  if (pages.length % 2 === 1) {
    leavesData.push({
      front: { isEndPage: true },
      back: { isEndCover: true }
    });
  }

  totalLeaves = leavesData.length;
  if (currentLeaf > totalLeaves) currentLeaf = totalLeaves;

  leavesData.forEach((leafInfo, idx) => {
    const leaf = document.createElement("div");
    leaf.className = "leaf";
    if (idx < currentLeaf) leaf.classList.add("flipped");
    leaf.dataset.index = idx;

    const frontFace = createFaceElement(leafInfo.front, "page-front", idx * 2);
    const backFace = createFaceElement(leafInfo.back, "page-back", idx * 2 + 1);

    leaf.appendChild(frontFace);
    leaf.appendChild(backFace);

    leaf.addEventListener("click", (e) => {
      if (e.target.closest("button, .photo-frame, .secret-envelope, a, input")) return;
      if (idx === currentLeaf) {
        goNext();
      } else if (idx === currentLeaf - 1) {
        goPrev();
      }
    });

    bookEl.appendChild(leaf);
  });

  updateBookState();
}

function createEmptyPage() {
  return {
    type: "note",
    theme: "blush",
    title: "كل حاجة تخصك 🌸",
    text: "اضغطي على (إضافة ذكرى) بالأعلى عشان تبدأي تحفظي صورك وذكرياتك."
  };
}

function createFaceElement(data, faceClass, pageNumber) {
  const face = document.createElement("div");

  if (data.isCover) {
    face.className = `page-face ${faceClass} cover-face`;
    face.innerHTML = `
      <div class="cover-frame">
        <div class="cover-ribbon">${escapeHtml(bookData.cover.badge || "Sama's Personal Diary")}</div>
        <div class="cover-heart-emblem">
          <span class="material-symbols-rounded">favorite</span>
        </div>
        <h2 class="cover-title">${escapeHtml(bookData.cover.title || "دفتر ذكريات صمصم")}</h2>
        <p class="cover-sub">${escapeHtml(bookData.cover.subtitle || "")}</p>
        <div class="cover-cta">اضغطي لفتح الدفتر</div>
      </div>
    `;
    return face;
  }

  if (data.isEndCover || data.isEndPage) {
    face.className = `page-face ${faceClass} cover-face`;
    face.innerHTML = `
      <div class="cover-frame">
        <div class="cover-heart-emblem">
          <span class="material-symbols-rounded">auto_awesome</span>
        </div>
        <h2 class="cover-title">ولسه صفحاتك مكملة...</h2>
        <p class="cover-sub">كل يوم فرصة لذكريات وصور جديدة تخصك يا صمصم 🌸</p>
      </div>
    `;
    return face;
  }

  const theme = data.theme || "blush";
  face.className = `page-face ${faceClass} theme-${theme}`;

  const metaHtml = `
    <div class="page-header-meta">
      <span class="page-title-badge">${escapeHtml(data.title || "ذكرى")}</span>
      <span class="page-num-tag">#${pageNumber}</span>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "page-body";

  if (data.type === "photo-note") {
    if (data.image) {
      const frame = document.createElement("div");
      frame.className = "photo-frame";
      frame.innerHTML = `<img src="${data.image}" alt="${escapeHtml(data.title || "صورة")}" loading="lazy" />`;
      frame.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(data.image, data.text || data.title || "");
      });
      body.appendChild(frame);
    }
    if (data.text) {
      const p = document.createElement("p");
      p.className = "memory-text";
      p.textContent = data.text;
      body.appendChild(p);
    }
  } else if (data.type === "song") {
    const card = document.createElement("div");
    card.className = "song-card";
    const coverImg = data.image || "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#ff62a5"/><text x="60" y="75" font-size="48" text-anchor="middle">🎧</text></svg>`);
    card.innerHTML = `
      <div class="vinyl-wrap">
        <img class="vinyl-cover" src="${coverImg}" alt="غلاف الأغنية" />
      </div>
      <div class="song-title">${escapeHtml(data.songName || "أغنية مفضلة")}</div>
      <div class="song-controls">
        <button type="button" class="song-play-btn" title="تشغيل / إيقاف">
          <span class="material-symbols-rounded">play_arrow</span>
        </button>
        <div class="equalizer">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
    `;

    const playBtn = card.querySelector(".song-play-btn");
    const vinyl = card.querySelector(".vinyl-wrap");
    const eq = card.querySelector(".equalizer");

    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSongCard(playBtn, vinyl, eq);
    });

    body.appendChild(card);
    if (data.text) {
      const p = document.createElement("p");
      p.className = "memory-text";
      p.textContent = data.text;
      body.appendChild(p);
    }
  } else if (data.type === "secret") {
    const env = document.createElement("div");
    env.className = "secret-envelope";
    env.innerHTML = `
      <span class="env-icon">
        <span class="material-symbols-rounded">mail</span>
      </span>
      <strong>اضغطي هنا لفتح الرسالة</strong>
      <div class="secret-revealed">${escapeHtml(data.text || "")}</div>
    `;
    env.addEventListener("click", (e) => {
      e.stopPropagation();
      env.classList.toggle("opened");
      if (env.classList.contains("opened")) {
        spawnSparkleBurst(e.clientX, e.clientY);
      }
    });
    body.appendChild(env);
  } else {
    const noteBox = document.createElement("div");
    noteBox.className = "note-box";
    noteBox.innerHTML = `<p class="memory-text">${escapeHtml(data.text || "")}</p>`;
    body.appendChild(noteBox);
  }

  face.innerHTML = metaHtml;
  face.appendChild(body);
  return face;
}

// ==========================================
// منطق التقليب وتحديث الـ z-index
// ==========================================
function updateBookState(animatingIdx = -1) {
  const leaves = bookEl.querySelectorAll(".leaf");
  leaves.forEach((leaf, i) => {
    if (i < currentLeaf) {
      leaf.classList.add("flipped");
    } else {
      leaf.classList.remove("flipped");
    }

    if (i === animatingIdx) {
      leaf.style.zIndex = totalLeaves + 15;
    } else if (i < currentLeaf) {
      leaf.style.zIndex = i + 1;
    } else {
      leaf.style.zIndex = totalLeaves - i;
    }
  });

  if (animatingIdx !== -1) {
    setTimeout(() => {
      const target = leaves[animatingIdx];
      if (!target) return;
      target.style.zIndex =
        animatingIdx < currentLeaf ? animatingIdx + 1 : totalLeaves - animatingIdx;
    }, 420);
  }

  const isDesktop = window.innerWidth > 820;
  if (isDesktop) {
    if (currentLeaf === 0) {
      bookEl.style.transform = "translateX(0)";
    } else if (currentLeaf === totalLeaves) {
      bookEl.style.transform = "translateX(-100%)";
    } else {
      bookEl.style.transform = "translateX(-50%)";
    }
  } else {
    bookEl.style.transform = "translateX(0)";
  }

  if (currentLeaf === 0) {
    pageCounterEl.textContent = "الغلاف";
  } else if (currentLeaf === totalLeaves) {
    pageCounterEl.textContent = "النهاية";
  } else {
    pageCounterEl.textContent = `صفحة ${currentLeaf} من ${totalLeaves}`;
  }

  const pct = totalLeaves > 0 ? (currentLeaf / totalLeaves) * 100 : 0;
  progressFillEl.style.width = `${pct}%`;

  prevBtn.disabled = currentLeaf <= 0;
  nextBtn.disabled = currentLeaf >= totalLeaves;
}

function goNext() {
  if (currentLeaf >= totalLeaves) return;
  const animatingIdx = currentLeaf;
  currentLeaf++;
  playFlipSound();
  updateBookState(animatingIdx);
}

function goPrev() {
  if (currentLeaf <= 0) return;
  currentLeaf--;
  const animatingIdx = currentLeaf;
  playFlipSound();
  updateBookState(animatingIdx);
}

prevBtn.addEventListener("click", goPrev);
nextBtn.addEventListener("click", goNext);

document.addEventListener("keydown", (e) => {
  if (studioModal.classList.contains("open") || lightboxModal.classList.contains("open")) return;
  if (e.key === "ArrowLeft") goNext();
  if (e.key === "ArrowRight") goPrev();
});

let touchStartX = 0;
bookSceneEl.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].clientX;
}, { passive: true });

bookSceneEl.addEventListener("touchend", (e) => {
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(diff) > 45) {
    if (diff > 0) goNext();
    else goPrev();
  }
}, { passive: true });

progressTrackEl.addEventListener("click", (e) => {
  const rect = progressTrackEl.getBoundingClientRect();
  const clickX = rect.right - e.clientX;
  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
  currentLeaf = Math.round(ratio * totalLeaves);
  playFlipSound();
  updateBookState();
});

window.addEventListener("resize", () => updateBookState());

// ==========================================
// الصوت وتشغيل بطاقة الأغنية
// ==========================================
soundToggleBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? "volume_up" : "volume_off";
});

function toggleSongCard(btn, vinyl, eq) {
  const isPlayingThis = btn.dataset.playing === "true";
  const iconEl = btn.querySelector(".material-symbols-rounded");

  if (activeSongBtn && activeSongBtn !== btn) {
    activeSongBtn.dataset.playing = "false";
    activeSongBtn.querySelector(".material-symbols-rounded").textContent = "play_arrow";
    activeSongBtn.closest(".song-card").querySelector(".vinyl-wrap").classList.remove("spinning");
    activeSongBtn.closest(".song-card").querySelector(".equalizer").classList.remove("active");
  }

  if (isPlayingThis) {
    btn.dataset.playing = "false";
    iconEl.textContent = "play_arrow";
    vinyl.classList.remove("spinning");
    eq.classList.remove("active");
    activeSongBtn = null;
  } else {
    btn.dataset.playing = "true";
    iconEl.textContent = "pause";
    vinyl.classList.add("spinning");
    eq.classList.add("active");
    activeSongBtn = btn;
  }
}

// ==========================================
// نافذة تكبير الصور (Lightbox)
// ==========================================
function openLightbox(src, caption) {
  lightboxImg.src = src;
  lightboxCaption.textContent = caption;
  lightboxModal.classList.add("open");
}

closeLightbox.addEventListener("click", () => lightboxModal.classList.remove("open"));
lightboxModal.addEventListener("click", (e) => {
  if (e.target === lightboxModal) lightboxModal.classList.remove("open");
});

// ==========================================
// استوديو الذكريات البسيط
// ==========================================
openStudioBtn.addEventListener("click", () => {
  renderManageList();
  studioModal.classList.add("open");
});

closeStudio.addEventListener("click", () => studioModal.classList.remove("open"));
studioModal.addEventListener("click", (e) => {
  if (e.target === studioModal) studioModal.classList.remove("open");
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

const memTypeEl = document.getElementById("memType");
const imageInputRow = document.getElementById("imageInputRow");
const songInputRow = document.getElementById("songInputRow");

memTypeEl.addEventListener("change", () => {
  const val = memTypeEl.value;
  imageInputRow.classList.toggle("hidden", val !== "photo-note" && val !== "song");
  songInputRow.classList.toggle("hidden", val !== "song");
});

let selectedTheme = "blush";
document.querySelectorAll(".theme-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    document.querySelectorAll(".theme-dot").forEach((d) => d.classList.remove("active"));
    dot.classList.add("active");
    selectedTheme = dot.dataset.theme;
  });
});

const fileInputEl = document.getElementById("memImageFile");
const uploadPreviewWrap = document.getElementById("uploadPreviewWrap");
const uploadPreviewImg = document.getElementById("uploadPreviewImg");
const uploadLabelText = document.getElementById("uploadLabelText");
const clearPreviewBtn = document.getElementById("clearPreviewBtn");

fileInputEl.addEventListener("change", async () => {
  const file = fileInputEl.files && fileInputEl.files[0];
  if (!file) return;
  uploadLabelText.textContent = "جاري تجهيز الصورة...";
  try {
    pendingCompressedImage = await compressImage(file, 1000, 0.8);
    uploadPreviewImg.src = pendingCompressedImage;
    uploadPreviewWrap.classList.remove("hidden");
    uploadLabelText.textContent = "تم اختيار الصورة بنجاح ✓";
  } catch (err) {
    alert("تعذر قراءة الصورة، جربي صورة أخرى.");
    resetImagePreview();
  }
});

clearPreviewBtn.addEventListener("click", () => {
  resetImagePreview();
});

function resetImagePreview() {
  pendingCompressedImage = "";
  fileInputEl.value = "";
  uploadPreviewImg.src = "";
  uploadPreviewWrap.classList.add("hidden");
  uploadLabelText.textContent = "اضغطي لاختيار صورة من جهازك";
}

document.getElementById("addMemoryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const type = memTypeEl.value;
  const title = document.getElementById("memTitle").value.trim() || "ذكرى حلوة 🌸";
  const text = document.getElementById("memText").value.trim();
  const songName = document.getElementById("memSongName").value.trim();

  let image = pendingCompressedImage;
  if (!image && fileInputEl.files && fileInputEl.files[0]) {
    image = await compressImage(fileInputEl.files[0], 1000, 0.8);
  }

  bookData.pages.push({
    id: "p_" + Date.now(),
    type,
    theme: selectedTheme,
    title,
    text,
    image,
    songName
  });

  await saveBookData();
  renderBook();
  renderManageList();
  e.target.reset();
  resetImagePreview();
  studioModal.classList.remove("open");
});

// ضغط الصور تلقائياً عشان تشتغل بسلاسة وتتحفظ أوفلاين بدون مشاكل مساحة
function compressImage(file, maxSize = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (file.type === "image/svg+xml" || file.size < 180 * 1024) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function renderManageList() {
  const listEl = document.getElementById("manageList");
  listEl.innerHTML = "";
  if (!bookData.pages.length) {
    listEl.innerHTML = `<p style="text-align:center;color:#f3c4da;">لا توجد صفحات بعد.</p>`;
    return;
  }
  bookData.pages.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "manage-item";
    item.innerHTML = `
      <div class="manage-info">
        <strong>${idx + 1}. ${escapeHtml(p.title || "صفحة")}</strong>
        <span>${escapeHtml(p.text || p.songName || p.type)}</span>
      </div>
      <button type="button" class="delete-item-btn">
        <span class="material-symbols-rounded" style="font-size:16px">delete</span>
        <span>حذف</span>
      </button>
    `;
    item.querySelector(".delete-item-btn").addEventListener("click", () => {
      bookData.pages.splice(idx, 1);
      saveBookData();
      renderBook();
      renderManageList();
    });
    listEl.appendChild(item);
  });
}

// ==========================================
// جزيئات الخلفية الناعمة
// ==========================================
function initParticles() {
  const canvas = document.getElementById("bg-particles");
  const ctx = canvas.getContext("2d");
  let w = (canvas.width = window.innerWidth);
  let h = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  const particles = Array.from({ length: 26 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 7 + Math.random() * 10,
    speedY: 0.3 + Math.random() * 0.65,
    speedX: (Math.random() - 0.5) * 0.35,
    opacity: 0.16 + Math.random() * 0.35,
    char: Math.random() > 0.4 ? "✦" : "♡"
  }));

  function animate() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffb3d6";
    particles.forEach((p) => {
      ctx.globalAlpha = p.opacity;
      ctx.font = `${p.size}px Arial`;
      ctx.fillText(p.char, p.x, p.y);
      p.y -= p.speedY;
      p.x += p.speedX;
      if (p.y < -20) {
        p.y = h + 20;
        p.x = Math.random() * w;
      }
    });
    requestAnimationFrame(animate);
  }
  animate();
}

function spawnSparkleBurst(x, y) {
  for (let i = 0; i < 10; i++) {
    const el = document.createElement("span");
    el.textContent = i % 2 === 0 ? "✦" : "♡";
    el.style.position = "fixed";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.color = "#ff9ec7";
    el.style.pointerEvents = "none";
    el.style.zIndex = "999";
    el.style.fontSize = "16px";
    el.style.transition = "transform 0.8s ease-out, opacity 0.8s ease-out";
    document.body.appendChild(el);

    const angle = (Math.PI * 2 * i) / 10;
    const dist = 40 + Math.random() * 45;
    requestAnimationFrame(() => {
      el.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 15}px) scale(1.25)`;
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 850);
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================================
// وضع الأوفلاين والأونلاين والمزامنة (PWA + BroadcastChannel)
// ==========================================
const syncChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("samsam_sync") : null;
const toastBanner = document.getElementById("toastBanner");
const syncStatusIcon = document.getElementById("syncStatusIcon");
const syncStatusTitle = document.getElementById("syncStatusTitle");
const syncStatusDesc = document.getElementById("syncStatusDesc");
const exportBackupBtn = document.getElementById("exportBackupBtn");
const importBackupInput = document.getElementById("importBackupInput");

function showToast(msg) {
  if (!toastBanner) return;
  toastBanner.textContent = msg;
  toastBanner.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastBanner.classList.add("hidden"), 2800);
}

function updateOnlineStatus(justCameOnline = false) {
  const isOnline = navigator.onLine;
  if (offlinePill) offlinePill.classList.toggle("hidden", isOnline);

  if (syncStatusIcon && syncStatusTitle && syncStatusDesc) {
    if (isOnline) {
      const pending = localStorage.getItem("samsam_pending_sync") === "1";
      if (pending) {
        localStorage.removeItem("samsam_pending_sync");
        if (justCameOnline) showToast("تمت مزامنة ذكرياتك مع رجوع الإنترنت 🌸");
      }
      syncStatusIcon.textContent = "cloud_done";
      syncStatusTitle.textContent = "متصل ومتزامن";
      syncStatusDesc.textContent = "كل ذكرياتك محفوظة محلياً ومربوطة تلقائياً بين الأونلاين والأوفلاين.";
    } else {
      syncStatusIcon.textContent = "cloud_off";
      syncStatusTitle.textContent = "وضع الأوفلاين نشط";
      syncStatusDesc.textContent = "تقدري تضيفي صور وذكريات عادي جداً، وهتتزامن أول ما النت يرجع.";
    }
  }
}

window.addEventListener("online", () => updateOnlineStatus(true));
window.addEventListener("offline", () => updateOnlineStatus(false));

if (syncChannel) {
  syncChannel.onmessage = async (event) => {
    if (event.data && event.data.type === "SYNC_UPDATED") {
      await loadBookDataAsync();
      renderBook();
      renderManageList();
    }
  };
}

// ربط الحفظ بالمزامنة التلقائية
const _origSaveBookData = saveBookData;
saveBookData = async function () {
  await _origSaveBookData();
  if (!navigator.onLine) {
    localStorage.setItem("samsam_pending_sync", "1");
  }
  if (syncChannel) {
    syncChannel.postMessage({ type: "SYNC_UPDATED", at: Date.now() });
  }
  updateOnlineStatus(false);
};

if (exportBackupBtn) {
  exportBackupBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(bookData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `samsam-memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast("تم تحميل النسخة الاحتياطية بنجاح");
  });
}

if (importBackupInput) {
  importBackupInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.pages)) {
        throw new Error("Invalid backup");
      }
      const existingIds = new Set(bookData.pages.map((p) => p.id));
      let added = 0;
      parsed.pages.forEach((p) => {
        if (!existingIds.has(p.id)) {
          bookData.pages.push(p);
          added++;
        }
      });
      await saveBookData();
      renderBook();
      renderManageList();
      showToast(`تمت مزامنة ودمج ${added} صفحة جديدة 🌸`);
    } catch (err) {
      alert("ملف النسخة الاحتياطية غير صالح.");
    }
    e.target.value = "";
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// تشغيل التطبيق
(async function initApp() {
  updateOnlineStatus(false);
  initParticles();
  await loadBookDataAsync();
  renderBook();
})();
