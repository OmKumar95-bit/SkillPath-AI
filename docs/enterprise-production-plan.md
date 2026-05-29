# Enterprise Production Plan

SkillPath AI is now structured as a production-style application foundation. It is not yet safe to deploy inside a real enterprise network until the items below are completed with the company's IT, security, legal, L&D, EHS, and operations teams.

## What Has Been Built

- Browser-based product UI
- Backend API service
- Static app serving from the backend
- Skill-risk endpoint
- Worker coach endpoint
- Supervisor coaching endpoint
- Knowledge capture endpoint
- Impact estimator endpoint
- Feedback endpoint stub
- Optional API-key protection through `SkillPath_API_KEY`
- Smoke tests for core API routes
- Structured sample data

## Local Production-Style Run

```bash
npm start
```

Open:

```text
http://localhost:8080
```

Optional local API protection:

```bash
set SkillPath_API_KEY=change-me
npm start
```

In a real deployment, the API key should be replaced or supplemented with enterprise identity such as SSO/OIDC and role-based authorization.

## Required Before Real Go-Live

### 1. Identity And Access

- SSO integration
- role-based access for worker, supervisor, L&D, EHS, quality, and leadership
- employee data visibility rules
- audit trail for all sensitive actions

### 2. Data Layer

Replace JSON files with enterprise-grade storage:

- PostgreSQL or SQL Server for structured records
- object storage for documents
- vector database or search index for retrieval
- encrypted backups
- data retention policy

### 3. AI And RAG Layer

Add:

- document ingestion
- chunking and metadata tagging
- embeddings
- retrieval ranking
- grounded answer generation
- citation enforcement
- unsafe-answer filter
- low-confidence escalation

### 4. Enterprise Integrations

Connect to:

- LMS for learning content and completions
- HRMS for worker role and organization structure
- assessment system for competency evidence
- QMS for defects and corrective actions
- CMMS for downtime and maintenance events
- EHS systems for safety constraints

### 5. Governance

Mandatory approval workflows:

- SOP content approval
- AI answer review policy
- knowledge article review by process owner
- EHS and quality sign-off for safety-critical topics
- model and prompt change control

### 6. Monitoring

Track:

- answer confidence
- unanswered questions
- supervisor acceptance
- source usage
- latency
- errors
- adoption by role
- repeated skill gaps
- business impact metrics

### 7. Security Controls

Required:

- HTTPS only
- secure secrets manager
- network allowlisting
- dependency scanning
- vulnerability testing
- logging without sensitive content leakage
- input validation
- output safety checks

## Suggested Production Stack

Frontend:

- React or plain server-rendered UI depending on IT preference
- design system aligned with company standards

Backend:

- Node.js or Python API service
- PostgreSQL or SQL Server
- Redis for queues/caching if needed

AI:

- enterprise-approved LLM provider
- RAG over approved content only
- prompt registry and evaluation set

Deployment:

- Docker containers
- Kubernetes or enterprise PaaS
- CI/CD with environment approvals
- dev, test, UAT, production environments

## Pilot To Production Path

1. Pilot one plant.
2. Select three critical roles.
3. Ingest only approved SOPs and training content.
4. Run with supervisor review enabled.
5. Measure time saved, training precision, assessment uplift, and repeated-question reduction.
6. Present results to leadership.
7. Expand to more roles only after governance is stable.

## Go/No-Go Criteria

Go if:

- users can complete the workflow without support
- sources are accurate and approved
- supervisors trust recommendations
- safety-critical answers are escalated correctly
- measurable operating value is visible

No-go if:

- AI invents procedures
- source quality is weak
- access controls are unclear
- supervisors bypass review
- business impact cannot be measured

