const STORAGE_KEY = "kaizenTrackerState";

const defaultState = {
  teamName: "Wildcats",
  teamLogo: "",
  roster: ["Avery Johnson", "Jordan Lee", "Morgan Smith", "Riley Davis", "Taylor Brown"],
  events: [],
  activeSession: null
};

let state = loadState();
let presentPlayers = new Set();
let removeMode = false;
let wheelRotation = 0;
let isSpinning = false;
let currentWheelEntries = [];

const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".nav-btn");
const headerTeamName = document.getElementById("headerTeamName");
const headerLogo = document.getElementById("headerLogo");
const logoFallback = document.getElementById("logoFallback");
const eventDate = document.getElementById("eventDate");
const sessionForm = document.getElementById("sessionForm");
const sessionTitle = document.getElementById("sessionTitle");
const sessionDetails = document.getElementById("sessionDetails");
const attendanceGrid = document.getElementById("attendanceGrid");
const saveSessionBtn = document.getElementById("saveSessionBtn");
const addPlayerAttendanceBtn = document.getElementById("addPlayerAttendanceBtn");
const toggleRemoveModeBtn = document.getElementById("toggleRemoveModeBtn");
const settingsForm = document.getElementById("settingsForm");
const teamNameInput = document.getElementById("teamNameInput");
const teamLogoInput = document.getElementById("teamLogoInput");
const addPlayerSettingsBtn = document.getElementById("addPlayerSettingsBtn");
const rosterList = document.getElementById("rosterList");
const summaryTableBody = document.getElementById("summaryTableBody");
const eventHistory = document.getElementById("eventHistory");
const totalEventsStat = document.getElementById("totalEventsStat");
const practiceHoursStat = document.getElementById("practiceHoursStat");
const trainingHoursStat = document.getElementById("trainingHoursStat");
const clearEventsBtn = document.getElementById("clearEventsBtn");
const raffleWheel = document.getElementById("raffleWheel");
const spinWheelBtn = document.getElementById("spinWheelBtn");
const refreshWheelBtn = document.getElementById("refreshWheelBtn");
const raffleWinner = document.getElementById("raffleWinner");
const wheelEntries = document.getElementById("wheelEntries");
const playerCardTemplate = document.getElementById("playerCardTemplate");

document.addEventListener("DOMContentLoaded", init);

