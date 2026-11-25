"use strict";

/* ------------------------------------------------------------------ *
 * FMGE 75-Day Study Planner
 * Data lives in localStorage under STORAGE_KEY. All user-entered text
 * is escaped before it is inserted into HTML.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "fmgePlanner75";
const TAB_KEY = "fmgePlanner75_tab";
const DATA_VERSION = 2;
const PASS_MARK = 150;
const BASE_TITLE = "FMGE 75-Day Study Planner";

const subjects = [
  ["Anatomy", "BD Chaurasia"],
  ["Physiology", "Ganong"],
  ["Biochemistry", "Harper"],
  ["Pathology", "Harsh Mohan"],
  ["Pharmacology", "KD Tripathi"],
  ["Microbiology", "Ananthanarayan"],
  ["PSM", "Park"],
  ["Forensic Medicine", "KS Narayan Reddy"],
  ["Medicine", "Harrison (selected)"],
  ["Surgery", "SRB Manual"],
  ["OBG", "DC Dutta"],
  ["Pediatrics", "OP Ghai"],
  ["ENT", "Dhingra"],
  ["Ophthalmology", "AK Khurana"],
  ["Orthopaedics", "Maheshwari"],
  ["Dermatology", "Neena Khanna"],
  ["Psychiatry", "Niraj Ahuja"],
  ["Radiology", "Platform notes"],
  ["Anaesthesia", "Platform notes"]
];

const gtDays = [49, 54, 58, 63, 65, 68, 70, 73];

const phases = [
  {
    from: 1, to: 31,
    title: "Day 1–31 · Round 1",
    desc: "All 19 subjects, high-yield first. Complete first-pass notes/videos and MCQs.",
    short: "Round 1 · All 19 subjects, high-yield first"
  },
  {
    from: 32, to: 48,
    title: "Day 32–48 · Revision 1",
    desc: "First revision + previous-year questions (PYQs).",
    short: "Revision 1 · PYQs + revise notes"
  },
  {
    from: 49, to: 63,
    title: "Day 49–63 · GT block 1",
    desc: "GT 1 to 4 + same-day analysis + weak-subject revision.",
    short: "GT block 1 · Test, analyse, revise weak areas"
  },
  {
    from: 64, to: 73,
    title: "Day 64–73 · GT block 2",
    desc: "GT 5 to 8 + same-day analysis.",
    short: "GT block 2 · Test + same-day analysis"
  },
  {
    from: 74, to: 75,
    title: "Day 74–75 · Final revision",
    desc: "Final revision only. No new topics.",
    short: "Final revision only · No new topics",
    accent: true
  }
];

const CAT_LABELS = {
  "1": "Not read",
  "2": "Read, still wrong",
  "3": "Silly mistake",
  "4": "Confused between 2 options"
};

const TIMER_MODES = { pomodoro: 1500, short: 300, long: 900, stopwatch: 0, custom: 0 };

/* ----------------------------- helpers ----------------------------- */

const $ = id => document.getElementById(id);

