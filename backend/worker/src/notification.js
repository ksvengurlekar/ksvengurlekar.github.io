export function formatSessionSummary(session) {
    const counts = {};

    for (const event of session.events) {
        counts[event.type] = (counts[event.type] ?? 0) + 1;
    }

    return [
        `Portfolio session: ${session.events.length} events`,
        `Started: ${new Date(session.startedAt).toISOString()}`,
        `Last event: ${new Date(session.lastEventAt).toISOString()}`,
        ...Object.entries(counts).map(([type, count]) => `${type}: ${count}`),
        "Full stored session data is attached as portfolio-session.json."
    ].join("\n");
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
        content: message.trim().slice(0, 2000),
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
