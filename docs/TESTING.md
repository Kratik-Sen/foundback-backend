# Testing strategy and checklist

## Automated tests

The backend uses Vitest and Supertest. The suite covers health/error API behavior, registration and item validation, role authorization, privacy serializers, weighted matching, claim/listing policies, the unique approved-claim index, and handover OTP verification.

```bash
npm test
npm run lint
npm run build
```

For integration testing against MongoDB, create a dedicated test database, seed it, and exercise routes with Supertest or an API client. Never point destructive seed/test commands at production.

## Manual testing checklist

### Authentication

- [ ] Approved college email can register as `student`; submitted `role` is ignored.
- [ ] Disallowed domain fails in production mode.
- [ ] Duplicate email and enrollment number fail.
- [ ] Password shorter than eight characters and mismatched confirmation fail.
- [ ] Valid verification and reset links work once and expire.
- [ ] Login sets an HTTP-only cookie; logout clears it.
- [ ] Repeated wrong logins trigger rate limiting.
- [ ] Blocked user cannot log in or open an existing authenticated route.
- [ ] Student cannot access any `/api/admin` or admin UI route.

### Reports, search, and privacy

- [ ] Lost date in the future, short title/description, invalid image type, or oversized image fails.
- [ ] Duplicate report warning appears and requires explicit confirmation.
- [ ] A valid new report appears publicly immediately.
- [ ] Expired listing does not appear active; owner can extend it.
- [ ] Search, report type, category, location, date, security-office, sort, and pagination filters combine correctly.
- [ ] User cannot edit/delete another user’s listing.
- [ ] Editing a student listing keeps it published and refreshes matching.
- [ ] Deleting a listing also removes Cloudinary assets, bookmarks, and match links.
- [ ] Public JSON never includes unique marks, private details, phone/email, finder answers, serial data, password/token fields, or OTP hashes.
- [ ] Published found item generates a QR that opens a privacy-safe page.

### Matching and claims

- [ ] Same category, colour, brand, location, nearby date, and keywords produce expected score.
- [ ] Match notification appears for both reporters.
- [ ] User cannot claim their own found report.
- [ ] Returned, closed, expired, rejected, already-approved, or handover-scheduled item refuses new claims.
- [ ] All finder questions require answers.
- [ ] Claim creates exactly one participant chat.
- [ ] Staff sees private comparison data; public item callers do not.
- [ ] Only one claim per claimant/item exists and only one claim per item can be approved.
- [ ] Rejection requires a reason and notifies claimant.

### Chat, complaint, handover

- [ ] Non-participant cannot open/join a chat room.
- [ ] New text/image message arrives in real time with timestamp.
- [ ] Typing, read markers, block/unblock, and reported-chat controls work.
- [ ] Reporting chat makes its messages available for admin complaint review.
- [ ] Approved claim can schedule one handover and returns a six-digit OTP once.
- [ ] Wrong handover OTP is rejected.
- [ ] Owner, finder, and staff confirmations are all required.
- [ ] Successful handover marks item returned and closes other pending claims.
- [ ] Returned item no longer accepts claims.

### Admin and UX

- [ ] Admin can create staff, block/unblock users, approve/reject listings, and resolve complaints.
- [ ] Used category cannot be deleted; it can be disabled.
- [ ] Announcements create recipient notifications.
- [ ] Dashboard charts reflect seeded data and CSV opens correctly in spreadsheet software.
- [ ] Destructive actions show confirmation.
- [ ] Loading, success, error, and empty states render on mobile, tablet, and desktop.
- [ ] Keyboard focus, labels, contrast, light mode, dark mode, mobile sidebar, and print view are usable.
