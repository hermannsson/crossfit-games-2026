"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Mode } from "./shared";

// Keeps a live page fresh without a manual reload. The routes revalidate their
// server data via ISR (revalidate = 60); this pings router.refresh() on an
// interval so a spectator's browser actually pulls that fresh render in — and
// because it's a soft refresh, the leaderboard's client state (division, event
// filter, search) is preserved rather than reset. Polling pauses while the tab
// is hidden and fires once on return, so background tabs don't hammer the route.
const POLL_MS = 30_000;

export default function LiveRefresh({
  mode,
  generatedAt,
}: {
  mode: Mode;
  generatedAt: string;
}) {
  const router = useRouter();
  // Poll while the competition is in motion — during seeding too, so the board
  // flips to live on its own the moment the first scores post. A finalized
  // board never changes, so leave it be.
  const active = mode === "live" || mode === "seeding";
  const [ago, setAgo] = useState<string>("");
  const [tip, setTip] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!active) return;

    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, router]);

  // Tick the "updated Ns ago" label (and locale-formatted tooltip) off the
  // snapshot's build time. Both run only after mount, never during SSR, so the
  // locale-dependent time can't cause a server/client hydration mismatch.
  useEffect(() => {
    if (mode !== "live") return;
    const built = new Date(generatedAt).getTime();
    if (!Number.isFinite(built)) return;
    setTip(`Data as of ${new Date(built).toLocaleTimeString()}`);
    const tick = () => setAgo(relTime(Date.now() - built));
    tick();
    const id = setInterval(tick, 5_000);
    return () => clearInterval(id);
  }, [mode, generatedAt]);

  if (mode !== "live") return null;

  return (
    <span className="livepill" title={tip}>
      <span className="d" />
      Live
      {ago ? <span className="ago">· {ago}</span> : null}
    </span>
  );
}

function relTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
