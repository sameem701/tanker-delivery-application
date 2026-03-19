const phoneRateStore = new Map();

const cleanupExpired = (entry, now) => {
  if (!entry || now > entry.resetAt) {
    return null;
  }
  return entry;
};

const createPhoneRateLimiter = ({ windowMs, max, keyName, message }) => {
  return (req, res, next) => {
    const rawPhone = (req.body?.phone || req.body?.phone_number || '').toString().trim();
    const key = rawPhone || '__missing_phone__';
    const now = Date.now();

    let entry = cleanupExpired(phoneRateStore.get(keyName + ':' + key), now);
    if (!entry) {
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
    }

    entry.count += 1;
    phoneRateStore.set(keyName + ':' + key, entry);

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        message,
        retry_after_seconds: retryAfterSeconds
      });
    }

    return next();
  };
};

module.exports = {
  createPhoneRateLimiter
};
