const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.resolve(__dirname, "..", "schema", "mysql.sql");

let mysqlModule = null;
let pool = null;
let initialized = false;
let seeded = false;

function getMysqlModule() {
  if (mysqlModule !== null) {
    return mysqlModule;
  }
  try {
    mysqlModule = require("mysql2/promise");
  } catch {
    mysqlModule = undefined;
  }
  return mysqlModule;
}

function mysqlConfigured() {
  return Boolean(
    process.env.MYSQL_HOST &&
    process.env.MYSQL_PORT &&
    process.env.MYSQL_DATABASE &&
    process.env.MYSQL_USER &&
    typeof process.env.MYSQL_PASSWORD !== "undefined" &&
    getMysqlModule()
  );
}

function getPool() {
  if (!mysqlConfigured()) {
    return null;
  }
  if (!pool) {
    const mysql = getMysqlModule();
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      multipleStatements: true
    });
  }
  return pool;
}

async function runQuery(sql, params = []) {
  const db = getPool();
  if (!db) {
    throw new Error("MySQL is not configured");
  }
  return db.execute(sql, params);
}

async function ensureSchema() {
  if (!mysqlConfigured() || initialized) {
    return;
  }
  const db = getPool();
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  await db.query(schema);
  initialized = true;
}

async function seedReferenceData(data) {
  if (!mysqlConfigured() || seeded || !data) {
    return;
  }
  await ensureSchema();

  for (const role of data.roles || []) {
    await runQuery(
      `insert into roles (id, name, risk_owner, business_exposure)
       values (?, ?, ?, ?)
       on duplicate key update
         name = values(name),
         risk_owner = values(risk_owner),
         business_exposure = values(business_exposure)`,
      [role.id, role.name, role.riskOwner, role.businessExposure]
    );

    for (const worker of role.workers || []) {
      await runQuery(
        `insert into workers (id, role_id, name, tenure, assessment_score, training_precision)
         values (?, ?, ?, ?, ?, ?)
         on duplicate key update
           role_id = values(role_id),
           name = values(name),
           tenure = values(tenure),
           assessment_score = values(assessment_score),
           training_precision = values(training_precision)`,
        [worker.id, role.id, worker.name, worker.tenure, worker.assessment, worker.trainingPrecision]
      );
    }

    for (const skill of role.criticalSkills || []) {
      await runQuery(
        `insert into skills (role_id, skill, required_level, current_level, risk_type, weight, evidence)
         values (?, ?, ?, ?, ?, ?, ?)
         on duplicate key update
           required_level = values(required_level),
           current_level = values(current_level),
           risk_type = values(risk_type),
           weight = values(weight),
           evidence = values(evidence)`,
        [role.id, skill.skill, skill.required, skill.current, skill.risk, skill.weight, skill.evidence]
      );
    }
  }

  for (const item of data.knowledge || []) {
    const body = `${item.summary}\n\nRecommended learning: ${item.recommendedLearning}\nEscalation: ${item.escalation}`;
    await runQuery(
      `insert into knowledge_documents (source, title, body, tags)
       values (?, ?, ?, ?)
       on duplicate key update
         body = values(body),
         tags = values(tags)`,
      [item.source, item.title, body, JSON.stringify(item.tags || [])]
    );
  }

  seeded = true;
}

function databaseStatus() {
  const configured = Boolean(
    process.env.MYSQL_HOST &&
    process.env.MYSQL_PORT &&
    process.env.MYSQL_DATABASE &&
    process.env.MYSQL_USER &&
    typeof process.env.MYSQL_PASSWORD !== "undefined"
  );
  const mysqlInstalled = Boolean(getMysqlModule());
  return {
    configured,
    engine: "mysql",
    mode: configured && mysqlInstalled ? "mysql-active" : "json-file-local-mode",
    schemaPath: SCHEMA_PATH,
    schemaAvailable: fs.existsSync(SCHEMA_PATH),
    note: configured
      ? mysqlInstalled
        ? "MySQL connection variables and mysql2 are configured. The app will write logs and tracking data to MySQL."
        : "MySQL variables are configured but mysql2 is not installed yet."
      : "Using local JSON data for demo. Set MYSQL_* variables to enable MySQL."
  };
}

