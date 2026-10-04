# Folio Product Scope and UI Design Specification

## 1. Purpose

This document defines what Folio is, who it is for, what the first product should do, and how its user interface should feel and behave. It is a product direction and design brief for the team, not a claim that all listed features are already implemented.

## 2. Product direction

### Product statement

**Folio helps businesses run AI-powered phone conversations and turn them into clear outcomes and next steps.**

Businesses should be able to configure how Folio represents them, choose a calling workflow, contact people at appropriate times, understand what happened, and act on requested follow-ups.

### Positioning

Folio is an **industry-flexible voice operations platform**. It should not present itself as an education/admissions product, but it should also avoid the vague promise of automating every process for every business.

The product is organized around reusable jobs:

- Reach a person and explain an offer or service.
- Follow up on an earlier conversation or enquiry.
- Remind someone about an upcoming deadline, visit, appointment, or renewal.
- Re-engage a past customer or an inactive lead.
- Collect feedback after an interaction.
- Route a conversation to a person when the AI cannot or should not complete it.

Industry-specific language, knowledge, fields, and templates should configure these workflows rather than define separate versions of Folio.

### Intended users

- **Business owner or administrator:** sets up the business, users, calling rules, and campaigns; reviews outcomes and usage.
- **Operator or sales/support teammate:** monitors activity, handles callbacks, and resolves human handoffs.
- **Viewer or manager:** checks campaign performance and call outcomes without changing configuration.

### Core value

Folio should make it easy to answer:

1. What work did Folio do?
2. What useful outcome did it produce?
3. What needs my attention next?

The UI should show operational activity and business outcomes together. Counts such as calls placed are useful, but should not be presented as the result by themselves.

## 3. Scope boundaries

### The core product includes

- Business identity, voice, operating hours, and AI guardrails.
- Contact import, review, segmentation, and opt-out handling.
- Campaign creation and lifecycle management.
- Scheduled and immediate outbound calls.
- Call status, transcripts or summaries, outcomes, and recordings where available.
- Requested callbacks and human follow-up work.
- Basic campaign and usage reporting.
- Team access and account settings.

### Not part of the first release

These are valid future product areas, but should not block the first useful release:

- A complete CRM with deal stages, forecasting, and sales compensation.
- A full helpdesk or ticketing system.
- Native calendar booking with live availability and conflict resolution.
- Multichannel marketing across email, SMS, and messaging platforms.
- Complex workflow builders and arbitrary automation.
- Deep integrations with many CRMs, calendars, and telephony providers.
- Fully autonomous inbound customer support.

The first release may capture a booking request or callback preference and hand it to a human. It should not imply that an appointment is confirmed unless Folio is actually connected to an availability source and has reserved the slot.

## 4. Product principles

1. **Outcome before activity.** Show what happened and what should happen next, not just volume.
2. **One adaptable platform.** Share navigation and core workflows across industries; customize examples, templates, and business knowledge.
3. **Human control stays clear.** Make it obvious when the AI is calling, when work is queued, and when a person needs to take over.
4. **Trust over novelty.** Make consent, opt-outs, calling windows, failures, and data use understandable.
5. **Progressive configuration.** Let a new customer complete the essential setup first; keep advanced controls out of the way until needed.
6. **Truthful status.** Never show a call, callback, booking, or delivery as successful unless the underlying system confirms it.

## 5. Visual direction

### Reference

Use Zaro as a **visual mood reference**, not as a screen-by-screen template. The direction to carry into Folio is warm, minimal, confident, and high-contrast: a light canvas, near-black typography, generous whitespace, and a restrained lavender accent. Zaro's inspected page is a marketing experience; Folio's interface must be designed for repeated operational work.

Do not reproduce Zaro's logo, copy, illustrations, or distinctive page composition. Folio should have its own identity and dashboard structure.

### Proposed visual system

