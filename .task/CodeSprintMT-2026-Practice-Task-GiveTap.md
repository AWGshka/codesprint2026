# Practice Task Booklet — *GiveTap*
### Contactless Charitable Giving Platform

> **This is a practice task, not an official CodeSprintMT booklet.** It is reverse-engineered from the 2026 prep guide to rehearse every criterion the real Open task is likely to test. Attempt it under realistic conditions and you'll have built a working version of each variant before the day. Names and exact wording are invented; the **shape, scope, and point grid** mirror the prediction.

---

## How to use this for practice

- **Time-box it to ~8 hours, solo.** Same as the real Open category. Resist starting before the clock.
- **Simulate the payment.** Do **not** integrate real card processing or NFC. A mock/sandbox "charge" that returns success/failure is the whole point — the real task will be the same.
- **Finish with a narrated demo video** showing *every* feature you built. This is mandatory in the real competition (no video = disqualified; undemonstrated features = ungraded), so rehearse it now.
- **Then run a self-VIVA.** Have someone (or your notes) ask you to explain random sections — auth, real-time, reconciliation, currency formatting.
- **Score yourself** against the grid at the end. Anything below ~250 means tighten the core before chasing extras.

---

## 1. Design Brief

Spontaneous generosity is hard to capture. A donor at an event, a kiosk, or on their phone wants to give in seconds — and the charity behind the cause needs to run campaigns, watch the money arrive, and reconcile what actually landed against what their system recorded.

**GiveTap** is a prototype platform that solves both sides. You will build:

1. A **donor app** — a branded, low-friction "tap to give" flow ending in a confirmation/receipt.
2. An **admin console** — a role-based back-office to manage campaigns and monitor giving in real time.

Since you only have a day, this is a **prototype / proof-of-concept**. Payment processing is **simulated** (assume an integration with the Mastercard Donate sandbox; you may mock its responses). Functionality is prioritised below using the **MoSCoW** method.

---

## 2. Requirements (MoSCoW)

### Must have

**M1 — Donor App**

| ID | Requirement |
|---|---|
| M1.1 | **Branding.** Donation screens display the selected campaign's branding: logo, campaign name, a banner/hero image, a theme colour, and a short cause description. |
| M1.2 | **Available options.** The donor can choose a cause/campaign, an amount from presets (e.g. €5 / €10 / €25 / €50) **or** a custom amount, and a frequency: **one-time**, **monthly**, or **round-up**. |
| M1.3 | **User flow.** A guided, multi-step donation flow: (1) choose cause → (2) choose amount & frequency → (3) enter/select payment → (4) review. Progress is clear and the user can go back a step. |
| M1.4 | **User confirmation.** A review step summarises the donation before submitting; on success, a confirmation/receipt screen shows the transaction details (reference ID, amount, currency, cause, date/time, frequency). The receipt can be viewed/printed. |
| M1.5 | **Multi-currency.** Support **at least three currencies** with **EUR as primary** (e.g. EUR, USD, GBP), formatting every amount correctly for its currency/locale. |
| M1.6 | **Graceful error handling.** Validate inputs (amount > 0, required fields) and handle failures (declined/failed payment, network error) with clear messages. No crashes or dead ends. |
| M1.7 | **Accessibility.** Provide a **text-size control** and a **high-contrast colour-scheme toggle**. |

**M2 — Admin Console**

| ID | Requirement |
|---|---|
| M2.1 | **Role-based access control.** Admins log in. At least **two roles** with different capabilities — e.g. *Viewer* (sees dashboards/ledger, cannot modify) vs *Manager/Admin* (manages campaigns; admin manages users). The UI and the API both enforce roles. |
| M2.2 | **Create & manage.** Admins can **create, edit, and delete campaigns**. Each campaign has required fields — name, cause/description, target amount, currency, status — with validation. |
| M2.3 | **Live dashboard.** A dashboard of donation activity: total raised, number of donations, per-campaign progress toward target, recent donations, and a trend chart (donations over time). |
| M2.4 | **Transaction ledger.** A list of all donations, **filterable** (by campaign, currency, date range, status) and **sortable** (by amount, date). |
| M2.5 | **CSV & PDF export.** Export the (filtered) ledger to **CSV** and to **PDF**. |
| M2.6 | **Reconciliation view.** Compare donations recorded by the app against a provided **processor records** source (mock API/file). Show **matched**, **missing**, and **mismatched** (e.g. amount differs) records. |
| M2.7 | **Audit log.** Record **every admin action** (create/edit/delete campaign, role/user change, login) with actor, action, and timestamp; viewable in the console. |

### Should have

| ID | Requirement |
|---|---|
| S1.1 | **Extra user actions.** After a donation, offer at least one of: convert to a recurring donation, download/email the receipt, share to social, or opt into transaction round-up. |
| S1.2 | **Additional UI prototype.** A **static** mockup of an extra feature — e.g. a donor impact dashboard, campaign discovery/search, or a donor leaderboard. |
| S1.3 | **Functional UI prototype.** A **working** version of one extra feature (e.g. campaign discovery that actually filters real campaigns, or an impact dashboard showing real totals). |

