const FALLBACK_DATA = {
  product: "SkillPath AI",
  purpose: "Industrial L&D intelligence for role-level skill visibility, coaching, and expert knowledge capture.",
  roles: [
    {
      id: "blast-furnace-operator",
      name: "Blast Furnace Operator",
      riskOwner: "Iron Making + Safety",
      sampleQuestion: "What should I check when furnace temperature trend becomes unstable?",
      businessExposure: "hot metal quality variation, furnace instability, safety exposure, production loss",
      workers: [
        { id: "rakesh", name: "Rakesh K.", tenure: "8 months", assessment: 61, trainingPrecision: 46 },
        { id: "suman", name: "Suman P.", tenure: "4 years", assessment: 76, trainingPrecision: 65 },
        { id: "arvind", name: "Arvind S.", tenure: "17 years", assessment: 91, trainingPrecision: 82 }
      ],
      criticalSkills: [
        { skill: "Furnace parameter monitoring", required: 5, current: 3, risk: "safety", weight: 5, evidence: "delayed escalation during abnormal temperature trend simulation" },
        { skill: "Burden distribution awareness", required: 4, current: 2, risk: "quality", weight: 5, evidence: "needs coaching on link between burden pattern and hot metal consistency" },
        { skill: "Gas safety and isolation", required: 5, current: 4, risk: "safety", weight: 5, evidence: "recertification due and supervisor sign-off pending" },
        { skill: "Abnormality escalation", required: 4, current: 2, risk: "uptime", weight: 4, evidence: "shift log shows incomplete abnormality description" }
      ]
    }
  ],
  knowledge: [
    {
      title: "Blast furnace abnormal temperature trend",
      tags: ["blast", "furnace", "temperature", "trend", "hot", "metal", "burden", "gas", "safety"],
      summary: "Check recent burden pattern, hot blast parameters, gas trend, cooling water alarms, and shift log before changing operating assumptions.",
      source: "Blast furnace operating guidance - training sample",
      recommendedLearning: "Micro-module: Abnormal Furnace Trend Recognition",
      escalation: "Escalate immediately if temperature trend is abnormal with gas, pressure, or cooling-water warning signs."
    }
  ],
  knowledgeBacklog: [
    { topic: "Blast furnace abnormal trend early-warning signs", owner: "Senior BF operator", status: "High value" }
  ]
};

let DATA = FALLBACK_DATA;
let apiAvailable = false;
let lastAnswerId = null;
let workerSession = null;
let sessionTimer = null;

const loginShell = document.querySelector("#loginShell");
const appShell = document.querySelector("#appShell");
const loginRoleSelect = document.querySelector("#loginRoleSelect");
const loginWorkerSelect = document.querySelector("#loginWorkerSelect");
const loginShiftSelect = document.querySelector("#loginShiftSelect");
const usagePurpose = document.querySelector("#usagePurpose");
const loginStatusMessage = document.querySelector("#loginStatusMessage");
const workerLoginButton = document.querySelector("#workerLoginButton");
const logoutButton = document.querySelector("#logoutButton");
const activeWorkerName = document.querySelector("#activeWorkerName");
const activeSessionMeta = document.querySelector("#activeSessionMeta");
const sessionDuration = document.querySelector("#sessionDuration");
const sessionPurpose = document.querySelector("#sessionPurpose");
const dashboardLoginTime = document.querySelector("#dashboardLoginTime");
const dashboardChatVisits = document.querySelector("#dashboardChatVisits");
const dashboardQuestionsAsked = document.querySelector("#dashboardQuestionsAsked");
const dashboardLastActivity = document.querySelector("#dashboardLastActivity");
const dashboardPurpose = document.querySelector("#dashboardPurpose");
const workerActivityDatabase = document.querySelector("#workerActivityDatabase");
const openAssistanceButton = document.querySelector("#openAssistanceButton");
const shiftIntelOutput = document.querySelector("#shiftIntelOutput");
const trainingLoopOutput = document.querySelector("#trainingLoopOutput");
const evidenceOutput = document.querySelector("#evidenceOutput");
const expertRiskOutput = document.querySelector("#expertRiskOutput");
const safetyQueueOutput = document.querySelector("#safetyQueueOutput");

const roleSelect = document.querySelector("#roleSelect");
const workerSelect = document.querySelector("#workerSelect");
const shiftSelect = document.querySelector("#shiftSelect");
const personaSelect = document.querySelector("#personaSelect");
const riskOwner = document.querySelector("#riskOwner");
const riskNarrative = document.querySelector("#riskNarrative");
const plantRisk = document.querySelector("#plantRisk");
const precisionScore = document.querySelector("#precisionScore");
const knowledgeRisk = document.querySelector("#knowledgeRisk");
const questionInput = document.querySelector("#questionInput");
const answerCard = document.querySelector("#answerCard");
const skillGrid = document.querySelector("#skillGrid");
const coachingPlan = document.querySelector("#coachingPlan");
const knowledgeBacklog = document.querySelector("#knowledgeBacklog");
const captureOutput = document.querySelector("#captureOutput");
const impactOutput = document.querySelector("#impactOutput");
const analyticsGrid = document.querySelector("#analyticsGrid");
const sessionMode = document.querySelector("#sessionMode");
const statusMessage = document.querySelector("#statusMessage");
const learningPathOutput = document.querySelector("#learningPathOutput");
const assessmentOutput = document.querySelector("#assessmentOutput");
const approvalOutput = document.querySelector("#approvalOutput");
const accessOutput = document.querySelector("#accessOutput");
const translationOutput = document.querySelector("#translationOutput");
const evidenceSkill = document.querySelector("#evidenceSkill");
const evidenceObservation = document.querySelector("#evidenceObservation");
const evidenceOutcome = document.querySelector("#evidenceOutcome");

