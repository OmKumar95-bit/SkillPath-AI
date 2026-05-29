# Live Enterprise Setup

This project now includes implementation hooks for the items that were previously missing:

- GenAI model/API
- RAG over SOP/training documents
- PostgreSQL schema
- SSO/OIDC session handling
- LMS/HRMS/QMS/CMMS/EHS integration adapters

## 1. GenAI API

Set:

```text
OPENAI_API_KEY=your-provider-key
OPENAI_BASE_URL=https://api.openai.com/v1
GENAI_MODEL=gpt-4.1-mini
```

The backend calls an OpenAI-compatible `/chat/completions` endpoint from `server/lib/genai.js`.

Without a key, the system falls back to deterministic local guidance.

## 2. RAG Documents

Put approved `.md` or `.txt` files here:

```text
docs/knowledge-base
```

Current sample files:

- `cnc-tool-change-sop.md`
- `hydraulic-safety-sop.md`
- `quality-measurement-guide.md`

Test retrieval:

```bash
npm.cmd run rag:search -- "tool change dimensional defect"
```

API endpoint:

```text
GET /api/rag/search?q=tool%20change%20defect
```

## 3. PostgreSQL

Schema file:

```text
server/schema/postgres.sql
```

Set:

```text
DATABASE_URL=postgres://SkillPath_user:password@localhost:5432/SkillPath
```

The current local app still reads JSON so it can run without setup. In a real enterprise deployment, the JSON data should be migrated into the PostgreSQL tables defined in the schema.

## 4. SSO / OIDC

Set:

```text
OIDC_ISSUER=https://login.company.com/oauth2/default
OIDC_CLIENT_ID=SkillPath-ai
```

The server can parse bearer-token claims for user id and role. A production deployment should add full JWT signature verification using the organization's JWKS endpoint.

Current endpoint:

```text
GET /api/auth/session
```

## 5. Enterprise Integrations

Set any available integration URLs:

```text
LMS_BASE_URL=https://lms.company.com
HRMS_BASE_URL=https://hrms.company.com
QMS_BASE_URL=https://qms.company.com
CMMS_BASE_URL=https://cmms.company.com
EHS_BASE_URL=https://ehs.company.com
```

Status endpoint:

```text
GET /api/integrations/status
```

These adapters are intentionally status-first until credentials, API contracts, and security approvals are available.

## 6. Production Reality Check

The code now has live integration points. To activate them inside a real enterprise, you still need:

- approved GenAI provider credentials
- approved SOP/training documents
- PostgreSQL database provisioned
- SSO/OIDC app registration
- enterprise API credentials
- network/firewall approval
- security testing