| Role | Direction | Starting token |
|---|---|---|
| Main canvas | Warm off-white, not stark white | `#F7F6F2` |
| Surface | White cards and menus | `#FFFFFF` |
| Primary text | Near-black / warm charcoal | `#201D1B` |
| Secondary text | Muted warm gray | `#716D69` |
| Borders | Quiet neutral gray | `#E8E5E0` |
| Primary accent | Soft lavender | `#B8A9F5` |
| Accent hover / emphasis | Deeper accessible purple | `#7057C8` |
| Success | Dark green with a light tint | Reserve for confirmed success |
| Warning | Amber with a light tint | Reserve for attention needed |
| Destructive / error | Red with a light tint | Reserve for errors and destructive actions |

These are starting values, not final brand approvals. Check text and control contrast before implementation. Lavender is an accent for primary actions, selected states, and small highlights; it should not color every card or chart.

### Layout and components

- Use a calm, light application canvas with a persistent left navigation on desktop.
- Use a compact top bar for workspace identity, page context, help, and account controls.
- Use clear page titles, short explanatory text, and one obvious primary action per page.
- Prefer flat, lightly bordered surfaces to glass effects, heavy shadows, or gradients.
- Use rounded corners consistently but modestly; avoid making every element pill-shaped.
- Use a readable sans-serif already available in the app (Geist is suitable) and a clear type scale.
- Use simple line icons with text labels. Do not rely on emoji as product iconography.
- Keep tables, filters, and status labels visually quiet and scannable.
- Reserve strong colors for meaning: status, alerts, and the main action.

### Theme

The first release should ship with the light theme as the default. A dark theme is optional future work; do not force every surface into strict black and white. The interface should use warm neutrals so it remains comfortable during long work sessions.

## 6. Application information architecture

### Primary navigation

1. **Overview** — today's work, outcomes, and attention items.
2. **Campaigns** — campaign list, setup, details, and performance.
3. **Contacts** — imported people, segments, contact history, and opt-outs.
4. **Calls** — call activity, filters, call detail, transcript, and recording.
5. **Follow-ups** — callbacks and human actions, with due dates and ownership.
6. **Knowledge & Voice** — business profile, knowledge, voice, tone, and guardrails.
7. **Analytics** — trends and campaign comparisons.
8. **Settings** — team, calling hours, usage/plan, and account configuration.

Navigation should be permission-aware. Hide or disable actions that a user's role cannot perform, while keeping read-only views accessible to viewers.

### Global shell

- Workspace/business switcher when a user can access more than one business.
- Persistent primary navigation on desktop; compact menu or bottom navigation on small screens.
- Contextual page title and breadcrumbs for nested screens.
- Notifications for important failures and requested human actions; avoid noisy notifications for routine events.
- Clear loading, empty, error, and permission-denied states on every data-driven page.

## 7. Screen specifications

### 7.1 Overview — “Today + Results”

The overview should help a returning customer see Folio's value and know what to do next.

Recommended content order:

1. **Page greeting and time context:** business name, current date/time zone, and a restrained “Create campaign” action.
2. **Outcome summary:** a small set of meaningful, clearly defined metrics for the selected period, such as people reached, successful conversations, follow-ups requested/completed, and campaign completion. Only display metrics supported by reliable data.
3. **Needs attention:** callbacks due, calls that failed and require review, and human handoffs. Give each item a direct next action.
4. **Campaign activity:** running/paused campaigns and their progress, with quick links to details.
5. **Recent calls:** a short recent-activity list with contact, campaign, time, result, and a route to the call detail.
6. **Trend/context:** a modest period comparison or trend, with the date range and metric definition visible.

Do not present unverified conversion or revenue attribution. Explain the time range and what each metric counts.

### 7.2 Campaigns

Campaign list:

- Name, workflow type, status, audience size, progress, last activity, and result summary.
- Search and filters for status and workflow type.
- Clear actions to view, pause/resume, duplicate, or archive, subject to role and confirmation rules.
- Empty state that helps the user create their first campaign.

Campaign creation should use a short guided flow:

1. Choose a goal/template: outreach, follow-up, reminder, reactivation, feedback, or announcement.
2. Name the campaign and describe its objective.
3. Select or import the audience; preview valid, duplicate, opted-out, and invalid contacts.
4. Configure the business voice, opening, key information, response boundaries, and call to action.
5. Set schedule, time zone, permitted calling hours, and retry policy.
6. Review a summary, run a test call, and launch or save as draft.

