import http2 from "node:http2";
import jwt from "jsonwebtoken";

const RETRY_OTHER_ENV_REASONS = new Set(["BadDeviceToken", "DeviceTokenNotForTopic"]);

let cachedJwt: { token: string; expiresAt: number } | null = null;

function getApnsConfig() {
  const privateKey = (process.env.APNS_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  const keyId = process.env.APNS_KEY_ID?.trim() || "";
  const teamId = process.env.APNS_TEAM_ID?.trim() || "";
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "com.keymouseit.agencyops";
  const production = process.env.APNS_PRODUCTION === "true";

  return {
    keyId,
    teamId,
    privateKey,
    bundleId,
    production,
  };
}

export function isApnsConfigured() {
  const config = getApnsConfig();
  return Boolean(config.keyId && config.teamId && config.privateKey && config.bundleId);
}

export function getApnsStatus() {
  const config = getApnsConfig();
  return {
    configured: isApnsConfigured(),
    bundleId: config.bundleId || null,
    preferredProduction: config.production,
    keyId: config.keyId || null,
    teamId: config.teamId || null,
    hasPrivateKey: Boolean(config.privateKey),
  };
}

function normalizeDeviceToken(token: string) {
  return token.replace(/\s+/g, "").toLowerCase();
}

/** Same JWT as Apple Push Console "Authenticate using tokens" curl. */
function createApnsAuthToken() {
  const config = getApnsConfig();
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 60) {
    return cachedJwt.token;
  }

  const token = jwt.sign(
    { iss: config.teamId, iat: now },
    config.privateKey,
    {
      algorithm: "ES256",
      header: { alg: "ES256", kid: config.keyId },
    }
  );

  cachedJwt = { token, expiresAt: now + 3300 };
  return token;
}

function buildApnsBody(payload: { title: string; body: string; data?: Record<string, any> }) {
  return {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      badge: 1,
    },
    ...(payload.data || {}),
  };
}

function apnsHost(production: boolean) {
  return production ? "api.push.apple.com" : "api.development.push.apple.com";
}

async function sendApnsHttp2(
  production: boolean,
  deviceToken: string,
  body: Record<string, unknown>,
  bundleId: string
): Promise<{ ok: boolean; status: number; reason?: string; production: boolean }> {
  const host = apnsHost(production);
  const token = normalizeDeviceToken(deviceToken);
  const json = JSON.stringify(body);
  const authToken = createApnsAuthToken();

  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`);

    const fail = (err: Error) => {
      client.close();
      reject(err);
    };

    client.on("error", fail);

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${authToken}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(json),
    });

    let responseBody = "";
    let status = 0;

    req.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      client.close();
      if (status === 200) {
        console.log(
          "✅ [push][apns] delivered via",
          production ? "production" : "sandbox",
          "topic:",
          bundleId,
          "token:",
          token.slice(0, 10) + "..."
        );
        resolve({ ok: true, status, production });
        return;
      }

      let reason = "unknown";
      try {
        reason = (JSON.parse(responseBody) as { reason?: string }).reason || reason;
      } catch {
        reason = responseBody || reason;
      }

      console.warn(
        "⚠️ [push][apns] failed:",
        reason,
        "status:",
        status,
        "topic:",
        bundleId,
        "env:",
        production ? "production" : "sandbox"
      );
      resolve({ ok: false, status, reason, production });
    });
    req.on("error", fail);

    req.write(json);
    req.end();
  });
}

const KNOWN_IOS_BUNDLE_IDS = ["com.keymouseit.agencyops", "com.keymouus"] as const;

function topicCandidates(preferred?: string) {
  const config = getApnsConfig();
  const topics: string[] = [];
  for (const id of [preferred, config.bundleId, ...KNOWN_IOS_BUNDLE_IDS]) {
    if (id && !topics.includes(id)) topics.push(id);
  }
  return topics;
}

export async function sendApnsPush(
  deviceToken: string,
  payload: { title: string; body: string; data?: Record<string, any> },
  options?: { bundleId?: string }
): Promise<{ ok: boolean; reason?: string; production?: boolean }> {
  if (!isApnsConfigured()) {
    console.warn("⚠️ [push][apns] Not configured — set APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY on server or place AuthKey in workspace");
    return { ok: false, reason: "not_configured" };
  }

  const config = getApnsConfig();
  const body = buildApnsBody(payload);
  const envOrder: boolean[] = config.production ? [true, false] : [false, true];
  const topics = topicCandidates(options?.bundleId);

  for (const bundleId of topics) {
    for (let i = 0; i < envOrder.length; i++) {
      const production = envOrder[i];
      try {
        const result = await sendApnsHttp2(production, deviceToken, body, bundleId);
        if (result.ok) return { ok: true, production: result.production };

        if (i === 0 && result.reason && RETRY_OTHER_ENV_REASONS.has(result.reason)) {
          continue;
        }
      } catch (err: any) {
        console.warn(`[push][apns] connection error on ${production ? "prod" : "sandbox"}:`, err?.message || err);
      }
      break;
    }
  }

  return { ok: false, reason: "delivery_failed" };
}
