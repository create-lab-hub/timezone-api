# Simple Time Zone API (DST-aware)

**What it is**  
A small, polished Time Zone API that returns current time, DST info, and converts between time zones.  
No authentication. No database. Ready to deploy to Render / Heroku / any Node host.

**Features**
- `/time?zone=<TZ>` — current time and DST details for a timezone (IANA tz names, e.g. `Africa/Lagos`).
- `/timezones` — list of all IANA timezone names.
- `/convert?from=<TZ>&to=<TZ>&time=<ISO>` — convert a timestamp from one timezone to another.
- `/health` — simple health check.
- Lightweight in-memory cache and rate limiting for basic protection.

## Quick start (local)

1. Clone or download this project.
2. Install dependencies:

```bash
npm install
```

3. Run locally:
```bash
npm start
```
By default it runs on port 3000. Change with `PORT` env var.

## Endpoints & Examples

**Get time (DST-aware)**
```
GET /time?zone=Europe/London
```
Response:
```json
{
  "timezone": "Europe/London",
  "datetime": "2025-10-19T17:00:00.000Z",
  "formatted": "2025-10-19T18:00:00+01:00",
  "utc_offset": "+01:00",
  "day_of_week": "Sunday",
  "is_dst": true,
  "dst_offset": "+01:00",
  "next_dst_change": "2025-10-26T01:00:00.000Z"
}
```

**List timezones**
```
GET /timezones
```

**Convert**
```
GET /convert?from=UTC&to=Asia/Tokyo&time=2025-10-19T14:00:00Z
```

## Deployment (Render.com)
1. Create a GitHub repo and push this project.
2. Sign up / log in to https://render.com.
3. Choose "New" → "Web Service" and connect your GitHub repo.
4. Set a name (e.g., `timezone-api`), branch (main), and start command `npm start`.
5. Add environment variables if needed (e.g., `PORT`, `RATE_MAX`, `RATE_WINDOW_MS`).
6. Click "Create Web Service" — Render will build and deploy automatically.

## RapidAPI publishing (brief)
1. Deploy your app and get the public base URL (e.g., `https://timezone-api.onrender.com`).
2. Create a RapidAPI provider account and go to the Hub.
3. Add a new API listing and set base URL and endpoints (`/time`, `/timezones`, `/convert`).
4. Add clear docs, a free tier (e.g., 100 req/month) and a starter paid tier (e.g., $1/month).
5. Test endpoints in RapidAPI console and publish.

## Notes & Tips
- Uses IANA timezone names (from moment-timezone).
- No persistent storage — suitable for small-scale public API.
- If you need higher throughput or persistence for usage analytics, integrate a DB later.

## License
MIT
