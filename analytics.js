const token = document
  .querySelector('meta[name="cloudflare-web-analytics-token"]')
  ?.content.trim();

if (token) {
  const script = document.createElement("script");
  script.type = "module";
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token });
  script.async = true;
  document.head.append(script);
}