function isObj(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function num(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

/* Local-date helpers. Never use toISOString() for calendar dates: it is UTC. */
function localDateStr(date) {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

function today() {
  return localDateStr(new Date());
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(value, n) {
  const date = parseDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + n);
  return localDateStr(date);
}

function daysBetween(from, to) {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return null;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return value || "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function planForDay(day) {
  const phase = phases.find(p => day >= p.from && day <= p.to);
  return phase ? phase.short : "";
}

/* --------------------------- data model ---------------------------- */

function normalizeData(raw) {
  const src = isObj(raw) ? raw : {};
  const out = {
    version: DATA_VERSION,
    updatedAt: Number(src.updatedAt) || 0,
    subjects: {},
    days: {},
    gts: {},
    gtSubjectScores: {},
    wrongs: [],
    logs: {},
    settings: {},
    timer: null
  };

  if (isObj(src.subjects)) {
    subjects.forEach(([name]) => {
      const value = src.subjects[name];
      if (isObj(value)) {
        out.subjects[name] = {
          done: Boolean(value.done),
          read: String(value.read || "").slice(0, 2000),
          left: String(value.left || "").slice(0, 2000)
        };
      }
    });
  }

  if (isObj(src.days)) {
    Object.keys(src.days).forEach(key => {
      const day = Number(key);
      const value = src.days[key];
      if (!Number.isInteger(day) || day < 1 || day > 75 || !isObj(value)) return;
      out.days[day] = {
        done: Boolean(value.done),
        note: String(value.note || "").slice(0, 500)
      };
    });
  }

  if (isObj(src.gts)) {
    Object.keys(src.gts).forEach(key => {
      const index = Number(key);
      const value = src.gts[key];
      if (!Number.isInteger(index) || index < 0 || index >= gtDays.length || !isObj(value)) return;
      const score = value.score;
      out.gts[index] = {
        score: score === "" || score === undefined || score === null ? "" : num(score, 0, 300, ""),
        analysis: Boolean(value.analysis),
        action: String(value.action || "").slice(0, 500)
      };
    });
  }

  if (isObj(src.gtSubjectScores)) {
    Object.keys(src.gtSubjectScores).forEach(key => {
      const index = Number(key);
      const value = src.gtSubjectScores[key];
      if (!Number.isInteger(index) || index < 0 || index >= gtDays.length || !isObj(value)) return;
      const clean = {};
      subjects.forEach(([name]) => {
        const score = num(value[name], 0, 100, null);
        if (score !== null) clean[name] = score;
      });
      out.gtSubjectScores[index] = clean;
    });
  }

  if (Array.isArray(src.wrongs)) {
    out.wrongs = src.wrongs.map(entry => {
      if (!isObj(entry)) return null;
      const topic = String(entry.topic || "").trim().slice(0, 300);
      if (!topic) return null;
      return {
        id: String(entry.id || uid()).slice(0, 80),
        subject: subjects.some(([name]) => name === entry.subject) ? entry.subject : subjects[0][0],
        cat: CAT_LABELS[String(entry.cat)] ? String(entry.cat) : "1",
        topic,
        date: isDate(entry.date) ? entry.date : today(),
        note: String(entry.note || "").slice(0, 2000)
      };
    }).filter(Boolean);
  }

  if (isObj(src.logs)) {
    Object.keys(src.logs).forEach(date => {
      const entries = src.logs[date];
      if (!isDate(date) || !Array.isArray(entries)) return;
      const clean = [];
      entries.forEach(entry => {
        if (!isObj(entry)) return;
        const subject = String(entry.subject || "");
        if (!subjects.some(([name]) => name === subject)) return;
        const mcq = num(entry.mcq, 0, 100000, 0);
        clean.push({
          subject,
          h: num(entry.h, 0, 24, 0),
          m: num(entry.m, 0, 59, 0),
          mcq,
          correct: num(entry.correct, 0, mcq, 0),
          read: String(entry.read || "").slice(0, 2000),
          left: String(entry.left || "").slice(0, 2000)
        });
      });
      if (clean.length) out.logs[date] = clean;
    });
  }

  const settings = isObj(src.settings) ? src.settings : {};
  out.settings = {
    start: isDate(settings.start) ? settings.start : "",
    exam: isDate(settings.exam) ? settings.exam : "",
    target: num(settings.target, 1, 1000, 150),
    score: num(settings.score, 1, 300, 180),
    platform: ["", "Marrow", "PrepLadder", "DAMS", "Other"].includes(settings.platform) ? settings.platform : "",
    platformOther: String(settings.platformOther || "").slice(0, 80),
    lastGT: num(settings.lastGT, 0, gtDays.length - 1, 0)
  };

  if (isObj(src.timer)) {
    const mode = ["pomodoro", "short", "long", "stopwatch", "custom"].includes(src.timer.mode)
      ? src.timer.mode
      : "pomodoro";
    const custom = num(src.timer.custom, 1, 600, 50);
    const fallback = mode === "custom" ? custom * 60 : (TIMER_MODES[mode] || 1500);
    out.timer = {
      mode,
      custom,
      remaining: src.timer.remaining === undefined ? fallback : num(src.timer.remaining, 0, 86400, fallback),
      elapsed: num(src.timer.elapsed, 0, 864000, 0),
      running: Boolean(src.timer.running),
      endAt: Number(src.timer.endAt) > 0 ? Number(src.timer.endAt) : null,
      startedAt: Number(src.timer.startedAt) > 0 ? Number(src.timer.startedAt) : null
    };
  }

  return out;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeData(raw ? JSON.parse(raw) : {});
  } catch (error) {
    return normalizeData({});
  }
}

let data = loadData();

/* ----------------------------- saving ------------------------------ */

let toastTimer = null;

function toast(message, kind) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 3200);
}

function updateSavedLabel() {
  const el = $("lastSaved");
  if (!el) return;
  if (!data.updatedAt) {
    el.textContent = "Not saved yet";
    return;
  }
  const time = new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  el.textContent = "Last saved " + time + " on this device";
}

function save() {
  data.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    toast("Could not save in this browser. Export a backup now.", "error");
  }
  updateSavedLabel();
}

/* ----------------------------- metrics ----------------------------- */

