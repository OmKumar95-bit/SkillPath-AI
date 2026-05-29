# SkillPath AI - Project Manifest

This project manifest provides a technical overview of the directory structure, backend service endpoints, and modular features implemented in 
**SkillPath AI** for Tata Steel Jamshedpur Works.

---

## 🚀 Execution & Run Commands

To check, test, and start the system, execute the following commands in the project directory:

```bash
# Verify file and code integrity
npm run check

# Run unit and integration tests
npm test

# Start the Node.js application server
npm start
```

Once started, the application will serve the interactive console locally at:
👉 **http://localhost:8081**

---

## 📂 Project Architecture & Core Files

### Frontend Console
*   `prototype/index.html` — The centralized user interface exposing viewports for Workers, Supervisors, L&D managers, EHS compliance officers, and plant sponsors.
*   `prototype/styles.css` — High-fidelity CSS tokens utilizing responsive plant UI themes and dynamic color variables.
*   `prototype/app.js` — Client-side logic orchestrating interactive dashboards, live API calls, and local offline-fallback behaviors.

### Backend Infrastructure
*   `server/index.js` — Core application server handling REST API routes, static asset delivery, and shift intelligence calculation.
*   `server/lib/genai.js` — Grounded GenAI wrapper with fail-safes and local content fallback.
*   `server/lib/auth.js` — Session claim parsing, user role validation, and mock SSO integration.
*   `server/lib/rag.js` — Document similarity vector retriever mapping operator queries to approved plant SOP chunks.
*   `server/lib/database.js` — Connection utility and status tracker for local and remote MySQL database nodes.
*   `server/lib/integrations.js` — Integration state adapters for steel plant operational systems (LMS, HRMS, QMS, CMMS, EHS).
*   `server/schema/mysql.sql` — Relational database schema layout optimized for MySQL transaction records.
*   `server/tests/api-smoke.test.js` — Automation scripts verifying server health, vector search, RAG grounding, and security constraints.

---

## 🔌 Primary REST API Contract

### Core System
*   `GET /api/health` — Check server system health, active database node, and service config.
*   `GET /api/bootstrap` — Initialize active role, shift profile, and capability metrics.
*   `GET /api/auth/session` — Retrieve active authenticated session tokens.
*   `GET /api/database/status` — Inspect MySQL connection telemetry.
*   `GET /api/integrations/status` — Poll LMS, HRMS, and CMMS integration health.

### L&D Intelligence & Workflows
*   `GET /api/analytics` — Compile plant capability statistics and EHS reviews.
*   `POST /api/coach/answer` — Answer operator troubleshooting questions using RAG.
*   `POST /api/supervisor/coaching-plan` — Map worker skill gaps to on-the-job action plans.
*   `POST /api/supervisor/evidence` — Persist supervisor-submitted field competency observations.
*   `POST /api/knowledge/capture-pack` — Auto-generate interview questionnaires to capture expert knowledge.
*   `POST /api/impact/estimate` — Calculate supervisor hours saved based on worker usage profiles.
*   `POST /api/documents/upload` — Ingest new plant operating manuals into the local RAG store.
*   `POST /api/learning/path` — Generate a 14-day prioritized skill development path.
*   `POST /api/assessment/generate` — Formulate interactive scenario-based worker knowledge checks.
*   `GET /api/access/roles` — Expose role-based authorization matrix.
*   `POST /api/approvals` — Request supervisor or manager sign-off for worker skill advancements.
*   `GET /api/approvals` — Load the pending organizational approval queue.
*   `POST /api/translate` — Translate critical plant safety recommendations into shopfloor languages (e.g., Hindi, Marathi).
