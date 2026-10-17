import assert from "node:assert/strict";
import test from "node:test";
import { formatSessionSummary, sendDiscord } from "../src/notification.js";

function makeSession(events) {
    return {
        startedAt: Date.parse("2026-10-17T01:00:00.000Z"),
        lastEventAt: Date.parse("2026-10-17T01:01:00.000Z"),
        events
    };
}

const events = [
    { type: "page-view", timestamp: "2026-10-17T01:00:00.000Z", pagePath: "/home" },
    { type: "resume-click", timestamp: "2026-10-17T01:01:00.000Z", pagePath: "/about" }
];

test("small sessions show event details inline alongside totals", () => {
    const message = formatSessionSummary(makeSession(events));

    assert.match(message, /Portfolio session: 2 events/);
    assert.match(message, /page-view: 1\nresume-click: 1/);
    assert.match(message, /Event preview \(2\/2 shown\):/);
    assert.match(message, /Started: <t:1792198800:F>/);
    assert.match(message, /Last event: <t:1792198860:F>/);
    assert.match(message, /Observed span: 1m 0s/);
    assert.match(message, /1\. \+0s page-view\n   Page: \/home/);
    assert.match(message, /2\. \+1m 0s resume-click\n   Page: \/about/);
    assert.ok(message.endsWith("Full stored session data is attached as portfolio-session.json."));
});

test("large sessions fit Discord's content limit without cutting formatting or the attachment note", () => {
    const session = makeSession(Array.from({ length: 100 }, (_, index) => ({
        ...events[0],
        pagePath: `/${index}/${"x".repeat(200)}`
    })));
    const original = structuredClone(session);
    const message = formatSessionSummary(session);
    const shown = Number(message.match(/Event preview \((\d+)\/100 shown\):/)[1]);

    assert.ok(message.length <= 2000);
    assert.ok(shown > 0 && shown < 100);
    assert.match(message, /page-view: 100/);
    assert.equal((message.match(/```/g) ?? []).length, 2);
    assert.ok(message.endsWith("Full stored session data is attached as portfolio-session.json."));
    assert.deepEqual(session, original);
});

test("browser values cannot close the code block or create extra preview lines", () => {
    const message = formatSessionSummary(makeSession([{
        type: "page-view",
        timestamp: { invalid: true },
        pagePath: "/home\n```\n@everyone"
    }]));

    assert.match(message, /time unknown page-view/);
    assert.match(message, /Page: \/home ''' @everyone/);
    assert.equal((message.match(/```/g) ?? []).length, 2);
});

test("timeline uses server receipt time when the browser clock is wrong", () => {
    const message = formatSessionSummary(makeSession([{
        ...events[1], timestamp: "2036-10-17T01:00:00.000Z", receivedAt: "2026-10-17T01:00:12.000Z"
    }]));
    assert.match(message, /\+12s resume-click/);
    assert.ok(!message.includes("2036"));
});

test("preview includes device, estimated location, network, and click details", () => {
    const message = formatSessionSummary(makeSession([{
        ...events[0], deviceCategory: "mobile", operatingSystemFamily: "iOS", userAgentFamily: "Safari",
        language: "en-US", estimatedLocation: { city: "Austin", region: "Texas", country: "US" },
        network: { asOrganization: "Example ISP" }, entryReferrerOrigin: "https://example.org"
    }, {
        ...events[1], projectName: "Portfolio", linkText: "Code", destination: "https://github.com/example/portfolio"
    }]));
    assert.match(message, /Device: mobile \/ iOS \/ Safari/);
    assert.match(message, /Location \(IP estimate\): Austin, Texas, US/);
    assert.match(message, /Network: Example ISP/);
    assert.match(message, /Entry referrer: https:\/\/example.org/);
    assert.match(message, /Project: Portfolio\n   Link: Code\n   Destination: https:\/\/github.com\/example\/portfolio/);
});

test("enriched sessions remain within the message budget", () => {
    const session = makeSession(Array.from({ length: 100 }, () => ({
        ...events[0], type: "project-link-click", deviceCategory: "mobile", operatingSystemFamily: "iOS",
        userAgentFamily: "Safari", language: "en-US", estimatedLocation: { city: "x".repeat(200) },
        network: { asOrganization: "x".repeat(200) }, entryReferrerOrigin: "x".repeat(200),
        projectName: "x".repeat(200), linkText: "x".repeat(200), destination: "x".repeat(2000)
    })));
    const message = formatSessionSummary(session);
    assert.ok(message.length <= 2000);
    assert.match(message, /Event preview \([1-9]\d*\/100 shown\):/);
    assert.equal((message.match(/```/g) ?? []).length, 2);
});

test("empty sessions do not leave an unclosed code block", () => {
    const message = formatSessionSummary(makeSession([]));

    assert.match(message, /Event preview \(0\/0 shown\):/);
    assert.ok(!message.includes("```"));
});

test("webhook payload includes the preview and an unchanged full JSON attachment", async (t) => {
    const session = makeSession(events);
    const webhook = "https://discord.invalid/api/webhooks/test";
    t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, `${webhook}?wait=true`);
        assert.equal(options.method, "POST");
        const payload = JSON.parse(options.body.get("payload_json"));
        assert.equal(payload.content, formatSessionSummary(session));
        assert.deepEqual(payload.allowed_mentions, { parse: [] });

        const attachment = options.body.get("files[0]");
        assert.equal(attachment.name, "portfolio-session.json");
        assert.equal(attachment.type, "application/json");
        assert.deepEqual(JSON.parse(await attachment.text()), session);
        return new Response(null, { status: 204 });
    });

    await sendDiscord({ DISCORD_WEBHOOK_URL: webhook }, session);
    assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test("webhook failures still propagate so the session alarm can retry", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));

    await assert.rejects(
        sendDiscord({ DISCORD_WEBHOOK_URL: "https://discord.invalid/test" }, makeSession(events)),
        /Discord notification failed: 429/
    );
});
