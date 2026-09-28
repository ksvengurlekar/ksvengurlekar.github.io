import { DurableObject } from "cloudflare:workers";

const MAX_EVENTS = 100;
const IDLE_TIMEOUT_MS = 20_000;

export class SessionBucket extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
    }

    async fetch(request) {
        if (request.method !== "POST") {
            return new Response("Method not allowed", {status:405});
        }

        let event;
        try {
            event = await request.json();
        } catch {
            return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const session = await this.ctx.storage.get("session") ?? {
            events: [],
            droppedEvents: 0,
            startedAt: Date.now()
        }

        if (sessions.events.length < MAX_EVENTS) {
            session.events.push(event);
        } else {
            droppedEvents += 1;
        }

        session.lastEventAt = Date.now();
        
    }
}