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

function trackEvent(eventName, extraData = {}) {
    const eventData = {
        event: eventName,
        pageUrl: window.location.href,
        ...extraData
    };

    return fetch(`${window.APP_CONFIG.apiBaseUrl}/api/events`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(eventData)
    })
    .then((response) => response.json())
    .then((data) => {
      console.log("Tracked:", data);
    })
    .catch((error) => {
      console.error("Tracking failed:", error);
    });
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        });
    });
}

// This is enabled automatically for the local demo only. In production, call
// it from an explicit user action after adding your permission/consent UI.
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

const isLocalDemo = ["localhost", "127.0.0.1"].includes(window.location.hostname);

if (isLocalDemo) {
    trackCurrentLocation();
}

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

trackEvent("page-view");

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

resumeLink.addEventListener("click", () => {
    trackEvent("resume-click");
})
