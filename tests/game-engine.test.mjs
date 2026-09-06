import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BLOCKS,PIECES,boardFor,canPlace,dailyBlocks,rotate,scoreFor} from '../lib/game-engine.ts';

function solve(blocks){
  const options=new Map(PIECES.map(piece=>[piece.id,[0,1,2,3].map(rotation=>({rotation,cells:rotate(piece.cells,rotation)})).filter((v,i,all)=>all.findIndex(p=>JSON.stringify(p.cells.slice().sort())===JSON.stringify(v.cells.slice().sort()))===i)]));
  function visit(placements,remaining){
    if(!remaining.length)return placements;
    const board=boardFor(placements,blocks),first=board.findIndex(c=>c===null);
    const fx=first%6,fy=Math.floor(first/6);
    for(const piece of remaining){
      for(const {rotation,cells}of options.get(piece.id)){
        for(const [dx,dy]of cells){
          const x=fx-dx,y=fy-dy;
          if(!canPlace(placements,piece.id,x,y,rotation,blocks))continue;
          const solution=visit([...placements,{id:piece.id,x,y,rotation}],remaining.filter(p=>p.id!==piece.id));
          if(solution)return solution;
        }
      }
    }
    return null;
  }
  return visit([],PIECES.slice().sort((a,b)=>b.cells.length-a.cells.length));
}
test('rotations preserve shape and normalise origin',()=>{
  for(const p of PIECES)for(let r=0;r<4;r++){
    const cells=rotate(p.cells,r);assert.equal(cells.length,p.cells.length);
    assert.equal(new Set(cells.map(String)).size,p.cells.length);
    assert.equal(Math.min(...cells.map(c=>c[0])),0);assert.equal(Math.min(...cells.map(c=>c[1])),0);
  }
});
test('bounds, occupied squares, reserved space and duplicate pieces reject moves',()=>{
  const first={id:'camera',x:0,y:0,rotation:0};
  assert.equal(canPlace([],'camera',5,5,0),false);
  assert.equal(canPlace([],'camera',-1,0,0),false);
  assert.equal(canPlace([],'camera',0.5,0,0),false);
  assert.equal(canPlace([],'missing',0,0,0),false);
  assert.equal(canPlace([],'camera',0,0,0,[0]),false);
  assert.equal(canPlace([first],'camera',3,3,0),false);
  assert.equal(canPlace([first],'shirt',0,0,0),false);
  assert.throws(()=>boardFor([first,first]));
});
test('score is derived from placed cells, not client score fields',()=>{
  assert.equal(canPlace([],'phones',2,2,0,BLOCKS[4]),true,'A shape may have an empty bounding-box anchor');
  assert.equal(scoreFor([],[0,1,6,7]),0);
  assert.equal(scoreFor([{id:'camera',x:0,y:0,rotation:0}]),100);
  assert.throws(()=>scoreFor([{id:'unknown',x:0,y:0,rotation:0}]));
});
test('every shipped daily layout has a full 1000-point solution',()=>{
  for(const blocks of BLOCKS){const solution=solve(blocks);assert.ok(solution,'Unsolvable '+blocks);assert.equal(solution.length,8);assert.equal(scoreFor(solution,blocks),1000);assert.equal(boardFor(solution,blocks).filter(c=>c===null).length,0);}
});
test('shared UTC day and destination reproduce a challenge',()=>{
  assert.deepEqual(dailyBlocks('2026-09-05',2),dailyBlocks('2026-09-05',2));
  assert.notDeepEqual(dailyBlocks('2026-09-05',2),dailyBlocks('2026-09-05',3));
});
