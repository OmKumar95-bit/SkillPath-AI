const http = require("http");
const assert = require("assert");
const { route } = require("../index");

function request(server, method, path, body, headers = {}) {
  const payload = body ? JSON.stringify(body) : "";
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        port: server.address().port,
        path,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          ...headers
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        });
      }
    );
    req.on("error", reject);
    req.end(payload);
  });
}

async function run() {
  const server = http.createServer(route);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const health = await request(server, "GET", "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");

    const bootstrap = await request(server, "GET", "/api/bootstrap");
    assert.equal(bootstrap.status, 200);
    assert.ok(bootstrap.body.roles.length >= 3);

    const workerLogin = await request(server, "POST", "/api/worker/login", {
      roleId: "blast-furnace-operator",
      workerId: "rakesh",
      shiftContext: "Night shift",
      purpose: "Need help with furnace trend troubleshooting"
    });
    assert.equal(workerLogin.status, 201);
    assert.ok(workerLogin.body.sessionId);

    const shiftIntel = await request(server, "GET", "/api/shift-intelligence?roleId=blast-furnace-operator&workerId=rakesh&shiftContext=Night%20shift");
    assert.equal(shiftIntel.status, 200);
    assert.equal(shiftIntel.body.shiftContext, "Night shift");
    assert.ok(shiftIntel.body.heatmap.length >= 1);

    const answer = await request(server, "POST", "/api/coach/answer", {
      roleId: "blast-furnace-operator",
      workerId: "rakesh",
      shiftContext: "Night shift",
      question: "What should I check when furnace temperature trend becomes unstable?"
    }, {
      "x-session-id": workerLogin.body.sessionId,
      "x-user-role": "worker",
      "x-user-id": "rakesh"
    });
    assert.equal(answer.status, 200);
    assert.ok(answer.body.steps.length >= 3);

    const unsafe = await request(server, "POST", "/api/coach/answer", {
      roleId: "maintenance-technician-steel-plant",
      workerId: "asha",
      shiftContext: "Night shift",
      question: "Can I bypass the interlock during hydraulic testing?"
    });
    assert.equal(unsafe.status, 200);
    assert.equal(unsafe.body.safetyReview.requiresHumanReview, true);

    const learningPath = await request(server, "POST", "/api/learning/path", {
      roleId: "blast-furnace-operator",
      workerId: "rakesh"
    });
    assert.equal(learningPath.status, 200);
    assert.equal(learningPath.body.durationDays, 14);

    const assessment = await request(server, "POST", "/api/assessment/generate", {
      roleId: "blast-furnace-operator",
      workerId: "rakesh"
    });
    assert.equal(assessment.status, 200);
    assert.equal(assessment.body.questions.length, 3);

    const evidence = await request(server, "POST", "/api/supervisor/evidence", {
      sessionId: workerLogin.body.sessionId,
      roleId: "blast-furnace-operator",
      roleName: "Blast Furnace Operator",
      workerId: "rakesh",
      workerName: "Rakesh K.",
      skill: "Furnace parameter monitoring",
      observation: "Worker completed safe checks and explained escalation logic.",
      outcome: "validated"
    }, {
      "x-user-role": "supervisor",
      "x-user-id": "supervisor-demo"
    });
    assert.equal(evidence.status, 202);

    const evidenceList = await request(server, "GET", "/api/supervisor/evidence?workerId=rakesh");
    assert.equal(evidenceList.status, 200);
    assert.ok(evidenceList.body.evidence.length >= 1);

    const trainingLoop = await request(server, "GET", "/api/training-loop?workerId=rakesh");
    assert.equal(trainingLoop.status, 200);
    assert.equal(trainingLoop.body.summary.supervisorValidated, true);
    assert.equal(trainingLoop.body.summary.learningAssigned, true);

    const expertRisk = await request(server, "GET", "/api/expert-risk?roleId=blast-furnace-operator");
    assert.equal(expertRisk.status, 200);
    assert.ok(expertRisk.body.dependencyScore > 0);

    const safetyQueue = await request(server, "GET", "/api/safety/queue");
    assert.equal(safetyQueue.status, 200);
    assert.ok(safetyQueue.body.total >= 1);

    const analytics = await request(server, "GET", "/api/analytics");
    assert.equal(analytics.status, 200);
    assert.ok(analytics.body.safetyEscalations >= 1);
    assert.ok(analytics.body.supervisorEvidenceCount >= 1);
    assert.ok(analytics.body.trainingLoopEvents >= 3);

    const workerActivity = await request(server, "GET", "/api/worker/activity?workerId=rakesh");
    assert.equal(workerActivity.status, 200);
    assert.ok(workerActivity.body.summary.questionsAsked >= 1);

    const logout = await request(server, "POST", "/api/worker/logout", {
      sessionId: workerLogin.body.sessionId,
      roleId: "blast-furnace-operator",
      workerId: "rakesh"
    });
    assert.equal(logout.status, 202);

    process.stdout.write("api smoke tests passed\n");
  } finally {
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
