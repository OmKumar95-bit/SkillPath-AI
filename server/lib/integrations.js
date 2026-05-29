const SYSTEMS = [
  ["LMS", "LMS_BASE_URL"],
  ["HRMS", "HRMS_BASE_URL"],
  ["QMS", "QMS_BASE_URL"],
  ["CMMS", "CMMS_BASE_URL"],
  ["EHS", "EHS_BASE_URL"]
];

function integrationStatus() {
  return SYSTEMS.map(([name, envKey]) => ({
    system: name,
    envKey,
    configured: Boolean(process.env[envKey]),
    baseUrl: process.env[envKey] || null,
    mode: process.env[envKey] ? "ready-for-live-connector" : "simulated"
  }));
}

function integrationSummary() {
  const systems = integrationStatus();
  return {
    configuredCount: systems.filter((system) => system.configured).length,
    total: systems.length,
    systems
  };
}

module.exports = {
  integrationSummary
};
