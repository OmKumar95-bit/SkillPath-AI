# API Contract For Production Build

This contract describes the backend services needed when the static prototype becomes a real application.

## 1. Skill Risk Endpoint

`GET /api/roles/{roleId}/skill-risk?workerId={workerId}`

Returns:

```json
{
  "roleId": "cnc-operator",
  "workerId": "asha",
  "capabilityRisk": 38,
  "prioritySkills": [
    {
      "skill": "Tool offset correction",
      "required": 4,
      "current": 2,
      "risk": "quality",
      "evidence": "two repeat defects after tool change"
    }
  ]
}
```

## 2. Worker Coach Endpoint

`POST /api/coach/answer`

Request:

```json
{
  "roleId": "cnc-operator",
  "workerId": "asha",
  "shiftContext": "Night shift",
  "question": "Why do dimensional defects keep happening after tool change?"
}
```

Returns:

```json
{
  "answer": "Confirm tool length, wear offset, fixture seating, coolant flow, and first-piece inspection before releasing production.",
  "source": "CNC setup checklist v3.2",
  "confidence": "medium-high",
  "recommendedLearning": "10-minute micro-module: Tool Offset Correction and First-Piece Check",
  "supervisorAction": "Observe one live tool change and record evidence.",
  "escalation": "Escalate if first-piece result remains out of tolerance after one verified offset correction."
}
```

## 3. Coaching Plan Endpoint

`POST /api/supervisor/coaching-plan`

Request:

```json
{
  "roleId": "maintenance-tech",
  "workerId": "neha",
  "timeWindow": "2 weeks"
}
```

Returns:

```json
{
  "worker": "Neha K.",
  "actions": [
    {
      "priority": 1,
      "skill": "Preventive maintenance planning",
      "coachingAction": "Review one recurring filter-change pattern and update PM checklist evidence.",
      "evidenceToCapture": "Completed checklist and supervisor observation"
    }
  ]
}
```

## 4. Knowledge Capture Endpoint

`POST /api/knowledge/capture-pack`

Request:

```json
{
  "roleId": "quality-inspector",
  "topic": "Gauge dispute resolution examples",
  "expertOwner": "Lead inspector"
}
```

Returns:

```json
{
  "interviewQuestions": [
    "What early signal tells you the issue is measurement-related?",
    "What unsafe or incorrect shortcut should newer workers avoid?"
  ],
  "publishFormat": [
    "short worker answer",
    "safe check sequence",
    "supervisor observation checklist",
    "micro-learning scenario",
    "search tags"
  ],
  "reviewGate": "Quality owner approval required before release"
}
```

## 5. Feedback Endpoint

`POST /api/feedback`

Request:

```json
{
  "answerId": "ans-2026-04-27-001",
  "userRole": "supervisor",
  "rating": "accepted",
  "comment": "Useful, but add gauge calibration check."
}
```

Purpose:

- improve content quality
- identify missing knowledge
- measure supervisor acceptance
- prevent unsupported AI answers from becoming standard practice
