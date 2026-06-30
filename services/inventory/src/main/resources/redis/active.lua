-- Atomic reservation liveness check used at checkout (Deep-Dive 3; Req 10.4).
-- A reservation is active iff its hash still exists and its recorded expiry is strictly in the
-- future relative to the supplied clock. The check is read-only and does not mutate any state.
--
-- KEYS[1] = resv:{reservationId} (reservation hash)
-- ARGV[1] = nowMillis
-- Returns 1 when the reservation is active, 0 otherwise.
local hashKey = KEYS[1]
local now = tonumber(ARGV[1])

if redis.call('EXISTS', hashKey) == 0 then
  return 0
end

local expiresAt = redis.call('HGET', hashKey, 'expiresAt')
if not expiresAt then
  return 0
end
if tonumber(expiresAt) <= now then
  return 0
end
return 1
