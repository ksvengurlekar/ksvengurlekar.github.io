function boundedText(value, maxLength = 120) {
    if (typeof value !== "string") return null;
    return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength) || null;
}

function normalizeDestination(value) {
    if (typeof value !== "string" || value.length > 2000) return null;

    try {
        const url = new URL(value);
        if (url.protocol === "mailto:") return `mailto:${url.pathname}`;
        if (!["http:", "https:"].includes(url.protocol)) return null;

        // Exclude credentials, query strings, and fragments from click destinations.
        return `${url.origin}${url.pathname}`;
    } catch {
        return null;
    }
}

export function getEventDetails(event) {
    const details = {};

    if (event.type === "page-navigation") {
        const target = boundedText(event.targetPage, 80);
        if (target && /^[a-z0-9_-]+$/i.test(target)) details.targetPage = target;
    }

    if (["project-click", "project-link-click", "social-link-click"].includes(event.type)) {
        for (const field of ["linkText", "linkTitle", "projectName"]) {
            const text = boundedText(event[field]);
            if (text) details[field] = text;
        }
        const destination = normalizeDestination(event.destination);
        if (destination) details.destination = destination;
    }

    if (event.type === "page-view") {
        const referrer = normalizeDestination(event.entryReferrer);
        if (referrer && !referrer.startsWith("mailto:")) {
            details.entryReferrerOrigin = new URL(referrer).origin;
        }
    }

    return details;
}

export function getOperatingSystemFamily(userAgent = "") {
    if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
    if (/android/i.test(userAgent)) return "Android";
    if (/windows/i.test(userAgent)) return "Windows";
    if (/cros/i.test(userAgent)) return "ChromeOS";
    if (/macintosh|mac os x/i.test(userAgent)) return "macOS";
    if (/linux/i.test(userAgent)) return "Linux";
    return "Other";
}

export function getNetworkMetadata(cf = {}) {
    const network = {};
    for (const field of ["asOrganization", "colo", "httpProtocol", "tlsVersion"]) {
        const value = boundedText(cf[field]);
        if (value) network[field] = value;
    }
    if (Number.isSafeInteger(cf.asn) && cf.asn > 0) network.asn = cf.asn;

    const rtt = cf.clientTcpRtt ?? cf.clientQuicRtt;
    if (typeof rtt === "number" && Number.isFinite(rtt) && rtt >= 0) {
        network.clientRttMs = Math.round(rtt);
    }

    return network;
}