### Could have

| ID | Requirement |
|---|---|
| C1.1 | **Mobile app.** A mobile-app prototype of the donor flow (responsive PWA or native). |
| C2.1 | **Multilingual UI.** Translation support with **at least one partial translation** to another language (e.g. Maltese). |
| C3.1 | **Real-time dashboard.** The admin dashboard updates **in real time** as new donations arrive — no manual refresh. |

### Won't have (don't attempt)

- Real card charging or live payment settlement.
- Production NFC / contactless certification (Tap to Pay hardware).
- Real OAuth onboarding with Mastercard beyond mocking the sandbox.

---

## 3. Technical Guidelines

**Platform.** Any platform (Windows, macOS, Linux, iOS, Android, web). A **web app** is recommended for lowest barrier to entry; this doesn't affect points.

**Language/stack.** Any language and framework you're comfortable with. You must be able to run the solution on a judge's machine and supply both a runnable build and source code.

**Separation of concerns.** A clear split between presentation and logic (e.g. a REST API boundary between the front-end and the data/business layer) is explicitly rewarded.

**Simulated payment.** Model the donation "charge" as a function/endpoint that returns success / failure / pending. You may stub the Mastercard Donate sandbox responses.

### Sample data (mock this yourself to practise the data-driven parts)

Generate roughly **three months** of data so charts and the ledger look real:

- **Campaigns** (~8–12): `id`, `name`, `cause/category`, `description`, `target_amount`, `currency`, `status` (active / paused / ended), `branding` (`logo_url` or initials, `theme_colour`).
- **Donations** (~150–300): `id`, `timestamp`, `campaign_id`, `donor_name` (or `"Guest"`), `amount`, `currency` (mix of EUR/USD/GBP), `frequency` (`one_time` / `monthly` / `roundup`), `status` (`completed` / `pending` / `failed`), `payment_ref`.
- **Processor records** (for reconciliation): a near-copy of the donations list, deliberately seeded with a few discrepancies — at least one record **missing** from the app, at least one **extra** record the app doesn't have, and at least one **amount mismatch**. Reconciliation should surface all three classes.

---

## 4. Judgement Criteria (345 points)

You don't need every criterion — the more you land, the better. Aim for the four-and-a-half-figure 20-pointers first (User Flow, User Confirmation, RBAC, Create & Manage, Live Dashboard).

| Criterion | Max |
|---|---:|
| **Core — Donor App (M1)** | |
| [M1.1] Branding | 10 |
| [M1.2] Available Options | 10 |
| [M1.3] User Flow | 20 |
| [M1.4] User Confirmation | 20 |
| [M1.5] Multi-Currency | 15 |
| [M1.6] Graceful Error Handling | 15 |
| [M1.7] Accessibility | 10 |
| **Core — Admin Console (M2)** | |
| [M2.1] Role-Based Access Control | 20 |
| [M2.2] Create & Manage | 20 |
| [M2.3] Live Dashboard | 20 |
| [M2.4] Transaction Ledger | 15 |
| [M2.5] CSV & PDF Export | 10 |
| [M2.6] Reconciliation View | 10 |
| [M2.7] Audit Log | 10 |
| **UI/UX** | |
| Neat / aesthetically pleasant UI | 10 |
| App is easy to use | 5 |
| Responsiveness (desktop + mobile) | 10 |
| **Code Quality** | |
| Code organisation | 5 |
| Separation of presentation and logic | 10 |
| Consistent, correct programming paradigm | 5 |
| Function cohesion | 5 |
| Inline documentation | 5 |
| Maintainable code | 5 |
| **Additional / Optional** | |
| [S1.1] Extra User Actions | 10 |
| [S1.2] Additional UI Prototype | 10 |
| [S1.3] Functional UI Prototype | 20 |
| [C1.1] Mobile App | 15 |
| [C2.1] Multilingual UI | 15 |
| [C3.1] Real-Time Dashboard | 10 |
| Additional features | tie-break only |
| **Total** | **345** |

---

## 5. Submission Criteria (rehearse these)

- Submit all source code + assets as a folder or archive.
- **Record a demonstration video** narrating **every** feature of both the donor app and the admin console/back-end. In the real competition, **no video = immediate disqualification**, and **any feature not shown in the video is not graded** — including optional and additional features.
- Be ready for a **10-minute VIVA**: expect to explain your auth/RBAC, the real-time mechanism, how reconciliation detects mismatches, how currency formatting works, and where presentation is separated from logic.

---

## 6. Stretch challenge (only if you finish early)

Swap the theme but keep the skeleton: re-skin the donor app for a **different campaign brand**, add a **fourth currency**, and add a **second admin role** with a narrower permission set — proving your RBAC, branding, and currency layers are actually data-driven rather than hard-coded. That's exactly the kind of adaptability the real booklet's hidden wording will demand.

---

*Practice goal: by the end, you should be able to rebuild auth+roles, a validated CRUD+table, charts with a live feed, the currency/i18n/accessibility layer, CSV/PDF export, and a mock-API reconciliation diff — from memory, and explain each. Hit that, and the real task is just re-skinning what you already know.*
