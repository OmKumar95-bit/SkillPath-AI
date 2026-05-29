# SkillPath AI

Industry-ready capstone project for AI-enabled learning and development at **Tata Steel Limited, Jamshedpur Works**.

## Product Idea

SkillPath AI is a role-based L&D intelligence console designed for critical steel plant roles at Tata Steel Jamshedpur. It helps leaders see workforce capability risk, helps supervisors coach against real skill gaps, helps workers get simple guidance, and helps the organization capture expert know-how before it is lost.

## Primary Problem

At Tata Steel Jamshedpur Works, critical shopfloor roles such as Blast Furnace Operator, Steel Melting Shop Technician, Rolling Mill Operator, and Maintenance Technician require safe, consistent, role-specific capability. The core problem is that L&D teams often lack a live role-level view of skill gaps, making training reactive, generic, and difficult to connect to safety, quality, uptime, onboarding, and productivity outcomes.

## Secondary Opportunity

Experienced workers hold tacit troubleshooting and process knowledge that is not captured systematically. AI can help convert this knowledge into searchable guidance, micro-learning, coaching checklists, and scenario practice.

## What Makes This Stand Out

- Business problem first, not AI first.
- Worker, supervisor, L&D, and leadership views in one experience.
- Built-in trust controls: approved-content answers, confidence signal, human review, and escalation.
- Uses steel plant metrics: safety, hot metal/steel quality, downtime, rework, line stoppage, onboarding, and expert dependency.
- Designed for shopfloor usability with short, role-specific guidance.

## Project Files

- `prototype/index.html` - main interactive product prototype.
- `prototype/app.js` - role data, retrieval logic, coaching workflow, and impact estimator.
- `prototype/styles.css` - responsive industry-grade UI.
- `data/industrial-ld-sample-data.json` - sample role, skill, and knowledge data.
- `docs/week1-problem-statement.md` - business problem definition.
- `docs/use-case-blueprint.md` - solution design, personas, prompts, and expected outputs.
- `docs/impact-roadmap.md` - build roadmap, ROI logic, and pilot success metrics.
- `docs/industry-readiness-checklist.md` - controls needed before real deployment.
- `docs/solution-architecture.md` - target architecture for RAG/API integration.
- `docs/final-demo-checklist.md` - live demo script and test flow.

## How To Run

Static demo mode:

`prototype/index.html`

Production-style local mode:

```bash
npm start
```

Then open:

`http://localhost:8081`

No external packages are required. The app now includes a Node.js backend API scaffold and a browser UI. The UI calls the backend when it is running and falls back to local demo logic when opened directly.

## Demo Flow

1. Start at the leadership command center for Tata Steel Jamshedpur Works.
2. Select a critical steel plant role and worker profile.
3. Use the Worker Coach to ask a real shopfloor training question.
4. Move to Supervisor Cockpit and generate a coaching plan.
5. Move to Knowledge Capture and generate an expert interview pack.
6. Move to Business Case and calculate pilot impact.

## Next Production Steps

1. Replace simulated data with pilot plant skill matrices, LMS records, assessment scores, SOPs, and training content.
2. Add document ingestion, embeddings, and retrieval-augmented generation.
3. Add authentication and role-based access.
4. Add supervisor feedback loops and L&D approval workflows.
5. Integrate with LMS, HRMS, quality, maintenance, and safety systems.

## Production Foundation Added

- `server/index.js` - backend API and static app server.
- `server/tests/api-smoke.test.js` - API smoke tests.
- `package.json` - start, check, and test scripts.
- `docs/enterprise-production-plan.md` - go-live plan and controls.
- `docs/final-demo-checklist.md` - exact live demo flow.

Useful commands:

```bash
npm run check
npm test
npm start
```