The user must be able to return to previous steps without losing entered data. Show a final review before any action that starts real calls.

Campaign detail:

- Status and controls at the top.
- Progress and meaningful outcomes, each with definitions.
- Contact-level activity and call results.
- Clear pause/resume behavior and an explanation of what happens to pending calls.
- Errors and blocked records, with actionable resolution guidance.

### 7.3 Contacts

- Searchable, filterable list with name, phone, relevant custom fields, contact status, last interaction, and opt-out indicator.
- Import flow with column mapping, validation preview, duplicate handling, and a final import confirmation.
- Allow custom columns without making education-specific fields mandatory.
- Contact detail should show relevant business context, call history, campaign membership, and pending follow-up.
- Make opt-out visible and persistent. Prevent opted-out contacts from being queued for calls.
- Support safe correction of invalid contact details and clear explanations when a record cannot be called.

### 7.4 Calls

- Filter by date, campaign, outcome, and status.
- List contact, campaign, start time, duration, outcome, and follow-up state.
- Call detail should show a concise summary first, then the transcript, recording (if available), outcome, and next steps.
- Make transcript speaker and timestamps clear. Provide playback controls with accessible labels.
- Distinguish call outcome from sentiment or interest; do not infer a business result solely from sentiment.
- Show unavailable recordings/transcripts honestly, with retry or support guidance where relevant.

### 7.5 Follow-ups

- Default to actionable groupings: overdue, due today, upcoming, and completed.
- Show contact, reason/context, requested time, owner, source call, and current state.
- Allow assignment, rescheduling, completion, and “not needed” actions according to permissions.
- Preserve notes and a link to the originating call.
- Make timezone explicit when showing scheduled times.

### 7.6 Knowledge & Voice

Setup should be approachable and divided into sections:

- Business name, description, contact details, location, and operating hours.
- Industry selection as an optional template selector, not a permanent product silo.
- Catalog/services/offers and frequently asked questions.
- AI persona name and tone.
- Guardrails: what Folio may say, must not promise, or must hand to a person.
- A preview/test area that makes it clear when a real call will be placed.

Show whether changes are saved and which configuration version was used for a call when the system supports that information.

### 7.7 Analytics

- Start with a small set of dependable period and campaign comparisons.
- Include reached/connected rate, outcome distribution, follow-up completion, and usage where data supports them.
- Make date range, denominator, timezone, and metric definition visible.
- Distinguish unavailable data from zero results.
- Avoid vanity dashboards and unsupported claims about revenue, bookings, or conversions.

### 7.8 Settings

- Team members and roles.
- Business profile, caller identity, timezone, and allowed calling hours.
- Plan and usage, including what a credit means and when counters reset.
- Data, recording, and retention settings as supported by policy and implementation.
- Clear confirmation and audit context for sensitive or destructive changes.

## 8. Core user journeys

### First-time setup

1. Create or join a workspace.
2. Enter business basics and timezone.
3. Choose a workflow template or start from a blank campaign.
4. Add a small test audience or import contacts.
5. Review mappings, duplicates, invalid numbers, and opt-outs.
6. Configure voice and guardrails, then place a clearly identified test call.
7. Review the test result and launch only after explicit confirmation.

Progress should be saved between steps. Do not force a customer to complete advanced settings before they can understand the product.

### Daily operation

1. Open Overview and understand recent outcomes.
2. Handle overdue or due follow-ups.
3. Review active campaign progress and failures.
4. Open a call when context is needed.
5. Make a human decision, record it, and return to the workflow.

### Create and launch a campaign

Users should always know the audience, estimated workload, calling window, retry behavior, and what “launch” will do before they confirm. A campaign in draft must not initiate calls.

## 9. Responsive behavior and accessibility

