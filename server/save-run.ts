// Atomic updates keep the best score, profile and recovery record together.
// Leaderboard keys have no TTL. Game sessions expire; records do not.
export const SAVE_RUN_SCRIPT = `
local raw=redis.call('GET',KEYS[1]); if not raw then return -1 end
local old=cjson.decode(raw)
if old.state.turn~=tonumber(ARGV[1]) or old.lastRequest~=ARGV[2] then return -2 end
local next=cjson.decode(ARGV[3])
if next.finished and redis.call('GET',KEYS[4])~=ARGV[5] then return -3 end
redis.call('SET',KEYS[1],ARGV[3],'EX',tonumber(ARGV[4]))
if next.finished and next.state.score>0 then
  local previous=redis.call('ZSCORE',KEYS[2],ARGV[5])
  if not previous or next.state.score>tonumber(previous) then
    redis.call('ZADD',KEYS[2],next.state.score,ARGV[5])
    redis.call('HSET',KEYS[3],ARGV[5],ARGV[6])
    redis.call('HSET',KEYS[5],ARGV[5],cjson.encode({score=next.state.score,profile=cjson.decode(ARGV[6]),runId=KEYS[1]}))
  end
end
return next.state.turn`;
