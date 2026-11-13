// ---------- State & helpers ----------
const state = { tasks: [], sessions: [], notes: [], user: null };
let token = localStorage.getItem("studyhub-token");
let theme = localStorage.getItem("studyhub-theme") || "light";

const $ = (id) => document.getElementById(id);
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isOverdue = (t) => !t.done && t.due && t.due < today();
const priLabel = { 1: "High", 2: "Medium", 3: "Low" };
const sumMin = (list) => list.reduce((n, s) => n + s.minutes, 0);
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const lastDays = (n) => Array.from({ length: n }, (_, i) => dayOffset(i - (n - 1)));

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 2500);
}
function openDlg(d) { d.showModal ? d.showModal() : d.setAttribute("open", ""); }
function closeDlg(d) { d.close ? d.close() : d.removeAttribute("open"); }

// ---------- API (fetch + async/await) ----------
async function api(path, method = "GET", body) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
  } catch { throw new Error("Cannot reach the server. Is it running (npm start)?"); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) logout();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}
// Runs an async action; shows errors in the given box and a toast on success
async function run(fn, errBox = "formError", ok) {
  try { await fn(); $(errBox).textContent = ""; if (ok) toast(ok); }
  catch (e) { $(errBox).textContent = e.message; }
}

// ---------- Session & navigation ----------
function logout() {
  ["studyhub-token", "studyhub-user"].forEach((k) => localStorage.removeItem(k));
  location.href = "login.html";
}
document.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", logout));

const views = ["overview", "tasks", "focus", "notes", "reports", "settings"];
function showView() {
  const v = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("on", el.id === "v-" + v));
  document.querySelectorAll(".side [data-view]").forEach((a) => a.classList.toggle("on", a.dataset.view === v));
  $("viewTitle").textContent = v[0].toUpperCase() + v.slice(1);
}
addEventListener("hashchange", showView);
document.addEventListener("keydown", (e) => {   // press N to add a task
  if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !$("editDlg").open) {
    e.preventDefault(); location.hash = "tasks"; $("title").focus();
  }
});

async function enterApp() {
  const [me, tasks, sessions, notes] = await Promise.all([
    api("/auth/me"), api("/tasks"), api("/sessions?from=" + lastDays(30)[0]), api("/notes"),
  ]);
  Object.assign(state, { user: me, tasks, sessions, notes });
  localStorage.setItem("studyhub-user", JSON.stringify(me));
  const h = new Date().getHours();
  $("greeting").textContent = `Good ${h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"}, ${me.name.split(" ")[0]}. Here is what's on your plate.`;
  $("userName").textContent = me.name;
  $("pName").value = me.name; $("pGoal").value = me.dailyGoal;
  setMode(false); render(); renderNotes(); loadQuote();
}

// ---------- Tasks ----------
$("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("title").value.trim(), due = $("due").value;
  $("title").classList.remove("invalid");
  if (title.length < 3) { $("formError").textContent = "Enter a task title with at least 3 characters."; $("title").classList.add("invalid"); return; }
  if (due && due < today()) { $("formError").textContent = "The due date has already passed. Pick today or later."; return; }
  run(async () => {
    state.tasks.unshift(await api("/tasks", "POST", { title, due, subject: $("subject").value.trim() || "General", priority: Number($("priority").value) }));
    e.target.reset(); render();
  }, "formError", "Task added");
});

let editId = null;
$("taskList").addEventListener("click", (e) => {   // event delegation
  const id = e.target.closest("li")?.dataset.id;
  if (!id) return;
  const t = state.tasks.find((t) => t._id === id);
  if (e.target.matches(".del")) run(async () => { await api("/tasks/" + id, "DELETE"); state.tasks = state.tasks.filter((x) => x._id !== id); render(); }, "formError", "Task deleted");
  else if (e.target.matches("input[type=checkbox]")) run(async () => { Object.assign(t, await api("/tasks/" + id, "PUT", { done: !t.done })); render(); });
  else if (e.target.matches(".edit")) {
    editId = id; $("eTitle").value = t.title; $("eSubject").value = t.subject; $("eDue").value = t.due; $("ePriority").value = t.priority;
    $("eError").textContent = ""; openDlg($("editDlg"));
  }
});
$("editForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("eTitle").value.trim();
  if (title.length < 3) { $("eError").textContent = "Title needs at least 3 characters."; return; }
  run(async () => {
    const updated = await api("/tasks/" + editId, "PUT", { title, subject: $("eSubject").value.trim() || "General", due: $("eDue").value, priority: Number($("ePriority").value) });
    Object.assign(state.tasks.find((t) => t._id === editId), updated);
    closeDlg($("editDlg")); render();
  }, "eError", "Task updated");
});
$("editCancel").addEventListener("click", () => closeDlg($("editDlg")));
$("clearDone").addEventListener("click", () => run(async () => { await api("/tasks", "DELETE"); state.tasks = state.tasks.filter((t) => !t.done); render(); }, "formError", "Completed tasks cleared"));
["search", "filter", "sort"].forEach((id) => $(id).addEventListener("input", render));

