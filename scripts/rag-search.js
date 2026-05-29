const { retrieveDocuments } = require("../server/lib/rag");

const query = process.argv.slice(2).join(" ") || "tool change dimensional defect";
const results = retrieveDocuments(query);

process.stdout.write(JSON.stringify({ query, results }, null, 2));
process.stdout.write("\n");