function computeStats() {
  const subjectsDone = subjects.filter(([name]) => data.subjects[name] && data.subjects[name].done).length;
  const daysDone = Object.keys(data.days).filter(key => {
    const day = Number(key);
    return day >= 1 && day <= 75 && data.days[key].done;
  }).length;
  const gtsDone = gtDays.reduce((total, _, index) => {
    const score = data.gts[index] ? data.gts[index].score : "";
    return total + (score !== "" && Number.isFinite(Number(score)) ? 1 : 0);
  }, 0);
  const allLogs = Object.values(data.logs).flat();
  const mcq = allLogs.reduce((total, entry) => total + (entry.mcq || 0), 0);
  const correct = allLogs.reduce((total, entry) => total + (entry.correct || 0), 0);
  const accuracy = mcq > 0 ? Math.round((correct / mcq) * 100) : null;
  const percent = Math.max(0, Math.min(100, Math.round(
    (subjectsDone / 19 + daysDone / 75 + gtsDone / 8) / 3 * 100
  )));
  return { subjectsDone, daysDone, gtsDone, mcq, correct, accuracy, percent };
}

/* ----------------------------- rendering --------------------------- */

function renderStats() {
  const stats = computeStats();
  $("daysDone").textContent = stats.daysDone + "/75";
  $("subjectsDone").textContent = stats.subjectsDone + "/19";
  $("mcqTotal").textContent = stats.mcq.toLocaleString();
  $("mcqSub").textContent = stats.mcq > 0
    ? stats.accuracy + "% accuracy · recorded in daily log"
    : "Total recorded in daily log";
  $("gtDone").textContent = stats.gtsDone + "/8";
  $("subjectProgress").textContent = stats.subjectsDone + "/19 done";
  $("planProgress").textContent = stats.daysDone + "/75 days";
  $("overallPct").textContent = stats.percent + "%";
  $("overallBar").style.width = stats.percent + "%";
  $("overallProgress").setAttribute("aria-valuenow", String(stats.percent));
  $("targetDisplay").textContent = data.settings.score + "+";

  let dayMessage = "Set your start date below";
  if (data.settings.start) {
    const diff = daysBetween(data.settings.start, today());
    if (diff !== null) {
      if (diff < 0) {
        const remaining = Math.abs(diff);
        dayMessage = "Plan starts in " + remaining + " day" + (remaining === 1 ? "" : "s");
      } else if (diff + 1 > 75) {
        dayMessage = "75-day plan period ended";
      } else {
        dayMessage = "Today is Day " + (diff + 1);
      }
    }
  }
  $("dayNow").textContent = dayMessage;
}

function renderCountdown() {
  const banner = $("countdownBanner");
  const exam = data.settings.exam;
  const start = data.settings.start;

  if (!exam) {
    banner.innerHTML = "<b>No exam date set.</b> Add it in Exam setup to see your countdown.";
    return;
  }

  const daysLeft = daysBetween(today(), exam);
  let main;
  if (daysLeft > 0) {
    main = "<b>" + daysLeft + " day" + (daysLeft === 1 ? "" : "s") + " to exam</b> · " + esc(formatDate(exam));
  } else if (daysLeft === 0) {
    main = "<b>Exam is today.</b> Revise only your weak spots and stay calm.";
  } else {
    main = "<b>Exam date has passed.</b> Update it in Exam setup.";
  }

  let note = "";
  if (start) {
    const planEnd = addDays(start, 74);
    const gap = daysBetween(planEnd, exam);
    if (gap !== null && gap < 0) {
      note = " Your 75-day plan ends after the exam date.";
    } else if (gap !== null && gap <= 3) {
      note = " Your plan ends just before the exam — keep those last days light.";
    }
  }

  banner.innerHTML = main + (note ? '<span class="muted">' + note + "</span>" : "");
}

function renderToday() {
  const entries = data.logs[today()] || [];
  const mcq = entries.reduce((total, entry) => total + (entry.mcq || 0), 0);
  const hours = entries.reduce((total, entry) => total + (entry.h || 0), 0);
  const minutes = entries.reduce((total, entry) => total + (entry.m || 0), 0);
  const target = data.settings.target || 150;

  $("todaySummary").textContent = entries.length
    ? entries.length + " subject log" + (entries.length === 1 ? "" : "s") + " saved today."
    : "No daily log added yet.";
  $("todayMcqLabel").textContent = mcq.toLocaleString() + " / " + target.toLocaleString() + " MCQs today";
  $("todayHours").textContent = entries.length ? hours + "h " + minutes + "m studied" : "";

  const percent = target > 0 ? Math.min(100, Math.round((mcq / target) * 100)) : 0;
  $("todayBar").style.width = percent + "%";
  $("todayProgress").setAttribute("aria-valuenow", String(percent));
}

function renderPhaseList() {
  $("phaseList").innerHTML = phases.map(phase => (
    '<div class="phase"' + (phase.accent ? ' style="border-color:var(--accent)"' : "") + ">" +
      "<strong>" + esc(phase.title) + "</strong>" +
      "<span>" + esc(phase.desc) + "</span>" +
    "</div>"
  )).join("");
}

