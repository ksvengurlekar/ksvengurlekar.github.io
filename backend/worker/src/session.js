import { DurableObject } from "cloudflare:workers";

const MAX_EVENTS = 100;
const IDLE_TIMEOUT_MS = 20_000;
const SESSION = "session";

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

        const session = await this.ctx.storage.get(SESSION) ?? {
            events: [],
            droppedEvents: 0,
            startedAt: Date.now()
        }

        if (session.events.length < MAX_EVENTS) {
            session.events.push(event);
        } else {
            droppedEvents += 1;
        }

        session.lastEventAt = Date.now();
        await this.ctx.storage.put(SESSION, session);

        this.ctx.storage.setAlarm(Date.now() + IDLE_TIMEOUT_MS)

        return Response.json({
            ok: true,
            storedEvents: session.events.length
        })
    }

    async alarm() {
        const session = await this.ctx.storage.get(SESSION);
        if (!session) return;

        console.error.log(`Session became idle with ${session.events.length}`);
        await this.ctx.storage.delete(SESSION_KEY);
    }
}