import type { Team } from "./access";

// Email on room entry. Fire-and-forget: a failed notification must never delay or
// break a viewer's access to the room.
//
// Env:
//   RESEND_API_KEY  — a sending-only key is enough
//   NOTIFY_TO       — where the alert lands
//   NOTIFY_FROM     — must be an address on a Resend-verified domain

const FALLBACK_FROM = "Portal <onboarding@resend.dev>";

// Corporate mail gateways (SafeLinks, Proofpoint, Mimecast) and chat unfurlers
// fetch every URL in an email before a human ever clicks it. Without this, the
// first "Acme Corp opened the room" alert would fire from their spam filter.
const NON_HUMAN =
  /bot|crawl|spider|slack|discord|whatsapp|telegram|preview|scanner|safelinks|proofpoint|mimecast|barracuda|curl|wget|python-requests|headless|monitor|pingdom|uptime/i;

/** Vercel RFC3986-encodes geo headers; "New York" arrives as "New%20York". */
function geo(req: Request, header: string): string | null {
  const raw = req.headers.get(header);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // malformed encoding: better a literal value than nothing
  }
}

/**
 * Returns the in-flight send so the caller can hand it to waitUntil(). Orphaning
 * this promise loses the email: Vercel may freeze the invocation the moment the
 * response is returned, before the request to Resend leaves the machine.
 */
export function notifyRoomOpened(team: Team, req: Request): Promise<unknown> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO;
  if (!key || !to) return Promise.resolve();

  // Our own previews are not news.
  if (/internal/i.test(team.org)) return Promise.resolve();

  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || NON_HUMAN.test(ua)) return Promise.resolve();

  // Browsers speculatively fetch links. A prefetch is not a visit.
  const purpose =
    req.headers.get("sec-purpose") ?? req.headers.get("purpose") ?? "";
  if (/prefetch|prerender/i.test(purpose)) return Promise.resolve();

  const city = geo(req, "x-vercel-ip-city");
  const region = geo(req, "x-vercel-ip-country-region");
  const country = geo(req, "x-vercel-ip-country");
  const where = [city, region, country].filter(Boolean).join(", ") || "unknown location";

  const when = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date());

  const body = [
    `${team.org} just opened the data room.`,
    ``,
    `When:  ${when} ET`,
    `Where: ${where}`,
    `Agent: ${ua.slice(0, 120)}`,
    ``,
    `This fires once per browser. A second email from ${team.org} means a second`,
    `person, a second device, or a cleared cookie — not the same tab reloading.`,
    ``,
    `Dashboard: https://us.posthog.com/project/505335/dashboard/1825561`,
  ].join("\n");

  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM ?? FALLBACK_FROM,
      to: [to],
      subject: `${team.org} opened the data room`,
      text: body,
    }),
  }).catch(() => {});
}