function renderSubjects() {
  $("subjectRows").innerHTML = subjects.map(([subject, book], index) => {
    const entry = data.subjects[subject] || {};
    return "<tr>" +
      '<td><input type="checkbox" aria-label="Mark ' + esc(subject) + ' complete" ' +
        (entry.done ? "checked " : "") +
        'onchange="updateSubject(' + index + ',\'done\',this.checked)"></td>' +
      '<td class="subject-name">' + esc(subject) + "</td>" +
      '<td class="book">' + esc(book) + "</td>" +
      '<td><input aria-label="What I read in ' + esc(subject) + '" value="' + esc(entry.read || "") + '" ' +
        'placeholder="Covered..." oninput="updateSubject(' + index + ',\'read\',this.value)"></td>' +
      '<td><input aria-label="What is left in ' + esc(subject) + '" value="' + esc(entry.left || "") + '" ' +
        'placeholder="Pending..." oninput="updateSubject(' + index + ',\'left\',this.value)"></td>' +
    "</tr>";
  }).join("");
}

function renderDays() {
  const start = data.settings.start;
  $("dayRows").innerHTML = Array.from({ length: 75 }, (_, index) => {
    const day = index + 1;
    const entry = data.days[day] || {};
    return "<tr>" +
      '<td><input type="checkbox" aria-label="Mark day ' + day + ' complete" ' +
        (entry.done ? "checked " : "") +
        'onchange="updateDay(' + day + ',\'done\',this.checked)"></td>' +
      "<td><b>" + day + "</b></td>" +
      "<td>" + (start ? esc(addDays(start, index)) : "—") + "</td>" +
      "<td>" + esc(planForDay(day)) + "</td>" +
      '<td><input aria-label="Notes for day ' + day + '" value="' + esc(entry.note || "") + '" ' +
        'placeholder="Your focus..." oninput="updateDay(' + day + ',\'note\',this.value)"></td>' +
    "</tr>";
  }).join("");
}

function renderGT() {
  const start = data.settings.start;

  $("gtSchedule").innerHTML = gtDays.map((day, index) => (
    '<div class="gt"><b>Day ' + day + "</b><span>GT " + (index + 1) +
    (start ? " · " + esc(addDays(start, day - 1)) : "") + "</span></div>"
  )).join("");

  $("gtRows").innerHTML = gtDays.map((day, index) => {
    const entry = data.gts[index] || {};
    return "<tr>" +
      "<td><b>GT " + (index + 1) + "</b></td>" +
      "<td>" + day + "</td>" +
      "<td>" + (start ? esc(addDays(start, day - 1)) : "—") + "</td>" +
      '<td><input type="number" min="0" max="300" step="1" placeholder="/300" ' +
        'aria-label="GT ' + (index + 1) + ' score out of 300" value="' + esc(entry.score ?? "") + '" ' +
        'onchange="updateGT(' + index + ',\'score\',this.value)"></td>' +
      '<td><input type="checkbox" aria-label="GT ' + (index + 1) + ' analysis done" ' +
        (entry.analysis ? "checked " : "") +
        'onchange="updateGT(' + index + ',\'analysis\',this.checked)"></td>' +
      '<td><input aria-label="GT ' + (index + 1) + ' weak areas and action" value="' + esc(entry.action || "") + '" ' +
        'placeholder="Weak areas / action" oninput="updateGT(' + index + ',\'action\',this.value)"></td>' +
    "</tr>";
  }).join("");
}

