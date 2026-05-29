const fs = require("fs");
const path = require("path");

const DEFAULT_DOC_DIR = path.resolve(__dirname, "..", "..", "docs", "knowledge-base");

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function vectorize(tokens) {
  return tokens.reduce((vector, token) => {
    vector[token] = (vector[token] || 0) + 1;
    return vector;
  }, {});
}

function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (const key of keys) {
    dot += (a[key] || 0) * (b[key] || 0);
    aMag += (a[key] || 0) ** 2;
    bMag += (b[key] || 0) ** 2;
  }
  return aMag && bMag ? dot / (Math.sqrt(aMag) * Math.sqrt(bMag)) : 0;
}

function chunkText(text, size = 900) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (`${current}\n\n${paragraph}`.length > size && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = `${current}\n\n${paragraph}`.trim();
    }
  }

  if (current) {
    chunks.push(current.trim());
  }
  return chunks;
}

function loadDocuments(docDir = DEFAULT_DOC_DIR) {
  if (!fs.existsSync(docDir)) {
    return [];
  }

  return fs
    .readdirSync(docDir)
    .filter((file) => /\.(md|txt)$/i.test(file))
    .flatMap((file) => {
      const fullPath = path.join(docDir, file);
      const text = fs.readFileSync(fullPath, "utf8");
      return chunkText(text).map((chunk, index) => ({
        id: `${file}#${index + 1}`,
        source: file,
        text: chunk,
        tokens: tokenize(chunk),
        vector: vectorize(tokenize(chunk))
      }));
    });
}

function retrieveDocuments(query, options = {}) {
  const documents = loadDocuments(options.docDir);
  const rawQueryTokens = tokenize(query);
  const queryTokens = new Set(rawQueryTokens);
  const queryVector = vectorize(rawQueryTokens);

  return documents
    .map((doc) => {
      const overlap = doc.tokens.filter((token) => queryTokens.has(token)).length;
      const density = overlap / Math.max(doc.tokens.length, 1);
      const vectorScore = cosineSimilarity(queryVector, doc.vector);
      return {
        id: doc.id,
        source: doc.source,
        snippet: doc.text.slice(0, 520),
        score: Number((overlap + density + vectorScore * 3).toFixed(4)),
        vectorScore: Number(vectorScore.toFixed(4))
      };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit || 4);
}

module.exports = {
  retrieveDocuments,
  loadDocuments,
  vectorize,
  cosineSimilarity
};
