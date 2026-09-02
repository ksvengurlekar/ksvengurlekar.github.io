const NODE_ENV = process.env.NODE_ENV ?? "development";
const COOKIE_MODE = process.env.COOKIE_MODE === "maximal" ? "maximal" : "minimal";

export const YTTL = 3;

export const cookie_ops = {
    maxAge: 1000 * 60 * 60 * 24 * 365 * YTTL,
    httpOnly: true,
    sameSite: "lax",
    secure: NODE_ENV === "production"
};

export const min_cookie = {
    visitorId: "random UUID",
    timestamp: true,
    pagePath: true,
    referrerOrigin: true,
    userAgentFamily: true,
    languageRegion: true,
    eventType: true,
    deviceCategory: true
};

export const max_cookie = {
    ...min_cookie,
    fullIpAddress: true,
    fullReferrerUrl: true,
    fullPageUrl: true,
    fullUserAgent: true,
    sharedLocation: true
};

export const is_max_collection = COOKIE_MODE === "maximal";