function getSubjectScore(gtIndex, subject) {
  const value = data.gtSubjectScores[gtIndex] ? data.gtSubjectScores[gtIndex][subject] : undefined;
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scoredGTs(subject) {
  const found = [];
  for (let i = gtDays.length - 1; i >= 0; i--) {
    const score = getSubjectScore(i, subject);
    if (score !== null) found.push({ index: i, score });
  }
  return found;
}

function subjectStatus(subject) {
  const scores = scoredGTs(subject);
  if (!scores.length) return { kind: "none", label: "No data", scores: [] };

  const latest = scores[0].score;
  const previous = scores[1] ? scores[1].score : null;

  if (latest < 50) {
    if (previous !== null && previous < 50) {
      return { kind: "revise", label: "+1 day revision", scores: scores.slice(0, 2) };
    }
    return { kind: "watch", label: "Watch", scores: scores.slice(0, 2) };
  }
  return { kind: "ok", label: "OK", scores: scores.slice(0, 2) };
}

function renderGTSubjectGrid() {
  const select = $("subjectGTSelect");
  if (!select) return;
  const selected = Number(select.value || 0);
  const scores = data.gtSubjectScores[selected] || {};

  $("subjectGTGrid").innerHTML = subjects.map(([subject], index) => (
    '<div class="subject-analysis-card">' +
      "<h4>" + esc(subject) + "</h4>" +
      '<div class="subject-score-row">' +
        '<label class="muted" for="gtScore' + index + '" style="font-size:12px">GT ' + (selected + 1) + " score</label>" +
        '<input id="gtScore' + index + '" type="number" min="0" max="100" step="0.1" placeholder="%" ' +
          'aria-label="' + esc(subject) + " GT " + (selected + 1) + ' percentage" ' +
          'value="' + esc(scores[subject] ?? "") + '" ' +
          'onchange="updateSubjectGTScore(' + selected + "," + index + ',this.value)">' +
        '<span class="muted" style="font-size:11px">/ 100%</span>' +
      "</div>" +
    "</div>"
  )).join("");
}

function renderGTReport() {
  const counts = { ok: 0, watch: 0, revise: 0 };

  const report = subjects.map(([subject]) => {
    const status = subjectStatus(subject);
    if (status.kind !== "none") counts[status.kind]++;

    const scoresText = status.scores.length
      ? status.scores.slice().reverse().map(item => "GT " + (item.index + 1) + ": " + item.score + "%").join(" · ")
      : "No scores entered";

    const action =
      status.kind === "revise" ? "Give this subject 1 extra revision day." :
      status.kind === "watch" ? "Monitor this subject and revise weak topics." :
      status.kind === "ok" ? "Continue regular revision and MCQs." :
      "Enter scores to generate an action.";

    const className =
      status.kind === "revise" ? "status-revise" :
      status.kind === "watch" ? "status-watch" :
      status.kind === "ok" ? "status-ok" : "status-none";

    return '<div class="list-item"><div>' +
      "<b>" + esc(subject) + "</b>" +
      '<div class="muted" style="font-size:12px">' + scoresText + "</div>" +
      '<div style="font-size:12px">' + action + "</div>" +
      "</div>" +
      '<span class="' + className + '">' + esc(status.label) + "</span>" +
    "</div>";
  }).join("");

  $("gtOkCount").textContent = counts.ok;
  $("gtWatchCount").textContent = counts.watch;
  $("gtReviseCount").textContent = counts.revise;
  $("subjectGTReport").innerHTML = report;
}

function renderWrongs() {
  $("wrongCount").textContent = data.wrongs.length + " " + (data.wrongs.length === 1 ? "entry" : "entries");

  $("wrongList").innerHTML = data.wrongs.length
    ? data.wrongs.map(entry => (
        '<div class="list-item"><div>' +
          "<b>" + esc(entry.topic) + "</b> " +
          '<span class="pill">' + esc(entry.cat + " · " + (CAT_LABELS[entry.cat] || "Uncategorised")) + "</span>" +
          '<div class="muted" style="font-size:12px">' +
            esc(entry.subject) + " · " + esc(entry.date) +
            (entry.note ? " · " + esc(entry.note) : "") +
          "</div>" +
        "</div>" +
        '<button type="button" class="danger small" data-delete-wrong="' + esc(entry.id) + '">Delete</button>' +
      "</div>"
      )).join("")
    : '<div class="empty">No wrong questions logged yet.</div>';
}

function renderLogs() {
  const dates = Object.keys(data.logs).sort().reverse();

  $("logHistory").innerHTML = dates.length
    ? dates.map(date => {
        const entries = data.logs[date];
        const mcq = entries.reduce((total, entry) => total + (entry.mcq || 0), 0);
        const detail = entries.map(entry =>
          esc(entry.subject) + ": " + entry.h + "h " + entry.m + "m · " + entry.mcq + " MCQs"
        ).join(" | ");
        return '<div class="list-item"><div>' +
          "<b>" + esc(date) + "</b>" +
          '<div class="muted" style="font-size:12px">' + detail + "</div>" +
          '<div class="muted" style="font-size:12px">' + mcq + " MCQs total</div>" +
        "</div>" +
        '<button type="button" class="danger small" data-delete-log="' + esc(date) + '">Delete</button>' +
        "</div>";
      }).join("")
    : '<div class="empty">No daily logs yet.</div>';
}

function renderSettings() {
  const settings = data.settings;
  $("startDate").value = settings.start || "";
  $("examDate").value = settings.exam || "";
  $("mcqTarget").value = settings.target || 150;
  $("scoreTarget").value = settings.score || 180;
  $("platform").value = settings.platform || "";
  $("platformOther").value = settings.platformOther || "";
}

function renderAll() {
  renderSubjects();
  renderDays();
  renderGT();
  renderGTSubjectGrid();
  renderGTReport();
  renderWrongs();
  renderLogs();
  renderStats();
  renderCountdown();
  renderToday();
}

/* ----------------------------- mutations --------------------------- */

function updateSubject(index, key, value) {
  const subject = subjects[index][0];
  data.subjects[subject] = data.subjects[subject] || {};
  data.subjects[subject][key] = value;
  save();
  if (key === "done") renderStats();
}

function updateDay(day, key, value) {
  data.days[day] = data.days[day] || {};
  data.days[day][key] = value;
  save();
  if (key === "done") renderStats();
}

function updateGT(index, key, value) {
  if (key === "score" && value !== "") {
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 300) {
      toast("GT score must be between 0 and 300.", "error");
      renderGT();
      return;
    }
    value = score;
  }

  data.gts[index] = data.gts[index] || {};
  data.gts[index][key] = value;
  save();
  if (key === "score" || key === "analysis") renderStats();
}