async function api(path, options = {}) {
  const headers = {
    "content-type": "application/json",
    "x-user-role": workerSession ? workerSession.userRole : (personaSelect ? personaSelect.value : "demo-user"),
    "x-user-id": workerSession ? workerSession.workerId : "skillpath-demo-user",
    ...(workerSession && workerSession.sessionId ? { "x-session-id": workerSession.sessionId } : {}),
    ...(options.headers || {})
  };
  const baseUrl = localStorage.getItem("BACKEND_URL") || "https://skillpath-backend-hdum.onrender.com";
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }
  return response.json();
}

function selectedRole() {
  return DATA.roles.find((role) => role.id === roleSelect.value) || DATA.roles[0];
}

function selectedWorker() {
  const role = selectedRole();
  return role.workers.find((worker) => worker.id === workerSelect.value) || role.workers[0];
}

function loginRole() {
  return DATA.roles.find((role) => role.id === loginRoleSelect.value) || DATA.roles[0];
}

function loginWorker() {
  const role = loginRole();
  return role.workers.find((worker) => worker.id === loginWorkerSelect.value) || role.workers[0];
}

function skillGap(skill) {
  return Math.max(0, skill.required - skill.current);
}

function weightedRisk(role) {
  const weightedGap = role.criticalSkills.reduce((sum, skill) => sum + skillGap(skill) * skill.weight, 0);
  const maxGap = role.criticalSkills.reduce((sum, skill) => sum + skill.required * skill.weight, 0);
  return Math.round((weightedGap / maxGap) * 100);
}

function prioritySkills(role, count = 3) {
  return [...role.criticalSkills]
    .sort((a, b) => skillGap(b) * b.weight - skillGap(a) * a.weight)
    .slice(0, count);
}

