import {
    isMaxCollection,
    max_cookie, min_cookie,
    serializeVisitorCookie
} from "./cookies.js";
export { SessionBucket } from "./session.js";

const MAX_JSON = 10 * 1024;

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const allowedOrigins = new Set([
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://ksvengurlekar.github.io"
]);

const allowedEvents = new Set([
    "page-view",
    "resume-click",
    "project-click",
    "location-shared",
    "page-navigation",
    "project-link-click",
    "social-link-click"
]);

function corsHeaders(request) {
    const origin = request.headers.get("Origin");
    const headers = {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (allowedOrigins.has(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
        headers.Vary = "Origin";
    }

    return headers;
}

function jsonResponse(request, body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders(request),
            "Content-Type": "application/json",
            ...extraHeaders
        }
    });
}

function getCookies(request) {
    const cookieHeader = request.headers.get("Cookie") ?? "";
    const cookies = {};

    for (const part of cookieHeader.split(";")) {
        const separator = part.indexOf("=");
        if (separator === -1) continue;

        const name = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();

        try {
            cookies[name] = decodeURIComponent(value);
        } catch {
            cookies[name] = value;
        }
    }

    return cookies;
}

async function parseJson(request) {
    if (!request.body) return { error: "invalid" };

    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";

    try {
        for await (const chunk of request.body) {
            bytes += chunk.byteLength;
            if (bytes > MAX_JSON) return { error: "too_large"} ;

            text += decoder.decode(chunk, { stream : true });
        }

        text += decoder.decode();
        return { body: JSON.parse(text) };
    } catch {
        return { error: "invalid" };
    }
}

function getUserAgentFamily(userAgent = "") {
    if (/edg/i.test(userAgent)) return "Edge";
    if (/chrome|crios/i.test(userAgent)) return "Chrome";
    if (/firefox|fxios/i.test(userAgent)) return "Firefox";
    if (/safari/i.test(userAgent)) return "Safari";
    return "Other";
}

function getDeviceCategory(userAgent = "") {
    if (/tablet|ipad/i.test(userAgent)) return "tablet";
    if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
    return "desktop";
}

function getLanguageRegion(request) {
    const language = request.headers.get("accept-language") ?? "";
    return language.match(/^[a-z]{2}(?:-([A-Z]{2}))?/i)?.[1] ?? null;
}

function getReferrerOrigin(referrerUrl) {
    try {
        return referrerUrl ? new URL(referrerUrl).origin : null;
    } catch {
        return null;
    }
}

function normalizePagePath(pagePath) {
    if (typeof pagePath !== "string") {
        return null;
    }

    const pathWithoutQuery = pagePath.split(/[?#]/, 1)[0];
    const normalized = pathWithoutQuery.startsWith("/")
        ? pathWithoutQuery
        : `/${pathWithoutQuery}`;

    return normalized.replace(/\/+/g, "/").slice(0, 200);
}

function normalizePageUrl(pageUrl) {
    if (typeof pageUrl !== "string") {
        return null;
    }

    try {
        const parsed = new URL(pageUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            return null;
        }

        return parsed.href.slice(0, 2000);
    } catch {
        return null;
    }
}

function normalizeLocation(location) {
    const source = location && typeof location === "object" ? location : {};
    const { latitude, longitude, accuracy } = source;

    return {
        latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
        longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null,
        accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null
    };
}

async function saveSession(env, { sessionId, event }) {
    const bucket = env.SESSION_BUCKETS.getByName(sessionId);

    return bucket.fetch("https://session-bucket/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event)
    });
}

async function handleEvent(request, env) {
    const parsed = await parseJson(request);

    if (parsed.error === "too_large")
        return jsonResponse(request, { error: "request body too large" }, 413);
    if (parsed.error)
        return jsonResponse(request, { error: "invalid json" }, 400);


    const { sessionId, event } = parsed.body ?? {};

    if (
        !event ||
        typeof event !== "object" ||
        typeof event.type !== "string" ||
        event.type.length === 0 ||
        !allowedEvents.has(event.type)
    ) {
        return jsonResponse(request, { error: "event failure" }, 400);
    }

    const pagePath = normalizePagePath(event.pagePath);
    if (!pagePath) {
        return jsonResponse(request, { error: "pagePath failure" }, 400);
    }

    if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
        return jsonResponse(request, { error: "invalid session" }, 400);
    }

    const now = new Date().toISOString();
    const cookies = getCookies(request);
    const visitorId = cookies.visitor_id ?? crypto.randomUUID();
    const userAgent = request.headers.get("user-agent") ?? "";
    const referrerUrl = request.headers.get("referer") ?? null;

    const eventData = {
        vid: visitorId,
        eventId: event.eventId ?? crypto.randomUUID(),
        type: event.type,
        timestamp: event.occurredAt ?? now,
        pagePath,
        referrerOrigin: getReferrerOrigin(referrerUrl),
        userAgentFamily: getUserAgentFamily(userAgent),
        languageRegion: getLanguageRegion(request),
        deviceCategory: getDeviceCategory(userAgent)
    };

    const collectionPolicy = isMaxCollection(env) ? max_cookie : min_cookie;

    if (event.type === "location-shared" && collectionPolicy.sharedLocation) {
        eventData.location = normalizeLocation(event.location);
    }

    if (collectionPolicy.fullIpAddress) {
        eventData.ipAddress = request.headers.get("CF-Connecting-IP") ?? null;
    }

    if (collectionPolicy.fullReferrerUrl) {
        eventData.referrerUrl = referrerUrl;
    }

    if (collectionPolicy.fullUserAgent) {
        eventData.userAgent = userAgent;
    }

    if (collectionPolicy.fullPageUrl) {
        const pageUrl = normalizePageUrl(event.pageUrl);
        if (pageUrl) {
            eventData.pageUrl = pageUrl;
        }
    }

    const bucketResponse = await saveSession(env, { sessionId, event: eventData });

    if (!bucketResponse.ok) {
        const limited = bucketResponse.status === 429;
        return jsonResponse(
            request,
            { error: limited ? "Session event limit reached" : "Could not save event" },
            limited ? 429 : 502
        );
    }

    const bucketResult = await bucketResponse.json();

    const headers = {};
    if (!cookies.visitor_id) {
        headers["Set-Cookie"] = serializeVisitorCookie(visitorId, env);
    }

    return jsonResponse(request, { 
        success: true,
        storedEvents: bucketResult.storedEvents
    }, 200, headers);
}

export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(request)
            });
        }

        const url = new URL(request.url);

        if (url.pathname === "/api/health" && request.method === "GET") {
            return jsonResponse(request, {
                ok: true,
                service: "portfolio-api"
            });
        }

        if (url.pathname === "/api/events" && request.method === "POST") {
            const ip = request.headers.get("CF-Connecting-IP") ?? "local";
            const { success } = await env.EVENT_RATE_LIMITER.limit({
                key: `events:${ip}`
            })

            if (!success) {
                return jsonResponse(request, { error: "Too many events" }, 429);
            }

            return handleEvent(request, env);
        }

        return new Response("Not found", {
            status: 404,
            headers: corsHeaders(request)
        });
    }
};
