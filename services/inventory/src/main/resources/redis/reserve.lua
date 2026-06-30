-- Atomic reserve (Deep-Dive 2; Req 7.1, 7.2, 7.3, 7.8, 18.4).
-- Executed by Redis as a single EVAL so no other command interleaves: this is the atomicity
-- boundary, replacing any check-then-act logic in Java.
--
-- KEYS[1] = product:{id}:stock          (available-stock mirror)
-- KEYS[2] = product:{id}:reserved_total (currently-reserved counter)
-- KEYS[3] = product:{id}:reservations   (sorted set of "{reservationId}:{qty}" scored by expiry)
-- KEYS[4] = resv:{reservationId}         (reservation hash)
-- ARGV[1] = qty
-- ARGV[2] = reservationId
-- ARGV[3] = retailerId
-- ARGV[4] = ttlMillis
-- ARGV[5] = nowMillis
-- ARGV[6] = productId
-- Returns {granted(0|1), sellable}: on grant, sellable is the remaining sellable quantity AFTER the
-- grant; on reject, sellable is the current sellable quantity (Req 7.2).
local stockKey = KEYS[1]
local reservedKey = KEYS[2]
local setKey = KEYS[3]
local hashKey = KEYS[4]
local qty = tonumber(ARGV[1])
local reservationId = ARGV[2]
local retailerId = ARGV[3]
local ttl = tonumber(ARGV[4])
local now = tonumber(ARGV[5])
local productId = ARGV[6]

-- Lazy reconciliation: drop expired entries and subtract their quantities from reserved_total
-- BEFORE evaluating sellable, so an expired hold never blocks a new reservation.
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
local sellable = stock - reserved
if qty > sellable then
  return { 0, sellable } -- reject; return current sellable (Req 7.2, 7.8)
end

local expiresAt = now + ttl
local member = reservationId .. ':' .. qty
redis.call('INCRBY', reservedKey, qty)
redis.call('ZADD', setKey, expiresAt, member)
redis.call(
  'HSET', hashKey,
  'productId', productId,
  'retailerId', retailerId,
  'qty', qty,
  'renewals', 0,
  'expiresAt', expiresAt,
  'member', member,
  'stockKey', stockKey,
  'reservedKey', reservedKey,
  'setKey', setKey)
redis.call('PEXPIRE', hashKey, ttl)
return { 1, sellable - qty } -- granted (Req 7.1)
