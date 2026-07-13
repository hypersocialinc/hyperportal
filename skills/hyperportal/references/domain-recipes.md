# Domain recipes

Ready mappings of the portal model onto common domains. Each answers the four
design questions: who is the counterparty, what do stages mean, what's teaser
vs hidden, and what must never leak. Adapt with the user — these are starting
points, not fixed menus.

In every recipe, "the owner" is whoever runs the portal and holds the CLI.

---

## M&A / acquisition dataroom

The origin domain — this template was extracted from a production acquisition data room.

- **Counterparty:** each acquirer/buyer org. One link per buyer, shared inside
  their corp-dev team.
- **Stages:** T1 = first-look curated room (post-NDA). T2 = post-LOI diligence
  (financial detail, HR/personnel releases, per-holder cap table). T3 (rare) =
  clean-room material.
- **Teaser:** Financials, Tax, Data/Privacy — advertising them invites the
  right next conversation.
- **Hidden:** HR/personnel sections (releases, disputes) — a visible
  "Personnel — on request" row plants exactly the question you don't want
  asked pre-LOI.
- **Never leak:** other buyers' existence (multi-tenancy discipline —
  neutral asset paths, no counterparty names anywhere shared), deal metrics in
  the OG image, anything from the internal deal vault that wasn't curated in.
- **Sections:** Overview, Product/Technology, IP, Team, FAQ, Corporate,
  Capitalization, Financials(T2), Commercial, Legal, Tax(T2), HR(T2, hidden).

## Fundraising dataroom

Nearly identical machine; different counterparty psychology (you're selling
up, not out, and there are many more viewers).

- **Counterparty:** each investing firm. One link per fund; partners and
  associates share it.
- **Stages:** T1 = post-first-meeting (deck, memo, product, market, summary
  metrics). T2 = in-diligence (full financial model, cap table with holders,
  key contracts, pipeline detail).
- **Teaser:** Financial model, cap table — "available in diligence" is a
  normal, healthy signal.
- **Hidden:** anything about *other* term sheets or investor conversations;
  sensitive customer names under NDA.
- **Never leak:** round status/metrics in the OG image (it will be unfurled in
  fund Slack channels constantly), customer names in image paths or doc
  filenames.
- **Extra value:** `pnpm portal stats` ordering of firms by engagement is a
  genuinely useful priority signal between meetings.

## Rental application portal

Direction inverts: the applicant runs the portal and discloses to landlords.

- **Counterparty:** each landlord/broker/management company.
- **Stages:** T1 = profile (intro, employment letter, references, general
  budget). T2 = serious interest (pay stubs, bank statements, credit report,
  guarantor documents).
- **Teaser:** the T2 financial docs — "available on request" reads as
  organized, not evasive.
- **Hidden:** anything revealing other applications in flight, or negotiating
  posture (e.g. a section tailored to one building's asks).
- **Never leak:** SSN/account numbers (redact *inside* documents before
  upload — the portal gates access, it does not redact), salary figures in
  filenames, other landlords' names.
- **Note:** short `expires` (2–4 weeks) fits this domain; revoke after
  signing a lease.

## Visa / green-card evidence binder

The applicant (or their team) organizes an evidence portfolio for attorneys,
employers, and expert-letter writers. (USCIS itself gets paper/PDF filings —
the portal is for the humans assembling and reviewing the case.)

- **Counterparty:** law firm, employer/HR, each recommender.
- **Stages:** T1 = public-facing case skeleton (CV, publications list, press,
  citations, the criteria narrative). T2 = personal documents (passport,
  I-94s, prior filings, salary evidence, personal letters).
- **Teaser:** T2 personal docs for the attorney's link.
- **Hidden:** draft strategy/weakness analysis sections — visible only to the
  attorney-tier link, invisible to recommenders (a recommender seeing
  "Case Weaknesses — on request" is exactly the hidden-mode use case).
- **Never leak:** passport/A-numbers in filenames or paths, other
  recommenders' identities across links if letters are meant to be
  independent.
- **Note:** recommenders are many small counterparties — grant each their own
  link so you can see who actually opened the materials before the deadline.

---

## Designing a new domain

Ask, in order:
1. Who is the unit of trust (gets a link)? If it's individuals, fine — an
   "org" of one.
2. What event moves a counterparty from stage 1 to 2? (LOI, term sheet,
   application accepted, retainer signed.) If no such event exists, you may
   only need one tier.
3. Section by section: below-tier recipients — should they *want and ask*
   (teaser) or *never wonder* (hidden)?
4. Write the never-leak list before writing content, and check every asset,
   filename, and the OG image against it.
