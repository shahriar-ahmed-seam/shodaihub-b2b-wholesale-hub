-- Sellable-quantity computation (Deep-Dive 2; Req 6.4, 7.4).
-- Reconciles expired holds first, then returns stock - reserved_total as a consistent snapshot.
--
-- KEYS[1] = product:{id}:stock
-- KEYS[2] = product:{id}:reserved_total
-- KEYS[3] = product:{id}:reservations
-- ARGV[1] = nowMillis
local stockKey = KEYS[1]
local reservedKey = KEYS[2]
local setKey = KEYS[3]
local now = tonumber(ARGV[1])

local expired = redis.call('ZRANGEBYSCORE', setKey, '-inf', now)
for _, m in ipairs(expired) do
  local euuid, eqty = string.match(m, '^(.*):(%d+)$')
  if eqty then
    redis.call('DECRBY', reservedKey, tonumber(eqty))
    redis.call('ZREM', setKey, m)
    if euuid then redis.call('DEL', 'resv:' .. euuid) end
  end
end

local stock = tonumber(redis.call('GET', stockKey) or '0')
local reserved = tonumber(redis.call('GET', reservedKey) or '0')
return stock - reserved
