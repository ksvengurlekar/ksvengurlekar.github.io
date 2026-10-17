const MAX_MESSAGE_LENGTH = 2000;

function previewText(value, fallback, maxLength) {
    if (typeof value !== "string" || value.trim() === "") return fallback;

    // Keep browser-supplied values on one line and inside the preview's code block.
    const text = value.replace(/`/g, "'").replace(/\s/g, " ").trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function timestampMillis(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    return typeof value === "string" ? Date.parse(value) : NaN;
}

function discordTime(value) {
    const ms = timestampMillis(value);
    return Number.isFinite(ms) ? `<t:${Math.floor(ms / 1000)}:F>` : "unknown";
}

function duration(ms) {
    if (!Number.isFinite(ms)) return "unknown";
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours}h ${minutes}m ${seconds % 60}s`
        : minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

export function formatSessionSummary(session) {
    const counts = new Map();

    for (const event of session.events) {
        counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    }

    const summary = [
        `Portfolio session: ${session.events.length} events`,
        `Started: ${discordTime(session.startedAt)}`,
        `Last event: ${discordTime(session.lastEventAt)}`,
        `Observed span: ${duration(timestampMillis(session.lastEventAt) - timestampMillis(session.startedAt))}`,
        ...Array.from(counts, ([type, count]) => `${type}: ${count}`)
    ].join("\n");

    const first = session.events.find((event) => event.type === "page-view") ?? session.events[0];
    const context = [];
    if (first) {
        context.push(`Device: ${previewText(first.deviceCategory, "unknown", 20)} / ${previewText(first.operatingSystemFamily, "unknown", 20)} / ${previewText(first.userAgentFamily, "unknown", 20)}`);
        if (first.language) context.push(`Language: ${previewText(first.language, "unknown", 40)}`);
        if (first.estimatedLocation) {
            const location = [first.estimatedLocation.city, first.estimatedLocation.region, first.estimatedLocation.country]
                .filter((value) => typeof value === "string" && value);
            if (location.length) context.push(`Location (IP estimate): ${previewText(location.join(", "), "unknown", 120)}`);
        }
        if (first.network?.asOrganization) {
            context.push(`Network: ${previewText(first.network.asOrganization, "unknown", 120)}`);
        }
        if (first.entryReferrerOrigin) {
            context.push(`Entry referrer: ${previewText(first.entryReferrerOrigin, "unknown", 120)}`);
        }
    }

    const preview = [];
    const messageWith = (events) => [
        summary,
        "",
        `Event preview (${events.length}/${session.events.length} shown):`,
        ...(events.length ? ["```text", ...context,
            "Timeline: elapsed since start (receipt time when available)",
            events.join("\n"), "```"] : []),
        "Full stored session data is attached as portfolio-session.json."
    ].join("\n");

    for (const [index, event] of session.events.entries()) {
        const received = timestampMillis(event.receivedAt);
        const eventTime = Number.isFinite(received) ? received : timestampMillis(event.timestamp);
        const elapsed = duration(eventTime - timestampMillis(session.startedAt));
        const detail = [
            `${index + 1}. ${elapsed === "unknown" ? "time unknown" : `+${elapsed}`} ${previewText(event.type, "unknown", 40)}`,
            `   Page: ${previewText(event.pagePath, "unknown", 120)}`,
            ...(event.targetPage ? [`   To page: ${previewText(event.targetPage, "unknown", 80)}`] : []),
            ...(event.projectName ? [`   Project: ${previewText(event.projectName, "unknown", 80)}`] : []),
            ...(event.linkText || event.linkTitle ? [`   Link: ${previewText(event.linkText || event.linkTitle, "unknown", 80)}`] : []),
            ...(event.destination ? [`   Destination: ${previewText(event.destination, "unknown", 120)}`] : [])
        ].join("\n");
        const candidate = [...preview, detail];

        // Reserve space for the closing fence and attachment note before adding a row.
        if (messageWith(candidate).length > MAX_MESSAGE_LENGTH) break;
        preview.push(detail);
    }

    return messageWith(preview);
}

export async function sendDiscord(env, session) {
    if (!env.DISCORD_WEBHOOK_URL) {
        throw new Error("Missing DISCORD_WEBHOOK_URL");
    }

    if (!session || !Array.isArray(session.events)) {
        throw new TypeError("Discord notification needs a session with events");
    }

    const message = formatSessionSummary(session);
    if (typeof message !== "string" || message.trim() === "") {
        throw new TypeError("Discord message must be a non-empty string");
    }

    const form = new FormData();
    form.append("payload_json", JSON.stringify({
        content: message,
        allowed_mentions: { parse: [] }
    }));
    form.append(
        "files[0]",
        new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }),
        "portfolio-session.json"
    );

    const response = await fetch(`${env.DISCORD_WEBHOOK_URL}?wait=true`, {
        method: "POST",
        body: form
    });

    if (!response.ok) {
        throw new Error(`Discord notification failed: ${response.status}`);
    }
}
