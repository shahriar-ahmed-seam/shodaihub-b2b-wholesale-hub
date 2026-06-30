-- Atomic release on cart removal (Deep-Dive 2; Req 7.6).
-- Removes the reservation from the set, decrements reserved_total by its qty, and deletes the hash.
-- Derives the product keys from the hash itself, so the caller only needs the reservation id.
--
-- KEYS[1] = resv:{reservationId} (reservation hash)
-- ARGV[1] = nowMillis
-- Returns the number of units released (0 if the reservation no longer exists).
local hashKey = KEYS[1]
local now = tonumber(ARGV[1])

if redis.call('EXISTS', hashKey) == 0 then
  return 0
end

local qty = tonumber(redis.call('HGET', hashKey, 'qty'))
local member = redis.call('HGET', hashKey, 'member')
local reservedKey = redis.call('HGET', hashKey, 'reservedKey')
local setKey = redis.call('HGET', hashKey, 'setKey')

-- Lazy reconciliation of other expired holds on the same product.
local expired = redis.call('ZRANGEBYSCORE', setKey, '-inf', now)
for _, m in ipairs(expired) do
  if m ~= member then
    local euuid, eqty = string.match(m, '^(.*):(%d+)$')
    if eqty then
      redis.call('DECRBY', reservedKey, tonumber(eqty))
      redis.call('ZREM', setKey, m)
      if euuid then redis.call('DEL', 'resv:' .. euuid) end
    end
  end
end

redis.call('DECRBY', reservedKey, qty)
redis.call('ZREM', setKey, member)
redis.call('DEL', hashKey)
return qty