function visibleTasks() {
  const q = $("search").value.toLowerCase(), f = $("filter").value;
  const sorters = {
    due: (a, b) => (a.due || "9999").localeCompare(b.due || "9999"),
    priority: (a, b) => a.priority - b.priority,
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };
  return state.tasks
    .filter((t) => (t.title + t.subject).toLowerCase().includes(q))
    .filter((t) => f === "all" || (f === "done" && t.done) || (f === "pending" && !t.done) || (f === "overdue" && isOverdue(t)))
    .sort(sorters[$("sort").value]);
}

// ---------- Rendering ----------
function streak() {
  const days = new Set(state.sessions.map((s) => s.date));
  let n = 0, i = days.has(today()) ? 0 : -1;       // a streak stays alive until the day ends
  while (days.has(dayOffset(i))) { n++; i--; }
  return n;
}

function render() {
  const list = visibleTasks();
  $("taskList").innerHTML = list.length ? list.map(({ _id, title, subject, due, priority, done }) => `
    <li class="task ${done ? "done" : ""}" data-id="${_id}">
      <input type="checkbox" ${done ? "checked" : ""} aria-label="Mark done: ${escapeHTML(title)}">
      <span class="pri pri-${priority}" title="${priLabel[priority]} priority"></span>
      <div class="info">
        <div class="name">${escapeHTML(title)}</div>
        <div class="meta">${escapeHTML(subject)}${due ? ` &middot; due ${due}` : ""}${isOverdue({ done, due }) ? ' <span class="overdue">Overdue</span>' : ""}</div>
      </div>
      <button class="edit ghost" type="button" aria-label="Edit task">Edit</button>
      <button class="del" type="button" aria-label="Delete task">Delete</button>
    </li>`).join("") : '<li class="empty">No tasks here yet. Add one above to get started.</li>';

  const pending = state.tasks.filter((t) => !t.done);
  const todays = state.sessions.filter((s) => s.date === today());
  $("stPending").textContent = pending.length;
  $("stDone").textContent = state.tasks.length - pending.length;
  $("stOverdue").textContent = state.tasks.filter(isOverdue).length;
  $("stMinutes").textContent = sumMin(todays);
  $("sessions").innerHTML = todays.length
    ? todays.map((s) => `<li><span>${escapeHTML(s.subject)}</span><span>${s.minutes} min</span></li>`).join("")
    : '<li class="meta">No sessions yet. Start the timer to log one.</li>';

  // daily goal + streak
  const goal = state.user?.dailyGoal || 60, done = sumMin(todays);
  $("goalBar").style.width = Math.min(100, (done / goal) * 100) + "%";
  $("goalText").textContent = `${done} of ${goal} minutes today${done >= goal ? " - goal reached!" : ""}`;
  $("streak").textContent = streak();

  // due soon: overdue + next 3 days
  const limit = dayOffset(3);
  const soon = pending.filter((t) => t.due && t.due <= limit).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  $("dueSoon").innerHTML = soon.length ? soon.map((t) => `<li class="due"><span>${escapeHTML(t.title)}</span>
    <span class="${isOverdue(t) ? "overdue" : "meta"}">${isOverdue(t) ? "Overdue" : t.due === today() ? "Today" : t.due}</span></li>`).join("")
    : '<li class="meta">Nothing due in the next 3 days.</li>';

  const subjects = [...new Set(["General", ...state.tasks.map((t) => t.subject)])];
  const sel = $("timerSubject"), keep = sel.value;
  sel.innerHTML = subjects.map((s) => `<option>${escapeHTML(s)}</option>`).join("");
  if (subjects.includes(keep)) sel.value = keep;
  renderReports();
}

function renderReports() {
  const days = lastDays(7);
  const mins = days.map((d) => sumMin(state.sessions.filter((s) => s.date === d)));
  const max = Math.max(...mins, 30);
  $("week").innerHTML = days.map((d, i) => `<div class="bar" title="${mins[i]} min"><b>${mins[i] || ""}</b>
    <i style="height:${(mins[i] / max) * 100}%"></i><span>${new Date(d + "T00:00").toLocaleDateString("en", { weekday: "short" })}</span></div>`).join("");
  $("weekTotal").textContent = `${mins.reduce((a, b) => a + b, 0)} minutes studied`;

  const bySubject = state.sessions.reduce((acc, s) => ({ ...acc, [s.subject]: (acc[s.subject] || 0) + s.minutes }), {});
  const rows = Object.entries(bySubject).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $("subjectBars").innerHTML = rows.length ? rows.map(([name, m]) => `<div class="sb"><span>${escapeHTML(name)}</span>
    <div><i style="width:${(m / rows[0][1]) * 100}%"></i></div><b>${m}m</b></div>`).join("")
    : '<p class="meta">Complete a focus session to see your subjects here.</p>';
}

