import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import cors from "cors";
import { saveEvent } from "./database.js";
import { cookie_ops, is_max_collection } from "./cookies.js";

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

function getApproximateRegion(request) {
    const country = request.get("x-vercel-ip-country");
    if (country) return country;

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

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.post("/api/events", (req, res) => {
    let vid = req.cookies.visitor_id;

    if (!vid) {
        vid = crypto.randomUUID();

        res.cookie("visitor_id", vid, cookie_ops);
    }


    const { event, pageUrl } = req.body;
    const userAgent = req.get("user-agent") ?? "";
    const referrerUrl = req.get("referer") ?? null;

    const eventData = {
        vid,
        event,
        timestamp: new Date().toISOString(),
        pagePath: getPagePath(pageUrl),
        referrerOrigin: getReferrerOrigin(referrerUrl),
        userAgentFamily: getUserAgentFamily(userAgent),
        approximateRegion: getApproximateRegion(req),
        eventType: event,
        deviceCategory: getDeviceCategory(userAgent)
    };

    if (is_max_collection) {
        eventData.ipAddress = req.ip;
        eventData.referrerUrl = referrerUrl;
        eventData.queryStringsAndFragments = pageUrl ?? null;
        eventData.userAgent = userAgent;
    }

    saveEvent(eventData);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});