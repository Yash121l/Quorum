import posthog from "posthog-js";

const APP_SLUG = "quorum";
const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

// Only send events from production builds served from a real host. Set
// VITE_POSTHOG_DEV=1 to opt in from a dev/preview server on localhost.
const devOptIn = Boolean(import.meta.env.VITE_POSTHOG_DEV);
export const analyticsEnabled = Boolean(key) && (devOptIn || (import.meta.env.PROD && !isLocalhost));

export function initAnalytics() {
  if (!analyticsEnabled || !key) return;
  posthog.init(key, {
    // Reverse-proxied through /ingest (Pages Function / worker route) so ad blockers don't drop events.
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    enable_heatmaps: true,
    capture_dead_clicks: true,
    capture_exceptions: true,
    capture_performance: { web_vitals: true },
    session_recording: { maskAllInputs: true },
  });
  posthog.register({ app: APP_SLUG });
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!analyticsEnabled) return;
  posthog.capture(event, properties);
}
