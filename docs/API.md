# CampusFind REST API

Base URL: `/api`. Successful JSON responses include `success: true`; operational failures include `success: false` and `message`. Validation failures also include `errors`. Authentication uses the `campusfind_token` HTTP-only cookie; `Authorization: Bearer <token>` is supported for non-browser clients.

## Public and authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/public/home` | Landing stats, recent reports, announcements, testimonials |
| GET | `/public/metadata` | Active categories, locations, public settings |
| POST | `/public/contact` | Validate and persist a support message |
| POST | `/auth/register` | Create student account and email token |
| POST | `/auth/login` | Set HTTP-only session cookie |
| POST | `/auth/logout` | Clear session cookie |
| POST | `/auth/verify-email` | Verify raw one-time email token |
| POST | `/auth/forgot-password` | Send generic reset response/link |
| POST | `/auth/reset-password` | Validate token and replace password |
| GET | `/auth/me` | Current user |
| PATCH | `/auth/profile` | Update permitted profile fields |
| PATCH | `/auth/change-password` | Verify current password and change it |

## Items

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/items` | Public | Published, active, unexpired items; search/filter/page |
| POST | `/items` | User | Publish a multipart lost/found report; optional images |
| GET | `/items/mine` | User | Own reports and workflow statuses |
| GET | `/items/matches` | User | Match pairs involving own reports |
| GET | `/items/bookmarks` | User | Saved items |
| GET | `/items/:id` | Optional user | Public safe view or owner/staff private view |
| PATCH/DELETE | `/items/:id` | Owner/admin | Update/publish or delete with Cloudinary cleanup |
| POST/DELETE | `/items/:id/bookmark` | User | Save/remove item |
| POST | `/items/:id/extend` | Owner | Refresh expiry |
| PATCH | `/items/:id/recovered` | Owner/admin | Mark returned or closed |
| GET | `/items/:id/qr` | Public | Privacy-safe approved found-item QR data URL |

Search query parameters: `search`, `type`, `category`, `location`, `status`, `securityOffice`, `from`, `to`, `sort`, `page`, and `limit`.

## Claims, chat, notifications, complaints, handovers

| Method | Path | Purpose |
|---|---|---|
| POST | `/claims/item/:itemId` | Submit multipart private ownership claim and create chat |
| GET | `/claims/mine` | Claimant history |
| GET | `/claims` | Staff/admin review queue |
| GET | `/claims/item/:itemId` | Reporter/staff item claims |
| GET | `/claims/:id` | Authorized claim detail |
| PATCH | `/claims/:id/review` | Staff/admin approve or reject |
| PATCH | `/claims/:id/cancel` | Claimant cancellation before decision |
| GET | `/chats` | Participant chats |
| GET | `/chats/:id/messages` | Paginated messages |
| POST | `/chats/:id/messages` | Text/image message; emits Socket.IO event |
| PATCH | `/chats/:id/read` | Mark messages read |
| PATCH | `/chats/:id/block` | Toggle chat block |
| GET | `/notifications` | Paginated notifications and unread count |
| PATCH | `/notifications/read-all` | Mark all read |
| PATCH | `/notifications/:id/read` | Mark one read |
| DELETE | `/notifications/:id` | Delete own notification |
| POST | `/complaints` | Report listing, claim, user, or chat |
| GET | `/complaints/mine` | Own complaint history |
| POST | `/handovers` | Schedule from approved claim and generate OTP |
| GET | `/handovers` | Participant or staff records |
| PATCH | `/handovers/:id/confirm` | Owner/finder/staff confirmation; OTP when required |

Socket events: `chat:join`, `typing:start`, `typing:stop`, `message:send`, `message:new`, `messages:read`, and `notification:new`. Every socket handshake validates JWT and account status; each chat-room join checks participant/admin access.

## Dashboards and admin

`GET /dashboard/student`, `/dashboard/staff`, and `/dashboard/admin` return role-specific statistics. Admin-only routes under `/admin` cover `users`, `items`, `claims`, `complaints`, `categories`, `locations`, `announcements`, `logs`, `settings`, dashboard `stats`, and `/export/items.csv`. Mutating routes write an `AdminLog` where applicable.

The admin support inbox is available through `GET /admin/contact-messages` and `PATCH /admin/contact-messages/:id`.

## Example item report

Multipart fields include `reportType`, `title`, `category`, `description`, `date`, `location`, optional public fields, JSON-stringified `privacy`, JSON-stringified `verificationQuestions`, and up to six `images`. If duplicate detection returns HTTP 409 with `code: POSSIBLE_DUPLICATES`, show the returned summaries and resubmit with `duplicateAcknowledged=true` only after user confirmation.