function updateSubjectGTScore(gtIndex, subjectIndex, value) {
  const subject = subjects[subjectIndex][0];
  data.gtSubjectScores[gtIndex] = data.gtSubjectScores[gtIndex] || {};

  if (value === "") {
    delete data.gtSubjectScores[gtIndex][subject];
  } else {
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      toast("Enter a percentage from 0 to 100.", "error");
      renderGTSubjectGrid();
      return;
    }
    data.gtSubjectScores[gtIndex][subject] = score;
  }

  save();
  renderGTReport();
}

function addWrong() {
  const topic = $("wrongTopic").value.trim();
  if (!topic) {
    toast("Add a topic or question reference.", "error");
    $("wrongTopic").focus();
    return;
  }

  data.wrongs.unshift({
    id: uid(),
    subject: $("wrongSubject").value,
    cat: $("wrongCategory").value,
    topic,
    date: $("wrongDate").value || today(),
    note: $("wrongNote").value.trim()
  });

  $("wrongTopic").value = "";
  $("wrongNote").value = "";
  save();
  renderWrongs();
  toast("Wrong question saved.", "success");
}

function deleteWrong(id) {
  data.wrongs = data.wrongs.filter(entry => String(entry.id) !== String(id));
  save();
  renderWrongs();
  toast("Entry deleted.");
}

function clearWrong() {
  if (!confirm("Delete all saved wrong-question entries?")) return;
  data.wrongs = [];
  save();
  renderWrongs();
  toast("Notebook cleared.");
}

function saveLog() {
  const hours = Number($("studyHours").value || 0);
  const minutes = Number($("studyMinutes").value || 0);
  const mcqs = Number($("mcqs").value || 0);
  const correct = Number($("correct").value || 0);
  const invalid =
    !Number.isFinite(hours) || !Number.isFinite(minutes) ||
    !Number.isFinite(mcqs) || !Number.isFinite(correct) ||
    hours < 0 || hours > 24 || minutes < 0 || minutes > 59 ||
    mcqs < 0 || correct < 0 || correct > mcqs;

  if (invalid) {
    $("logError").textContent = "Check the numbers: hours 0–24, minutes 0–59, and correct MCQs cannot exceed total MCQs.";
    return;
  }
  $("logError").textContent = "";

  const date = $("logDate").value || today();
  const subject = $("logSubject").value;
  const entry = {
    subject,
    h: hours,
    m: minutes,
    mcq: mcqs,
    correct,
    read: $("readToday").value.trim(),
    left: $("leftToday").value.trim()
  };

  data.logs[date] = data.logs[date] || [];
  const index = data.logs[date].findIndex(item => item.subject === subject);
  if (index >= 0) data.logs[date][index] = entry;
  else data.logs[date].push(entry);

  $("studyHours").value = 0;
  $("studyMinutes").value = 0;
  $("mcqs").value = 0;
  $("correct").value = 0;
  $("readToday").value = "";
  $("leftToday").value = "";

  save();
  renderLogs();
  renderStats();
  renderToday();
  toast("Daily log saved.", "success");
}

function deleteLog(date) {
  if (!confirm("Delete daily logs for " + date + "?")) return;
  delete data.logs[date];
  save();
  renderLogs();
  renderStats();
  renderToday();
  toast("Daily log deleted.");
}

function saveSettings(showToast) {
  const start = $("startDate").value;
  const exam = $("examDate").value;

  if (start && exam && daysBetween(start, exam) < 0) {
    toast("Heads up: the exam date is before the plan start date.", "error");
  }

  data.settings = Object.assign({}, data.settings, {
    start,
    exam,
    target: num($("mcqTarget").value, 1, 1000, 150),
    score: num($("scoreTarget").value, 1, 300, 180)
  });

  save();
  renderSettings();
  renderDays();
  renderGT();
  renderCountdown();
  renderToday();
  renderStats();

  if (showToast) toast("Setup saved.", "success");
}

/* ------------------------------ timer ------------------------------ */

let timerState = null;
let tickId = null;

function saveTimer() {
  data.timer = Object.assign({}, timerState);
  save();
}

function modeSeconds() {
  if (!timerState) return 1500;
  return timerState.mode === "custom" ? timerState.custom * 60 : (TIMER_MODES[timerState.mode] || 0);
}

function showClock() {
  if (!timerState) return;
  const value = timerState.mode === "stopwatch" ? timerState.elapsed : timerState.remaining;
  const text = pad2(Math.floor(value / 60)) + ":" + pad2(value % 60);
  $("clock").textContent = text;
  document.title = timerState.running ? text + " · " + BASE_TITLE : BASE_TITLE;
}

