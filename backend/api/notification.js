const DISC = process.env.DISCORD_WEBHOOK_URL;

export function formatDiscord(eventData) {
    if (!eventData || typeof eventData.type !== "string") {
        throw new TypeError("Discord event must have a type");
    }

    return [
        `New Portfolio event: ${eventData.type}`,
        "",
        "```json",
        JSON.stringify(eventData, null, 2),
        "```"
    ].join("\n");
}

export async function sendDiscord(message) {
    if (!DISC) {
        throw new Error("Missing discord url");
    }

    if (typeof message !== "string" || message.trim() === "") {
        throw new TypeError("Discord message must be a non-empty string");
    }

    const response = await fetch(`${DISC}?wait=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: message.trim().slice(0, 2000),
            allowed_mentions: {
                parse: []
            }
        })
    });

    if (!response.ok) {
        console.error(
            "Discord webhook failed:",
            response.status,
            await response.text()
        );
        throw new Error("Discord notification failed");
    }

    return response;
}