- Desktop is optimized for campaign management, tables, and call review.
- Tablet layouts should preserve important content without requiring horizontal page scrolling.
- Mobile prioritizes the overview, follow-up actions, and call details; complex campaign setup may use a simplified step-by-step layout.
- Use semantic headings, keyboard-accessible navigation, visible focus styles, and accessible names for icon-only controls.
- Do not use color alone to communicate campaign or call status.
- Respect reduced-motion preferences and avoid animation that distracts from active-call or error states.
- Keep text contrast compliant with WCAG AA targets; verify the proposed lavender accent on each background before using it for text.
- Provide readable validation messages next to fields and a page-level summary for submission failures.

## 10. Data and capability alignment

The current schema already provides useful building blocks: business profiles, industry and campaign types, contacts with custom/context data, call queues, calls, follow-ups, knowledge-base entries, and user roles in [the database schema](../db/src/schema.ts).

The UI must reflect the difference between these existing data concepts and implemented product behavior:

- A schema table does not mean the corresponding workflow is complete or persisted end-to-end.
- The current status report identifies database-backed call persistence, queue automation, contact import, and a business dashboard as remaining work in [the project status update](./Project%20Status%20Update.md).
- Contact fields such as parent, student, and course should be optional industry-specific data; generic contact management should not require them.
- Booking should be labeled a request or follow-up unless a real calendar integration confirms a reservation.
- “Connected”, “interested”, “follow-up requested”, “sentiment”, and campaign success should remain distinct concepts in the UI.
- Do not expose internal provider costs, model details, or operational diagnostics to ordinary business users unless there is a clear customer-facing reason.

### Foundational requirements before broad rollout

- Authentication, role-based access, and strict business/tenant data isolation.
- Durable and replayable call-event handling.
- Reliable call, transcript, and outcome persistence.
- Protected webhooks and safe, validated request destinations.
- Contact import validation, duplicate review, and opt-out enforcement.
- Queue scheduling that respects timezone, permitted hours, retries, and pauses.
- Explicit error states for provider failures and partial results.

These are product trust requirements, not optional visual polish.

## 11. Release plan

### Foundation

- Replace the test-console-first experience with an authenticated product shell.
- Establish tenant-aware routing and role-aware navigation/actions.
- Persist call activity and surface reliable status, transcript/summary, and error information.
- Add consistent loading, empty, and failure states.

### First useful customer release

- Complete business setup and a generic workflow template.
- Import and review contacts, including duplicates and opt-outs.
- Create, test, schedule, launch, pause, and inspect an outbound campaign.
- View calls and manage requested human follow-ups.
- Show the Today + Results overview and basic usage.
- Include accessible, responsive light-theme UI using the visual direction in this document.

### Later expansion

- Better analytics and campaign comparisons.
- Additional workflow templates and configurable custom fields.
- Calendar booking integrations with real availability confirmation.
- CRM and support integrations.
- Inbound call handling and additional channels.
- Optional dark theme and deeper workspace customization.

## 12. First-release acceptance criteria

The UI is ready for the first customer release when:

- A new business user can understand what Folio does without encountering education-only language.
- The user can configure business voice and guardrails, import contacts, review exceptions, and create a campaign.
- No opted-out or invalid contact can be silently queued.
- A user can see whether a campaign is a draft, active, paused, completed, or blocked, and can explain the status.
- A call result is clearly distinguished from a callback request, a human follow-up, or a confirmed booking.
- The Overview shows dependable outcome information and a prioritized next action, with transparent metric definitions.
- Data and actions are scoped to the correct workspace and role.
- Every important page has useful loading, empty, error, and permission states.
- Core tasks work with keyboard navigation and on mobile-sized screens.
- The interface uses a warm light canvas, near-black type, quiet neutral surfaces, and restrained lavender accents without copying Zaro's brand assets or page layouts.

## 13. Design summary

**Product:** a configurable AI phone-operations platform for outreach and follow-through.

**First release:** business setup, contact import, outbound campaigns, calls, outcomes, and human follow-ups.

**Dashboard:** a balanced “Today + Results” overview—what Folio accomplished, what needs attention, and how campaigns are progressing.

**Visual direction:** Zaro-inspired warmth and restraint; Folio-specific information architecture and brand; warm off-white, near-black, soft neutrals, and a limited lavender accent.
