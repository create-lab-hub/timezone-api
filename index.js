import express from 'express';
import moment from 'moment-timezone';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'Simple Time Zone API (DST-aware)';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10_000); // 10s default for simple in-memory cache

// Basic middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('tiny'));
app.use(express.json());

// Light rate limiter (configurable by env)
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_WINDOW_MS || 60_000), // 1 minute
  max: Number(process.env.RATE_MAX || 120), // limit each IP to 120 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Simple in-memory cache to reduce CPU for repeated calls (no DB)
const cache = new Map();
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
function setCache(key, value, ttl = CACHE_TTL_MS) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, time: new Date().toISOString() });
});

// List all timezones
app.get('/timezones', (req, res) => {
  const key = 'timezones_list';
  const cached = getFromCache(key);
  if (cached) return res.json(cached);

  const names = moment.tz.names();
  setCache(key, names, 60_000); // cache for 60s
  res.json(names);
});

// Get current time for a zone (DST-aware)
app.get('/time', (req, res) => {
  const zone = req.query.zone;
  if (!zone) return res.status(400).json({ error: "Missing required query parameter 'zone'" });

  const key = `time::${zone}`;
  const cached = getFromCache(key);
  if (cached) return res.json(cached);

  try {
    if (!moment.tz.zone(zone)) {
      return res.status(400).json({ error: 'Invalid time zone identifier' });
    }

    const now = moment().tz(zone);
    const isDST = now.isDST();

    // Find next DST change within next 370 days
    let nextChange = null;
    const limit = moment().add(370, 'days');
    let cursor = now.clone();
    const stepMinutes = 60 * 6; // check every 6 hours to be faster but accurate
    while (cursor.isBefore(limit)) {
      const future = cursor.clone().add(stepMinutes, 'minutes');
      if (future.isDST() !== now.isDST()) {
        // walk back to find closer change
        let left = cursor.clone();
        let right = future.clone();
        while (right.diff(left, 'minutes') > 1) {
          const mid = moment(left).add(Math.floor(right.diff(left, 'minutes') / 2), 'minutes');
          if (mid.isDST() === now.isDST()) left = mid;
          else right = mid;
        }
        nextChange = right.toISOString();
        break;
      }
      cursor = future;
    }

    const payload = {
      timezone: zone,
      datetime: now.toISOString(),
      formatted: now.format(),
      utc_offset: now.format('Z'),
      day_of_week: now.format('dddd'),
      is_dst: isDST,
      dst_offset: isDST ? now.format('Z') : null,
      next_dst_change: nextChange // null if none found in the next year
    };

    setCache(key, payload);
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Convert time between zones
app.get('/convert', (req, res) => {
  const from = req.query.from;
  const to = req.query.to;
  const time = req.query.time; // ISO string or moment-parsable

  if (!from || !to || !time) {
    return res.status(400).json({ error: "Missing parameters. Required: 'from', 'to', 'time' (ISO string)" });
  }

  const key = `convert::${from}::${to}::${time}`;
  const cached = getFromCache(key);
  if (cached) return res.json(cached);

  try {
    if (!moment.tz.zone(from) || !moment.tz.zone(to)) {
      return res.status(400).json({ error: 'Invalid time zone identifier for from or to' });
    }

    const parsed = moment.tz(time, from);
    if (!parsed.isValid()) {
      return res.status(400).json({ error: 'Invalid time format. Use ISO 8601 or parsable string.' });
    }

    const converted = parsed.clone().tz(to);
    const payload = {
      from,
      to,
      input_time: parsed.toISOString(),
      input_formatted: parsed.format(),
      converted_time: converted.toISOString(),
      converted_formatted: converted.format(),
      is_dst_in_target: converted.isDST(),
      utc_offset_target: converted.format('Z')
    };

    setCache(key, payload);
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Basic usage page (README short)
app.get('/', (req, res) => {
  res.type('text').send(
    SERVICE_NAME + '\n\n' +
    'Endpoints:\n' +
    'GET /time?zone=Africa/Lagos\n' +
    'GET /timezones\n' +
    'GET /convert?from=UTC&to=Asia/Tokyo&time=2025-10-19T14:00:00Z\n' +
    'GET /health\n'
  );
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`â ${SERVICE_NAME} running on port ${PORT}`);
});