export function formatSessionSummary(session) {
    const counts = {};

    for (const event of session.events) {
        counts[event.type] = (counts[event.type] ?? 0) + 1;
    }

    return [
        `Portfolio session: ${session.events.length} events`,
        `Started: ${new Date(session.startedAt).toISOString()}`,
        `Last event: ${new Date(session.lastEventAt).toISOString()}`,
        ...Object.entries(counts).map(([type, count]) => `${type}: ${count}`)
    ].join("\n");
}

export async function sendDiscord(env, message) {
    if (!env.DISCORD_WEBHOOK_URL) {
        throw new Error("Missing DISCORD_WEBHOOK_URL");
    }
    if (typeof message !== "string" || message.trim() === "") {
        throw new TypeError("Discord message must be a non-empty string");
    }

    const response = await fetch(`${env.DISCORD_WEBHOOK_URL}?wait=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: message.trim().slice(0, 2000),
            allowed_mentions: { parse: [] }
        })
    });

    if (!response.ok) {
        throw new Error(`Discord notification failed: ${response.status}`);
    }
}
