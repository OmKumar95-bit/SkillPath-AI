function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function decodeJwtClaims(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

function getSession(req) {
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = decodeJwtClaims(bearer);

  if (claims) {
    return {
      mode: "oidc-token",
      userId: claims.sub || claims.email || "unknown",
      userRole: claims.SkillPath_role || claims.role || "enterprise-user",
      name: claims.name || claims.email || "Enterprise user",
      issuer: claims.iss || process.env.OIDC_ISSUER || "unknown"
    };
  }

  return {
    mode: "demo-header",
    userId: req.headers["x-user-id"] || "anonymous",
    userRole: req.headers["x-user-role"] || "demo-user",
    name: req.headers["x-user-name"] || "Demo user",
    issuer: "local-demo"
  };
}

function authStatus() {
  return {
    ssoConfigured: Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID),
    issuer: process.env.OIDC_ISSUER || null,
    mode: process.env.OIDC_ISSUER ? "oidc-ready" : "demo-headers"
  };
}

module.exports = {
  getSession,
  authStatus
};

