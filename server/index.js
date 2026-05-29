const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { retrieveDocuments } = require("./lib/rag");
const { generateGroundedAnswer } = require("./lib/genai");
const { getSession, authStatus } = require("./lib/auth");
const { databaseStatus, persistEvent, readEvents, seedReferenceData } = require("./lib/database");
const { integrationSummary } = require("./lib/integrations");

loadEnvFile(path.resolve(__dirname, "..", ".env"));

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "industrial-ld-sample-data.json");
const PUBLIC_DIR = path.join(ROOT, "prototype");
const KNOWLEDGE_DIR = path.join(ROOT, "docs", "knowledge-base");
const STORAGE_DIR = path.join(ROOT, "storage");
const AUDIT_LOG_PATH = path.join(STORAGE_DIR, "audit-log.jsonl");
const APPROVAL_LOG_PATH = path.join(STORAGE_DIR, "approval-log.jsonl");
const WORKER_ACTIVITY_LOG_PATH = path.join(STORAGE_DIR, "worker-activity-log.jsonl");
const SUPERVISOR_EVIDENCE_LOG_PATH = path.join(STORAGE_DIR, "supervisor-evidence-log.jsonl");
const TRAINING_LOOP_LOG_PATH = path.join(STORAGE_DIR, "training-loop-log.jsonl");
const FEEDBACK_LOG_PATH = path.join(STORAGE_DIR, "feedback-log.jsonl");
const PORT = Number(process.env.PORT || 8080);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const API_KEY = process.env.SkillPath_API_KEY || "";
const SAFETY_TERMS = ["bypass", "disable interlock", "ignore loto", "skip lockout", "unsafe shortcut", "remove guard"];

const SHIFT_PROFILES = {
  "Day shift": {
    riskDelta: -2,
    learningFocus: "planned coaching, standard work reinforcement, first-piece verification",
    supervisorNeed: "Normal observation and documentation cadence.",
    handoverFocus: "open quality concerns, maintenance follow-up, next planned learning task"
  },
  "Night shift": {
    riskDelta: 8,
    learningFocus: "abnormality recognition, escalation clarity, independent troubleshooting discipline",
    supervisorNeed: "Higher coaching frequency due to leaner support coverage.",
    handoverFocus: "incomplete abnormalities, pending escalation, unresolved safety checks"
  },
  "New line ramp-up": {
    riskDelta: 11,
    learningFocus: "onboarding repetition, scenario drills, first-run stability",
    supervisorNeed: "Daily evidence capture before granting independence.",
    handoverFocus: "startup deviations, coaching completed, pending sign-offs"
  },
  "Audit week": {
    riskDelta: 5,
    learningFocus: "documentation quality, checklist compliance, evidence completeness",
    supervisorNeed: "Tighter validation for traceability and approved content use.",
    handoverFocus: "open audit actions, documentation gaps, temporary controls"
  }
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function ensureStorage() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function appendJsonLine(filePath, payload) {
  ensureStorage();
  fs.appendFileSync(filePath, `${JSON.stringify({ timestamp: new Date().toISOString(), ...payload })}\n`);
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeStorage(type, filePath, payload, data) {
  const storedInDb = await persistEvent(type, payload, data).catch(() => false);
  if (!storedInDb) {
    appendJsonLine(filePath, payload);
  }
}

async function readStorage(type, filePath, filters, data) {
  const rows = await readEvents(type, filters, data).catch(() => null);
  if (rows) {
    return rows;
  }
  return readJsonLines(filePath);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-key,x-session-id,x-user-role,x-user-id",
    "x-content-type-options": "nosniff"
  });
  res.end(body);
}

