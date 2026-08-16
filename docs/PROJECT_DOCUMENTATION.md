# College project documentation

## Abstract

CampusFind is a role-based Smart College Lost & Found Portal that centralizes lost and found reports, suggests probable matches, verifies ownership through private evidence, enables claim-linked communication, and records controlled handovers. The project uses React and Tailwind CSS for a responsive interface, Express and Socket.IO for REST/realtime services, MongoDB for structured persistence, Cloudinary for images, JWT/bcrypt for identity security, and scheduled jobs for lifecycle management. It addresses false claims and fragmented communication while giving college staff a reliable operational and analytics tool.

## Introduction

Personal belongings are frequently misplaced across libraries, classrooms, laboratories, canteens, buses, hostels, parking areas, and events. The item may be found quickly, yet its owner often cannot discover that fact. Messages disappear in crowded groups, notices reach a small audience, and guards lack a searchable cross-campus record. A web platform is suitable because students and staff can access it from existing phones and computers without installing software.

## Existing system

The typical system combines WhatsApp/Telegram posts, paper notices, verbal enquiries, visits to security, and informal handovers. Each channel holds different details, uses inconsistent formats, and has no stable ownership or status record.

### Problems in the existing system

- Reports are fragmented, duplicated, difficult to search, and quickly buried.
- Full phone numbers and sensitive identifiers may be posted publicly.
- A finder has no structured way to test an ownership claim.
- Multiple people may claim the same item with no review history.
- Staff cannot easily identify overdue items, pending handovers, hotspots, or recovery rate.
- Chats and handovers happen outside a college-controlled audit trail.

## Proposed system

CampusFind provides college-email identity, structured report forms, public/private field separation, automatic report publication, deterministic match scoring, private verification questions, proof-backed claims, real-time claim rooms, notifications, a security-office inventory view, QR item labels, staff decisions, hashed OTP handovers, complaints/moderation, expiration, and analytics/export.

## Objectives

1. Create one searchable source of truth for campus items.
2. Increase recovery speed using explainable matching.
3. Reduce fraud through private evidence and staff review.
4. Protect contact and ownership data by default.
5. Prevent duplicate reports and multiple approved claims.
6. Record accountable handovers and useful recovery statistics.
7. Deliver an accessible, responsive college demonstration project.

## Functional requirements

### Student

The system shall register/verify/login students; allow lost/found creation, editing, deletion, extension, images, search, filters, matches, bookmarks, claims, proof, chats, complaints, notifications, profile management, and recovery tracking.

### Staff

The system shall provide department/location-aware security records, found-item entry, physical-availability flags, private claim comparison, approval/rejection, handover scheduling/notes, OTP verification, and record history.

### Administrator

The system shall manage users/staff, approve/reject/hide/delete listings, review claims/complaints/reported chats, manage categories/locations/settings/announcements, block accounts, see audit logs, view charts, print, and export CSV.

### System services

The system shall calculate matches, detect duplicates, hide sensitive fields, enforce one approved claim, generate QR/OTP values, deliver in-app/email notifications, expire inactive reports, delete stored images, and centralize errors.

## Non-functional requirements

- **Security:** bcrypt cost 12, signed expiring JWT, HTTP-only cookies, Helmet, CORS allowlist, rate limits, sanitization, input validation, ObjectId checks, role/ownership checks, private schema selection, hashed handover OTP, and audit logs.
- **Performance:** indexed text/compound queries, bounded pagination, compressed responses, Cloudinary transformations, and aggregation-based charts.
- **Reliability:** centralized errors, safe email fallback, unique database constraints, idempotent bookmark/match writes, and explicit terminal states.
- **Usability/accessibility:** responsive navigation, labels, focus outlines, high-contrast status badges, keyboard-friendly controls, loading/error/empty states, light/dark mode, and clear confirmations.
- **Maintainability:** route/controller/service/model separation, reusable React components, environment configuration, provider-independent matching, automated tests, and documentation.
- **Scalability:** stateless API, CDN images, independent frontend, replica-ready MongoDB, and a documented Redis/worker scale-out path.

## Feasibility study

### Technical feasibility

All technologies are mature, cross-platform, documented, and supported by free development tiers. MongoDB fits evolving report/claim documents; Socket.IO supports browser realtime with fallback; Cloudinary removes local-disk dependence.

### Economic feasibility

Development can use free/open-source tools and provider starter tiers. A production college rollout mainly incurs hosting, email, image bandwidth, backups, and operational support.

### Operational feasibility

The workflow resembles current behavior—report, search, contact security—but makes it structured. Minimal student training is required. Staff gains queues instead of informal notes; admins gain clear moderation actions.

### Schedule feasibility

The modular six-phase plan separates foundations, reports, claims/matching, communication, handover/analytics, and quality/documentation. Each phase produces demonstrable functionality and can be tested independently.

### Legal and ethical feasibility

A college must define lawful basis/consent, retention, moderation, grievance, staff access, export, and deletion rules. The implementation minimizes public personal data but policy review is still mandatory.

## Software and hardware requirements

Development software: Windows/macOS/Linux, Node.js 20+, npm 10+, VS Code or equivalent, Git, a modern browser, MongoDB/Atlas, and optional Postman. Runtime software: Node host with WebSockets, MongoDB Atlas, Cloudinary, SMTP, HTTPS, and static frontend hosting.