function updateTimerValues() {
  if (!timerState) return;
  const now = Date.now();
  if (timerState.mode === "stopwatch") {
    timerState.elapsed = Math.max(0, Math.floor((now - timerState.startedAt) / 1000));
  } else {
    timerState.remaining = Math.max(0, Math.ceil((timerState.endAt - now) / 1000));
  }
}

function startTicking() {
  if (tickId) clearInterval(tickId);
  tickId = setInterval(tick, 250);
}

function tick() {
  if (!timerState || !timerState.running) return;
  updateTimerValues();
  if (timerState.mode !== "stopwatch" && timerState.remaining <= 0) {
    completeTimer();
    return;
  }
  showClock();
}

function completeTimer() {
  if (tickId) {
    clearInterval(tickId);
    tickId = null;
  }
  timerState.running = false;
  timerState.remaining = 0;
  timerState.endAt = null;
  timerState.startedAt = null;
  $("timerStart").textContent = "Start";
  $("timerStatus").textContent = "Session complete. Take a short break.";
  showClock();
  saveTimer();
  toast("Focus session complete. Take a short break.", "success");
}

function startTimer() {
  if (!timerState || timerState.running) return;

  if (timerState.mode === "stopwatch") {
    timerState.startedAt = Date.now() - timerState.elapsed * 1000;
  } else {
    if (timerState.remaining <= 0) timerState.remaining = modeSeconds();
    timerState.endAt = Date.now() + timerState.remaining * 1000;
  }

  timerState.running = true;
  $("timerStart").textContent = "Pause";
  $("timerStatus").textContent = "Stay on one task until the timer ends.";
  startTicking();
  showClock();
  saveTimer();
}

function pauseTimer() {
  if (!timerState || !timerState.running) return;
  updateTimerValues();
  timerState.running = false;
  timerState.endAt = null;
  timerState.startedAt = null;
  if (tickId) {
    clearInterval(tickId);
    tickId = null;
  }
  $("timerStart").textContent = "Start";
  showClock();
  saveTimer();
}

function toggleTimer() {
  if (!timerState) return;
  if (timerState.running) pauseTimer();
  else startTimer();
}

function resetTimer() {
  if (!timerState) return;
  if (tickId) {
    clearInterval(tickId);
    tickId = null;
  }
  timerState.running = false;
  timerState.endAt = null;
  timerState.startedAt = null;
  timerState.elapsed = 0;
  timerState.remaining = modeSeconds();
  $("timerStart").textContent = "Start";
  $("timerStatus").textContent = "Timer reset.";
  showClock();
  saveTimer();
}

function setTimerMode() {
  if (!timerState) return;
  if (tickId) {
    clearInterval(tickId);
    tickId = null;
  }
  timerState.running = false;
  timerState.endAt = null;
  timerState.startedAt = null;
  timerState.mode = $("timerMode").value;
  timerState.custom = num($("customMinutes").value, 1, 600, 50);
  timerState.remaining = modeSeconds();
  timerState.elapsed = 0;
  $("timerStart").textContent = "Start";
  $("timerStatus").textContent = "Focus on one task until the timer ends.";
  showClock();
  saveTimer();
}

function initTimer() {
  const saved = isObj(data.timer) ? data.timer : {};
  const mode = ["pomodoro", "short", "long", "stopwatch", "custom"].includes(saved.mode)
    ? saved.mode
    : "pomodoro";
  const custom = num(saved.custom, 1, 600, 50);
  const fallback = mode === "custom" ? custom * 60 : (TIMER_MODES[mode] || 1500);

  timerState = {
    mode,
    custom,
    remaining: saved.remaining === undefined ? fallback : num(saved.remaining, 0, 86400, fallback),
    elapsed: num(saved.elapsed, 0, 864000, 0),
    running: Boolean(saved.running),
    endAt: Number(saved.endAt) > 0 ? Number(saved.endAt) : null,
    startedAt: Number(saved.startedAt) > 0 ? Number(saved.startedAt) : null
  };

  $("timerMode").value = mode;
  $("customMinutes").value = custom;

  if (timerState.running) {
    if (mode === "stopwatch") {
      if (!timerState.startedAt) timerState.startedAt = Date.now() - timerState.elapsed * 1000;
    } else {
      if (!timerState.endAt) timerState.endAt = Date.now() + timerState.remaining * 1000;
      timerState.remaining = Math.max(0, Math.ceil((timerState.endAt - Date.now()) / 1000));
      if (timerState.remaining <= 0) {
        timerState.running = false;
        timerState.remaining = 0;
        timerState.endAt = null;
        $("timerStatus").textContent = "Session complete. Take a short break.";
      }
    }

    if (timerState.running) {
      startTicking();
      $("timerStart").textContent = "Pause";
    } else {
      $("timerStart").textContent = "Start";
      saveTimer();
    }
  } else {
    $("timerStart").textContent = "Start";
  }

  showClock();
}

/* --------------------------- backup / restore ---------------------- */

