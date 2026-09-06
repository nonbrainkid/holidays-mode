import assert from 'node:assert/strict';
import {test} from 'node:test';
import {completionScore,readPassport,saveCompletion,unlockedThrough,destinationStats,validDay,formatTime,mergePassports,parsePassport} from '../lib/passport.ts';
const entry=(stop='bali',seconds=100,day='2026-09-06')=>({day,stop,seconds,score:completionScore(seconds)});

test('time bonus has a ceiling and a floor; there is no timeout',()=>{
  assert.equal(completionScore(0),1600);
  assert.equal(completionScore(119),1005);
  assert.equal(completionScore(120),1000);
  assert.equal(completionScore(7200),1000);
  assert.throws(()=>completionScore(NaN));
  assert.throws(()=>completionScore(-1));
});
test('destination unlocks follow the route, not the number of arbitrary stamps',()=>{
  assert.equal(unlockedThrough([]),0);
  assert.equal(unlockedThrough([entry('rio')]),0);
  assert.equal(unlockedThrough([entry('bali')]),1);
  assert.equal(unlockedThrough([entry('bali'),entry('tokyo')]),2);
  assert.equal(unlockedThrough([entry('bali'),entry('tokyo'),entry('ibiza')]),3);
});
test('replaying one daily puzzle updates the best without inflating completion count',()=>{
  let data=saveCompletion([],entry('bali',100));
  assert.equal(saveCompletion(data,entry('bali',110)),data);
  data=saveCompletion(data,entry('bali',80));
  assert.equal(data.length,1);assert.equal(data[0].score,1200);
  data=saveCompletion(data,entry('bali',130,'2026-09-07'));
  assert.deepEqual(destinationStats(data,'bali'),{completed:2,best:1200,fastest:80});
});
test('corrupt storage cannot crash or load impossible scores and dates',()=>{
  const good=entry();
  const data=readPassport([null,{},good,{...good,score:999999},{...good,stop:'maldives'},{...good,day:'2026-02-31'},{...good,seconds:-1},{...good,seconds:Infinity},{...good,seconds:2.5}]);
  assert.deepEqual(data,[good]);
  assert.deepEqual(readPassport({entries:[good]}),[]);
  assert.equal(validDay('2026-02-31'),false);
  assert.equal(validDay('2024-02-29'),true);
  assert.equal(formatTime(125),'02:05');
});
test('a stale tab cannot remove another tab’s stamp when passports merge',()=>{
  const tabA=[entry('bali',90),entry('tokyo',130)];
  const tabB=[entry('bali',100)];
  const merged=mergePassports(tabA,tabB);
  assert.equal(merged.length,2);
  assert.equal(unlockedThrough(merged),2);
  assert.equal(merged.find(r=>r.stop==='bali').seconds,90);
  assert.deepEqual(mergePassports(tabB,tabA),merged);
  assert.deepEqual(mergePassports(merged,merged),merged);
  assert.deepEqual(parsePassport('{bad json'),[]);
});
