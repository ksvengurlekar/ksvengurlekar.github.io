const NODE_ENV = process.env.NODE_ENV ?? "development";
const COOKIE_MODE = process.env.COOKIE_MODE === "maximal"
    ? "maximal"
    : "minimal";

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
    approximateRegion: true,
    eventType: true,
    deviceCategory: true
};

export const max_cookie = {
    ...min_cookie,
    fullIpAddress: true,
    fullReferrerUrl: true,
    queryStringsAndFragments: true,
    formContentsAndContactData: true,
    preciseLocation: true,
    fingerprintingData: true,
    sensitivePageData: true
};

export const collection_mode = COOKIE_MODE;
export const is_max_collection = COOKIE_MODE === "maximal";

export const active_collection =
    is_max_collection ? max_cookie : min_cookie;
