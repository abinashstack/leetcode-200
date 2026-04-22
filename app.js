(function () {
  "use strict";

  // --- Firebase Config ---
  const firebaseConfig = {
    apiKey: "AIzaSyCW8NYRHSmiBzVcZC6x4WvLYGhGw5V9uJU",
    authDomain: "leetcheat.firebaseapp.com",
    projectId: "leetcheat",
    storageBucket: "leetcheat.firebasestorage.app",
    messagingSenderId: "1061940608343",
    appId: "1:1061940608343:web:da607bbbc2b6462cec1212",
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const provider = new firebase.auth.GoogleAuthProvider();

  const STORAGE_KEY = "leetcode200_done";

  // --- State ---
  let done = {};
  let currentUser = null;
  let activePattern = "all";
  let activeDiff = "all";
  let activeStatus = "all";
  let searchText = "";

  // --- DOM refs ---
  const tbody = document.getElementById("q-body");
  const progressFill = document.getElementById("progress-fill");
  const doneCount = document.getElementById("done-count");
  const donePct = document.getElementById("done-pct");
  const easyDone = document.getElementById("easy-done");
  const easyTotal = document.getElementById("easy-total");
  const medDone = document.getElementById("med-done");
  const medTotal = document.getElementById("med-total");
  const hardDone = document.getElementById("hard-done");
  const hardTotal = document.getElementById("hard-total");
  const noResults = document.getElementById("no-results");
  const showingCount = document.getElementById("showing-count");
  const searchBox = document.getElementById("search");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");
  const userInfo = document.getElementById("user-info");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const syncBanner = document.getElementById("sync-banner");
  const syncText = document.getElementById("sync-text");
  const loginGate = document.getElementById("login-gate");
  const mainContent = document.getElementById("main-content");

  // --- Storage layer ---
  function loadFromLocal() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  }

  function saveToLocal(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getUserDocRef() {
    if (!currentUser) return null;
    return db.collection("users").doc(currentUser.uid);
  }

  async function loadFromFirestore() {
    const ref = getUserDocRef();
    if (!ref) return {};
    try {
      const doc = await ref.get();
      if (doc.exists && doc.data().done) {
        return doc.data().done;
      }
    } catch (e) {
      console.warn("Firestore read failed:", e);
    }
    return {};
  }

  async function saveToFirestore(data) {
    const ref = getUserDocRef();
    if (!ref) return;
    try {
      await ref.set(
        {
          done: data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      console.warn("Firestore write failed:", e);
    }
  }

  async function loadState() {
    if (currentUser) {
      const cloudData = await loadFromFirestore();
      const localData = loadFromLocal();

      // Merge: union of both (cloud wins on conflicts, but both are booleans so union is fine)
      const merged = { ...localData, ...cloudData };

      // If local had extra items, push them to cloud
      const localKeys = Object.keys(localData);
      const cloudKeys = Object.keys(cloudData);
      const hasNewLocal = localKeys.some((k) => !cloudData[k]);

      done = merged;
      saveToLocal(done);

      if (hasNewLocal) {
        await saveToFirestore(done);
      }
    } else {
      done = loadFromLocal();
    }
  }

  async function saveState() {
    saveToLocal(done);
    if (currentUser) {
      await saveToFirestore(done);
    }
  }

  // --- Auth UI ---
  function showLoggedIn(user) {
    btnLogin.style.display = "none";
    userInfo.style.display = "flex";
    userAvatar.src = user.photoURL || "";
    userName.textContent = user.displayName || user.email;
    syncBanner.style.display = "block";
    syncText.textContent = "Progress synced to your Google account.";
    loginGate.style.display = "none";
    mainContent.style.display = "block";
  }

  function showLoggedOut() {
    btnLogin.style.display = "flex";
    userInfo.style.display = "none";
    loginGate.style.display = "block";
    mainContent.style.display = "none";
    syncBanner.style.display = "none";
  }

  // --- Auth events ---
  function doLogin() {
    auth.signInWithPopup(provider).catch(function (err) {
      console.error("Login failed:", err);
    });
  }

  btnLogin.addEventListener("click", doLogin);

  var btnLoginHero = document.getElementById("btn-login-hero");
  if (btnLoginHero) btnLoginHero.addEventListener("click", doLogin);

  btnLogout.addEventListener("click", function () {
    auth.signOut();
  });

  auth.onAuthStateChanged(async function (user) {
    currentUser = user;
    if (user) {
      showLoggedIn(user);
    } else {
      showLoggedOut();
    }
    try {
      await loadState();
    } catch (e) {
      console.warn("loadState error, falling back to local:", e);
      done = loadFromLocal();
    }
    render();
  });

  // --- Build pattern pills ---
  function buildPatternPills() {
    const patterns = [...new Set(questions.map((q) => q.pattern))];
    const container = document.getElementById("pattern-pills");
    patterns.forEach((p) => {
      const btn = document.createElement("button");
      btn.className = "pill";
      btn.dataset.pattern = p;
      btn.textContent = p;
      container.appendChild(btn);
    });
  }

  // --- Render table ---
  function render() {
    const filtered = questions.filter((q) => {
      if (activePattern !== "all" && q.pattern !== activePattern) return false;
      if (activeDiff !== "all" && q.difficulty !== activeDiff) return false;
      if (activeStatus === "done" && !done[q.id]) return false;
      if (activeStatus === "todo" && done[q.id]) return false;
      if (searchText && !q.title.toLowerCase().includes(searchText))
        return false;
      return true;
    });

    tbody.innerHTML = "";

    filtered.forEach((q) => {
      const tr = document.createElement("tr");
      if (done[q.id]) tr.className = "done";

      const diffClass =
        q.difficulty === "Easy"
          ? "badge-easy"
          : q.difficulty === "Medium"
            ? "badge-medium"
            : "badge-hard";

      let links = `<a class="link-btn" href="${q.link}" target="_blank" rel="noopener">LC</a>`;
      if (q.gfg)
        links += `<a class="link-btn" href="${q.gfg}" target="_blank" rel="noopener">GFG</a>`;
      if (q.ib)
        links += `<a class="link-btn" href="${q.ib}" target="_blank" rel="noopener">IB</a>`;

      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" class="cb" data-id="${q.id}" ${done[q.id] ? "checked" : ""}></td>
        <td class="col-id">${q.id}</td>
        <td class="q-title"><a href="${q.link}" target="_blank" rel="noopener">${q.title}</a></td>
        <td class="col-diff"><span class="badge ${diffClass}">${q.difficulty}</span></td>
        <td class="col-pattern"><span class="pattern-tag">${q.pattern}</span></td>
        <td class="col-links">${links}</td>
      `;

      tbody.appendChild(tr);
    });

    noResults.style.display = filtered.length === 0 ? "block" : "none";
    showingCount.textContent = `Showing ${filtered.length} of ${questions.length}`;

    updateProgress();
  }

  // --- Progress ---
  function updateProgress() {
    const total = questions.length;
    const count = questions.filter((q) => done[q.id]).length;
    const pct = Math.round((count / total) * 100);

    doneCount.textContent = count;
    donePct.textContent = pct + "%";
    progressFill.style.width = pct + "%";

    const easyQs = questions.filter((q) => q.difficulty === "Easy");
    const medQs = questions.filter((q) => q.difficulty === "Medium");
    const hardQs = questions.filter((q) => q.difficulty === "Hard");

    easyTotal.textContent = easyQs.length;
    medTotal.textContent = medQs.length;
    hardTotal.textContent = hardQs.length;

    easyDone.textContent = easyQs.filter((q) => done[q.id]).length;
    medDone.textContent = medQs.filter((q) => done[q.id]).length;
    hardDone.textContent = hardQs.filter((q) => done[q.id]).length;
  }

  // --- Events ---
  // Checkbox toggle
  tbody.addEventListener("change", async function (e) {
    if (e.target.classList.contains("cb")) {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        done[id] = true;
      } else {
        delete done[id];
      }
      await saveState();

      const tr = e.target.closest("tr");
      if (e.target.checked) {
        tr.classList.add("done");
      } else {
        tr.classList.remove("done");
      }

      updateProgress();
    }
  });

  // Search
  searchBox.addEventListener("input", function () {
    searchText = this.value.toLowerCase().trim();
    render();
  });

  // Difficulty pills
  document.getElementById("diff-pills").addEventListener("click", function (e) {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    this.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    activeDiff = btn.dataset.diff;
    render();
  });

  // Status pills
  document
    .getElementById("status-pills")
    .addEventListener("click", function (e) {
      const btn = e.target.closest(".pill");
      if (!btn) return;
      this.querySelectorAll(".pill").forEach((p) =>
        p.classList.remove("active"),
      );
      btn.classList.add("active");
      activeStatus = btn.dataset.status;
      render();
    });

  // Pattern pills
  document
    .getElementById("pattern-pills")
    .addEventListener("click", function (e) {
      const btn = e.target.closest(".pill");
      if (!btn) return;
      this.querySelectorAll(".pill").forEach((p) =>
        p.classList.remove("active"),
      );
      btn.classList.add("active");
      activePattern = btn.dataset.pattern;
      render();
    });

  // Reset
  document
    .getElementById("btn-reset")
    .addEventListener("click", async function () {
      if (confirm("Reset all progress? This cannot be undone.")) {
        done = {};
        await saveState();
        render();
      }
    });

  // --- Init ---
  buildPatternPills();
  // Auth state listener handles loadState + render
})();
