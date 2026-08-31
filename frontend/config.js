const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

window.APP_CONFIG = {
  apiBaseUrl: isLocal
    ? "http://localhost:3000"
    : "https://replacelater-domain.com"
};