# CampusFind Mermaid diagrams

These blocks render in Mermaid-enabled Markdown viewers.

## Use-case diagram

```mermaid
flowchart LR
  Student([Student]) --> Auth((Register / sign in))
  Student --> Report((Report lost/found))
  Student --> Search((Search and filter))
  Student --> Match((View matches))
  Student --> Claim((Submit claim))
  Student --> Chat((Claim-linked chat))
  Student --> Saved((Bookmarks & notifications))
  Student --> Confirm((Confirm handover))

  Staff([College / Security Staff]) --> Security((Record security item))
  Staff --> Verify((Verify claim))
  Staff --> Schedule((Schedule / confirm handover))
  Staff --> Records((View records))

  Admin([Admin]) --> Moderate((Moderate listings / complaints))
  Admin --> Users((Manage users / staff))
  Admin --> Taxonomy((Manage categories / locations))
  Admin --> Verify
  Admin --> Analytics((Analytics / CSV / logs))
  Admin --> Announce((Announcements / settings))

  Report -. includes .-> Duplicate((Duplicate detection))
  Report -. triggers .-> MatchEngine((Matching engine))
  Claim -. creates .-> Chat
  Verify -. enables .-> Schedule
```

## ER diagram

```mermaid
erDiagram
  USER ||--o{ ITEM : reports
  USER ||--o{ CLAIM : submits
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ BOOKMARK : saves
  USER ||--o{ COMPLAINT : reports
  USER ||--o{ ADMIN_LOG : performs
  ITEM ||--o{ CLAIM : receives
  ITEM ||--o{ BOOKMARK : bookmarked_as
  ITEM ||--o{ COMPLAINT : may_have
  ITEM ||--o| HANDOVER : returned_through
  ITEM ||--o{ MATCH : lost_side
  ITEM ||--o{ MATCH : found_side
  CLAIM ||--|| CHAT : opens
  CLAIM ||--o| HANDOVER : authorizes
  CHAT ||--o{ MESSAGE : contains
  CHAT ||--o{ COMPLAINT : may_have
  USER }o--o{ CHAT : participates
  CATEGORY ||--o{ ITEM : classifies
  CAMPUS_LOCATION ||--o{ ITEM : locates

  USER {
    ObjectId id
    string email UK
    string enrollmentNumber UK
    string role
    string accountStatus
    boolean emailVerified
  }
  ITEM {
    ObjectId id
    string reportType
    string category
    string status
    string approvalStatus
    date expiryDate
    ObjectId reporter
  }
  CLAIM {
    ObjectId id
    ObjectId item
    ObjectId claimant
    string status
    string privateAnswers
  }
  MATCH {
    ObjectId lostItem
    ObjectId foundItem
    number matchingScore
    string matchedFields
  }
  CHAT {
    ObjectId claim UK
    ObjectId item
    string status
  }
  MESSAGE {
    ObjectId chat
    ObjectId sender
    string message
    date createdAt
  }
  HANDOVER {
    ObjectId claim UK
    string OTP_hash
    boolean ownerConfirmed
    boolean finderConfirmed
    boolean staffConfirmed
  }
```

## System architecture

```mermaid
flowchart TB
  Browser[React + Vite + Tailwind SPA]
  REST[Express REST API]
  Socket[Socket.IO Gateway]
  Auth[JWT / Roles / Validation Middleware]
  Controllers[Controllers]
  Services[Matching / Notification / Policy Services]
  Cron[Expiry Cron Job]
  Mongo[(MongoDB Atlas)]
  Cloud[(Cloudinary)]
  Mail[(SMTP / Email Provider)]

  Browser <-->|HTTPS JSON + HTTP-only cookie| REST
  Browser <-->|Authenticated WebSocket| Socket
  REST --> Auth --> Controllers --> Services
  Socket --> Auth
  Socket --> Mongo
  Controllers --> Mongo
  Controllers --> Cloud
  Services --> Mail
  Services --> Socket
  Cron --> Mongo
  Cron --> Services
```

