# CampusFind — Smart College Lost & Found Portal

CampusFind is a complete MERN-stack college project for reporting, matching, verifying, and returning lost belongings. It replaces fragmented WhatsApp posts, paper notices, and word of mouth with searchable reports, privacy-safe ownership checks, real-time claim chat, admin moderation, and OTP-backed handovers.

## Final folder structure

```text
campusfind/
├── backend/
│   ├── config/                 # MongoDB, Cloudinary, and email configuration
│   ├── controllers/            # Auth, items, claims, chat, admin, handover workflows
│   ├── jobs/                   # Scheduled expiry and warning job
│   ├── middleware/             # JWT, roles, validation, upload, error handling
│   ├── models/                 # 16 Mongoose domain models
│   ├── routes/                 # Version-ready REST route modules
│   ├── seed/                   # Demonstration dataset
│   ├── services/               # Matching, notifications, email, storage, policies
│   ├── sockets/                # Authenticated Socket.IO rooms and events
│   ├── tests/                  # API, auth, roles, privacy, validation, workflow tests
│   ├── utils/                  # Tokens, OTP, serialization, pagination, errors
│   ├── validators/             # Express Validator chains
│   ├── app.js
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/                # Axios client
│   │   ├── components/         # Cards, states, forms, navigation, modal
│   │   ├── context/            # Cookie-session auth context
│   │   ├── layouts/            # Public and role workspace shells
│   │   ├── pages/              # Public, student, staff, and admin routes
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── DIAGRAMS.md
│   ├── PROJECT_DOCUMENTATION.md
│   └── TESTING.md
├── .env.example
├── .gitignore
└── package.json                # npm workspaces and combined scripts
```

## Problem statement

Students regularly lose IDs, wallets, phones, chargers, books, keys, bags, documents, and other belongings. Existing recovery methods are disconnected, short-lived, difficult to search, and vulnerable to false ownership claims. Colleges also lack a reliable record of items submitted to security or returned to owners.

## Proposed solution and objectives

CampusFind creates one college-controlled workflow:

1. Students or staff submit a structured lost/found report.
2. Reports publish immediately and enter matching automatically.
3. A modular matching service scores opposite reports from 0–100.
4. Claimants provide private details and finder-defined answers.
5. Staff/admin approves one ownership claim.
6. Parties coordinate through claim-linked real-time chat.
7. A scheduled campus handover uses a six-digit OTP and three confirmations.
8. The returned item contributes to recovery analytics.

The key objectives are centralization, privacy, safer verification, duplicate reduction, accountable handovers, useful campus analytics, and a responsive student-friendly experience.

## Feature coverage

- College-domain registration, email verification, reset links, JWT HTTP-only cookie sessions, role guards, blocked-account checks, and login rate limits.
- Lost/found reporting with multi-image Cloudinary uploads, private details, finder questions, duplicate warnings, expiry, extension, editing, deletion, and recovery status.
- Public full-text search, filters, sorting, pagination, security-office filter, bookmarks, QR verification pages, and empty/loading/error states.
- Weighted matching for category, colour, brand, location, date, and keywords.
- One-approved-claim database invariant, ownership proof, private answers, review notes, cancellation, and claim-linked chat.
- Authenticated Socket.IO user/chat rooms, messages, attachments, typing, read markers, blocking, reporting, and real-time notifications.
- Staff security queues, claim review, scheduled handovers, hashed OTP verification, and owner/finder/staff confirmation.
- Admin users/staff, listings, claims, complaints, categories, locations, announcements, settings, charts, CSV export, and audit logs.
- Light/dark themes, responsive sidebars/mobile navigation, accessible labels, toasts, confirmation prompts, tables, charts, cards, and print styles.
- Seeded college demonstration data and Vitest/Supertest coverage.

## User roles

| Role | Main capabilities |
|---|---|
| Student | Report, search, save, match, claim, chat, track, and confirm recovery |
| Staff | Add security items, verify claims, manage campus handovers, view records |
| Admin | Moderate all data, manage roles/resources, investigate complaints, analyze/export |

Normal registration always creates a `student`. Staff and admin users can only be created by an authenticated admin.

## Technology stack

The frontend uses React 19, Vite, Tailwind CSS 4, React Router, Axios, React Hook Form, Socket.IO Client, Recharts, Lucide icons, React Hot Toast, and date-fns. The backend uses Node.js, Express 5, MongoDB/Mongoose, JWT, bcrypt, Multer, Cloudinary, Socket.IO, Nodemailer, Express Validator, Helmet, CORS, compression, rate limiting, sanitization, QRCode, and node-cron.

## Architecture

The browser talks to a stateless REST API using an HTTP-only JWT cookie. Express routes delegate to modular controllers/services, Mongoose owns database invariants, Cloudinary stores images, SMTP sends optional email, and Socket.IO authenticates the same JWT before joining per-user or per-claim rooms. See [all Mermaid diagrams](docs/DIAGRAMS.md).

