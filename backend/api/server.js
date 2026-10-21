import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import cors from "cors";
import { saveEvent } from "./database.js";
import { cookie_ops, is_max_collection } from "./cookies.js";
import { formatDiscord, sendDiscord } from "./notification.js";

const PORT = process.env.PORT || 3000;
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://ksvengurlekar.github.io"
];

const allowedEvents = new Set([
    "page-view",
    "resume-click",
    "project-click",
    "location-shared",
    "page-navigation",
    "project-link-click",
    "social-link-click"
]);

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
    const language = request.get("accept-language");
    return language?.match(/^[a-z]{2}(?:-([A-Z]{2}))?/i)?.[1] ?? null;
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

function getReferrerOrigin(referrerUrl) {
    try {
        return referrerUrl ? new URL(referrerUrl).origin : null;
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

async function saveSession(sesh) {
    saveEvent(sesh);
}

const app = express();

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

app.post("/api/test-discord", async (req, res) => {
    const { message } = req.body;

    try {
        await sendDiscord(message);
        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(502).json({
            error: "Discord notification failed"
        });
    }
});

app.post("/api/events", async (req, res) => {
    const now = new Date().toISOString();
    let vid = req.cookies.visitor_id;

    if (!vid) {
        vid = crypto.randomUUID();

        res.cookie("visitor_id", vid, cookie_ops);
    }


    const { sessionId, event } = req.body ?? {};

    if (
        !event ||
        typeof event !== "object" ||
        typeof event.type !== "string" ||
        event.type.length === 0 ||
        !allowedEvents.has(event.type)
    ) {
        return res.status(400).json({
            error: "event failure"
        });
    }

    const pagePath = normalizePagePath(event.pagePath);

    if (!pagePath) {
        return res.status(400).json({
            error: "pagePath failure"
        });
    }

    if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
        return res.status(400).json({
            error: "invalid session"
        });
    }

    const userAgent = req.get("user-agent") ?? "";
    const referrerUrl = req.get("referer") ?? null;

    const eventData = {
        vid,
        eventId: event.eventId ?? crypto.randomUUID(),
        type: event.type,
        timestamp: event.occurredAt ?? now,
        pagePath,
        referrerOrigin: getReferrerOrigin(referrerUrl),
        userAgentFamily: getUserAgentFamily(userAgent),
        languageRegion: getLanguageRegion(req),
        deviceCategory: getDeviceCategory(userAgent)
    };

    if (event.type === "location-shared") {
        eventData.location = normalizeLocation(event.location);
    }

    if (is_max_collection) {
        eventData.ipAddress = req.ip;
        eventData.referrerUrl = referrerUrl;
        eventData.userAgent = userAgent;
    }

    await saveSession({
        sessionId,
        event: eventData
    });

    sendDiscord(formatDiscord(eventData)).catch(console.error);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
