-- Atomic reservation -> permanent decrement conversion (Deep-Dive 2; Req 6.5, 7.7, 11.9).
-- A reserved unit becomes a permanent stock decrement, preserving reserved_total + decrements <=
-- stock. The persistent PostgreSQL decrement happens in the caller's order transaction; this script
-- keeps the Redis mirror consistent atomically.
--
-- KEYS[1] = product:{id}:stock
-- KEYS[2] = product:{id}:reserved_total
-- KEYS[3] = product:{id}:reservations
-- KEYS[4] = resv:{reservationId}
-- ARGV[1] = qty
-- ARGV[2] = nowMillis
-- Returns {converted(0|1), value}: on success value is the new stock mirror; on failure (expired and
-- current sellable insufficient, Req 11.9) value is the current sellable quantity.
local stockKey = KEYS[1]
local reservedKey = KEYS[2]
local setKey = KEYS[3]
local hashKey = KEYS[4]
local qty = tonumber(ARGV[1])
local now = tonumber(ARGV[2])

local exists = redis.call('EXISTS', hashKey)
local ourMember = nil
if exists == 1 then
  ourMember = redis.call('HGET', hashKey, 'member')
end

-- Lazy reconciliation of expired holds (never touching our own active reservation).
local expired = redis.call('ZRANGEBYSCORE', setKey, '-inf', now)
for _, m in ipairs(expired) do
  if m ~= ourMember then
    local euuid, eqty = string.match(m, '^(.*):(%d+)$')
    if eqty then
      redis.call('DECRBY', reservedKey, tonumber(eqty))
      redis.call('ZREM', setKey, m)
      if euuid then redis.call('DEL', 'resv:' .. euuid) end
    end
  end
end

local stock = tonumber(redis.call('GET', stockKey) or '0')
local reserved = tonumber(redis.call('GET', reservedKey) or '0')

if exists == 1 then
  -- Active reservation: free the hold and apply the permanent decrement. Sellable is conserved.
  redis.call('DECRBY', reservedKey, qty)
  redis.call('ZREM', setKey, ourMember)
  redis.call('DEL', hashKey)
  redis.call('SET', stockKey, stock - qty)
  return { 1, stock - qty }
end

-- Expired reservation: fulfil only if free sellable stock still covers the quantity.
local sellable = stock - reserved
if sellable >= qty then
  redis.call('SET', stockKey, stock - qty)
  return { 1, stock - qty }
end
return { 0, sellable } -- insufficient: caller keeps the sub-orders PENDING for reconciliation (Req 11.9)
