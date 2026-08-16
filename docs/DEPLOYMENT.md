# Deployment guide

## Production services

1. Create a MongoDB Atlas cluster, least-privilege database user, network rules, backups, and monitoring.
2. Create a Cloudinary folder/account with upload constraints.
3. Configure a transactional SMTP provider or Resend-compatible SMTP relay.
4. Deploy `backend` to a Node host that supports WebSockets (Render, Railway, Fly.io, Azure, AWS, etc.).
5. Build `frontend` and deploy `frontend/dist` to a static host/CDN.

## Backend

Set every environment variable from `.env.example`, use a 32+ byte random JWT secret, set `NODE_ENV=production`, set `CLIENT_URL` to the exact HTTPS frontend origin, and start with:

```bash
npm install --omit=dev
npm start --workspace backend
```

Terminate TLS at the platform/load balancer, preserve WebSocket upgrades, enable health checks at `/api/health`, and forward the correct proxy IP. Do not run the seed command against production. Create the first admin through a controlled migration or a one-time secured seed database.

For multiple API replicas, move the expiry job to a singleton worker and configure Socket.IO’s Redis adapter. Use centralized logs and alerts for 5xx rates, rejected uploads, authentication throttling, database connections, and email failures.

## Frontend

Set `VITE_API_URL` to the public API URL ending in `/api` and `VITE_SOCKET_URL` to its HTTPS origin, then:

```bash
npm run build --workspace frontend
```

Serve `dist` with SPA fallback to `index.html`, immutable caching for hashed assets, no caching for HTML, HTTPS, and an appropriate Content Security Policy. If the API is on another site, confirm cross-site cookie settings, CORS origin, credentials, and modern browser third-party-cookie constraints. A same-site reverse proxy is preferred.

## Production hardening

- Restrict Atlas/Cloudinary/SMTP credentials and rotate them periodically.
- Add malware scanning for evidence attachments and content moderation for user images.
- Configure retention/anonymization for private claim evidence, chat, logs, and completed handovers.
- Review college consent, grievance, audit-access, and data-export policies.
- Add Redis-backed rate limits and queues for email/matching work at scale.
- Run tests, dependency audit, backups/restore drill, and an authorization review before launch.
