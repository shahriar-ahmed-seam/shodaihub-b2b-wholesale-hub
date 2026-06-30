-- Active expiry reaper for a single product (Deep-Dive 2; Req 7.5).
-- Removes every reservation whose expiry score is <= now, decrements reserved_total by their
-- quantities, deletes their hashes, and returns the number of units reclaimed.
--
-- KEYS[1] = product:{id}:reserved_total
-- KEYS[2] = product:{id}:reservations
-- ARGV[1] = nowMillis
local reservedKey = KEYS[1]
local setKey = KEYS[2]
local now = tonumber(ARGV[1])

local expired = redis.call('ZRANGEBYSCORE', setKey, '-inf', now)
local reclaimed = 0
for _, m in ipairs(expired) do
  local euuid, eqty = string.match(m, '^(.*):(%d+)$')
  if eqty then
    redis.call('DECRBY', reservedKey, tonumber(eqty))
    redis.call('ZREM', setKey, m)
    if euuid then redis.call('DEL', 'resv:' .. euuid) end
    reclaimed = reclaimed + tonumber(eqty)
  end
end
return reclaimed
