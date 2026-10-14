/**
 * Cloudflare Pages Function: PostHog reverse proxy for the static frontend.
 * /ingest/* → us.i.posthog.com (static assets → us-assets.i.posthog.com),
 * so ad blockers don't drop analytics events.
 */

const API_HOST = "us.i.posthog.com";
const ASSET_HOST = "us-assets.i.posthog.com";

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/ingest/, "") || "/";
  const host = path.startsWith("/static/") ? ASSET_HOST : API_HOST;

  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.set("host", host);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(`https://${host}${path}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
  });
}
