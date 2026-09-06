const baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");

if (!baseUrl) {
  console.error("SMOKE_BASE_URL is required, for example https://www.calqulus.site");
  process.exit(1);
}

const routes = ["/", "/legal", "/install", "/pricing", "/auth", "/health"];
const requiredHeaders = [
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "content-security-policy",
];

const fetchText = async (url) => {
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();
  return { response, body };
};

const failures = [];

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  const { response, body } = await fetchText(url);
  if (!response.ok) {
    failures.push(`${route} returned ${response.status}`);
    continue;
  }
  if (!body.includes('id="root"')) {
    failures.push(`${route} did not return the SPA shell`);
  }
}

const { response: rootResponse, body: rootHtml } = await fetchText(baseUrl);
for (const header of requiredHeaders) {
  if (!rootResponse.headers.get(header)) {
    failures.push(`Missing security header: ${header}`);
  }
}

const assetPaths = [
  ...rootHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
].map((match) => match[1]);

if (assetPaths.length === 0) {
  failures.push("No JS/CSS assets found in root HTML");
}

for (const assetPath of assetPaths.slice(0, 8)) {
  const assetUrl = assetPath.startsWith("http") ? assetPath : `${baseUrl}${assetPath}`;
  const response = await fetch(assetUrl, { redirect: "follow" });
  if (!response.ok) {
    failures.push(`Asset failed: ${assetPath} returned ${response.status}`);
  }
}

if (failures.length > 0) {
  console.error("Deploy smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Deploy smoke passed for ${baseUrl}`);