async function persistEvent(type, payload, data) {
  if (!mysqlConfigured()) {
    return false;
  }
  await seedReferenceData(data);

  if (type === "audit") {
    await runQuery(
      `insert into ai_audit_log
       (request_id, user_id, user_role, role_name, worker_name, source, confidence, requires_human_review, matched_terms)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.requestId,
        payload.userId,
        payload.userRole,
        payload.role,
        payload.worker,
        payload.source,
        payload.confidence,
        payload.requiresHumanReview ? 1 : 0,
        JSON.stringify(payload.matchedTerms || [])
      ]
    );
    return true;
  }



  if (type === "approval") {
    await runQuery(
      `insert into approval_log (approval_id, type, status, comment, user_id, user_role)
       values (?, ?, ?, ?, ?, ?)`,
      [payload.approvalId, payload.type, payload.status, payload.comment, payload.userId, payload.userRole]
    );
    return true;
  }

  if (type === "worker-activity") {
    await runQuery(
      `insert into worker_activity_log
       (event, session_id, user_role, user_id, role_id, role_name, worker_id, worker_name, purpose, question, target_view, details, shift_context)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.event,
        payload.sessionId,
        payload.userRole,
        payload.userId,
        payload.roleId,
        payload.roleName,
        payload.workerId,
        payload.workerName,
        payload.purpose || "",
        payload.question || "",
        payload.targetView || "",
        payload.details || "",
        payload.shiftContext || ""
      ]
    );

    if (payload.event === "login") {
      await runQuery(
        `insert into worker_sessions
         (session_id, role_id, role_name, worker_id, worker_name, shift_context, purpose, login_time)
         values (?, ?, ?, ?, ?, ?, ?, now())
         on duplicate key update session_id = values(session_id)`,
        [payload.sessionId, payload.roleId, payload.roleName, payload.workerId, payload.workerName, payload.shiftContext || "", payload.purpose || ""]
      );
    }
    return true;
  }

  if (type === "worker-logout") {
    await runQuery(
      `update worker_sessions
       set logout_time = coalesce(?, now())
       where session_id = ?`,
      [payload.logoutTime || null, payload.sessionId]
    );
    await runQuery(
      `insert into worker_activity_log
       (event, session_id, user_role, user_id, role_id, role_name, worker_id, worker_name, details)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["logout", payload.sessionId, payload.userRole, payload.userId, payload.roleId, payload.roleName, payload.workerId, payload.workerName, payload.details || "Worker logged out"]
    );
    return true;
  }

  if (type === "supervisor-evidence") {
    await runQuery(
      `insert into supervisor_evidence_log
       (session_id, supervisor_role, worker_id, worker_name, role_id, role_name, skill, observation, outcome)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.sessionId, payload.supervisorRole, payload.workerId, payload.workerName, payload.roleId, payload.roleName, payload.skill, payload.observation, payload.outcome]
    );
    return true;
  }

  if (type === "training-loop") {
    await runQuery(
      `insert into training_loop_log
       (worker_id, role_id, role_name, skill, stage, note)
       values (?, ?, ?, ?, ?, ?)`,
      [payload.workerId, payload.roleId, payload.roleName, payload.skill, payload.stage, payload.note || ""]
    );
    return true;
  }

  return false;
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const next = { ...row };
    if (typeof next.matchedTerms === "string") {
      try {
        next.matchedTerms = JSON.parse(next.matchedTerms);
      } catch {
        next.matchedTerms = [];
      }
    }
    return next;
  });
}

async function readEvents(type, filters = {}, data) {
  if (!mysqlConfigured()) {
    return null;
  }
  await seedReferenceData(data);

  if (type === "approval") {
    const [rows] = await runQuery(
      `select created_at as timestamp, approval_id as approvalId, type, status, comment, user_id as userId, user_role as userRole
       from approval_log
       order by created_at desc
       limit ?`,
      [filters.limit || 20]
    );
    return rows;
  }

  if (type === "worker-activity") {
    const [rows] = await runQuery(
      `select created_at as timestamp, event, session_id as sessionId, user_role as userRole,
              user_id as userId, role_id as roleId, role_name as roleName, worker_id as workerId,
              worker_name as workerName, purpose, question, target_view as targetView, details, shift_context as shiftContext
       from worker_activity_log
       where (? is null or worker_id = ?)
       order by created_at desc
       limit ?`,
      [filters.workerId || null, filters.workerId || null, filters.limit || 100]
    );
    return rows;
  }

  if (type === "supervisor-evidence") {
    const [rows] = await runQuery(
      `select created_at as timestamp, session_id as sessionId, supervisor_role as supervisorRole,
              worker_id as workerId, worker_name as workerName, role_id as roleId, role_name as roleName,
              skill, observation, outcome
       from supervisor_evidence_log
       where (? is null or worker_id = ?)
       order by created_at desc
       limit ?`,
      [filters.workerId || null, filters.workerId || null, filters.limit || 100]
    );
    return rows;
  }

  if (type === "training-loop") {
    const [rows] = await runQuery(
      `select created_at as timestamp, worker_id as workerId, role_id as roleId, role_name as roleName,
              skill, stage, note
       from training_loop_log
       where (? is null or worker_id = ?)
       order by created_at desc
       limit ?`,
      [filters.workerId || null, filters.workerId || null, filters.limit || 100]
    );
    return rows;
  }

  if (type === "audit") {
    const [rows] = await runQuery(
      `select created_at as timestamp, request_id as requestId, user_id as userId, user_role as userRole,
              role_name as role, worker_name as worker, source, confidence,
              requires_human_review as requiresHumanReview, matched_terms as matchedTerms
       from ai_audit_log
       order by created_at desc
       limit ?`,
      [filters.limit || 100]
    );
    return normalizeRows(rows);
  }



  return [];
}

module.exports = {
  databaseStatus,
  mysqlConfigured,
  ensureSchema,
  seedReferenceData,
  persistEvent,
  readEvents
};
