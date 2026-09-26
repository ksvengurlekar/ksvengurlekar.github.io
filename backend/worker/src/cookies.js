export const YTTL = 3;

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

export function isMaxCollection(env) {
    return env.COOKIE_MODE === "maximal";
}

export function getCookieOptions(env) {
    return {
        maxAge: 1000 * 60 * 60 * 24 * 365 * YTTL,
        httpOnly: true,
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        secure: env.NODE_ENV === "production"
    };
}

export function serializeVisitorCookie(value, env) {
    const options = getCookieOptions(env);
    const attributes = [
        "Path=/",
        `Max-Age=${Math.floor(options.maxAge / 1000)}`,
        "HttpOnly",
        `SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`
    ];

    if (options.secure) {
        attributes.push("Secure");
    }

    return [`visitor_id=${encodeURIComponent(value)}`, ...attributes].join("; ");
}