function init() {
  eventDate.valueAsDate = new Date();
  teamNameInput.value = state.teamName;

  navButtons.forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  sessionForm.addEventListener("submit", startSession);
  saveSessionBtn.addEventListener("click", saveSession);
  addPlayerAttendanceBtn.addEventListener("click", () => addPlayer(true));
  addPlayerSettingsBtn.addEventListener("click", () => addPlayer(false));
  toggleRemoveModeBtn.addEventListener("click", toggleRemoveMode);
  settingsForm.addEventListener("submit", saveSettings);
  clearEventsBtn.addEventListener("click", clearEvents);
  spinWheelBtn.addEventListener("click", spinWheel);
  refreshWheelBtn.addEventListener("click", renderRaffleWheel);

  renderAll();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showPage(pageId) {
  pages.forEach(page => page.classList.toggle("active-page", page.id === pageId));
  navButtons.forEach(button => button.classList.toggle("active", button.dataset.page === pageId));

  if (pageId === "summaryPage") renderSummary();
  if (pageId === "rafflePage") renderRaffleWheel();
  if (pageId === "settingsPage") renderRoster();
}

function renderAll() {
  renderHeader();
  renderAttendancePage();
  renderRoster();
  renderSummary();
  renderRaffleWheel();
}

function renderHeader() {
  headerTeamName.textContent = state.teamName || "Kaizen Tracker";
  teamNameInput.value = state.teamName || "";

  if (state.teamLogo) {
    headerLogo.src = state.teamLogo;
    headerLogo.style.display = "block";
    logoFallback.style.display = "none";
  } else {
    headerLogo.removeAttribute("src");
    headerLogo.style.display = "none";
    logoFallback.style.display = "inline";
  }
}

function startSession(event) {
  event.preventDefault();

  const type = document.querySelector("input[name='eventType']:checked").value;
  const duration = Number(document.querySelector("input[name='duration']:checked").value);

  state.activeSession = {
    id: crypto.randomUUID(),
    date: eventDate.value,
    type,
    duration
  };

  presentPlayers = new Set();
  removeMode = false;
  saveState();
  renderAttendancePage();
  showPage("attendancePage");
}

function renderAttendancePage() {
  if (state.activeSession) {
    const session = state.activeSession;
    sessionTitle.textContent = `${session.type}`;
    sessionDetails.textContent = `${formatDate(session.date)} • ${formatHours(session.duration)}`;
    saveSessionBtn.disabled = false;
  } else {
    sessionTitle.textContent = "No active session";
    sessionDetails.textContent = "Start a session from the Launch page.";
    saveSessionBtn.disabled = true;
  }

  toggleRemoveModeBtn.textContent = `Remove Mode: ${removeMode ? "On" : "Off"}`;
  attendanceGrid.innerHTML = "";

  if (!state.roster.length) {
    attendanceGrid.innerHTML = `<div class="empty-state">No players yet. Add players from Attendance or Settings.</div>`;
    return;
  }

  state.roster.forEach(player => {
    const card = playerCardTemplate.content.cloneNode(true).querySelector(".player-card");
    const isPresent = presentPlayers.has(player);

    card.querySelector(".player-initials").textContent = getInitials(player);
    card.querySelector(".player-name").textContent = player;
    card.querySelector(".player-status").textContent = removeMode
      ? "Tap to remove"
      : isPresent
        ? "Present"
        : "Tap to mark present";

    card.classList.toggle("present", isPresent);
    card.classList.toggle("remove-mode", removeMode);

    card.addEventListener("click", () => {
      if (removeMode) {
        removePlayer(player);
        return;
      }

      if (!state.activeSession) {
        alert("Start a session first.");
        showPage("launchPage");
        return;
      }

      if (presentPlayers.has(player)) {
        presentPlayers.delete(player);
      } else {
        presentPlayers.add(player);
      }

      renderAttendancePage();
    });

    attendanceGrid.appendChild(card);
  });
}

function saveSession() {
  if (!state.activeSession) return;

  if (presentPlayers.size === 0) {
    const proceed = confirm("No players are marked present. Save this session anyway?");
    if (!proceed) return;
  }

  state.events.unshift({
    ...state.activeSession,
    players: Array.from(presentPlayers),
    savedAt: new Date().toISOString()
  });

  state.activeSession = null;
  presentPlayers = new Set();
  saveState();
  renderAll();
  showPage("summaryPage");
}

function addPlayer(returnToAttendance) {
  const name = prompt("Enter player name:");
  if (!name || !name.trim()) return;

  const cleanName = name.trim();
  const alreadyExists = state.roster.some(player => player.toLowerCase() === cleanName.toLowerCase());

  if (alreadyExists) {
    alert("That player is already on the roster.");
    return;
  }

  state.roster.push(cleanName);
  state.roster.sort((a, b) => a.localeCompare(b));
  saveState();
  renderAll();
  if (returnToAttendance) showPage("attendancePage");
}

function removePlayer(player) {
  const confirmed = confirm(`Remove ${player} from the roster? Existing event history will stay saved.`);
  if (!confirmed) return;

  state.roster = state.roster.filter(name => name !== player);
  presentPlayers.delete(player);
  saveState();
  renderAll();
}

function toggleRemoveMode() {
  removeMode = !removeMode;
  renderAttendancePage();
}

function saveSettings(event) {
  event.preventDefault();
  state.teamName = teamNameInput.value.trim() || "Kaizen Tracker";

  const file = teamLogoInput.files[0];
  if (!file) {
    saveState();
    renderHeader();
    alert("Settings saved.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.teamLogo = reader.result;
    saveState();
    renderHeader();
    alert("Settings saved.");
  };
  reader.readAsDataURL(file);
}

function renderRoster() {
  rosterList.innerHTML = "";

  if (!state.roster.length) {
    rosterList.innerHTML = `<div class="empty-state">No players on the roster yet.</div>`;
    return;
  }

  state.roster.forEach(player => {
    const item = document.createElement("div");
    item.className = "roster-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(player)}</strong>
        <p>Roster player</p>
      </div>
      <button class="icon-danger-btn" title="Remove ${escapeHtml(player)}">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => removePlayer(player));
    rosterList.appendChild(item);
  });
}

function renderSummary() {
  const totals = calculateTotals();
  const totalPracticePossible = state.events
    .filter(event => event.type === "Practice")
    .reduce((sum, event) => sum + event.duration, 0);
  const totalTrainingPossible = state.events
    .filter(event => event.type === "Optional Training")
    .reduce((sum, event) => sum + event.duration, 0);
  const totalPossible = totalPracticePossible + totalTrainingPossible;

  totalEventsStat.textContent = state.events.length;
  practiceHoursStat.textContent = formatNumber(totalPracticePossible);
  trainingHoursStat.textContent = formatNumber(totalTrainingPossible);

  summaryTableBody.innerHTML = "";
  const players = getAllPlayersFromRosterAndEvents();

  if (!players.length) {
    summaryTableBody.innerHTML = `<tr><td colspan="7">No roster or event data yet.</td></tr>`;
  } else {
    players.forEach(player => {
      const row = document.createElement("tr");
      const playerTotals = totals[player] || { practice: 0, training: 0 };
      const totalHours = playerTotals.practice + playerTotals.training;

      row.innerHTML = `
        <td><strong>${escapeHtml(player)}</strong></td>
        <td>${formatNumber(playerTotals.practice)}</td>
        <td>${percent(playerTotals.practice, totalPracticePossible)}</td>
        <td>${formatNumber(playerTotals.training)}</td>
        <td>${percent(playerTotals.training, totalTrainingPossible)}</td>
        <td>${formatNumber(totalHours)}</td>
        <td>${percent(totalHours, totalPossible)}</td>
      `;
      summaryTableBody.appendChild(row);
    });
  }

  renderEventHistory();
}

function calculateTotals() {
  const totals = {};

  getAllPlayersFromRosterAndEvents().forEach(player => {
    totals[player] = { practice: 0, training: 0 };
  });

  state.events.forEach(event => {
    event.players.forEach(player => {
      if (!totals[player]) totals[player] = { practice: 0, training: 0 };
      if (event.type === "Practice") {
        totals[player].practice += event.duration;
      } else {
        totals[player].training += event.duration;
      }
    });
  });

  return totals;
}

function renderEventHistory() {
  eventHistory.innerHTML = "";

  if (!state.events.length) {
    eventHistory.innerHTML = `<div class="empty-state">No events have been logged yet.</div>`;
    return;
  }

  state.events.forEach(event => {
    const item = document.createElement("div");
    item.className = "event-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(event.type)} • ${formatDate(event.date)}</strong>
        <p>${formatHours(event.duration)} • ${event.players.length} present</p>
      </div>
      <small>${escapeHtml(event.players.join(", ") || "No players")}</small>
    `;
    eventHistory.appendChild(item);
  });
}


function getWheelEntries() {
  const entries = [];

  state.events
    .filter(event => event.type === "Optional Training")
    .slice()
    .reverse()
    .forEach(event => {
      event.players.forEach(player => {
        entries.push({
          player,
          label: player,
          date: event.date,
          eventId: event.id
        });
      });
    });

  return entries;
}

function renderRaffleWheel() {
  if (!raffleWheel) return;

  currentWheelEntries = getWheelEntries();
  renderWheelEntriesList();
  drawWheel(currentWheelEntries, wheelRotation);

  spinWheelBtn.disabled = currentWheelEntries.length === 0 || isSpinning;
  if (currentWheelEntries.length === 0) {
    raffleWinner.textContent = "Log optional training sessions to build the wheel.";
  }
}

function renderWheelEntriesList() {
  wheelEntries.innerHTML = "";

  if (!currentWheelEntries.length) {
    wheelEntries.innerHTML = `<div class="empty-state">No raffle entries yet. Save an Optional Training session with players marked present.</div>`;
    return;
  }

  const counts = currentWheelEntries.reduce((map, entry) => {
    map[entry.player] = (map[entry.player] || 0) + 1;
    return map;
  }, {});

  Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([player, count]) => {
      const item = document.createElement("div");
      item.className = "wheel-entry-item";
      item.innerHTML = `
        <strong>${escapeHtml(player)}</strong>
        <span>${count} ${count === 1 ? "slice" : "slices"}</span>
      `;
      wheelEntries.appendChild(item);
    });
}

function drawWheel(entries, rotationDegrees = 0) {
  const canvas = raffleWheel;
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 18;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate((rotationDegrees * Math.PI) / 180);

  if (!entries.length) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#eef3f8";
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#153e75";
    ctx.stroke();
    ctx.restore();
    drawCenterBadge(ctx, center, center, "🎁");
    return;
  }

  const sliceAngle = (Math.PI * 2) / entries.length;
  const colors = ["#153e75", "#16a34a", "#f59e0b", "#dc2626", "#2563eb", "#7c3aed"];

  entries.forEach((entry, index) => {
    const start = index * sliceAngle - Math.PI / 2;
    const end = start + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();

    const mid = start + sliceAngle / 2;
    ctx.save();
    ctx.rotate(mid);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = entries.length > 18 ? "700 18px Inter, sans-serif" : "800 24px Inter, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 3;
    const label = entry.label.length > 14 ? `${entry.label.slice(0, 12)}…` : entry.label;
    ctx.fillText(label, radius - 24, 8);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#122033";
  ctx.stroke();
  ctx.restore();

  drawCenterBadge(ctx, center, center, "🎁");
}

function drawCenterBadge(ctx, x, y, text) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 48, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 38, 0, Math.PI * 2);
  ctx.fillStyle = "#f59e0b";
  ctx.fill();
  ctx.font = "30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function spinWheel() {
  if (!currentWheelEntries.length || isSpinning) return;

  isSpinning = true;
  spinWheelBtn.disabled = true;
  raffleWinner.textContent = "Spinning...";

  const winningIndex = Math.floor(Math.random() * currentWheelEntries.length);
  const sliceDegrees = 360 / currentWheelEntries.length;
  const targetCenter = winningIndex * sliceDegrees + sliceDegrees / 2;
  const fullSpins = 5 + Math.floor(Math.random() * 3);
  const targetRotation = fullSpins * 360 - targetCenter;
  const startRotation = wheelRotation;
  const change = targetRotation - startRotation;
  const startTime = performance.now();
  const duration = 4200;

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    wheelRotation = startRotation + change * eased;
    drawWheel(currentWheelEntries, wheelRotation);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelRotation = ((targetRotation % 360) + 360) % 360;
      isSpinning = false;
      const winner = currentWheelEntries[winningIndex];
      raffleWinner.textContent = `${winner.player} wins! Entry earned on ${formatDate(winner.date)}.`;
      spinWheelBtn.disabled = false;
      drawWheel(currentWheelEntries, wheelRotation);
    }
  }

  requestAnimationFrame(animate);
}

function clearEvents() {
  if (!state.events.length) return;
  const confirmed = confirm("Clear all logged events? This cannot be undone.");
  if (!confirmed) return;

  state.events = [];
  saveState();
  renderSummary();
}

function getAllPlayersFromRosterAndEvents() {
  const names = new Set(state.roster);
  state.events.forEach(event => event.players.forEach(player => names.add(player)));
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatHours(hours) {
  return `${formatNumber(hours)} ${Number(hours) === 1 ? "hour" : "hours"}`;
}

function formatNumber(number) {
  return Number(number).toLocaleString(undefined, {
    maximumFractionDigits: 1
  });
}

function percent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
