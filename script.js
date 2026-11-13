/* ==========================================================================
   StudyHub — application logic
   All data persists to localStorage. No build step, no dependencies.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Storage helpers
   * ------------------------------------------------------------------ */

  const STORE_KEY = "studyhub_v1";
  const TAB_COLORS = ["--tab-1", "--tab-2", "--tab-3", "--tab-4", "--tab-5", "--tab-6"];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayStr(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("StudyHub: could not read saved data, starting fresh.", e);
    }
    return seedState();
  }

  function seedState() {
    const mathId = uid();
    const bioId = uid();
    const historyId = uid();
    return {
      subjects: [
        { id: mathId, name: "Mathematics", color: "--tab-4" },
        { id: bioId, name: "Biology", color: "--tab-3" },
        { id: historyId, name: "History", color: "--tab-2" },
      ],
      notes: [
        {
          id: uid(),
          subjectId: mathId,
          title: "Derivatives — quick rules",
          content:
            "Power rule: d/dx[x^n] = n·x^(n-1)\nProduct rule: (fg)' = f'g + fg'\nChain rule: dy/dx = dy/du · du/dx\n\nRemember to simplify before differentiating when possible.",
          updatedAt: Date.now(),
        },
        {
          id: uid(),
          subjectId: bioId,
          title: "Cell respiration overview",
          content:
            "Glycolysis happens in the cytoplasm and produces a small net gain of ATP. The Krebs cycle and electron transport chain happen in the mitochondria and produce most of the ATP via oxidative phosphorylation.",
          updatedAt: Date.now(),
        },
      ],
      tasks: [
        { id: uid(), subjectId: mathId, title: "Finish problem set 4", date: todayStr(0), time: "18:00", done: false },
        { id: uid(), subjectId: historyId, title: "Read chapter on the Cold War", date: todayStr(1), time: "10:00", done: false },
        { id: uid(), subjectId: bioId, title: "Lab report draft", date: todayStr(2), time: "", done: false },
      ],
      cards: [
        { id: uid(), subjectId: mathId, question: "What is the derivative of sin(x)?", answer: "cos(x)", box: 1, lastReviewed: null },
        { id: uid(), subjectId: mathId, question: "What is the power rule?", answer: "d/dx[x^n] = n·x^(n-1)", box: 1, lastReviewed: null },
        { id: uid(), subjectId: bioId, question: "Where does the Krebs cycle occur?", answer: "In the mitochondrial matrix", box: 1, lastReviewed: null },
      ],
      sessions: [],
      reviews: [],
      ui: { activeView: "dashboard", noteFilter: "all", plannerFilter: "all", cardFilter: "all" },
    };
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  let state = loadState();

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  function subjectById(id) {
    return state.subjects.find((s) => s.id === id);
  }

  function subjectColorVar(id) {
    const s = subjectById(id);
    return s ? `var(${s.color})` : "var(--tab-4)";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2200);
  }

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */

  function setView(view) {
    state.ui.activeView = view;
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === view);
    });
    document.querySelectorAll(".view").forEach((section) => {
      section.classList.toggle("is-active", section.id === `view-${view}`);
    });
    renderAll();
  }

  document.getElementById("nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    setView(btn.dataset.view);
  });

  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.goto));
  });

  /* ------------------------------------------------------------------ *
   * Modal system
   * ------------------------------------------------------------------ */

  const modalOverlay = document.getElementById("modalOverlay");
  const modalRoot = document.getElementById("modal");

  function openModal(html, onMount) {
    modalRoot.innerHTML = html;
    modalOverlay.hidden = false;
    if (onMount) onMount(modalRoot);
    const firstInput = modalRoot.querySelector("input, textarea, select");
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    modalRoot.innerHTML = "";
  }

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  });

  function subjectOptionsHtml(selectedId) {
    return state.subjects
      .map((s) => `<option value="${s.id}" ${s.id === selectedId ? "selected" : ""}>${escapeHtml(s.name)}</option>`)
      .join("");
  }

  /* ------------------------------------------------------------------ *
   * Subject tab strips (filters used on Notes / Planner / Flashcards)
   * ------------------------------------------------------------------ */

  function renderTabStrip(containerId, filterKey) {
    const el = document.getElementById(containerId);
    const current = state.ui[filterKey];
    let html = `<button class="subject-tab ${current === "all" ? "is-active" : ""}" data-filter="all">All subjects</button>`;
    html += state.subjects
      .map(
        (s) => `<button class="subject-tab ${current === s.id ? "is-active" : ""}" style="--tab-color:var(${s.color})" data-filter="${s.id}">${escapeHtml(s.name)}</button>`
      )
      .join("");
    el.innerHTML = html;
    el.querySelectorAll(".subject-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.ui[filterKey] = btn.dataset.filter;
        renderAll();
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * DASHBOARD
   * ------------------------------------------------------------------ */

  function minutesOn(dateStr) {
    return state.sessions.filter((s) => s.date === dateStr).reduce((sum, s) => sum + s.minutes, 0);
  }

  function computeStreak() {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = todayStr(-i);
      if (minutesOn(d) > 0) streak++;
      else break;
    }
    return streak;
  }

  function renderDashboard() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("dashGreeting").textContent = `${greeting}. Here's where things stand.`;

    document.getElementById("statMinutes").textContent = minutesOn(todayStr(0));
    document.getElementById("statStreak").textContent = computeStreak();

    const todaysTasks = state.tasks.filter((t) => t.date === todayStr(0));
    const doneToday = todaysTasks.filter((t) => t.done).length;
    document.getElementById("statTasks").textContent = `${doneToday}/${todaysTasks.length}`;

    const reviewsToday = state.reviews.filter((r) => r.date === todayStr(0)).length;
    document.getElementById("statCards").textContent = reviewsToday;

    // 7-day bar chart
    const chart = document.getElementById("weekChart");
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(todayStr(-i));
    const dayMinutes = days.map(minutesOn);
    const max = Math.max(60, ...dayMinutes);
    chart.innerHTML = days
      .map((d, i) => {
        const h = Math.round((dayMinutes[i] / max) * 100);
        const label = new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" });
        const isToday = d === todayStr(0);
        return `<div class="bar-col ${isToday ? "is-today" : ""}" title="${dayMinutes[i]} min">
          <div class="bar-track"><div class="bar-fill" style="height:${Math.max(h, 3)}%"></div></div>
          <span class="bar-day">${label}</span>
        </div>`;
      })
      .join("");
    document.getElementById("weekTotalNote").textContent = `${dayMinutes.reduce((a, b) => a + b, 0)} min total`;

    // subject breakdown (all-time)
    const subjBars = document.getElementById("subjectBars");
    if (state.subjects.length === 0) {
      subjBars.innerHTML = `<p class="empty-state">Add a subject to see your time breakdown.</p>`;
    } else {
      const totals = state.subjects.map((s) => ({
        subject: s,
        minutes: state.sessions.filter((sess) => sess.subjectId === s.id).reduce((sum, sess) => sum + sess.minutes, 0),
      }));
      const maxMin = Math.max(1, ...totals.map((t) => t.minutes));
      subjBars.innerHTML = totals
        .map(
          (t) => `<div class="subject-bar-row">
            <span class="subject-bar-dot" style="background:var(${t.subject.color})"></span>
            <span class="subject-bar-label">${escapeHtml(t.subject.name)}</span>
            <span class="subject-bar-track"><span class="subject-bar-fill" style="width:${(t.minutes / maxMin) * 100}%;background:var(${t.subject.color})"></span></span>
            <span class="subject-bar-min">${t.minutes}m</span>
          </div>`
        )
        .join("");
    }

    // up next
    const upcoming = state.tasks
      .filter((t) => !t.done && t.date >= todayStr(0))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 5);
    const upNext = document.getElementById("upNextList");
    upNext.innerHTML = upcoming.length
      ? upcoming
          .map(
            (t) => `<li><span class="mini-dot" style="background:${subjectColorVar(t.subjectId)}"></span>${escapeHtml(t.title)}<span class="mini-meta">${formatDate(t.date)}</span></li>`
          )
          .join("")
      : `<li style="color:var(--text-mute); border:none;">Nothing scheduled. Add a task in Planner.</li>`;

    // recent notes
    const recent = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
    const recentNotes = document.getElementById("recentNotesList");
    recentNotes.innerHTML = recent.length
      ? recent
          .map(
            (n) => `<li><span class="mini-dot" style="background:${subjectColorVar(n.subjectId)}"></span>${escapeHtml(n.title)}<span class="mini-meta">${new Date(n.updatedAt).toLocaleDateString()}</span></li>`
          )
          .join("")
      : `<li style="color:var(--text-mute); border:none;">No notes yet. Start one in Notes.</li>`;
  }

  /* ------------------------------------------------------------------ *
   * NOTES
   * ------------------------------------------------------------------ */

  function renderNotes() {
    renderTabStrip("notesSubjectTabs", "noteFilter");
    const search = document.getElementById("notesSearch").value.trim().toLowerCase();
    const filter = state.ui.noteFilter;

    let list = state.notes.filter((n) => filter === "all" || n.subjectId === filter);
    if (search) {
      list = list.filter((n) => n.title.toLowerCase().includes(search) || n.content.toLowerCase().includes(search));
    }
    list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);

    const grid = document.getElementById("notesGrid");
    document.getElementById("notesEmpty").hidden = list.length !== 0;
    grid.innerHTML = list
      .map((n) => {
        const subj = subjectById(n.subjectId);
        return `<article class="note-card" style="--tab-color:var(${subj ? subj.color : "--tab-4"})" data-id="${n.id}">
          <h3 class="note-title">${escapeHtml(n.title)}</h3>
          <p class="note-body">${escapeHtml(n.content)}</p>
          <div class="note-meta">
            <span class="subject-pill" style="--tab-color:var(${subj ? subj.color : "--tab-4"})">${subj ? escapeHtml(subj.name) : "No subject"}</span>
            <span>${new Date(n.updatedAt).toLocaleDateString()}</span>
          </div>
        </article>`;
      })
      .join("");

    grid.querySelectorAll(".note-card").forEach((card) => {
      card.addEventListener("click", () => openNoteModal(card.dataset.id));
    });
  }

  document.getElementById("notesSearch").addEventListener("input", renderNotes);
  document.getElementById("newNoteBtn").addEventListener("click", () => openNoteModal(null));

  function openNoteModal(noteId) {
    const note = noteId ? state.notes.find((n) => n.id === noteId) : null;
    if (state.subjects.length === 0) {
      showToast("Add a subject first, then create notes.");
      return;
    }
    const html = `
      <h3>${note ? "Edit note" : "New note"}</h3>
      <div class="field">
        <label for="noteTitle">Title</label>
        <input type="text" id="noteTitle" value="${note ? escapeHtml(note.title) : ""}" placeholder="e.g. Chapter 3 summary">
      </div>
      <div class="field">
        <label for="noteSubject">Subject</label>
        <select id="noteSubject">${subjectOptionsHtml(note ? note.subjectId : state.subjects[0].id)}</select>
      </div>
      <div class="field">
        <label for="noteContent">Content</label>
        <textarea id="noteContent" placeholder="Write what you want to remember…">${note ? escapeHtml(note.content) : ""}</textarea>
      </div>
      <div class="modal-actions">
        ${note ? `<button class="btn btn-danger" id="deleteNoteBtn">Delete</button>` : ""}
        <button class="btn btn-ghost" id="cancelNoteBtn">Cancel</button>
        <button class="btn btn-primary" id="saveNoteBtn">Save note</button>
      </div>
    `;
    openModal(html, (root) => {
      root.querySelector("#cancelNoteBtn").addEventListener("click", closeModal);
      if (note) {
        root.querySelector("#deleteNoteBtn").addEventListener("click", () => {
          state.notes = state.notes.filter((n) => n.id !== note.id);
          saveState();
          closeModal();
          renderAll();
          showToast("Note deleted");
        });
      }
      root.querySelector("#saveNoteBtn").addEventListener("click", () => {
        const title = root.querySelector("#noteTitle").value.trim();
        const subjectId = root.querySelector("#noteSubject").value;
        const content = root.querySelector("#noteContent").value.trim();
        if (!title) {
          showToast("Give the note a title first.");
          return;
        }
        if (note) {
          note.title = title;
          note.subjectId = subjectId;
          note.content = content;
          note.updatedAt = Date.now();
        } else {
          state.notes.push({ id: uid(), subjectId, title, content, updatedAt: Date.now() });
        }
        saveState();
        closeModal();
        renderAll();
        showToast("Note saved");
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * PLANNER
   * ------------------------------------------------------------------ */

  function renderPlanner() {
    renderTabStrip("plannerSubjectTabs", "plannerFilter");
    const filter = state.ui.plannerFilter;
    let list = state.tasks.filter((t) => filter === "all" || t.subjectId === filter);

    document.getElementById("plannerEmpty").hidden = state.tasks.length !== 0;

    // group into: overdue, today, next 6 days, later
    const days = [];
    for (let i = 0; i < 7; i++) days.push(todayStr(i));

    const cols = document.getElementById("plannerColumns");
    let html = "";

    const overdue = list.filter((t) => !t.done && t.date < todayStr(0));
    if (overdue.length) {
      html += renderPlannerColumn("Overdue", overdue);
    }

    days.forEach((d, i) => {
      const dayTasks = list.filter((t) => t.date === d);
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDate(d);
      html += renderPlannerColumn(label, dayTasks);
    });

    const later = list.filter((t) => t.date > todayStr(6));
    if (later.length) {
      html += renderPlannerColumn("Later", later);
    }

    cols.innerHTML = html;
    cols.querySelectorAll(".task-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.dataset.action === "toggle") return;
        openTaskModal(card.dataset.id);
      });
    });
    cols.querySelectorAll("[data-action='toggle']").forEach((chk) => {
      chk.addEventListener("click", (e) => {
        e.stopPropagation();
        const task = state.tasks.find((t) => t.id === chk.closest(".task-card").dataset.id);
        task.done = !task.done;
        saveState();
        renderAll();
      });
    });
  }

  function renderPlannerColumn(label, tasks) {
    const sorted = [...tasks].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    return `<div class="planner-day">
      <div class="planner-day-head"><span>${label}</span><span>${tasks.length}</span></div>
      ${sorted
        .map(
          (t) => `<div class="task-card ${t.done ? "is-done" : ""}" style="--tab-color:${subjectColorVar(t.subjectId)}" data-id="${t.id}">
            <label style="display:flex;align-items:flex-start;gap:8px;">
              <input type="checkbox" data-action="toggle" ${t.done ? "checked" : ""} style="margin-top:2px;">
              <span>
                <div class="task-title">${escapeHtml(t.title)}</div>
                <div class="task-time">${t.time ? t.time : ""} ${subjectById(t.subjectId) ? "· " + escapeHtml(subjectById(t.subjectId).name) : ""}</div>
              </span>
            </label>
          </div>`
        )
        .join("") || `<p style="color:var(--text-mute);font-size:12px;">Nothing here</p>`}
    </div>`;
  }

  document.getElementById("newTaskBtn").addEventListener("click", () => openTaskModal(null));

  function openTaskModal(taskId) {
    const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;
    if (state.subjects.length === 0) {
      showToast("Add a subject first, then plan tasks.");
      return;
    }
    const html = `
      <h3>${task ? "Edit task" : "New task"}</h3>
      <div class="field">
        <label for="taskTitle">Task</label>
        <input type="text" id="taskTitle" value="${task ? escapeHtml(task.title) : ""}" placeholder="e.g. Review lecture notes">
      </div>
      <div class="field">
        <label for="taskSubject">Subject</label>
        <select id="taskSubject">${subjectOptionsHtml(task ? task.subjectId : state.subjects[0].id)}</select>
      </div>
      <div class="field">
        <label for="taskDate">Date</label>
        <input type="date" id="taskDate" value="${task ? task.date : todayStr(0)}">
      </div>
      <div class="field">
        <label for="taskTime">Time (optional)</label>
        <input type="time" id="taskTime" value="${task ? task.time : ""}">
      </div>
      <div class="modal-actions">
        ${task ? `<button class="btn btn-danger" id="deleteTaskBtn">Delete</button>` : ""}
        <button class="btn btn-ghost" id="cancelTaskBtn">Cancel</button>
        <button class="btn btn-primary" id="saveTaskBtn">Save task</button>
      </div>
    `;
    openModal(html, (root) => {
      root.querySelector("#cancelTaskBtn").addEventListener("click", closeModal);
      if (task) {
        root.querySelector("#deleteTaskBtn").addEventListener("click", () => {
          state.tasks = state.tasks.filter((t) => t.id !== task.id);
          saveState();
          closeModal();
          renderAll();
          showToast("Task deleted");
        });
      }
      root.querySelector("#saveTaskBtn").addEventListener("click", () => {
        const title = root.querySelector("#taskTitle").value.trim();
        const subjectId = root.querySelector("#taskSubject").value;
        const date = root.querySelector("#taskDate").value || todayStr(0);
        const time = root.querySelector("#taskTime").value;
        if (!title) {
          showToast("Give the task a name first.");
          return;
        }
        if (task) {
          task.title = title;
          task.subjectId = subjectId;
          task.date = date;
          task.time = time;
        } else {
          state.tasks.push({ id: uid(), subjectId, title, date, time, done: false });
        }
        saveState();
        closeModal();
        renderAll();
        showToast("Task saved");
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * FLASHCARDS
   * ------------------------------------------------------------------ */

  let flashQueue = [];
  let flashIndex = 0;

  function renderFlashcards() {
    renderTabStrip("cardsSubjectTabs", "cardFilter");
    const filter = state.ui.cardFilter;
    const list = state.cards.filter((c) => filter === "all" || c.subjectId === filter);

    document.getElementById("cardListEmpty").hidden = list.length !== 0;
    const cardList = document.getElementById("cardList");
    cardList.innerHTML = list
      .map(
        (c) => `<li style="--tab-color:${subjectColorVar(c.subjectId)}" data-id="${c.id}">
          <span class="card-list-q">${escapeHtml(c.question)}</span>
          <span class="card-list-box">box ${c.box}</span>
          <button class="icon-btn" data-action="edit" title="Edit">✎</button>
          <button class="icon-btn" data-action="delete" title="Delete">✕</button>
        </li>`
      )
      .join("");
    cardList.querySelectorAll("[data-action='edit']").forEach((btn) =>
      btn.addEventListener("click", () => openCardModal(btn.closest("li").dataset.id))
    );
    cardList.querySelectorAll("[data-action='delete']").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.closest("li").dataset.id;
        state.cards = state.cards.filter((c) => c.id !== id);
        saveState();
        renderAll();
        showToast("Card deleted");
      })
    );

    // build / refresh the study queue whenever the filtered set changes shape
    flashQueue = list;
    flashIndex = Math.min(flashIndex, Math.max(0, flashQueue.length - 1));

    const empty = document.getElementById("flashEmpty");
    const session = document.getElementById("flashSession");
    if (flashQueue.length === 0) {
      empty.hidden = false;
      session.hidden = true;
      return;
    }
    empty.hidden = true;
    session.hidden = false;
    renderFlashcardFace();
  }

  function renderFlashcardFace() {
    const card = flashQueue[flashIndex];
    if (!card) return;
    document.getElementById("flashProgress").textContent = `Card ${flashIndex + 1} of ${flashQueue.length}`;
    const front = document.getElementById("flashFront");
    const back = document.getElementById("flashBack");
    const colorVar = subjectColorVar(card.subjectId);
    document.getElementById("flashcard").style.setProperty("--tab-color", colorVar);
    front.textContent = card.question;
    back.textContent = card.answer;
    document.getElementById("flashcard").classList.remove("is-flipped");
    document.getElementById("flashGrade").hidden = true;
  }

  document.getElementById("flashcard").addEventListener("click", () => {
    const el = document.getElementById("flashcard");
    el.classList.toggle("is-flipped");
    document.getElementById("flashGrade").hidden = !el.classList.contains("is-flipped");
  });

  document.getElementById("flashGrade").addEventListener("click", (e) => {
    const btn = e.target.closest(".grade-btn");
    if (!btn) return;
    const card = flashQueue[flashIndex];
    if (!card) return;
    const grade = btn.dataset.grade;
    if (grade === "again") card.box = 1;
    else if (grade === "good") card.box = Math.min(5, card.box + 1);
    else card.box = Math.min(5, card.box + 2);
    card.lastReviewed = Date.now();
    state.reviews.push({ date: todayStr(0), cardId: card.id });
    saveState();

    flashIndex = (flashIndex + 1) % flashQueue.length;
    renderFlashcardFace();
    renderDashboard();
  });

  document.getElementById("newCardBtn").addEventListener("click", () => openCardModal(null));

  function openCardModal(cardId) {
    const card = cardId ? state.cards.find((c) => c.id === cardId) : null;
    if (state.subjects.length === 0) {
      showToast("Add a subject first, then create flashcards.");
      return;
    }
    const html = `
      <h3>${card ? "Edit flashcard" : "New flashcard"}</h3>
      <div class="field">
        <label for="cardSubject">Subject</label>
        <select id="cardSubject">${subjectOptionsHtml(card ? card.subjectId : state.subjects[0].id)}</select>
      </div>
      <div class="field">
        <label for="cardQuestion">Question</label>
        <textarea id="cardQuestion" placeholder="Front of the card">${card ? escapeHtml(card.question) : ""}</textarea>
      </div>
      <div class="field">
        <label for="cardAnswer">Answer</label>
        <textarea id="cardAnswer" placeholder="Back of the card">${card ? escapeHtml(card.answer) : ""}</textarea>
      </div>
      <div class="modal-actions">
        ${card ? `<button class="btn btn-danger" id="deleteCardBtn">Delete</button>` : ""}
        <button class="btn btn-ghost" id="cancelCardBtn">Cancel</button>
        <button class="btn btn-primary" id="saveCardBtn">Save card</button>
      </div>
    `;
    openModal(html, (root) => {
      root.querySelector("#cancelCardBtn").addEventListener("click", closeModal);
      if (card) {
        root.querySelector("#deleteCardBtn").addEventListener("click", () => {
          state.cards = state.cards.filter((c) => c.id !== card.id);
          saveState();
          closeModal();
          renderAll();
          showToast("Card deleted");
        });
      }
      root.querySelector("#saveCardBtn").addEventListener("click", () => {
        const subjectId = root.querySelector("#cardSubject").value;
        const question = root.querySelector("#cardQuestion").value.trim();
        const answer = root.querySelector("#cardAnswer").value.trim();
        if (!question || !answer) {
          showToast("Fill in both the question and answer.");
          return;
        }
        if (card) {
          card.subjectId = subjectId;
          card.question = question;
          card.answer = answer;
        } else {
          state.cards.push({ id: uid(), subjectId, question, answer, box: 1, lastReviewed: null });
        }
        saveState();
        closeModal();
        renderAll();
        showToast("Flashcard saved");
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * SUBJECTS
   * ------------------------------------------------------------------ */

  function renderSubjects() {
    const grid = document.getElementById("subjectGrid");
    if (state.subjects.length === 0) {
      grid.innerHTML = `<p class="empty-state">No subjects yet. Add one to start organizing notes, tasks and flashcards.</p>`;
      return;
    }
    grid.innerHTML = state.subjects
      .map((s) => {
        const noteCount = state.notes.filter((n) => n.subjectId === s.id).length;
        const taskCount = state.tasks.filter((t) => t.subjectId === s.id && !t.done).length;
        const cardCount = state.cards.filter((c) => c.subjectId === s.id).length;
        return `<div class="subject-card" style="--tab-color:var(${s.color})" data-id="${s.id}">
          <span class="subject-card-name">${escapeHtml(s.name)}</span>
          <div class="subject-card-stats">
            <span>${noteCount} notes</span>
            <span>${taskCount} open tasks</span>
            <span>${cardCount} cards</span>
          </div>
          <div class="subject-card-actions">
            <button data-action="edit">Edit</button>
            <button data-action="delete">Delete</button>
          </div>
        </div>`;
      })
      .join("");

    grid.querySelectorAll("[data-action='edit']").forEach((btn) =>
      btn.addEventListener("click", () => openSubjectModal(btn.closest(".subject-card").dataset.id))
    );
    grid.querySelectorAll("[data-action='delete']").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.closest(".subject-card").dataset.id;
        if (!confirm("Delete this subject? Its notes, tasks and flashcards will stay but become unassigned.")) return;
        state.subjects = state.subjects.filter((s) => s.id !== id);
        saveState();
        renderAll();
        showToast("Subject deleted");
      })
    );
  }

  document.getElementById("newSubjectBtn").addEventListener("click", () => openSubjectModal(null));

  function openSubjectModal(subjectId) {
    const subject = subjectId ? state.subjects.find((s) => s.id === subjectId) : null;
    const usedColors = new Set(state.subjects.map((s) => s.color));
    const defaultColor = subject ? subject.color : TAB_COLORS.find((c) => !usedColors.has(c)) || TAB_COLORS[0];

    const html = `
      <h3>${subject ? "Edit subject" : "New subject"}</h3>
      <div class="field">
        <label for="subjectName">Name</label>
        <input type="text" id="subjectName" value="${subject ? escapeHtml(subject.name) : ""}" placeholder="e.g. Chemistry">
      </div>
      <div class="field">
        <label>Colour tab</label>
        <div class="color-swatches" id="colorSwatches">
          ${TAB_COLORS.map((c) => `<span class="color-swatch ${c === defaultColor ? "is-selected" : ""}" style="background:var(${c})" data-color="${c}"></span>`).join("")}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancelSubjectBtn">Cancel</button>
        <button class="btn btn-primary" id="saveSubjectBtn">Save subject</button>
      </div>
    `;
    let selectedColor = defaultColor;
    openModal(html, (root) => {
      root.querySelector("#cancelSubjectBtn").addEventListener("click", closeModal);
      root.querySelectorAll(".color-swatch").forEach((sw) => {
        sw.addEventListener("click", () => {
          root.querySelectorAll(".color-swatch").forEach((s2) => s2.classList.remove("is-selected"));
          sw.classList.add("is-selected");
          selectedColor = sw.dataset.color;
        });
      });
      root.querySelector("#saveSubjectBtn").addEventListener("click", () => {
        const name = root.querySelector("#subjectName").value.trim();
        if (!name) {
          showToast("Give the subject a name first.");
          return;
        }
        if (subject) {
          subject.name = name;
          subject.color = selectedColor;
        } else {
          state.subjects.push({ id: uid(), name, color: selectedColor });
        }
        saveState();
        closeModal();
        renderAll();
        showToast("Subject saved");
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * FOCUS TIMER
   * ------------------------------------------------------------------ */

  let timerTotalSeconds = 25 * 60;
  let timerRemaining = timerTotalSeconds;
  let timerInterval = null;
  let timerRunning = false;

  function refreshTimerSubjectSelect() {
    const sel = document.getElementById("timerSubjectSelect");
    const current = sel.value;
    sel.innerHTML = state.subjects.length
      ? subjectOptionsHtml(current || (state.subjects[0] && state.subjects[0].id))
      : `<option value="">No subjects yet</option>`;
  }

  function updateTimerDisplay() {
    const m = Math.floor(timerRemaining / 60).toString().padStart(2, "0");
    const s = Math.floor(timerRemaining % 60).toString().padStart(2, "0");
    document.getElementById("timerClock").textContent = `${m}:${s}`;
  }

  function logStudyMinutes(minutes) {
    if (minutes <= 0) return;
    const subjectId = document.getElementById("timerSubjectSelect").value || (state.subjects[0] && state.subjects[0].id);
    if (!subjectId) return;
    state.sessions.push({ date: todayStr(0), minutes, subjectId });
    saveState();
    renderDashboard();
  }

  document.getElementById("timerStartBtn").addEventListener("click", () => {
    if (state.subjects.length === 0) {
      showToast("Add a subject before starting a focus session.");
      return;
    }
    if (timerRunning) {
      // pause: log partial minutes studied so far this run
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById("timerStartBtn").textContent = "Start";
      const studied = Math.floor((timerTotalSeconds - timerRemaining) / 60);
      if (studied > 0) {
        logStudyMinutes(studied);
        timerTotalSeconds = timerRemaining; // don't double count on next pause
      }
      return;
    }
    timerRunning = true;
    document.getElementById("timerStartBtn").textContent = "Pause";
    timerInterval = setInterval(() => {
      timerRemaining--;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        document.getElementById("timerStartBtn").textContent = "Start";
        logStudyMinutes(Math.floor(timerTotalSeconds / 60));
        timerTotalSeconds = timerRemaining = 25 * 60;
        updateTimerDisplay();
        showToast("Focus session complete — nice work.");
      }
    }, 1000);
  });

  document.getElementById("timerResetBtn").addEventListener("click", () => {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById("timerStartBtn").textContent = "Start";
    timerRemaining = timerTotalSeconds;
    updateTimerDisplay();
  });

  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById("timerStartBtn").textContent = "Start";
      timerTotalSeconds = timerRemaining = Number(chip.dataset.mins) * 60;
      updateTimerDisplay();
    });
  });

  /* ------------------------------------------------------------------ *
   * Render orchestration
   * ------------------------------------------------------------------ */

  function renderAll() {
    refreshTimerSubjectSelect();
    renderDashboard();
    renderNotes();
    renderPlanner();
    renderFlashcards();
    renderSubjects();
  }

  updateTimerDisplay();
  renderAll();
})();