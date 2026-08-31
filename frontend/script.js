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

function trackEvent(eventName) {
    const eventData = {
        event: eventName,
        pageUrl: window.location.href
    }

    fetch(`${window.APP_CONFIG.apiBaseUrl}/api/events`, {
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
    });;
}

navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
    event.preventDefault();
    const page = link.dataset.page;
    showPage(page);
    history.pushState({ page }, '', `#${page}`);
    });
});

window.addEventListener('popstate', () => {
    showPage(window.location.hash.slice(1) || 'home');
});

showPage(window.location.hash.slice(1) || 'home');

// site analytics

trackEvent("page-view");

resumeLink.addEventListener("click", () => {
    trackEvent("resume-click");
})