Suggested development hardware: dual-core 64-bit CPU, 8 GB RAM, 4 GB free storage, and broadband. Client minimum: modern mobile/desktop browser and campus/internet connectivity. Production sizing depends on users, images, retention, and concurrency.

## System architecture

The presentation tier is a Vite React single-page application. The application tier is an Express REST API and Socket.IO gateway with middleware, controllers, services, cron jobs, and provider adapters. The data tier is MongoDB plus Cloudinary image storage. SMTP handles optional email. JWT cookie identity is shared between REST and WebSocket handshakes.

## Use-case descriptions

### UC-01 Register and authenticate

Actor: Student. Preconditions: approved email and no duplicate account. Main flow: submit identity → validate → hash password → create student → send verification link → set session. Exceptions: disallowed domain, duplicate enrollment/email, blocked status, invalid/expired token.

### UC-02 Report lost/found item

Actor: Student/staff. Preconditions: authenticated active account. Main flow: enter structured public/private details → validate images/date → check duplicates → upload → create pending report → admin approves → notify reporter → calculate matches. Exceptions: invalid input/storage unavailable/duplicate not acknowledged/rejection.

### UC-03 Claim found item

Actor: Student. Preconditions: approved active found item; claimant is not reporter; no approved claim. Main flow: answer private questions → upload evidence → create claim/chat → notify finder → staff compares evidence → approve or reject. Exceptions: missing answer, duplicate claimant claim, terminal item, competing approved claim.

### UC-04 Communicate

Actors: Claimant and reporter. Preconditions: claim-generated chat and active account. Main flow: authorized room join → send text/image → emit realtime event → notify recipient → mark read/typing. Exceptions: non-participant, blocked/reported chat, invalid attachment.

### UC-05 Return item

Actors: Owner, finder, staff. Preconditions: approved claim. Main flow: schedule location/date/time → generate six-digit OTP → owner presents OTP → owner/finder/staff confirm → mark handover completed/item returned → close competing claims → notify parties. Exception: wrong OTP or missing confirmation.

### UC-06 Moderate portal

Actor: Admin. Preconditions: active admin session. Main flow: review queues → apply action → persist status → notify affected user → write audit log. Exceptions: self-block, deleting used category, invalid resource, conflicting claim state.

## Data-flow explanation

At context level, students/staff/admin exchange reports, searches, claims, messages, handover confirmations, and decisions with CampusFind. At level one, authentication writes users/tokens; reporting writes items/images; matching reads approved opposite items and writes match/notification records; claiming reads private item evidence and writes claims/chats; communication writes messages; moderation changes states/logs; handover verifies OTP and finalizes recovery; analytics aggregates operational collections.

Private data has a separate logical path: clients submit it over authenticated HTTPS, Mongoose excludes it from default queries, public serializers remove it again, and only explicit owner/staff review queries opt it back in.

## ER entities

- **User:** identity, academic profile, role, verification, account status.
- **Item:** lost/found facts, public/private details, images, reporter, lifecycle.
- **Claim:** claimant evidence, private answers, decision.
- **Match:** lost/found pair, score, reasons, disposition.
- **Chat/Message:** claim participants and realtime conversation.
- **Handover:** approved claim, parties, schedule, hashed OTP, confirmations.
- **Notification/Bookmark/Complaint:** personalized activity, saved items, and moderation intake.
- **Category/CampusLocation/Setting/Announcement/Testimonial:** managed portal content/configuration.
- **AdminLog:** actor, action, target, details, IP, timestamp.

See [DIAGRAMS.md](DIAGRAMS.md) for ER cardinalities and all workflows.

## Matching design

Text is normalized to lowercase alphanumeric tokens and common low-information words are removed. Exact/contained strings and token overlap provide simple similarity. Category contributes 25; colour 15; brand 15; combined location/building 15; date within three days 15; description/title overlap up to 15. A threshold of 45 avoids very weak suggestions. Each match stores its contributing fields, making the score explainable. The service boundary allows later embeddings/image recognition.

## Security and privacy design

Sensitive schema fields use `select: false`, public serializers delete them explicitly, populated reporter details are reduced to name/role/avatar, image uploads are memory-buffered and type/size checked, all writes validate roles/ownership/state, and database indexes enforce uniqueness. Password/reset/verification tokens and OTP hashes are never serialized. Only claim participants can join chat rooms. Reported chats are exposed to admin for a defined complaint purpose. Production should add retention, malware scanning, secret rotation, and institutional policy controls.

## Testing strategy

Testing combines unit tests for scoring/policies/OTP/serialization, middleware tests for role/input behavior, API smoke tests for health/error contracts, build/lint checks, and a manual end-to-end matrix for identity, report lifecycle, privacy, claims, chat, handover, admin, export, accessibility, and responsive layouts. Detailed cases are in [TESTING.md](TESTING.md).

## Conclusion

CampusFind demonstrates how a familiar campus problem benefits from careful workflow design more than simple posting. Structured discovery improves reach; explainable matching improves speed; private questions and staff decisions improve trust; and OTP handovers create a definitive recovery record. The modular MERN implementation is suitable for a college demonstration and a controlled pilot after institutional review.

## Future scope

Future versions can add college SSO, semantic/multilingual search, image embeddings, mobile push, Redis scale-out, background job queues, antivirus/moderation, automated retention, map-floor-plan context, QR/barcode hardware, native apps, richer recovery-time analytics, and federation between nearby campuses.