function tokenize(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function retrieveKnowledge(question, role) {
  const tokens = new Set([...tokenize(question), ...tokenize(role.name), ...tokenize(shiftSelect.value)]);
  return DATA.knowledge
    .map((item) => ({ ...item, score: item.tags.reduce((sum, tag) => sum + (tokens.has(tag) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)[0];
}

function buildLocalAnswer(question) {
  const role = selectedRole();
  const worker = selectedWorker();
  const match = retrieveKnowledge(question, role);
  const topSkills = prioritySkills(role, 2);
  return {
    answerId: `local-${Date.now()}`,
    source: match.source,
    confidence: match.score >= 2 ? "medium-high" : "human-review-required",
    title: match.title,
    answer: match.summary,
    steps: [
      "Do the safe check sequence first; do not skip isolation or inspection requirements.",
      `Complete: ${match.recommendedLearning}.`,
      `Ask supervisor to observe one live task and record evidence against ${topSkills.map((skill) => skill.skill).join(" and ")}.`,
      match.escalation
    ],
    worker: worker.name,
    role: role.name,
    shiftContext: shiftSelect.value,
    safetyReview: {
      requiresHumanReview: match.score < 2,
      policy: match.score < 2 ? "Answer is restricted to safe guidance and supervisor escalation." : "Answer is allowed from approved knowledge with normal supervisor follow-up.",
      nextAction: match.score < 2 ? "Route to supervisor/EHS queue" : "Worker can proceed with supervisor follow-up."
    }
  };
}

function formatDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function setAnimatedMetric(element, nextText) {
  const nextNumber = Number(String(nextText).match(/\d+/)?.[0] || 0);
  const suffix = String(nextText).replace(String(nextNumber), "");
  const previousNumber = Number(element.dataset.metricValue || 0);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.dataset.metricValue = String(nextNumber);

  if (reduceMotion || previousNumber === nextNumber) {
    element.textContent = nextText;
    return;
  }

  const start = performance.now();
  const duration = 650;

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(previousNumber + (nextNumber - previousNumber) * eased);
    element.textContent = `${value}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = nextText;
    }
  }

  requestAnimationFrame(tick);
}

function formatDuration(start, end = Date.now()) {
  if (!start) return "--";
  const totalSeconds = Math.max(0, Math.floor((end - new Date(start).getTime()) / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function renderRoleOptions() {
  const options = DATA.roles.map((role) => `<option value="${role.id}">${role.name}</option>`).join("");
  roleSelect.innerHTML = options;
  loginRoleSelect.innerHTML = options;
}

function renderWorkerOptions() {
  const role = selectedRole();
  workerSelect.innerHTML = role.workers.map((worker) => `<option value="${worker.id}">${worker.name} | ${worker.tenure}</option>`).join("");
}

function renderLoginWorkerOptions() {
  const role = loginRole();
  loginWorkerSelect.innerHTML = role.workers.map((worker) => `<option value="${worker.id}">${worker.name} | ${worker.tenure}</option>`).join("");
}

function renderCommandMetrics(metrics) {
  const role = selectedRole();
  const worker = selectedWorker();
  const fallback = {
    capabilityRisk: Math.round(DATA.roles.map(weightedRisk).reduce((sum, risk) => sum + risk, 0) / DATA.roles.length),
    trainingPrecision: worker.trainingPrecision,
    knowledgeRisk: DATA.knowledgeBacklog.filter((item) => item.status !== "High value").length,
    currentRiskOwner: role.riskOwner,
    riskNarrative: `${worker.name} has highest visible gap in ${prioritySkills(role, 1)[0].skill}. Exposure: ${role.businessExposure}.`
  };
  const view = metrics || fallback;
  setAnimatedMetric(plantRisk, `${view.capabilityRisk}%`);
  setAnimatedMetric(precisionScore, `${view.trainingPrecision}%`);
  setAnimatedMetric(knowledgeRisk, `${view.knowledgeRisk} topics`);
  riskOwner.textContent = view.currentRiskOwner;
  riskNarrative.textContent = view.riskNarrative;
}

async function refreshMetrics() {
  if (!apiAvailable) {
    renderCommandMetrics();
    return;
  }
  try {
    const role = selectedRole();
    const worker = selectedWorker();
    const result = await api(`/api/roles/${role.id}/skill-risk?workerId=${worker.id}`);
    renderCommandMetrics(result.metrics);
  } catch {
    renderCommandMetrics();
  }
}

function renderSkills() {
  const role = selectedRole();
  skillGrid.innerHTML = role.criticalSkills.map((skill) => {
    const gap = skillGap(skill);
    const level = gap >= 2 ? "high" : "medium";
    return `
      <article class="skill-item ${level}">
        <div>
          <strong>${skill.skill}</strong>
          <span>${skill.risk}</span>
        </div>
        <p>Required ${skill.required}; current ${skill.current}. Evidence: ${skill.evidence}.</p>
        <meter min="0" max="${skill.required}" value="${skill.current}"></meter>
      </article>
    `;
  }).join("");
}

function renderKnowledgeBacklog() {
  knowledgeBacklog.innerHTML = DATA.knowledgeBacklog.map((item) => `
    <article>
      <strong>${item.topic}</strong>
      <span>${item.owner}</span>
      <small>${item.status}</small>
    </article>
  `).join("");
}

function renderAnswer(payload) {
  lastAnswerId = payload.answerId || null;
  answerCard.innerHTML = `
    <div class="answer-topline">
      <span>Grounded source: ${payload.source}</span>
      <span>Confidence: ${payload.confidence}</span>
    </div>
    <h3>${payload.title}</h3>
    <p>${payload.answer}</p>
    <ol>${payload.steps.map((step) => `<li>${step}</li>`).join("")}</ol>
    ${(payload.citations || []).map((citation) => `
      <div class="citation-list">
        <strong>${citation.source}</strong>
        <span>${citation.snippet}</span>
      </div>
    `).join("")}
    ${payload.safetyReview && payload.safetyReview.requiresHumanReview ? `<p class="worker-note"><strong>Review gate:</strong> ${payload.safetyReview.policy} Next action: ${payload.safetyReview.nextAction}</p>` : ""}
    <p class="worker-note">Personalized for ${payload.worker}, ${payload.role}, ${payload.shiftContext}.</p>
  `;
}

function updateSessionClock() {
  sessionDuration.textContent = workerSession ? formatDuration(workerSession.loginTime) : "--";
}

function renderSessionHeader() {
  if (!workerSession) {
    activeWorkerName.textContent = "--";
    activeSessionMeta.textContent = "Session not started";
    dashboardLoginTime.textContent = "--";
    dashboardPurpose.textContent = "No purpose recorded.";
    sessionPurpose.textContent = "Login purpose will appear here after sign-in.";
    return;
  }
  activeWorkerName.textContent = workerSession.workerName;
  activeSessionMeta.textContent = `${workerSession.roleName} | ${workerSession.shiftContext}`;
  dashboardLoginTime.textContent = formatDateTime(workerSession.loginTime);
  dashboardPurpose.textContent = workerSession.purpose;
  sessionPurpose.textContent = `Purpose: ${workerSession.purpose}`;
  updateSessionClock();
}

function renderWorkerActivityDatabase(records = [], summary = {}) {
  if (!records.length) {
    workerActivityDatabase.innerHTML = `<p class="empty-state">No worker activity recorded yet.</p>`;
    return;
  }
  workerActivityDatabase.innerHTML = records.map((record) => `
    <div class="database-row">
      <strong>${record.event}</strong>
      <span>${formatDateTime(record.timestamp)}</span>
      <span>${record.details || record.question || record.purpose || record.targetView || "No extra detail"}</span>
      <small>${record.sessionId || "local-session"}</small>
    </div>
  `).join("");
  dashboardChatVisits.textContent = String(summary.chatbotVisits || 0);
  dashboardQuestionsAsked.textContent = String(summary.questionsAsked || 0);
  dashboardLastActivity.textContent = summary.lastActivity ? formatDateTime(summary.lastActivity.timestamp) : "--";
}

async function refreshWorkerDashboard() {
  if (!workerSession) return;
  const localSummary = {
    chatbotVisits: workerSession.chatbotVisits || 0,
    questionsAsked: workerSession.questionsAsked || 0,
    lastActivity: workerSession.lastActivity || null
  };
  if (!apiAvailable) {
    renderWorkerActivityDatabase(workerSession.activity || [], localSummary);
    return;
  }
  try {
    const payload = await api(`/api/worker/activity?workerId=${workerSession.workerId}`);
    renderWorkerActivityDatabase(payload.activities, payload.summary);
  } catch {
    renderWorkerActivityDatabase(workerSession.activity || [], localSummary);
  }
}

async function recordWorkerActivity(event, extra = {}) {
  if (!workerSession) return;
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    sessionId: workerSession.sessionId,
    workerId: workerSession.workerId,
    workerName: workerSession.workerName,
    roleId: workerSession.roleId,
    roleName: workerSession.roleName,
    purpose: workerSession.purpose,
    ...extra
  };
  workerSession.activity = [entry, ...(workerSession.activity || [])].slice(0, 20);
  workerSession.lastActivity = entry;
  if (event === "chatbot.open") workerSession.chatbotVisits = (workerSession.chatbotVisits || 0) + 1;
  if (event === "coach.answer") workerSession.questionsAsked = (workerSession.questionsAsked || 0) + 1;
  try {
    if (apiAvailable) {
      await api("/api/worker/activity", { method: "POST", body: JSON.stringify(entry) });
    }
  } catch {}
  await refreshWorkerDashboard();
}

function renderShiftIntelligence(payload) {
  shiftIntelOutput.innerHTML = `
    <div class="stack-item">
      <strong>${payload.shiftContext}</strong>
      <span>Adjusted shift risk: ${payload.adjustedRisk}%</span>
      <p>Learning focus: ${payload.learningFocus}</p>
      <p>Supervisor need: ${payload.supervisorNeed}</p>
      <p>Handover focus: ${payload.handoverFocus}</p>
    </div>
    ${payload.heatmap.map((item) => `
      <div class="stack-item">
        <strong>#${item.rank} ${item.skill}</strong>
        <span>Shift risk score: ${item.risk}%</span>
        <p>${item.note}</p>
      </div>
    `).join("")}
  `;
}

async function refreshShiftIntelligence() {
  if (!workerSession || !apiAvailable) {
    shiftIntelOutput.innerHTML = `<p class="empty-state">Shift intelligence becomes richer when the API is connected and a worker session is active.</p>`;
    return;
  }
  const payload = await api(`/api/shift-intelligence?roleId=${selectedRole().id}&workerId=${selectedWorker().id}&shiftContext=${encodeURIComponent(shiftSelect.value)}`);
  renderShiftIntelligence(payload);
}

function renderTrainingLoop(payload) {
  const summary = payload.summary;
  const stages = [
    { label: "Question asked", done: summary.questionAsked },
    { label: "Learning assigned", done: summary.learningAssigned },
    { label: "Assessment generated", done: summary.assessmentGenerated },
    { label: "Supervisor validated", done: summary.supervisorValidated }
  ];
  trainingLoopOutput.innerHTML = `
    ${stages.map((stage) => `
      <div class="stack-item">
        <strong>${stage.label}</strong>
        <span>${stage.done ? "Completed" : "Pending"}</span>
      </div>
    `).join("")}
    <div class="stack-item">
      <strong>Needs coaching loop</strong>
      <span>${summary.needsCoaching ? "Yes" : "No"}</span>
      <p>Last loop update: ${summary.lastUpdate ? formatDateTime(summary.lastUpdate.timestamp) : "--"}</p>
    </div>
  `;
}

async function refreshTrainingLoop() {
  if (!workerSession || !apiAvailable) {
    trainingLoopOutput.innerHTML = `<p class="empty-state">The closed-loop tracker appears after worker activity starts and the API is connected.</p>`;
    return;
  }
  const payload = await api(`/api/training-loop?workerId=${workerSession.workerId}`);
  renderTrainingLoop(payload);
}

function renderEvidenceList(evidence) {
  if (!evidence.length) {
    evidenceOutput.innerHTML = `<p class="empty-state">No supervisor evidence submitted yet.</p>`;
    return;
  }
  evidenceOutput.innerHTML = evidence.map((item) => `
    <div class="stack-item">
      <strong>${item.skill}</strong>
      <span>${item.outcome}</span>
      <p>${item.observation}</p>
      <small>${formatDateTime(item.timestamp)}</small>
    </div>
  `).join("");
}

async function refreshEvidence() {
  if (!apiAvailable || !selectedWorker()) {
    renderEvidenceList([]);
    return;
  }
  const payload = await api(`/api/supervisor/evidence?workerId=${selectedWorker().id}`);
  renderEvidenceList(payload.evidence);
}

async function submitSupervisorEvidence() {
  if (!apiAvailable) {
    evidenceOutput.innerHTML = `<p class="empty-state">Supervisor evidence requires the local API server.</p>`;
    return;
  }
  await api("/api/supervisor/evidence", {
    method: "POST",
    body: JSON.stringify({
      sessionId: workerSession ? workerSession.sessionId : null,
      workerId: selectedWorker().id,
      workerName: selectedWorker().name,
      roleId: selectedRole().id,
      roleName: selectedRole().name,
      skill: evidenceSkill.value.trim(),
      observation: evidenceObservation.value.trim(),
      outcome: evidenceOutcome.value
    })
  });
  await refreshEvidence();
  await refreshTrainingLoop();
  statusMessage.textContent = "Supervisor evidence recorded. Skill credit now depends on validation outcome, not just chatbot usage.";
}

function renderExpertRisk(payload) {
  expertRiskOutput.innerHTML = `
    <article class="analytics-card">
      <span>Dependency score</span>
      <strong>${payload.dependencyScore}%</strong>
      <span>${payload.role}</span>
    </article>
    <article class="analytics-card">
      <span>Primary expert</span>
      <strong>${payload.expertName}</strong>
      <span>${payload.expertTenure}</span>
    </article>
    <article class="analytics-card">
      <span>Backup coverage</span>
      <strong>${payload.backupName}</strong>
      <span>Secondary ready worker</span>
    </article>
    <article class="analytics-card">
      <span>Capture priority</span>
      <strong>${payload.capturePriority}</strong>
      <span>${payload.recommendation}</span>
    </article>
  `;
}

async function refreshExpertRisk() {
  if (!apiAvailable) {
    expertRiskOutput.innerHTML = `<article class="analytics-card"><span>Expert risk</span><strong>Offline</strong><span>API connection needed for the full risk meter.</span></article>`;
    return;
  }
  const payload = await api(`/api/expert-risk?roleId=${selectedRole().id}`);
  renderExpertRisk(payload);
}

function renderSafetyQueue(payload) {
  if (!payload.queue.length) {
    safetyQueueOutput.innerHTML = `<p class="empty-state">No safety escalation items yet.</p>`;
    return;
  }
  safetyQueueOutput.innerHTML = payload.queue.map((item) => `
    <div class="stack-item">
      <strong>${item.worker} | ${item.role}</strong>
      <span>${item.confidence}</span>
      <p>${item.action}. Source: ${item.source}.</p>
      <small>${formatDateTime(item.timestamp)}</small>
    </div>
  `).join("");
}

async function refreshSafetyQueue() {
  if (!apiAvailable) {
    safetyQueueOutput.innerHTML = `<p class="empty-state">Safety queue requires the API server.</p>`;
    return;
  }
  const payload = await api("/api/safety/queue");
  renderSafetyQueue(payload);
}

async function loginWorkerSession() {
  const role = loginRole();
  const worker = loginWorker();
  const purpose = usagePurpose.value.trim() || "General worker assistance";
  if (!usagePurpose.value.trim()) {
    usagePurpose.value = purpose;
    loginStatusMessage.textContent = "No usage purpose was entered, so the session was started with the default purpose: General worker assistance.";
  } else {
    loginStatusMessage.textContent = `${worker.name} is logging in for: ${purpose}.`;
  }

  const payload = {
    roleId: role.id,
    workerId: worker.id,
    shiftContext: loginShiftSelect.value,
    purpose
  };

  let sessionData = { sessionId: `local-${Date.now()}`, loginTime: new Date().toISOString() };
  try {
    if (apiAvailable) {
      sessionData = await api("/api/worker/login", { method: "POST", body: JSON.stringify(payload) });
    }
  } catch {}

  workerSession = {
    ...sessionData,
    ...payload,
    workerName: worker.name,
    roleName: role.name,
    userRole: "worker",
    chatbotVisits: sessionData.summary ? sessionData.summary.chatbotVisits : 0,
    questionsAsked: sessionData.summary ? sessionData.summary.questionsAsked : 0,
    lastActivity: null,
    activity: []
  };

  roleSelect.value = role.id;
  renderWorkerOptions();
  workerSelect.value = worker.id;
  shiftSelect.value = loginShiftSelect.value;
  personaSelect.value = "worker";
  personaSelect.disabled = true;
  evidenceSkill.value = prioritySkills(role, 1)[0].skill;

  loginShell.classList.add("hidden");
  appShell.classList.remove("hidden");
  renderSessionHeader();
  setView("dashboard");
  await renderAll();
  await recordWorkerActivity("login", { details: `Worker logged in for ${purpose}`, shiftContext: workerSession.shiftContext });
  clearInterval(sessionTimer);
  sessionTimer = window.setInterval(updateSessionClock, 1000);
  statusMessage.textContent = `${worker.name} logged in. Shift intelligence, closed-loop tracking, and activity logging are active.`;
}

async function logoutWorkerSession() {
  if (!workerSession) return;
  const logoutTime = new Date().toISOString();
  try {
    if (apiAvailable) {
      await api("/api/worker/logout", {
        method: "POST",
        body: JSON.stringify({
          sessionId: workerSession.sessionId,
          roleId: workerSession.roleId,
          workerId: workerSession.workerId,
          logoutTime
        })
      });
    }
  } catch {}
  workerSession = null;
  clearInterval(sessionTimer);
  sessionTimer = null;
  personaSelect.disabled = false;
  loginShell.classList.remove("hidden");
  appShell.classList.add("hidden");
  usagePurpose.value = "";
  loginStatusMessage.textContent = "Worker logged out. You can start a new tracked session.";
}

async function buildAnswer() {
  const role = selectedRole();
  const worker = selectedWorker();
  const question = questionInput.value.trim();
  if (!question) {
    answerCard.innerHTML = `<p class="empty-state">Enter a worker question first.</p>`;
    return;
  }
  try {
    const payload = apiAvailable
      ? await api("/api/coach/answer", {
          method: "POST",
          body: JSON.stringify({ roleId: role.id, workerId: worker.id, shiftContext: shiftSelect.value, question })
        })
      : buildLocalAnswer(question);
    renderAnswer(payload);
  } catch {
    renderAnswer(buildLocalAnswer(question));
  }
  await recordWorkerActivity("coach.answer", { question, details: `Asked chatbot: ${question}` });
  await refreshTrainingLoop();
  await refreshSafetyQueue();
}

function renderCoachingPlan(payload) {
  coachingPlan.innerHTML = `
    <h3>Two-week coaching plan for ${payload.worker}</h3>
    ${payload.actions.map((action) => `
      <section>
        <span>Priority ${action.priority}</span>
        <strong>${action.skill}</strong>
        <p>Why now: ${action.whyNow}. ${action.coachingAction}</p>
      </section>
    `).join("")}
  `;
}

async function buildCoachingPlan() {
  const role = selectedRole();
  const worker = selectedWorker();
  try {
    const payload = apiAvailable
      ? await api("/api/supervisor/coaching-plan", {
          method: "POST",
          body: JSON.stringify({ roleId: role.id, workerId: worker.id, timeWindow: "2 weeks" })
        })
      : {
          worker: worker.name,
          actions: prioritySkills(role, 3).map((skill, index) => ({
            priority: index + 1,
            skill: skill.skill,
            whyNow: skill.evidence,
            coachingAction: "Coach through one real task, one scenario question, and one evidence check."
          }))
        };
    renderCoachingPlan(payload);
  } catch {
    renderCoachingPlan({
      worker: worker.name,
      actions: prioritySkills(role, 3).map((skill, index) => ({
        priority: index + 1,
        skill: skill.skill,
        whyNow: skill.evidence,
        coachingAction: "Coach through one real task, one scenario question, and one evidence check."
      }))
    });
  }
}

function renderCapturePack(payload) {
  captureOutput.textContent = `Expert interview pack

Role: ${payload.role}
Critical topic: ${payload.criticalTopic}
Business exposure: ${payload.businessExposure}

Ask the expert:
${payload.interviewQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Publish as:
${payload.publishFormat.map((item) => `- ${item}`).join("\n")}

Review gate:
${payload.reviewGate}`;
}

async function buildCapturePack() {
  const role = selectedRole();
  const top = prioritySkills(role, 1)[0];
  try {
    const payload = apiAvailable
      ? await api("/api/knowledge/capture-pack", { method: "POST", body: JSON.stringify({ roleId: role.id, topic: top.skill }) })
      : {
          role: role.name,
          criticalTopic: top.skill,
          businessExposure: role.businessExposure,
          interviewQuestions: [
            "What early signs tell you this issue is about to happen?",
            "What unsafe shortcut do newer workers try, and how should they avoid it?",
            "Which check separates the real root cause from the symptom?",
            "What would you show in a 10-minute live coaching moment?",
            "When must the worker stop and escalate?"
          ],
          publishFormat: ["short worker answer", "safe check sequence", "supervisor observation checklist", "micro-learning scenario", "searchable tags"],
          reviewGate: "Process owner and EHS/Quality owner must approve before release."
        };
    renderCapturePack(payload);
  } catch {
    renderCapturePack({
      role: role.name,
      criticalTopic: top.skill,
      businessExposure: role.businessExposure,
      interviewQuestions: [
        "What early signs tell you this issue is about to happen?",
        "What unsafe shortcut do newer workers try, and how should they avoid it?",
        "Which check separates the real root cause from the symptom?",
        "What would you show in a 10-minute live coaching moment?",
        "When must the worker stop and escalate?"
      ],
      publishFormat: ["short worker answer", "safe check sequence", "supervisor observation checklist", "micro-learning scenario", "searchable tags"],
      reviewGate: "Process owner and EHS/Quality owner must approve before release."
    });
  }
}

function renderImpact(payload, workers, questions, minutes) {
  impactOutput.innerHTML = `
    <h3>Estimated pilot value</h3>
    <p>${workers} workers resolving ${questions} repeated questions per week at ${minutes} minutes saved each can release about <strong>${payload.weeklyHours} supervisor hours per week</strong>, or <strong>${payload.monthlyHours} hours per month</strong>.</p>
    <p>${payload.conservativeNote}</p>
  `;
}

async function calculateImpact() {
  const workers = Number(document.querySelector("#workerCount").value);
  const questions = Number(document.querySelector("#questionCount").value);
  const minutes = Number(document.querySelector("#minutesSaved").value);
  const fallback = {
    weeklyHours: Math.round((workers * questions * minutes) / 60),
    monthlyHours: Math.round((workers * questions * minutes) / 60) * 4,
    conservativeNote: "This estimate excludes avoided rework, faster onboarding, safer task execution, and knowledge reuse."
  };
  try {
    const payload = apiAvailable
      ? await api("/api/impact/estimate", {
          method: "POST",
          body: JSON.stringify({ workers, questionsPerWorker: questions, minutesSaved: minutes })
        })
      : fallback;
    renderImpact(payload, workers, questions, minutes);
  } catch {
    renderImpact(fallback, workers, questions, minutes);
  }
}

function renderAnalytics(payload) {
  const top = payload.topCapabilityRisk || { role: "Not available", risk: 0, topSkill: "No data" };
  analyticsGrid.innerHTML = `
    <article class="analytics-card">
      <span>Readiness score</span>
      <strong>${payload.readinessScore || 75}%</strong>
      <span>architecture, controls, and pilot readiness</span>
    </article>
    <article class="analytics-card">
      <span>Safety escalations</span>
      <strong>${payload.safetyEscalations || 0}</strong>
      <span>questions routed for human review</span>
    </article>
    <article class="analytics-card">
      <span>Supervisor evidence</span>
      <strong>${payload.supervisorEvidenceCount || 0}</strong>
      <span>validated observations captured</span>
    </article>
    <article class="analytics-card">
      <span>Top capability risk</span>
      <strong>${top.risk}%</strong>
      <span>${top.role}: ${top.topSkill}</span>
    </article>
  `;
}

async function refreshAnalytics() {
  const fallback = {
    readinessScore: 90,
    safetyEscalations: 0,
    supervisorEvidenceCount: 0,
    topCapabilityRisk: DATA.roles.map((role) => ({
      role: role.name,
      risk: weightedRisk(role),
      topSkill: prioritySkills(role, 1)[0].skill
    }))[0]
  };
  try {
    const payload = apiAvailable ? await api("/api/analytics") : fallback;
    renderAnalytics(payload);
  } catch {
    renderAnalytics(fallback);
  }
}

// Feedback collections removed.

function setView(viewName) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${viewName}View`);
  });
}

async function inspectApprovedContent() {
  setView("knowledge");
  const query = `${selectedRole().name} ${selectedRole().sampleQuestion}`;
  try {
    const payload = apiAvailable ? await api(`/api/rag/search?q=${encodeURIComponent(query)}`) : null;
    const sources = payload && payload.results.length ? payload.results.map((result) => result.source).join(", ") : "local approved knowledge and SOP samples";
    statusMessage.textContent = `Approved content active. Current source set: ${sources}.`;
  } catch {
    statusMessage.textContent = "Approved content active. Running from local approved sample knowledge.";
  }
}

async function inspectHumanReview() {
  setView("analytics");
  await refreshAnalytics();
  await refreshSafetyQueue();
  statusMessage.textContent = "Human review is active. Safety-sensitive or low-confidence answers are routed to the safety escalation queue.";
}

async function inspectApiReadiness() {
  try {
    const health = apiAvailable ? await api("/api/health") : null;
    const mode = health ? health.mode : "offline";
    const dbMode = health && health.database ? health.database.mode : "local fallback";
    const integrationCount = health && health.integrations ? `${health.integrations.configuredCount}/${health.integrations.total}` : "0/5";
    statusMessage.textContent = `API status: ${mode}. Database: ${dbMode}. Enterprise integrations configured: ${integrationCount}.`;
  } catch {
    statusMessage.textContent = "API is not reachable. The app is running in offline demo mode.";
  }
}

async function uploadDocument() {
  const title = document.querySelector("#docTitle").value;
  const content = document.querySelector("#docContent").value;
  const result = await api("/api/documents/upload", { method: "POST", body: JSON.stringify({ title, content }) });
  statusMessage.textContent = `Uploaded ${result.source}. It is now searchable by local vector RAG.`;
}

async function generateLearningPath() {
  const role = selectedRole();
  const worker = selectedWorker();
  const payload = await api("/api/learning/path", { method: "POST", body: JSON.stringify({ roleId: role.id, workerId: worker.id }) });
  learningPathOutput.innerHTML = `
    <strong>${payload.durationDays}-day plan for ${payload.worker}</strong>
    <ul class="mini-list">${payload.path.map((item) => `<li>Day ${item.day}: ${item.skill} - ${item.activity}</li>`).join("")}</ul>
  `;
  await refreshTrainingLoop();
}

async function generateAssessment() {
  const role = selectedRole();
  const worker = selectedWorker();
  const payload = await api("/api/assessment/generate", { method: "POST", body: JSON.stringify({ roleId: role.id, workerId: worker.id }) });
  assessmentOutput.innerHTML = `
    <strong>${payload.role} scenario checks</strong>
    <ul class="mini-list">${payload.questions.map((item) => `<li>${item.skill}: ${item.question}</li>`).join("")}</ul>
  `;
  await refreshTrainingLoop();
}

async function submitApproval() {
  const payload = await api("/api/approvals", {
    method: "POST",
    body: JSON.stringify({
      type: "learning-path",
      status: "pending",
      comment: `Approval requested by ${personaSelect.value} for ${selectedWorker().name}.`
    })
  });
  approvalOutput.innerHTML = `<strong>${payload.approvalId}</strong><p>Status: ${payload.status}</p>`;
}

async function loadApprovals() {
  const payload = await api("/api/approvals");
  approvalOutput.innerHTML = payload.approvals.length
    ? `<ul class="mini-list">${payload.approvals.map((item) => `<li>${item.approvalId}: ${item.type} - ${item.status}</li>`).join("")}</ul>`
    : "No approval items yet.";
}

async function loadAccessMatrix() {
  const payload = await api("/api/access/roles");
  accessOutput.innerHTML = Object.entries(payload.roles)
    .map(([role, access]) => `<strong>${role}</strong><ul class="mini-list">${access.map((item) => `<li>${item}</li>`).join("")}</ul>`)
    .join("");
}

async function translateInstruction() {
  const language = document.querySelector("#languageSelect").value;
  const payload = await api("/api/translate", {
    method: "POST",
    body: JSON.stringify({
      language,
      text: "Do the safe check sequence first; do not skip isolation or inspection requirements. Escalate if the result remains unsafe."
    })
  });
  translationOutput.innerHTML = `<strong>${payload.language}</strong><p>${payload.translated}</p><small>${payload.note}</small>`;
}

async function runStudioDemo() {
  await uploadDocument();
  await generateLearningPath();
  await generateAssessment();
  await submitApproval();
  await loadAccessMatrix();
  await translateInstruction();
  statusMessage.textContent = "Enterprise Studio demo complete: upload, RAG, learning path, assessment, approval, access matrix, and multilingual mode are active.";
}

async function renderAll() {
  renderWorkerOptions();
  renderSkills();
  renderKnowledgeBacklog();
  renderSessionHeader();
  await refreshMetrics();
  await refreshWorkerDashboard();
  await refreshShiftIntelligence();
  await refreshTrainingLoop();
  await refreshEvidence();
  await refreshExpertRisk();
}

async function openChatbotAssistance() {
  setView("worker");
  await recordWorkerActivity("chatbot.open", { details: "Worker opened chatbot assistance", targetView: "workerView" });
  await refreshShiftIntelligence();
  statusMessage.textContent = "Chatbot assistance opened. Worker access has been added to the activity database.";
}

async function boot() {
  const savedUrl = localStorage.getItem("BACKEND_URL") || "";
  const backendUrlInput = document.querySelector("#backendUrlInput");
  if (backendUrlInput) {
    backendUrlInput.value = savedUrl;
  }
  try {
    const bootstrap = await api("/api/bootstrap");
    DATA = bootstrap;
    apiAvailable = true;
    sessionMode.textContent = "Enterprise API connected";
  } catch {
    DATA = FALLBACK_DATA;
    apiAvailable = false;
    sessionMode.textContent = "Offline demo mode";
  }
  renderRoleOptions();
  renderWorkerOptions();
  renderLoginWorkerOptions();
  await calculateImpact();
  await refreshAnalytics();
  await refreshSafetyQueue();
  setView("dashboard");
}

loginRoleSelect.addEventListener("change", renderLoginWorkerOptions);
workerLoginButton.addEventListener("click", loginWorkerSession);
logoutButton.addEventListener("click", logoutWorkerSession);
openAssistanceButton.addEventListener("click", openChatbotAssistance);
roleSelect.addEventListener("change", renderAll);
workerSelect.addEventListener("change", renderAll);
shiftSelect.addEventListener("change", async () => {
  await refreshMetrics();
  await refreshShiftIntelligence();
});
personaSelect.addEventListener("change", refreshMetrics);
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));
document.querySelector("#sampleQuestion").addEventListener("click", () => {
  questionInput.value = selectedRole().sampleQuestion;
});
document.querySelector("#clearButton").addEventListener("click", () => {
  questionInput.value = "";
  answerCard.innerHTML = `<p class="empty-state">Ask a question to see grounded guidance, a recommended learning item, and a supervisor follow-up.</p>`;
});
document.querySelector("#askButton").addEventListener("click", buildAnswer);
document.querySelector("#generatePlan").addEventListener("click", buildCoachingPlan);
document.querySelector("#captureButton").addEventListener("click", buildCapturePack);
document.querySelector("#calculateImpact").addEventListener("click", calculateImpact);
document.querySelector("#refreshAnalytics").addEventListener("click", refreshAnalytics);
// Rating event listeners removed.
document.querySelector("#approvedContentBadge").addEventListener("click", inspectApprovedContent);
document.querySelector("#humanReviewBadge").addEventListener("click", inspectHumanReview);
document.querySelector("#sessionMode").addEventListener("click", inspectApiReadiness);
document.querySelector("#uploadDoc").addEventListener("click", uploadDocument);
document.querySelector("#generateLearningPath").addEventListener("click", generateLearningPath);
document.querySelector("#generateAssessment").addEventListener("click", generateAssessment);
document.querySelector("#submitApproval").addEventListener("click", submitApproval);
document.querySelector("#loadApprovals").addEventListener("click", loadApprovals);
document.querySelector("#loadAccessMatrix").addEventListener("click", loadAccessMatrix);
document.querySelector("#translateAnswer").addEventListener("click", translateInstruction);
document.querySelector("#runStudioDemo").addEventListener("click", runStudioDemo);
document.querySelector("#submitEvidence").addEventListener("click", submitSupervisorEvidence);
document.querySelector("#refreshShiftIntel").addEventListener("click", refreshShiftIntelligence);
document.querySelector("#refreshTrainingLoop").addEventListener("click", refreshTrainingLoop);
document.querySelector("#refreshExpertRisk").addEventListener("click", refreshExpertRisk);
document.querySelector("#refreshSafetyQueue").addEventListener("click", refreshSafetyQueue);

const saveBackendBtn = document.querySelector("#saveBackendUrlButton");
if (saveBackendBtn) {
  saveBackendBtn.addEventListener("click", () => {
    const rawUrl = document.querySelector("#backendUrlInput").value.trim();
    let cleanUrl = rawUrl;
    if (cleanUrl && cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (cleanUrl) {
      localStorage.setItem("BACKEND_URL", cleanUrl);
      loginStatusMessage.textContent = `Backend connection URL saved: ${cleanUrl}. Retrying connection...`;
    } else {
      localStorage.removeItem("BACKEND_URL");
      loginStatusMessage.textContent = "Connection URL reset. Using relative path / local server.";
    }
    boot().then(() => {
      if (apiAvailable) {
        loginStatusMessage.textContent = `Connected successfully to backend: ${cleanUrl || "local"}!`;
      } else {
        loginStatusMessage.textContent = `Could not reach backend at ${cleanUrl || "local"}. Running in offline demo mode.`;
      }
    });
  });
}

boot();
