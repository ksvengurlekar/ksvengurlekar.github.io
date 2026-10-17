import assert from "node:assert/strict";
import test from "node:test";
import { getEventDetails, getNetworkMetadata, getOperatingSystemFamily } from "../src/analytics.js";

test("click details retain context while removing URL credentials and query/fragment data", () => {
    assert.deepEqual(getEventDetails({
        type: "project-link-click", linkText: " Code\nlink ", projectName: "Portfolio",
        destination: "https://user:password@example.org/project?token=secret#section", arbitrary: "ignored"
    }), {
        linkText: "Code link", projectName: "Portfolio", destination: "https://example.org/project"
    });
});

test("metadata fields are bounded, type checked, and limited to appropriate event types", () => {
    assert.deepEqual(getEventDetails({ type: "page-view", destination: "https://example.org", linkText: "ignored" }), {});
    assert.deepEqual(getEventDetails({ type: "page-navigation", targetPage: "projects" }), { targetPage: "projects" });
    assert.deepEqual(getEventDetails({ type: "page-navigation", targetPage: "projects?secret=yes" }), {});
    const details = getEventDetails({ type: "social-link-click", linkTitle: "x".repeat(500), linkText: {}, destination: [] });
    assert.deepEqual(details, { linkTitle: "x".repeat(120) });
});

test("destinations reject non-link schemes and malformed or oversized URLs", () => {
    for (const destination of ["javascript:alert(1)", "data:text/html,test", "not a URL", "https://example.org/" + "x".repeat(2000)]) {
        assert.deepEqual(getEventDetails({ type: "social-link-click", destination }), {});
    }
    assert.deepEqual(getEventDetails({ type: "social-link-click", destination: "mailto:hello@example.org?subject=secret#body" }), {
        destination: "mailto:hello@example.org"
    });
});

test("entry referrer stores only an HTTP(S) origin", () => {
    assert.deepEqual(getEventDetails({ type: "page-view", entryReferrer: "https://search.example/results?query=private" }), {
        entryReferrerOrigin: "https://search.example"
    });
    assert.deepEqual(getEventDetails({ type: "page-view", entryReferrer: "" }), {});
    assert.deepEqual(getEventDetails({ type: "page-view", entryReferrer: "mailto:hello@example.org" }), {});
});

test("Cloudflare metadata works with TCP, QUIC, and absent local properties", () => {
    assert.deepEqual(getNetworkMetadata(), {});
    assert.deepEqual(getNetworkMetadata({
        asn: 13335, asOrganization: "Cloudflare", colo: "SJC", httpProtocol: "HTTP/3", tlsVersion: "TLSv1.3", clientQuicRtt: 12.6,
        tlsClientRandom: "not collected", latitude: "not collected", longitude: "not collected"
    }), { asn: 13335, asOrganization: "Cloudflare", colo: "SJC", httpProtocol: "HTTP/3", tlsVersion: "TLSv1.3", clientRttMs: 13 });
    assert.deepEqual(getNetworkMetadata({ clientTcpRtt: 0, clientQuicRtt: 25 }), { clientRttMs: 0 });
    assert.deepEqual(getNetworkMetadata({ asn: "13335", clientTcpRtt: -1, colo: {} }), {});
});

test("operating system families distinguish mobile systems from their desktop UA tokens", () => {
    assert.equal(getOperatingSystemFamily("iPhone; CPU iPhone OS 18_0 like Mac OS X"), "iOS");
    assert.equal(getOperatingSystemFamily("Linux; Android 15"), "Android");
    assert.equal(getOperatingSystemFamily("Windows NT 10.0"), "Windows");
    assert.equal(getOperatingSystemFamily("CrOS x86_64"), "ChromeOS");
    assert.equal(getOperatingSystemFamily("Macintosh; Intel Mac OS X"), "macOS");
    assert.equal(getOperatingSystemFamily("Linux x86_64"), "Linux");
    assert.equal(getOperatingSystemFamily(), "Other");
});