function exportData() {
  const payload = Object.assign({}, data, {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString()
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fmge-75-day-planner-backup-" + today() + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup downloaded.", "success");
}

function importData(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    toast("Backup file is too large.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const next = normalizeData(parsed);
      const summary =
        Object.keys(next.days).length + " day notes, " +
        Object.keys(next.logs).length + " daily logs, " +
        next.wrongs.length + " mistakes, " +
        Object.keys(next.gts).length + " GT entries.";

      if (!confirm("Replace all data in this browser with this backup?\n\nBackup contains: " + summary)) {
        return;
      }

      data = next;
      save();
      renderSettings();
      renderAll();
      initTimer();
      toast("Backup imported.", "success");
    } catch (error) {
      toast("Could not read this backup file.", "error");
    }
  };
  reader.onerror = () => toast("Could not read this backup file.", "error");
  reader.readAsText(file);
}

/* ------------------------------- tabs ------------------------------ */

function activateTab(name, focus) {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const target = tabs.find(tab => tab.dataset.tab === name) || tabs[0];

  tabs.forEach(tab => {
    const active = tab === target;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  });

  document.querySelectorAll(".panel").forEach(panel => {
    const active = panel.id === target.dataset.tab;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  if (focus) target.focus();
  try {
    localStorage.setItem(TAB_KEY, target.dataset.tab);
  } catch (error) {
    /* ignore */
  }
}

function restoreTab() {
  let saved = null;
  try {
    saved = localStorage.getItem(TAB_KEY);
  } catch (error) {
    /* ignore */
  }
  activateTab(saved || "dashboard", false);
}

/* ----------------------------- wiring ------------------------------ */

function setupSelects() {
  ["wrongSubject", "logSubject"].forEach(id => {
    $(id).innerHTML = subjects.map(([subject]) => (
      '<option value="' + esc(subject) + '">' + esc(subject) + "</option>"
    )).join("");
  });
}

function setupGTSelect() {
  const select = $("subjectGTSelect");
  select.innerHTML = gtDays.map((day, index) => (
    '<option value="' + index + '">GT ' + (index + 1) + " · Day " + day + "</option>"
  )).join("");
  select.value = String(data.settings.lastGT || 0);
}

function bindEvents() {
  const tabs = Array.from(document.querySelectorAll(".tab"));

  tabs.forEach(tab => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab, false));
    tab.addEventListener("keydown", event => {
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        activateTab(next.dataset.tab, true);
      }
    });
  });

  $("printBtn").addEventListener("click", () => window.print());
  $("exportBtn").addEventListener("click", exportData);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", importData);
  $("openDaily").addEventListener("click", () => activateTab("daily", true));
  $("saveSettingsBtn").addEventListener("click", () => saveSettings(true));
  $("addWrongBtn").addEventListener("click", addWrong);
  $("clearWrongBtn").addEventListener("click", clearWrong);
  $("saveLogBtn").addEventListener("click", saveLog);

  ["startDate", "examDate", "mcqTarget", "scoreTarget"].forEach(id => {
    $(id).addEventListener("change", () => saveSettings(false));
  });

  $("platform").addEventListener("change", () => {
    data.settings.platform = $("platform").value;
    save();
  });

  $("platformOther").addEventListener("change", () => {
    data.settings.platformOther = $("platformOther").value.trim();
    save();
  });

  $("subjectGTSelect").addEventListener("change", () => {
    data.settings.lastGT = num($("subjectGTSelect").value, 0, gtDays.length - 1, 0);
    save();
    renderGTSubjectGrid();
  });

  $("timerMode").addEventListener("change", setTimerMode);
  $("timerStart").addEventListener("click", toggleTimer);
  $("timerReset").addEventListener("click", resetTimer);
  $("customMinutes").addEventListener("change", () => {
    if (!timerState) return;
    timerState.custom = num($("customMinutes").value, 1, 600, 50);
    $("customMinutes").value = timerState.custom;
    if (timerState.mode === "custom" && !timerState.running) {
      timerState.remaining = modeSeconds();
      showClock();
      saveTimer();
    }
  });

  $("wrongList").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-wrong]");
    if (button) deleteWrong(button.dataset.deleteWrong);
  });

  $("logHistory").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-log]");
    if (button) deleteLog(button.dataset.deleteLog);
  });

  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      data = normalizeData(JSON.parse(event.newValue));
      renderSettings();
      renderAll();
      toast("Updated from another tab.");
    } catch (error) {
      /* ignore malformed external writes */
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && timerState && timerState.running) tick();
  });

  window.addEventListener("beforeunload", save);
}

function init() {
  setupSelects();
  setupGTSelect();
  bindEvents();
  renderPhaseList();
  renderSettings();
  renderAll();
  initTimer();
  restoreTab();
  $("logDate").value = today();
  $("wrongDate").value = today();
  updateSavedLabel();
}

init();


