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

const visitorId = getOrCreateVisitorId();

trackEvent("page-view");

window.addEventListener("DOMContentLoaded", () => {
  fetch("/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      visitorId: getVisitorId(),
      event: "page-view",
      page: window.location.pathname
    })
  });
});

document
  .querySelector("#resume-link")
  .addEventListener("click", () => {
    trackEvent("resume-click");
  });