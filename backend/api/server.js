import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import cors from "cors";
import { saveEvent } from "./database.js";
import { cookie_ops, is_max_collection } from "./cookies.js";

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

function getPagePath(pageUrl) {
    try {
        return new URL(pageUrl).pathname;
    } catch {
        return null;
    }
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

const app = express();

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

app.post("/api/events", (req, res) => {
    let vid = req.cookies.visitor_id;

    if (!vid) {
        vid = crypto.randomUUID();

        res.cookie("visitor_id", vid, cookie_ops);
    }


    const { event, pageUrl, location } = req.body;

    if (typeof event !== "string" || event.length === 0 || !allowedEvents.has(event)) {
        return res.status(400).json({
            error: "event failure"
        });
    }

    if (pageUrl !== undefined && typeof pageUrl !== "string") {
        return res.status(400).json({
            error: "pageUrl failure"
        });
    }

    const userAgent = req.get("user-agent") ?? "";
    const referrerUrl = req.get("referer") ?? null;

    const eventData = {
        vid,
        event,
        timestamp: new Date().toISOString(),
        pagePath: getPagePath(pageUrl),
        referrerOrigin: getReferrerOrigin(referrerUrl),
        userAgentFamily: getUserAgentFamily(userAgent),
        languageRegion: getLanguageRegion(req),
        deviceCategory: getDeviceCategory(userAgent)
    };

    if (event === "location-shared") {
        eventData.location = normalizeLocation(location);
    }

    if (is_max_collection) {
        eventData.ipAddress = req.ip;
        eventData.referrerUrl = referrerUrl;
        eventData.fullPageUrl = pageUrl ?? null;
        eventData.userAgent = userAgent;
    }

    saveEvent(eventData);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
