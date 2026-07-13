"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import type { SelfId } from "@/lib/access";

let initialized = false;

/**
 * Team-level analytics. Every viewer is grouped under their counterparty, so a
 * shared link still tells you "Acme Corp read IP for six minutes" and how many
 * distinct people looked. If someone volunteers their name, we identify them —
 * otherwise they stay an anonymous member of the group.
 */
export function PostHogTracker({ org, self }: { org: string; self: SelfId | null }) {
  const pathname = usePathname();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    if (!initialized) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageview: false,
        persistence: "localStorage+cookie",
      });
      initialized = true;
    }

    // The group is the unit that always exists. Person identity is a bonus.
    posthog.group("org", org, { name: org });
    posthog.setPersonPropertiesForFlags?.({ org });

    if (self?.email) {
      posthog.identify(self.email, { name: self.name, email: self.email, org });
    }
  }, [org, self?.email, self?.name]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.capture("$pageview", { section: pathname, org });
  }, [pathname, org]);

  return null;
}
