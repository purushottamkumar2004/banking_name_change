// frontend/src/hooks/usePolling.js
// Generic hook that calls a fetch function on an interval and stops
// automatically when a terminal condition is met.

import { useState, useEffect, useRef, useCallback } from 'react';

const TERMINAL_STATUSES = new Set([
  'AI_VERIFIED_PENDING_HUMAN',
  'APPROVED',
  'REJECTED',
  'FAILED',
]);

/**
 * Polls `fetchFn` every `intervalMs` milliseconds.
 * Stops when the returned data has a terminal status, or after `maxAttempts`.
 *
 * @param {Function} fetchFn       - Async function that returns { status, ...data }
 * @param {number}   intervalMs    - Poll interval (default 3000ms)
 * @param {number}   maxAttempts   - Give up after this many polls (default 60 = 3 min)
 */
export function usePolling(fetchFn, intervalMs = 3000, maxAttempts = 60) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const attempts                = useRef(0);
  const timerRef                = useRef(null);

  const poll = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setLoading(false);

      const status = result?.request?.status || result?.status;

      // Stop polling when terminal state reached
      if (TERMINAL_STATUSES.has(status)) {
        clearInterval(timerRef.current);
        return;
      }

      attempts.current++;
      if (attempts.current >= maxAttempts) {
        clearInterval(timerRef.current);
        setError('Processing timed out — please refresh the page.');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      clearInterval(timerRef.current);
    }
  }, [fetchFn, maxAttempts]);

  useEffect(() => {
    poll();  // immediate first fetch
    timerRef.current = setInterval(poll, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [poll, intervalMs]);

  const refresh = useCallback(() => {
    attempts.current = 0;
    setLoading(true);
    setError(null);
    poll();
  }, [poll]);

  return { data, loading, error, refresh };
}