// ---------- Study timer ----------
let timer = null, onBreak = false, total = 25 * 60, left = total;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
function beep() {
  try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 660; o.start(); o.stop(c.currentTime + 0.4); } catch {}
}
function drawTimer() {
  $("time").textContent = fmt(left);
  $("ring").style.setProperty("--p", ((total - left) / total) * 100);
  $("mode").textContent = onBreak ? "Break" : "Focus";
  document.title = timer ? `${fmt(left)} - StudyHub` : "Dashboard - StudyHub";
}
function setMode(isBreak) {
  onBreak = isBreak;
  total = Number($(isBreak ? "breakLen" : "focusLen").value || 25) * 60;
  left = total; drawTimer();
}
function tick() {
  left--;
  if (left > 0) return drawTimer();
  beep();
  if (!onBreak) {
    run(async () => {
      state.sessions.push(await api("/sessions", "POST", { date: today(), subject: $("timerSubject").value, minutes: Math.round(total / 60) }));
      render();
    }, "formError", "Focus session saved. Take a break!");
  } else toast("Break over. Ready for the next session?");
  setMode(!onBreak);
}
$("startBtn").addEventListener("click", () => {
  if (timer) { clearInterval(timer); timer = null; $("startBtn").textContent = "Resume"; }
  else { timer = setInterval(tick, 1000); $("startBtn").textContent = "Pause"; }
  drawTimer();
});
$("resetBtn").addEventListener("click", () => { clearInterval(timer); timer = null; $("startBtn").textContent = "Start"; setMode(false); });
["focusLen", "breakLen"].forEach((id) => $(id).addEventListener("change", () => { if (!timer) setMode(onBreak); }));

// ---------- Notes ----------
function renderNotes() {
  $("noteList").innerHTML = state.notes.length ? state.notes.map((n) => `
    <li class="note" data-id="${n._id}"><p>${escapeHTML(n.text)}</p>
    <button class="del" type="button" aria-label="Delete note">Delete</button></li>`).join("")
    : '<li class="empty">Jot down formulas, ideas or reminders here.</li>';
}
$("noteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("noteText").value.trim();
  if (!text) { $("noteError").textContent = "Write something first."; return; }
  run(async () => { state.notes.unshift(await api("/notes", "POST", { text })); e.target.reset(); renderNotes(); }, "noteError", "Note saved");
});
$("noteList").addEventListener("click", (e) => {
  const id = e.target.closest("li")?.dataset.id;
  if (id && e.target.matches(".del")) run(async () => {
    await api("/notes/" + id, "DELETE"); state.notes = state.notes.filter((n) => n._id !== id); renderNotes();
  }, "noteError", "Note deleted");
});

// ---------- Settings ----------
$("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  run(async () => {
    state.user = await api("/auth/me", "PUT", { name: $("pName").value.trim(), dailyGoal: $("pGoal").value });
    localStorage.setItem("studyhub-user", JSON.stringify(state.user));
    $("userName").textContent = state.user.name; render();
  }, "setError", "Profile saved");
});
$("pwForm").addEventListener("submit", (e) => {
  e.preventDefault();
  run(async () => { await api("/auth/password", "PUT", { current: $("pwOld").value, next: $("pwNew").value }); e.target.reset(); }, "pwError", "Password updated");
});
$("deleteAcct").addEventListener("click", async () => {
  if (!confirm("Delete your account and all your data? This cannot be undone.")) return;
  try { await api("/auth/me", "DELETE"); logout(); } catch (e) { toast(e.message); }
});

// ---------- Export ----------
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
$("exportJson").addEventListener("click", () =>
  download("studyhub-export.json", JSON.stringify({ tasks: state.tasks, sessions: state.sessions, notes: state.notes }, null, 2), "application/json"));
$("exportCsv").addEventListener("click", () => {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = state.tasks.map((t) => [t.title, t.subject, t.due, priLabel[t.priority], t.done ? "Done" : "Pending"].map(q).join(","));
  download("studyhub-tasks.csv", ["Title,Subject,Due,Priority,Status", ...rows].join("\n"), "text/csv");
});

// ---------- Theme ----------
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-btn]").forEach((b) => (b.textContent = theme === "dark" ? "Light mode" : "Dark mode"));
}
document.querySelectorAll("[data-theme-btn]").forEach((b) => b.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark"; localStorage.setItem("studyhub-theme", theme); applyTheme();
}));

// ---------- Daily quote (external API) ----------
async function loadQuote() {
  try {
    const res = await fetch("https://dummyjson.com/quotes/random");
    if (!res.ok) throw new Error();
    const { quote, author } = await res.json();
    $("quote").textContent = `"${quote}" - ${author}`;
  } catch { $("quote").textContent = "Small, steady sessions beat last-minute marathons."; }
}

// ---------- Start ----------
applyTheme(); showView();
if (!token) location.replace("login.html");
else enterApp().catch((e) => { $("formError").textContent = e.message; });
