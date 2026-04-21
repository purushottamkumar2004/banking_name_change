// backend/src/middleware/security.js
// Security middleware: rate limiting and basic request sanitisation.
// Protects the API from abuse without requiring heavy dependencies.

/**
 * Simple in-memory rate limiter.
 * In production use Redis-backed rate limiting (e.g. rate-limiter-flexible).
 *
 * @param {Object} opts
 * @param {number} opts.windowMs   - Time window in milliseconds
 * @param {number} opts.max        - Max requests per window per IP
 * @param {string} opts.message    - Error message when limit exceeded
 */
function rateLimit({ windowMs = 60_000, max = 30, message = 'Too many requests' } = {}) {
  const store = new Map();  // ip → { count, resetAt }

  // Clean up stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of store.entries()) {
      if (now > data.resetAt) store.delete(ip);
    }
  }, 5 * 60_000);

  return (req, res, next) => {
    const ip    = req.ip || req.socket.remoteAddress || 'unknown';
    const now   = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: message, retry_after_seconds: retryAfter });
    }

    entry.count++;
    next();
  };
}

/**
 * Sets basic security headers.
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Remove fingerprinting header
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Validates that UUID path params are valid UUIDs.
 */
function validateUUID(paramName = 'id') {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return (req, res, next) => {
    const val = req.params[paramName];
    if (!val || !UUID_REGEX.test(val)) {
      return res.status(400).json({ error: `Invalid ${paramName}: must be a valid UUID` });
    }
    next();
  };
}

module.exports = { rateLimit, securityHeaders, validateUUID };