## Local installation

Requirements: Node.js 20+, npm 10+, and MongoDB 7+ locally or an Atlas cluster.

```bash
git clone <repository-url>
cd campusfind
cd backend
copy .env.example .env
npm install
npm run seed
npm run dev
```

The backend loads only `backend/.env`. Set at minimum `MONGODB_URI`, a long random `JWT_SECRET`, `CLIENT_URL=http://localhost:5173`, and approved domains. Cloudinary is required only when uploading new images; SMTP is optional in development and uses console previews when absent. The frontend loads its own `frontend/.env`.

```bash
cd ../frontend
copy .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` for hot-reload development. After `npm run build`, the backend also serves the production frontend at `http://localhost:8080`; API health is at `http://localhost:8080/api/health`.

## Environment variables

| Name | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | API runtime |
| `MONGODB_URI` | MongoDB/Atlas connection string |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Session signing and duration |
| `CLIENT_URL` | Comma-separated allowed web origins |
| `CLOUDINARY_*` | Image storage credentials |
| `EMAIL_*` | SMTP transport and sender |
| `COLLEGE_EMAIL_DOMAIN` | Comma-separated allowed domains without `@` |
| `ALLOW_TEST_EMAILS` | Allow arbitrary emails outside production |
| `LISTING_EXPIRY_DAYS` | New report lifetime |
| `MAX_IMAGE_SIZE_MB` | Per-image upload limit |
| `SEED_PASSWORD` | Optional local demo password; required and at least 8 characters for production seeding |

Actual credentials must stay in `.env`; that file is ignored by Git.

## Demo login credentials

When `SEED_PASSWORD` is empty during local development, the seed command uses `CampusFind@2026`. Setting a different value of at least eight characters applies that password to every demo account.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@college.edu` | `CampusFind@2026` |
| Security staff | `security@college.edu` | `CampusFind@2026` |
| Library staff | `library.staff@college.edu` | `CampusFind@2026` |
| Student | `student1@college.edu` | `CampusFind@2026` |
| Additional students | `student2@college.edu` … `student8@college.edu` | `CampusFind@2026` |

The additional student accounts use the same password. The seed command deletes existing data in the configured database, so use a dedicated development database. It loads 30 image-backed reports plus matching, claim, chat, bookmark, notification, and handover examples. The privacy-safe demo photos are served locally from `../frontend/public/demo/items`.

## Matching algorithm

`matchingService.js` is intentionally provider-independent. Same category earns 25 points; colour, brand, location, and a date difference within three days earn 15 each; shared non-trivial description/title keywords earn up to 15. Scores at or above 45 create/update a `Match`, flag both reports, and notify both reporters. Private fields are never inputs returned to suggested-match clients. A future AI/image service can replace or supplement this service without changing controllers.

## Database overview

Core relations are `User → Item`, `Item → Claim`, `Lost Item ↔ Match ↔ Found Item`, `Claim → Chat → Message`, and `Approved Claim → Handover`. Supporting models are Notification, Bookmark, Complaint, Category, CampusLocation, Announcement, Testimonial, Setting, and AdminLog. Text and compound indexes support search, dashboards, ownership lists, expiration, and unread counts. A partial unique index enforces one approved claim per item.

## API, testing, and documentation

- [REST API reference](docs/API.md)
- [Project report content](docs/PROJECT_DOCUMENTATION.md)
- [Mermaid diagrams](docs/DIAGRAMS.md)
- [Automated and manual testing](docs/TESTING.md)
- [Deployment guide](docs/DEPLOYMENT.md)

Run:

```bash
cd backend
npm test
cd ../frontend
npm run lint
npm run build
```

## Screenshots

Add final deployment screenshots here for the college submission:

- Landing page and browse results
- Lost/found report forms
- Possible matches and claim review
- Claim-linked chat and handover OTP
- Student, staff, and admin dashboards
- Mobile navigation and dark mode

## Known limitations

- Keyword matching is deterministic rather than semantic or image-based.
- Email delivery and uploads require external provider credentials.
- The included cron job runs inside one Node process; multi-instance production deployments should use a distributed job runner.
- Contact submissions are stored for support follow-up; production deployments should connect them to the college ticket/email system and define retention.
- WebSocket scale-out needs the Socket.IO Redis adapter when running multiple API instances.

## Future improvements

Add perceptual image similarity, multilingual search, push notifications, college SSO, Redis queues/cache, antivirus scanning, automated moderation, claim-review confidence scoring, inventory barcode hardware, retention/anonymization jobs, and native mobile apps.

## License

This repository is intended for academic demonstration. Review college privacy, retention, and acceptable-use policies before a real deployment.
