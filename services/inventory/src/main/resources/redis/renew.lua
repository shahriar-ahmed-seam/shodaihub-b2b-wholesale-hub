-- Atomic renewal with cap (Deep-Dive 2; Req 7.9, 7.10).
-- When renewals < cap: increment the renewal count, set expiry to now + ttl, update the set score
-- and PEXPIRE, return success. When renewals == cap: reject and retain the existing expiry.
--
-- KEYS[1] = resv:{reservationId} (reservation hash)
-- ARGV[1] = ttlMillis
-- ARGV[2] = nowMillis
-- ARGV[3] = maxRenewals
-- Returns {renewed(0|1), renewals, expiresAt}; {0,-1,-1} when the reservation no longer exists.
local hashKey = KEYS[1]
local ttl = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local cap = tonumber(ARGV[3])

if redis.call('EXISTS', hashKey) == 0 then
  return { 0, -1, -1 }
end

local renewals = tonumber(redis.call('HGET', hashKey, 'renewals'))
local member = redis.call('HGET', hashKey, 'member')
local setKey = redis.call('HGET', hashKey, 'setKey')
local expiresAt = tonumber(redis.call('HGET', hashKey, 'expiresAt'))

if renewals >= cap then
  return { 0, renewals, expiresAt } -- reject; retain existing expiry (Req 7.10)
end

local newExpires = now + ttl
local newRenewals = renewals + 1
redis.call('HSET', hashKey, 'renewals', newRenewals, 'expiresAt', newExpires)
redis.call('ZADD', setKey, newExpires, member)
redis.call('PEXPIRE', hashKey, ttl)
return { 1, newRenewals, newExpires } -- renewed (Req 7.9)
