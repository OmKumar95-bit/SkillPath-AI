const DEFAULT_MODEL = process.env.GENAI_MODEL || "gpt-4.1-mini";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

function localGroundedAnswer({ question, roleName, retrievedDocs, staticAnswer }) {
  const bestDoc = retrievedDocs[0];
  return {
    provider: "local-deterministic",
    model: "rule-based-rag-fallback",
    answer: staticAnswer,
    generated: false,
    rationale: bestDoc
      ? `Matched approved document ${bestDoc.source} before returning safe guidance.`
      : "No document match was strong enough; returned approved static guidance."
  };
}

async function openAiCompatibleAnswer({ question, roleName, retrievedDocs, staticAnswer }) {
  if (!OPENAI_API_KEY) {
    return localGroundedAnswer({ question, roleName, retrievedDocs, staticAnswer });
  }

  const context = retrievedDocs
    .map((doc, index) => `[${index + 1}] ${doc.source}\n${doc.snippet}`)
    .join("\n\n");

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are SkillPath AI, an industrial L&D assistant. Answer only from approved context. Keep worker-facing language short, safe, and practical. If safety is uncertain, escalate to supervisor/EHS."
        },
        {
          role: "user",
          content: `Role: ${roleName}\nQuestion: ${question}\nApproved context:\n${context || "No retrieved context."}\nFallback approved guidance:\n${staticAnswer}`
        }
      ]
    })
  });

  if (!response.ok) {
    return localGroundedAnswer({ question, roleName, retrievedDocs, staticAnswer });
  }

  const payload = await response.json();
  const answer = payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : staticAnswer;

  return {
    provider: "openai-compatible",
    model: DEFAULT_MODEL,
    answer,
    generated: true,
    rationale: "Generated from retrieved approved context using configured GenAI provider."
  };
}

module.exports = {
  generateGroundedAnswer: openAiCompatibleAnswer
};

