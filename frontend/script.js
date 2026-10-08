const navLinks = document.querySelectorAll('.sidebar-nav a[data-page]');
const sections = document.querySelectorAll('.page-section');

function showPage(pageId) {
    sections.forEach((section) => {
    section.classList.toggle('active', section.id === pageId);
    });

    navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.page === pageId);
    });
}

async function trackEvent(eventName, extraData = {}) {
    const event = {
        eventId: crypto.randomUUID(),
        type: eventName,
        pagePath: getPagePath(),
        occurredAt: new Date().toISOString(),
        ...extraData
    }; 

    try {
        const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/events`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({sessionId, event})
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Tracking failed: ${response.status} ${JSON.stringify(data)}`);
        }

        console.log("Tracked:", data);
    } catch (error) {
        console.error("Tracking failed:", error);
    }
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        });
    });
}

function getSessionId() {
    let sessionId = sessionStorage.getItem("session_id");
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("session_id", sessionId);
    }

    return sessionId;
}

function getPagePath() {
    const rawPath =
        window.location.hash.slice(1) || window.location.pathname || "/";

    const pathWithoutQuery = rawPath.split(/[?#]/, 1)[0];

    const normalized = pathWithoutQuery.startsWith("/") ? pathWithoutQuery
        : `/${pathWithoutQuery}`;

    return normalized.replace(/\/+/g, "/").slice(0, 200);
}

async function trackCurrentLocation() {
    try {
        const position = await getCurrentPosition();
        const { latitude, longitude, accuracy } = position.coords;

        await trackEvent("location-shared", {
            location: { latitude, longitude, accuracy }
        });
    } catch (error) {
        console.warn("Location was not shared:", error.message);
    }
}

const sessionId = getSessionId();

navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
    event.preventDefault();
        const page = link.dataset.page;
        showPage(page);
        history.pushState({ page }, '', `#${page}`);

        trackEvent("page-navigation", {
            targetPage: page
        });
    });
});

window.addEventListener('popstate', () => {
    showPage(window.location.hash.slice(1) || 'home');
});

showPage(window.location.hash.slice(1) || 'home');

// site analytics
const pageViewKey = `page-view-sent:${sessionId}`;

if (!sessionStorage.getItem(pageViewKey)) {
    sessionStorage.setItem(pageViewKey, "1");
    trackCurrentLocation()
    trackEvent("page-view");
}

document.querySelectorAll(".project-links a").forEach((link) => {
    link.addEventListener("click", () => {
        trackEvent("project-link-click", {
            linkText: link.textContent.trim(),
            destination: link.href
        });
    });
});

document.querySelectorAll(".social-links a").forEach((link) => {
    link.addEventListener("click", () => {
        trackEvent("social-link-click", {
            linkTitle: link.title || link.getAttribute("aria-label"),
            destination: link.href
        });
    });
});

document.querySelector("#resume-link")?.addEventListener("click", () => {
    trackEvent("resume-click");
});
