/**
 * PostHog reverse proxy: /ingest/* → us.i.posthog.com (static assets → us-assets.i.posthog.com).
 * Serving analytics from our own origin keeps ad blockers from dropping events.
 */

const API_HOST = "us.i.posthog.com";
const ASSET_HOST = "us-assets.i.posthog.com";

export async function proxyPostHog(request: Request, prefix = "/ingest"): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(prefix.length) || "/";
  const host = path.startsWith("/static/") ? ASSET_HOST : API_HOST;

  const upstream = new URL(`https://${host}${path}${url.search}`);
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.set("host", host);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
  });
}