## Data-flow diagram

```mermaid
flowchart LR
  Users[Students / Staff / Admin]
  P1[1. Identity & access]
  P2[2. Reporting & discovery]
  P3[3. Matching & claiming]
  P4[4. Communication]
  P5[5. Moderation & handover]
  P6[6. Analytics & export]
  D1[(Users)]
  D2[(Items / Matches)]
  D3[(Claims / Chats / Messages)]
  D4[(Handovers / Complaints / Logs)]
  Images[(Cloudinary)]

  Users <--> P1 <--> D1
  Users <--> P2 <--> D2
  P2 <--> Images
  Users <--> P3
  P3 <--> D2
  P3 <--> D3
  Users <--> P4 <--> D3
  Users <--> P5 <--> D4
  P5 <--> D2
  P5 <--> D3
  P6 --> Users
  D1 --> P6
  D2 --> P6
  D3 --> P6
  D4 --> P6
```

## Lost-item workflow

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> DuplicateWarning: Similar own report
  DuplicateWarning --> Draft: Review
  DuplicateWarning --> PendingApproval: Acknowledge & submit
  Draft --> PendingApproval: Submit
  PendingApproval --> Rejected: Admin rejects
  PendingApproval --> Active: Admin approves
  Active --> PossibleMatch: Matching score >= threshold
  PossibleMatch --> ClaimRequested: Owner claims found counterpart
  Active --> Expired: Expiry job
  Expired --> Active: Owner extends
  Active --> Closed: Owner closes
  ClaimRequested --> Returned: Verified handover
  Returned --> [*]
  Closed --> [*]
  Rejected --> [*]
```

## Found-item workflow

```mermaid
stateDiagram-v2
  [*] --> PendingApproval: Finder / staff submits
  PendingApproval --> Rejected: Admin rejects
  PendingApproval --> Active: Admin approves + QR enabled
  Active --> PossibleMatch: Lost counterpart scores
  PossibleMatch --> ClaimRequested: Claim submitted
  ClaimRequested --> ClaimUnderReview: Staff opens evidence
  ClaimUnderReview --> Active: Claim rejected, no others
  ClaimUnderReview --> ClaimApproved: One claim approved
  ClaimApproved --> HandoverScheduled: Place/date/time + OTP
  HandoverScheduled --> Returned: Owner + finder + staff confirm
  Active --> Expired: Expiry job
  Returned --> [*]
```

## Claim approval workflow

```mermaid
sequenceDiagram
  participant C as Claimant
  participant API as CampusFind API
  participant F as Finder
  participant S as Staff/Admin
  participant DB as MongoDB

  C->>API: Submit private claim + proof + answers
  API->>DB: Validate item/owner/state/uniqueness
  API->>DB: Create Claim and Chat
  API-->>F: In-app/email notification
  S->>API: Open private comparison
  API->>DB: Explicitly select protected fields
  alt Evidence matches and no approved claim
    S->>API: Approve
    API->>DB: Unique approved claim + item status
    API-->>C: Approval notification
  else Evidence insufficient
    S->>API: Reject with reason
    API->>DB: Save rejection and restore item state
    API-->>C: Rejection notification
  end
```

## Handover workflow

```mermaid
sequenceDiagram
  participant O as Verified Owner
  participant F as Finder
  participant S as Staff
  participant API as CampusFind
  participant DB as MongoDB

  O->>API: Schedule approved claim
  API->>DB: Create handover with hashed 6-digit OTP
  API-->>O: One-time collection OTP
  API-->>F: Schedule notification
  O->>S: Presents item claim and OTP
  S->>API: Validate OTP + staff confirmation
  O->>API: OTP + owner confirmation
  F->>API: Finder confirmation
  API->>DB: All confirmations present?
  API->>DB: Mark handover completed and item returned
  API->>DB: Close other pending claims
  API-->>O: Recovery completed notification
  API-->>F: Handover completed notification
```
