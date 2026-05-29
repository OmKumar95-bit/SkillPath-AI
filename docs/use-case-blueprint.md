# Week 2 Use Case Blueprint: Tata Steel Jamshedpur

## Use Case Name

SkillPath AI for Tata Steel Jamshedpur Works

## User Personas

Primary user: steel plant shopfloor worker or technician

- Needs simple, role-specific guidance for blast furnace, steel melting shop, rolling mill, or maintenance tasks.
- Has limited time during shift.
- May prefer concise language over long training modules.
- Needs help connected to real equipment, procedures, and common mistakes.

Secondary user: supervisor

- Needs to know who needs coaching, on what topic, and why.
- Needs quick evidence before assigning training.
- Needs a way to capture expert knowledge before it disappears.

Tertiary user: L&D leader

- Needs capability visibility by role, plant, shift, and business risk.
- Needs to show impact beyond course completion.

## End-To-End Workflow

1. Worker selects role and experience level.
2. System reads skill expectations, assessment scores, training history, and common operational issues.
3. AI identifies priority skill gaps and explains why they matter.
4. Worker asks a question in natural language.
5. AI retrieves relevant guidance from approved knowledge sources.
6. AI gives a short answer, recommended learning item, and supervisor coaching action.
7. Supervisor sees aggregate gaps and knowledge capture prompts.
8. L&D leader sees impact metrics and investment priorities.

## AI Role

The AI acts as:

- Skill diagnostician: identifies capability gaps from structured and unstructured signals.
- Learning recommender: maps gaps to short, relevant learning interventions.
- Knowledge assistant: answers operational learning questions from approved content.
- Coaching copilot: gives supervisors short coaching prompts and practice scenarios.

## Sample Prompts

### Worker Prompt

```text
You are an AI skill coach for Tata Steel Jamshedpur Works. Answer in simple language for a shopfloor worker. Use only approved training knowledge. My role is Blast Furnace Operator, experience level is early-career, and my question is: What should I check when furnace temperature trend becomes unstable?
```

Expected output:

- likely risk signals
- safe check steps
- recommended micro-learning
- when to escalate to supervisor or quality engineer

### Supervisor Prompt

```text
You are a supervisor coaching assistant. Review this worker skill profile and suggest the top 3 coaching actions for the next 2 weeks. Prioritize safety, quality, and production continuity.
```

Expected output:

- priority gap
- coaching action
- practice scenario
- evidence to collect after coaching

### Knowledge Capture Prompt

```text
Interview an experienced Tata Steel Jamshedpur maintenance technician about a recurring hydraulic breakdown. Ask 5 structured questions that capture symptoms, root causes, safety cautions, and practical fixes.
```

Expected output:

- interview questions
- structured knowledge article
- tags for search and training reuse

## Measurable Impact

- 30-50 percent faster skill-gap review cycle
- 15-25 percent reduction in generic training assignments
- improved assessment uplift after targeted learning
- reduced repeat questions to supervisors
- lower dependency on a small group of experts

These are pilot targets, not guaranteed benefits. They should be validated with baseline data during Week 4 and Week 5.