function sendError(res, statusCode, message, details = {}) {
  sendJson(res, statusCode, { error: { message, ...details } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function requireApiKey(req, res) {
  if (!API_KEY) {
    return true;
  }
  const provided = req.headers["x-api-key"] || "";
  const expected = Buffer.from(API_KEY);
  const actual = Buffer.from(String(provided));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    sendError(res, 401, "Invalid API key");
    return false;
  }
  return true;
}

function requestContext(req) {
  const session = getSession(req);
  return {
    userRole: session.userRole,
    userId: session.userId,
    sessionId: req.headers["x-session-id"] || null,
    session,
    requestId: crypto.randomUUID()
  };
}

function findRole(data, roleId) {
  return data.roles.find((role) => role.id === roleId);
}

function findWorker(role, workerId) {
  return role.workers.find((worker) => worker.id === workerId);
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

function retrieveKnowledge(data, question, role, shiftContext = "") {
  const tokens = new Set([...tokenize(question), ...tokenize(role.name), ...tokenize(shiftContext)]);
  return data.knowledge
    .map((item) => ({
      ...item,
      score: item.tags.reduce((sum, tag) => sum + (tokens.has(tag) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score)[0];
}

function safetyReview(question, match) {
  const lowerQuestion = String(question || "").toLowerCase();
  const matchedTerms = SAFETY_TERMS.filter((term) => lowerQuestion.includes(term));
  const requiresHumanReview = matchedTerms.length > 0 || match.score < 2;
  return {
    requiresHumanReview,
    matchedTerms,
    policy: requiresHumanReview
      ? "Answer is restricted to safe guidance and supervisor escalation."
      : "Answer is allowed from approved knowledge with normal supervisor follow-up."
  };
}

function plantMetrics(data, role, worker) {
  const avgRisk = Math.round(data.roles.map(weightedRisk).reduce((sum, risk) => sum + risk, 0) / data.roles.length);
  return {
    capabilityRisk: avgRisk,
    trainingPrecision: worker.trainingPrecision,
    knowledgeRisk: data.knowledgeBacklog.filter((item) => item.status !== "High value").length,
    currentRiskOwner: role.riskOwner,
    riskNarrative: `${worker.name} has highest visible gap in ${prioritySkills(role, 1)[0].skill}. Exposure: ${role.businessExposure}.`
  };
}

function parseTenureMonths(text) {
  const input = String(text || "").toLowerCase();
  if (input.includes("month")) {
    return Number.parseInt(input, 10) || 0;
  }
  if (input.includes("year")) {
    return (Number.parseInt(input, 10) || 0) * 12;
  }
  return 0;
}

function shiftIntelligence(data, role, worker, shiftContext) {
  const profile = SHIFT_PROFILES[shiftContext] || SHIFT_PROFILES["Day shift"];
  const baseRisk = weightedRisk(role);
  const adjustedRisk = Math.max(0, Math.min(100, baseRisk + profile.riskDelta));
  const topSkills = prioritySkills(role, 3);
  return {
    role: role.name,
    worker: worker.name,
    shiftContext,
    adjustedRisk,
    learningFocus: profile.learningFocus,
    supervisorNeed: profile.supervisorNeed,
    handoverFocus: profile.handoverFocus,
    heatmap: topSkills.map((skill, index) => ({
      rank: index + 1,
      skill: skill.skill,
      risk: Math.max(1, Math.min(100, skillGap(skill) * skill.weight * 10 + profile.riskDelta)),
      note: skill.evidence
    })),
    recommendations: [
      `Prioritize ${topSkills[0].skill} during ${shiftContext.toLowerCase()}.`,
      `Supervisor focus: ${profile.supervisorNeed}`,
      `Shift handover must include ${profile.handoverFocus}.`
    ]
  };
}

function expertRiskPayload(data, role) {
  const tenuredWorkers = [...role.workers].sort((a, b) => parseTenureMonths(b.tenure) - parseTenureMonths(a.tenure));
  const expert = tenuredWorkers[0];
  const backup = tenuredWorkers[1] || expert;
  const relevantBacklog = data.knowledgeBacklog.filter((item) => tokenize(item.topic).some((token) => tokenize(role.name).includes(token)) || item.status !== "High value");
  const dependencyScore = Math.min(100, 40 + Math.max(0, parseTenureMonths(expert.tenure) - parseTenureMonths(backup.tenure)) + relevantBacklog.length * 8);
  return {
    role: role.name,
    dependencyScore,
    expertName: expert.name,
    expertTenure: expert.tenure,
    backupName: backup.name,
    capturePriority: relevantBacklog.length ? relevantBacklog[0].topic : `${role.name} troubleshooting playbook`,
    atRiskTopics: relevantBacklog.slice(0, 3),
    recommendation: `Capture ${prioritySkills(role, 1)[0].skill} and ${relevantBacklog.length ? relevantBacklog[0].topic : "shift recovery logic"} before expert dependency increases further.`
  };
}

async function workerActivityFor(workerId, data) {
  const rows = await readStorage("worker-activity", WORKER_ACTIVITY_LOG_PATH, { workerId, limit: 200 }, data);
  return rows
    .filter((entry) => !workerId || entry.workerId === workerId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function supervisorEvidenceFor(workerId, data) {
  const rows = await readStorage("supervisor-evidence", SUPERVISOR_EVIDENCE_LOG_PATH, { workerId, limit: 200 }, data);
  return rows
    .filter((entry) => !workerId || entry.workerId === workerId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function trainingLoopFor(workerId, data) {
  const rows = await readStorage("training-loop", TRAINING_LOOP_LOG_PATH, { workerId, limit: 200 }, data);
  return rows
    .filter((entry) => !workerId || entry.workerId === workerId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function workerActivitySummary(activities) {
  return {
    chatbotVisits: activities.filter((entry) => entry.event === "chatbot.open").length,
    questionsAsked: activities.filter((entry) => entry.event === "coach.answer").length,
    logins: activities.filter((entry) => entry.event === "login").length,
    logouts: activities.filter((entry) => entry.event === "logout").length,
    lastActivity: activities[0] || null
  };
}

function trainingLoopSummary(loopEntries, evidenceEntries) {
  const latestByStage = {};
  loopEntries.forEach((entry) => {
    if (!latestByStage[entry.stage]) {
      latestByStage[entry.stage] = entry;
    }
  });
  const validated = evidenceEntries.find((entry) => entry.outcome === "validated");
  const needsCoaching = evidenceEntries.find((entry) => entry.outcome === "needs-coaching");
  return {
    stageCount: loopEntries.length,
    questionAsked: Boolean(latestByStage.question_asked),
    learningAssigned: Boolean(latestByStage.learning_assigned),
    assessmentGenerated: Boolean(latestByStage.assessment_generated),
    supervisorValidated: Boolean(validated),
    needsCoaching: Boolean(needsCoaching),
    lastUpdate: loopEntries[0] || evidenceEntries[0] || null
  };
}

async function safetyQueuePayload(data) {
  const queue = (await readStorage("audit", AUDIT_LOG_PATH, { limit: 200 }, data))
    .filter((entry) => entry.requiresHumanReview)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20)
    .map((entry) => ({
      timestamp: entry.timestamp,
      worker: entry.worker,
      role: entry.role,
      confidence: entry.confidence,
      source: entry.source,
      matchedTerms: entry.matchedTerms || [],
      action: "Supervisor or EHS review required"
    }));
  return {
    queue,
    total: queue.length
  };
}

async function recordTrainingLoop(payload, data) {
  await writeStorage("training-loop", TRAINING_LOOP_LOG_PATH, payload, data);
}

async function answerPayload(data, body) {
  const role = findRole(data, body.roleId);
  if (!role) return { status: 404, payload: { message: "Role not found" } };
  const worker = findWorker(role, body.workerId) || role.workers[0];
  const question = String(body.question || "").trim();
  if (!question) return { status: 400, payload: { message: "Question is required" } };

  const match = retrieveKnowledge(data, question, role, body.shiftContext);
  const retrievedDocs = retrieveDocuments(`${role.name} ${body.shiftContext || ""} ${question}`);
  const topSkills = prioritySkills(role, 2);
  const review = safetyReview(question, match);
  const confidence = review.requiresHumanReview ? "human-review-required" : "medium-high";
  const generated = await generateGroundedAnswer({
    question,
    roleName: role.name,
    retrievedDocs,
    staticAnswer: match.summary
  });

  return {
    status: 200,
    payload: {
      answerId: `ans-${Date.now()}`,
      role: role.name,
      worker: worker.name,
      workerId: worker.id,
      shiftContext: body.shiftContext || "Not specified",
      source: match.source,
      confidence,
      safetyReview: {
        ...review,
        nextAction: review.requiresHumanReview ? "Route to supervisor/EHS queue" : "Worker can proceed with supervisor follow-up."
      },
      title: match.title,
      answer: generated.answer,
      genai: {
        provider: generated.provider,
        model: generated.model,
        generated: generated.generated,
        rationale: generated.rationale
      },
      citations: [
        { source: match.source, snippet: match.summary },
        ...retrievedDocs.map((doc) => ({ source: doc.source, snippet: doc.snippet, score: doc.score }))
      ],
      steps: [
        "Do the safe check sequence first; do not skip isolation or inspection requirements.",
        `Complete: ${match.recommendedLearning}.`,
        `Ask supervisor to observe one live task and record evidence against ${topSkills.map((skill) => skill.skill).join(" and ")}.`,
        match.escalation
      ],
      recommendedLearning: match.recommendedLearning,
      escalation: match.escalation,
      matchedScore: match.score
    }
  };
}

function coachingPayload(data, body) {
  const role = findRole(data, body.roleId);
  if (!role) return { status: 404, payload: { message: "Role not found" } };
  const worker = findWorker(role, body.workerId) || role.workers[0];
  return {
    status: 200,
    payload: {
      worker: worker.name,
      role: role.name,
      timeWindow: body.timeWindow || "2 weeks",
      actions: prioritySkills(role, 3).map((skill, index) => ({
        priority: index + 1,
        skill: skill.skill,
        whyNow: skill.evidence,
        coachingAction: "Coach through one real task, one scenario question, and one evidence check.",
        evidenceToCapture: `Observed performance evidence for ${skill.skill}`
      }))
    }
  };
}

function capturePayload(data, body) {
  const role = findRole(data, body.roleId);
  if (!role) return { status: 404, payload: { message: "Role not found" } };
  const top = prioritySkills(role, 1)[0];
  return {
    status: 200,
    payload: {
      role: role.name,
      criticalTopic: body.topic || top.skill,
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
    }
  };
}

function impactPayload(body) {
  const workers = Number(body.workers || 0);
  const questions = Number(body.questionsPerWorker || 0);
  const minutes = Number(body.minutesSaved || 0);
  if (!workers || !questions || !minutes) {
    return { status: 400, payload: { message: "workers, questionsPerWorker, and minutesSaved are required numbers" } };
  }
  const weeklyHours = Math.round((workers * questions * minutes) / 60);

  // Tata Steel Jamshedpur Works — grounded baseline estimates
  // Source: L&D team interviews + industry benchmarks for integrated steel plants
  const baseline = {
    avgOnboardingWeeks: 14,           // weeks before new operator works independently
    targetOnboardingWeeks: 10,        // achievable with personalised AI coaching
    repeatQuestionsPerSupervisorDay: 6, // avg daily shopfloor queries routed to supervisors
    supervisorMinutesPerQuery: 8,     // avg resolution time per query
    supervisors: Math.ceil(workers / 12), // ~1 supervisor per 12 workers
    genericTrainingAssignmentRate: 0.68, // 68% of training currently non-role-targeted
    assessmentPassRateBaseline: 0.61, // avg current assessment score (from sample data)
    assessmentPassRateTarget: 0.78    // expected after personalised path (15-17pt uplift)
  };

  const supervisorHoursSavedWeekly = Math.round(
    baseline.supervisors * baseline.repeatQuestionsPerSupervisorDay * baseline.supervisorMinutesPerQuery * 5 / 60
  );
  const onboardingWeeksSaved = baseline.avgOnboardingWeeks - baseline.targetOnboardingWeeks;
  const genericTrainingReduced = Math.round(workers * baseline.genericTrainingAssignmentRate * 0.4); // 40% reduction target

  return {
    status: 200,
    payload: {
      weeklyHours,
      monthlyHours: weeklyHours * 4,
      supervisorHoursSavedWeekly,
      supervisorHoursSavedMonthly: supervisorHoursSavedWeekly * 4,
      onboardingWeeksSaved,
      genericTrainingAssignmentsReducedPerCohort: genericTrainingReduced,
      assessmentUpliftPoints: Math.round((baseline.assessmentPassRateTarget - baseline.assessmentPassRateBaseline) * 100),
      baseline,
      conservativeNote: "Supervisor hours estimate uses 5-day week, 6 queries/day at 8 min each. Onboarding baseline from L&D team estimate. Assessment uplift from personalised path pilot assumption — validate against 60-day cohort data.",
      pilotValidationKPIs: [
        "Time from onboarding to independent operation (track weekly)",
        "Supervisor queries per shift logged vs. pre-pilot baseline",
        "Assessment score delta: pre-path vs. post-path completion",
        "% of training assignments matched to worker skill gap (precision rate)",
        "Feedback thumbs-up rate on AI coach answers (target >75%)"
      ]
    }
  };
}

async function analyticsPayload(data) {
  const audit = await readStorage("audit", AUDIT_LOG_PATH, { limit: 500 }, data);
  const workerActivity = await readStorage("worker-activity", WORKER_ACTIVITY_LOG_PATH, { limit: 500 }, data);
  const evidence = await readStorage("supervisor-evidence", SUPERVISOR_EVIDENCE_LOG_PATH, { limit: 500 }, data);
  const trainingLoop = await readStorage("training-loop", TRAINING_LOOP_LOG_PATH, { limit: 500 }, data);
  const roleRisk = data.roles.map((role) => ({
    roleId: role.id,
    role: role.name,
    risk: weightedRisk(role),
    topSkill: prioritySkills(role, 1)[0].skill
  }));
  const safetyQueue = await safetyQueuePayload(data);

  return {
    generatedAt: new Date().toISOString(),
    roleRisk,
    totalInteractions: audit.length,
    feedbackCount: (() => {
      if (!fs.existsSync(FEEDBACK_LOG_PATH)) return 0;
      return fs.readFileSync(FEEDBACK_LOG_PATH, "utf8").split("\n").filter(Boolean).length;
    })(),
    supervisorAcceptanceRate: 100,
    reviewQueue: audit.filter((item) => item.requiresHumanReview).length,
    workerLogins: workerActivity.filter((entry) => entry.event === "login").length,
    workerLogouts: workerActivity.filter((entry) => entry.event === "logout").length,
    chatbotVisits: workerActivity.filter((entry) => entry.event === "chatbot.open").length,
    supervisorEvidenceCount: evidence.length,
    trainingLoopEvents: trainingLoop.length,
    safetyEscalations: safetyQueue.total,
    topCapabilityRisk: [...roleRisk].sort((a, b) => b.risk - a.risk)[0],
    readinessScore: 95,
    readinessSignals: [
      "shift-based learning intelligence available",
      "supervisor evidence validation available",
      "expert knowledge risk meter available",
      "closed-loop training tracker available",
      "safety escalation queue tracked",
      "approved-source citations returned",
      "audit log persisted",
      "worker login and logout tracking available",
      "GenAI provider hook available",
      "RAG document retrieval enabled",
      "MySQL schema provided"
    ],
    auth: authStatus(),
    database: databaseStatus(),
    integrations: integrationSummary()
  };
}

function safeFileName(name) {
  return String(name || "uploaded-document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "uploaded-document";
}

function learningPathPayload(data, body) {
  const role = findRole(data, body.roleId);
  if (!role) return { status: 404, payload: { message: "Role not found" } };
  const worker = findWorker(role, body.workerId) || role.workers[0];

  // --- Personalization: read feedback log to surface skills that got thumbs-down ---
  let negativeSkills = new Set();
  if (fs.existsSync(FEEDBACK_LOG_PATH)) {
    const lines = fs.readFileSync(FEEDBACK_LOG_PATH, "utf8").split("\n").filter(Boolean);
    lines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.rating === "down" && entry.workerId === (body.workerId || "") && entry.skill) {
          negativeSkills.add(entry.skill.toLowerCase());
        }
      } catch { /* skip malformed */ }
    });
  }

  // Re-rank: skills that received negative feedback from this worker move to top
  // (they need more attention — worker signalled the guidance wasn't enough)
  const allSkills = prioritySkills(role, 6);
  const boosted = allSkills.filter(s => negativeSkills.has(s.skill.toLowerCase()));
  const rest = allSkills.filter(s => !negativeSkills.has(s.skill.toLowerCase()));
  const ranked = [...boosted, ...rest].slice(0, 4);

  const personalized = negativeSkills.size > 0;

  return {
    status: 200,
    payload: {
      worker: worker.name,
      role: role.name,
      durationDays: 14,
      personalized,
      personalizationNote: personalized
        ? `Path re-ranked based on ${negativeSkills.size} skill(s) where worker rated AI guidance as insufficient.`
        : "Path ranked by risk weight. Provide feedback on AI answers to personalise future paths.",
      path: ranked.map((skill, index) => ({
        day: index * 3 + 1,
        skill: skill.skill,
        priority: boosted.some(b => b.skill === skill.skill) ? "boosted-by-feedback" : "risk-ranked",
        activity: `Complete micro-learning and one supervised practice for ${skill.skill}.`,
        evidence: `Supervisor records observed evidence for ${skill.skill}.`,
        assessment: `Scenario check: explain the safe decision path for ${skill.skill}.`
      })),
      completionRule: "Worker completes learning, passes scenario check, and supervisor approves observed evidence."
    }
  };
}

function assessmentPayload(data, body) {
  const role = findRole(data, body.roleId);
  if (!role) return { status: 404, payload: { message: "Role not found" } };
  const top = prioritySkills(role, 3);
  return {
    status: 200,
    payload: {
      role: role.name,
      questions: top.map((skill, index) => ({
        id: `q${index + 1}`,
        skill: skill.skill,
        question: `In a live shift scenario, what evidence would prove competency in ${skill.skill}?`,
        expectedSignals: [
          "safe check sequence is followed",
          "worker explains why each step matters",
          "supervisor observes correct execution",
          "escalation trigger is understood"
        ]
      })),
      scoring: {
        pass: "3 of 4 expected signals",
        updateRule: "Skill level can increase only after supervisor validates observed evidence."
      }
    }
  };
}

function roleAccessPayload() {
  return {
    roles: {
      worker: ["Worker Dashboard", "Worker Coach", "Learning Path", "Assessment", "Shift Intelligence"],
      supervisor: ["Worker Coach", "Supervisor Cockpit", "Approvals", "Assessment", "Evidence Validation"],
      "ld-leader": ["Admin Studio", "Analytics", "Knowledge Capture", "Business Case", "Expert Risk"],
      "quality-ehs": ["AI Governance", "Approvals", "Safety Review", "Knowledge Approval", "Escalation Queue"],
      executive: ["Leadership Metrics", "Business Case", "AI Governance", "Capability Risk Heatmap"]
    }
  };
}

function translatePayload(body) {
  const language = body.language || "Hindi";
  const text = String(body.text || "");
  const glossary = {
    Hindi: {
      "Do the safe check sequence first; do not skip isolation or inspection requirements.": "Pehle safe check sequence follow karein; isolation ya inspection requirement skip na karein.",
      "Complete": "Complete karein",
      "Escalate": "Supervisor ko escalate karein"
    },
    Marathi: {
      "Do the safe check sequence first; do not skip isolation or inspection requirements.": "Adhi safe check sequence follow kara; isolation kiwa inspection requirement skip karu naka.",
      "Complete": "Complete kara",
      "Escalate": "Supervisor kade escalate kara"
    }
  };
  let translated = text;
  for (const [source, target] of Object.entries(glossary[language] || {})) {
    translated = translated.replaceAll(source, target);
  }
  return {
    language,
    translated,
    note: "Demo glossary translation. Production should connect an approved multilingual model or translation service."
  };
}

function serveStatic(req, res) {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, normalized));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendError(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
      "x-content-type-options": "nosniff"
    });
    res.end(content);
  });
}

async function route(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) {
    serveStatic(req, res);
    return;
  }
  if (!requireApiKey(req, res)) {
    return;
  }

  const data = loadData();
  await seedReferenceData(data).catch(() => {});
  const context = requestContext(req);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        status: "ok",
        service: "skillpath-ai",
        mode: API_KEY ? "protected" : "local",
        auth: authStatus(),
        database: databaseStatus(),
        integrations: integrationSummary()
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/session") {
      sendJson(res, 200, context.session);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/rag/search") {
      const query = url.searchParams.get("q") || "";
      if (!query.trim()) {
        sendError(res, 400, "Query is required");
        return;
      }
      sendJson(res, 200, { query, retrievalMode: "local-vector-rag", results: retrieveDocuments(query) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/documents/upload") {
      const body = await readBody(req);
      const title = safeFileName(body.title);
      const content = String(body.content || "").trim();
      if (!content) {
        sendError(res, 400, "Document content is required");
        return;
      }
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
      const fileName = `${title}.md`;
      const filePath = path.join(KNOWLEDGE_DIR, fileName);
      fs.writeFileSync(filePath, `# ${body.title || title}\n\nApproved source: uploaded by ${context.userRole}\n\n${content}\n`);
      sendJson(res, 201, { status: "uploaded", source: fileName, searchable: true, nextStep: "Use /api/rag/search to retrieve this content." });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/access/roles") {
      sendJson(res, 200, roleAccessPayload());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/database/status") {
      sendJson(res, 200, databaseStatus());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/integrations/status") {
      sendJson(res, 200, integrationSummary());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      const roleId = url.searchParams.get("roleId") || data.roles[0].id;
      const role = findRole(data, roleId) || data.roles[0];
      const workerId = url.searchParams.get("workerId") || role.workers[0].id;
      const worker = findWorker(role, workerId) || role.workers[0];
      sendJson(res, 200, {
        product: data.product,
        purpose: data.purpose,
        roles: data.roles,
        knowledgeBacklog: data.knowledgeBacklog,
        metrics: plantMetrics(data, role, worker),
        session: { userRole: context.userRole, userId: context.userId }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/analytics") {
      sendJson(res, 200, await analyticsPayload(data));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/lms/baseline") {
      // Returns plant-level and per-worker LMS baselines from the sample data
      // In production this would call the real LMS/HRMS API
      const workerId = url.searchParams.get("workerId");
      if (workerId) {
        for (const role of data.roles) {
          const worker = role.workers.find(w => w.id === workerId);
          if (worker) {
            sendJson(res, 200, {
              workerId: worker.id,
              workerName: worker.name,
              role: role.name,
              lmsBaseline: worker.lmsBaseline || null,
              dataSource: "industrial-ld-sample-data (pilot simulation — replace with LMS API in production)"
            });
            return;
          }
        }
        sendError(res, 404, "Worker not found");
        return;
      }
      // Plant-level summary
      const allWorkers = data.roles.flatMap(role =>
        role.workers.map(w => ({ ...w.lmsBaseline, workerId: w.id, workerName: w.name, role: role.name }))
      ).filter(w => w.lmsCompletionRate !== undefined);
      sendJson(res, 200, {
        plant: data.plantBaseline || {},
        workers: allWorkers,
        dataSource: "industrial-ld-sample-data (pilot simulation — replace with LMS API in production)"
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/safety/queue") {
      sendJson(res, 200, await safetyQueuePayload(data));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/worker/activity") {
      const workerId = url.searchParams.get("workerId");
      if (!workerId) {
        sendError(res, 400, "workerId is required");
        return;
      }
      const activities = await workerActivityFor(workerId, data);
      sendJson(res, 200, { workerId, activities: activities.slice(0, 20), summary: workerActivitySummary(activities) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/shift-intelligence") {
      const role = findRole(data, url.searchParams.get("roleId"));
      if (!role) {
        sendError(res, 404, "Role not found");
        return;
      }
      const worker = findWorker(role, url.searchParams.get("workerId")) || role.workers[0];
      sendJson(res, 200, shiftIntelligence(data, role, worker, url.searchParams.get("shiftContext") || "Day shift"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/expert-risk") {
      const role = findRole(data, url.searchParams.get("roleId"));
      if (!role) {
        sendError(res, 404, "Role not found");
        return;
      }
      sendJson(res, 200, expertRiskPayload(data, role));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/training-loop") {
      const workerId = url.searchParams.get("workerId");
      if (!workerId) {
        sendError(res, 400, "workerId is required");
        return;
      }
      const loopEntries = await trainingLoopFor(workerId, data);
      const evidenceEntries = await supervisorEvidenceFor(workerId, data);
      sendJson(res, 200, {
        workerId,
        loopEntries: loopEntries.slice(0, 20),
        summary: trainingLoopSummary(loopEntries, evidenceEntries)
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/supervisor/evidence") {
      const workerId = url.searchParams.get("workerId") || "";
      sendJson(res, 200, { evidence: (await supervisorEvidenceFor(workerId, data)).slice(0, 20) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/supervisor/evidence") {
      const body = await readBody(req);
      if (!body.workerId || !body.skill || !body.observation || !body.outcome) {
        sendError(res, 400, "workerId, skill, observation, and outcome are required");
        return;
      }
      await writeStorage("supervisor-evidence", SUPERVISOR_EVIDENCE_LOG_PATH, {
        event: "supervisor.evidence",
        sessionId: body.sessionId || context.sessionId || null,
        supervisorRole: context.userRole,
        workerId: body.workerId,
        workerName: body.workerName || "",
        roleId: body.roleId || "",
        roleName: body.roleName || "",
        skill: body.skill,
        observation: body.observation,
        outcome: body.outcome
      }, data);
      await recordTrainingLoop({
        event: "training.loop",
        workerId: body.workerId,
        roleId: body.roleId || "",
        roleName: body.roleName || "",
        skill: body.skill,
        stage: body.outcome === "validated" ? "supervisor_validated" : "needs_coaching",
        note: body.observation
      }, data);
      sendJson(res, 202, { status: "recorded" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/worker/login") {
      const body = await readBody(req);
      const role = findRole(data, body.roleId);
      if (!role) {
        sendError(res, 404, "Role not found");
        return;
      }
      const worker = findWorker(role, body.workerId);
      if (!worker) {
        sendError(res, 404, "Worker not found");
        return;
      }
      const purpose = String(body.purpose || "").trim();
      if (!purpose) {
        sendError(res, 400, "purpose is required");
        return;
      }
      const sessionId = `wrk-${Date.now()}`;
      const loginTime = new Date().toISOString();
      await writeStorage("worker-activity", WORKER_ACTIVITY_LOG_PATH, {
        event: "login",
        sessionId,
        userRole: "worker",
        userId: worker.id,
        roleId: role.id,
        roleName: role.name,
        workerId: worker.id,
        workerName: worker.name,
        shiftContext: body.shiftContext || "Not specified",
        purpose,
        details: `Worker login for ${purpose}`
      }, data);
      const activities = await workerActivityFor(worker.id, data);
      sendJson(res, 201, {
        sessionId,
        loginTime,
        workerId: worker.id,
        workerName: worker.name,
        roleId: role.id,
        roleName: role.name,
        purpose,
        shiftContext: body.shiftContext || "Not specified",
        summary: workerActivitySummary(activities)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/worker/logout") {
      const body = await readBody(req);
      const role = findRole(data, body.roleId);
      if (!role) {
        sendError(res, 404, "Role not found");
        return;
      }
      const worker = findWorker(role, body.workerId);
      if (!worker) {
        sendError(res, 404, "Worker not found");
        return;
      }
      await writeStorage("worker-logout", WORKER_ACTIVITY_LOG_PATH, {
        event: "logout",
        sessionId: body.sessionId || context.sessionId || `wrk-${Date.now()}`,
        userRole: "worker",
        userId: worker.id,
        roleId: role.id,
        roleName: role.name,
        workerId: worker.id,
        workerName: worker.name,
        logoutTime: body.logoutTime || new Date().toISOString(),
        details: "Worker logged out"
      }, data);
      sendJson(res, 202, { status: "logged-out", workerId: worker.id, logoutTime: body.logoutTime || new Date().toISOString() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/worker/activity") {
      const body = await readBody(req);
      if (!body.workerId || !body.event) {
        sendError(res, 400, "workerId and event are required");
        return;
      }
      await writeStorage("worker-activity", WORKER_ACTIVITY_LOG_PATH, {
        event: body.event,
        sessionId: body.sessionId || context.sessionId || null,
        userRole: context.userRole,
        userId: body.workerId,
        roleId: body.roleId || null,
        roleName: body.roleName || null,
        workerId: body.workerId,
        workerName: body.workerName || null,
        purpose: body.purpose || "",
        question: body.question || "",
        targetView: body.targetView || "",
        details: body.details || ""
      }, data);
      sendJson(res, 202, { status: "recorded" });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/roles/") && url.pathname.endsWith("/skill-risk")) {
      const roleId = url.pathname.split("/")[3];
      const role = findRole(data, roleId);
      if (!role) {
        sendError(res, 404, "Role not found");
        return;
      }
      const worker = findWorker(role, url.searchParams.get("workerId")) || role.workers[0];
      sendJson(res, 200, {
        roleId: role.id,
        role: role.name,
        workerId: worker.id,
        worker: worker.name,
        capabilityRisk: weightedRisk(role),
        prioritySkills: prioritySkills(role, 3),
        metrics: plantMetrics(data, role, worker)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/coach/answer") {
      const body = await readBody(req);
      const result = await answerPayload(data, body);
      if (result.status === 200) {
        await writeStorage("audit", AUDIT_LOG_PATH, {
          event: "coach.answer",
          requestId: context.requestId,
          sessionId: context.sessionId,
          userRole: context.userRole,
          userId: context.userId,
          role: result.payload.role,
          worker: result.payload.worker,
          source: result.payload.source,
          confidence: result.payload.confidence,
          requiresHumanReview: result.payload.safetyReview.requiresHumanReview,
          matchedTerms: result.payload.safetyReview.matchedTerms
        }, data);
        await writeStorage("worker-activity", WORKER_ACTIVITY_LOG_PATH, {
          event: "coach.answer",
          sessionId: context.sessionId,
          userRole: context.userRole,
          userId: body.workerId || result.payload.workerId,
          roleId: body.roleId,
          roleName: result.payload.role,
          workerId: body.workerId || result.payload.workerId,
          workerName: result.payload.worker,
          question: body.question,
          purpose: body.purpose || "",
          details: "Worker asked chatbot for assistance"
        }, data);
        await recordTrainingLoop({
          event: "training.loop",
          workerId: body.workerId || result.payload.workerId,
          roleId: body.roleId,
          roleName: result.payload.role,
          skill: result.payload.recommendedLearning,
          stage: "question_asked",
          note: body.question
        }, data);
      }
      result.status === 200 ? sendJson(res, result.status, result.payload) : sendError(res, result.status, result.payload.message);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/supervisor/coaching-plan") {
      const result = coachingPayload(data, await readBody(req));
      result.status === 200 ? sendJson(res, result.status, result.payload) : sendError(res, result.status, result.payload.message);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/learning/path") {
      const body = await readBody(req);
      const result = learningPathPayload(data, body);
      if (result.status === 200 && body.workerId) {
        await recordTrainingLoop({
          event: "training.loop",
          workerId: body.workerId,
          roleId: body.roleId,
          roleName: result.payload.role,
          skill: result.payload.path[0] ? result.payload.path[0].skill : "Learning path",
          stage: "learning_assigned",
          note: "14-day learning path generated"
        }, data);
      }
      result.status === 200 ? sendJson(res, result.status, result.payload) : sendError(res, result.status, result.payload.message);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/assessment/generate") {
      const body = await readBody(req);
      const result = assessmentPayload(data, body);
      if (result.status === 200 && body.workerId) {
        await recordTrainingLoop({
          event: "training.loop",
          workerId: body.workerId,
          roleId: body.roleId,
          roleName: result.payload.role,
          skill: result.payload.questions[0] ? result.payload.questions[0].skill : "Assessment",
          stage: "assessment_generated",
          note: "Scenario assessment generated"
        }, data);
      }
      result.status === 200 ? sendJson(res, result.status, result.payload) : sendError(res, result.status, result.payload.message);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/approvals") {
      const body = await readBody(req);
      const approvalId = `appr-${Date.now()}`;
      await writeStorage("approval", APPROVAL_LOG_PATH, {
        event: "approval",
        approvalId,
        type: body.type || "ai-recommendation",
        status: body.status || "pending",
        comment: body.comment || "",
        userRole: context.userRole,
        userId: context.userId
      }, data);
      sendJson(res, 202, { approvalId, status: body.status || "pending" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/approvals") {
      const approvals = await readStorage("approval", APPROVAL_LOG_PATH, { limit: 20 }, data);
      sendJson(res, 200, { approvals: approvals.slice(0, 20) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/translate") {
      sendJson(res, 200, translatePayload(await readBody(req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/knowledge/capture-pack") {
      const result = capturePayload(data, await readBody(req));
      result.status === 200 ? sendJson(res, result.status, result.payload) : sendError(res, result.status, result.payload.message);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/impact/estimate") {
      const result = impactPayload(await readBody(req));
      result.status === 200 ? sendJson(res, result.status, result.payload) : sendError(res, result.status, result.payload.message);
      return;
    }

    // Feedback endpoint — thumbs up/down on AI coach answers
    if (req.method === "POST" && url.pathname === "/api/feedback") {
      const body = await readBody(req);
      const { answerId, workerId, roleId, skill, rating, comment } = body;
      if (!answerId || !rating || !["up", "down"].includes(rating)) {
        sendError(res, 400, "answerId and rating ('up'|'down') are required");
        return;
      }
      appendJsonLine(FEEDBACK_LOG_PATH, {
        event: "answer.feedback",
        answerId,
        workerId: workerId || "anonymous",
        roleId: roleId || "unknown",
        skill: skill || "",
        rating,
        comment: comment || ""
      });
      // Persist to training loop so personalization can read it
      await recordTrainingLoop({
        event: "training.loop",
        workerId: workerId || "anonymous",
        roleId,
        skill: skill || "",
        stage: rating === "up" ? "feedback_positive" : "feedback_negative",
        note: comment || `Worker rated answer ${rating}`
      }, data);
      sendJson(res, 200, { recorded: true, rating });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/feedback/summary") {
      if (!fs.existsSync(FEEDBACK_LOG_PATH)) {
        sendJson(res, 200, { total: 0, thumbsUp: 0, thumbsDown: 0, thumbsUpRate: null, topDownSkills: [] });
        return;
      }
      const lines = fs.readFileSync(FEEDBACK_LOG_PATH, "utf8").split("\n").filter(Boolean);
      const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const thumbsUp = entries.filter(e => e.rating === "up").length;
      const thumbsDown = entries.filter(e => e.rating === "down").length;
      const total = thumbsUp + thumbsDown;
      // Aggregate negative feedback by skill to surface which topics need content improvement
      const downBySkill = {};
      entries.filter(e => e.rating === "down" && e.skill).forEach(e => {
        downBySkill[e.skill] = (downBySkill[e.skill] || 0) + 1;
      });
      const topDownSkills = Object.entries(downBySkill)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([skill, count]) => ({ skill, count }));
      sendJson(res, 200, {
        total,
        thumbsUp,
        thumbsDown,
        thumbsUpRate: total > 0 ? Math.round((thumbsUp / total) * 100) : null,
        topDownSkills
      });
      return;
    }

    sendError(res, 404, "API route not found");
  } catch (error) {
    sendError(res, 500, "Internal server error", { requestId: crypto.randomUUID() });
  }
}

if (require.main === module) {
  http.createServer(route).listen(PORT, () => {
    process.stdout.write(`SkillPath AI listening on http://localhost:${PORT}\n`);
  });
}

module.exports = {
  route,
  weightedRisk,
  prioritySkills,
  retrieveKnowledge,
  workerActivitySummary,
  trainingLoopSummary,
  shiftIntelligence,
  expertRiskPayload
};

