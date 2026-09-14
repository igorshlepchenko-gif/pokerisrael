// PokerIsrael – GGPoker/WSOP Broadcast Style
// Canvas 760×480, 30fps, WebM VP9
import { getAllInLockStreet, getContributions, getUncalledReturn } from './handPots';
import { seatsFor, minPlayersFor } from './pokerPositions';
import { resequenceHandActions } from './actionOrder';

// 16:9 so the action log gets its own full-height column beside the table
// instead of floating over the seats — 760×480 had no room for both, and the
// log covered whichever players sat in its corner.
const W = 960, H = 540;
const HUD_H = 42;
const PANEL_W = 210;     // left column: action log on top, pot at the bottom
const POT_BOX_H = 74;
const TCX = PANEL_W + (W - PANEL_W) / 2, TCY = HUD_H + (H - HUD_H) / 2 + 2;
const TRX = 262, TRY = 124;     // felt
const SEAT_RX = 318, SEAT_RY = 182; // avatar centres, around the rail
const AVATAR_R = 36;     // room for the player's name and stack inside the circle

const SUIT_SYM   = { s:'♠', h:'♥', d:'♦', c:'♣' };
const SUIT_COLOR = { s:'#1e293b', h:'#dc2626', d:'#dc2626', c:'#1e293b' };
// Seat angles come from the seats actually at this table, not a fixed map. The
// old map had eight seats and no LJ/MP+1, so a 9-handed LJ fell back to 0° and
// was drawn right of the table, next to the button — out of clockwise order.
// Anchored at the button (38°), which keeps an 8-handed table where it was.
function seatAngles(playersCount){
  const seats=seatsFor(playersCount), n=seats.length, deg={};
  seats.forEach((s,i)=>{ deg[s]=(38+((i+1)/n)*360)%360; });
  return deg;
}
let SEAT_DEG = seatAngles(8);

// Each player's colour — avatar fill and their name in the action log. Set per
// hand in buildFrames, keyed by seat (unique within a hand).
const HERO_COLOR='#2563eb';
const PLAYER_PALETTE=['#dc2626','#16a34a','#9333ea','#ea580c','#0891b2','#ca8a04','#db2777','#4f46e5','#65a30d'];
let SEAT_COLOR = {};

// Counts frames as they're drawn (reset per hand in buildFrames), so effects
// like the ALL IN pulse are driven by the video's own timeline — not the wall
// clock, which the encoder runs faster or slower than.
let FRAME_NO = 0;

// "ALL IN" tag straddling the top of the avatar ring, pulsing, from the moment
// the player moves all-in until the end of the hand — on exactly the players
// who are all-in, instead of a "everyone's all-in" banner that usually wasn't true.
function allInTagBox(pos){ const a=seatOuter(pos); return{x:a.x-24,y:a.y-AVATAR_R-8,w:48,h:16}; }
function allInPositions(events){
  return new Set((events||[]).filter(e=>e.action==='allin'&&e.pos).map(e=>e.pos));
}
function drawAllInTags(ctx,positions){
  if(!positions||!positions.size) return;
  const pulse=0.5+0.5*Math.abs(Math.sin(FRAME_NO*Math.PI/15)); // ~1s cycle at 30fps
  positions.forEach(pos=>{
    const b=allInTagBox(pos);
    ctx.save();
    setSh(ctx,`rgba(244,63,94,${0.9*pulse})`,6+10*pulse);
    ctx.globalAlpha=0.55+0.45*pulse;
    rr(ctx,b.x,b.y,b.w,b.h,5,'#e11d48','#fecdd3',1);
    clrSh(ctx);
    ctx.fillStyle='#ffffff'; ctx.font='bold 9.5px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('ALL IN',b.x+b.w/2,b.y+b.h/2+.5);
    ctx.restore();
  });
}

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
function rr(ctx,x,y,w,h,r,fill,stroke,sw=1){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.arcTo(x,y+h,x,y+h-r,r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}
}
function setSh(ctx,c,b,ox=0,oy=2){ctx.shadowColor=c;ctx.shadowBlur=b;ctx.shadowOffsetX=ox;ctx.shadowOffsetY=oy;}
function clrSh(ctx){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
function lerp(a,b,t){return a+(b-a)*Math.min(1,Math.max(0,t));}
function easeOut(t){return 1-Math.pow(1-Math.min(1,t),3);}
function easeInOut(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}

// ════════════════════════════════════════════════════
// SEAT POSITIONS
// ════════════════════════════════════════════════════
function seatOuter(pos){
  const deg=SEAT_DEG[pos]||0, rad=deg*Math.PI/180;
  return{x:TCX+SEAT_RX*Math.cos(rad), y:TCY+SEAT_RY*Math.sin(rad)};
}
// Hole cards: pulled in from the avatar toward the table centre just far enough
// that cards and avatar (with its position badge) never touch, whatever the
// direction. A second, fixed ellipse inside the seats let them overlap on the
// diagonal seats.
function seatCards(pos){
  const a=seatOuter(pos);
  const dx=a.x-TCX, dy=a.y-TCY, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
  const needX=AVATAR_R+4+CARD_HALF_W+2, needY=AVATAR_R+10+CARD_HALF_H+2;
  const d=Math.min(ux?needX/Math.abs(ux):Infinity, uy?needY/Math.abs(uy):Infinity);
  return{x:a.x-ux*d, y:a.y-uy*d};
}
// Bet chips and their amount label must not cover anything: cards, the board,
// avatars, or another seat's bet. They used to be offset sideways at the
// cards' own radius and landed on the cards. Now each seat's chips move out
// from its cards toward the table centre until they're clear, and the label
// takes the nearest clear spot around its chips — clear of labels already
// placed too. Computed once per table size.
const CARD_HALF_W=34, CARD_HALF_H=22;
const BET_CHIP_COUNT=4, BET_LABEL_W=62, BET_LABEL_H=15;
function boxesOverlap(a,b){ return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h; }
function cardsBox(pos){ const c=seatCards(pos); return{x:c.x-CARD_HALF_W,y:c.y-CARD_HALF_H,w:CARD_HALF_W*2,h:CARD_HALF_H*2}; }
function avatarBox(pos){ const a=seatOuter(pos); return{x:a.x-AVATAR_R-4,y:a.y-AVATAR_R-4,w:AVATAR_R*2+8,h:AVATAR_R*2+8}; }
function badgeBox(pos){ const a=seatOuter(pos); return{x:a.x-26,y:a.y+AVATAR_R-7,w:52,h:15}; }
function boardBox(){ const a=getBoardPos(0), b=getBoardPos(4); return{x:a.x-4,y:a.y-4,w:b.x+b.w-a.x+8,h:a.h+8}; }
function chipsBox(x,y){ const h=BET_CHIP_COUNT*3.8+8; return{x:x-9,y:y-h+4,w:18,h}; }

let _betLayoutFor=null, _betLayout=null;
function betLayout(){
  if(_betLayoutFor===SEAT_DEG) return _betLayout;
  const seats=Object.keys(SEAT_DEG);
  const table={x:PANEL_W+2,y:HUD_H+2,w:W-PANEL_W-4,h:H-HUD_H-4};
  const fixed=[boardBox(),...seats.map(cardsBox),...seats.map(avatarBox),...seats.map(badgeBox),...seats.map(allInTagBox)];
  const inTable=(b)=>b.x>=table.x&&b.y>=table.y&&b.x+b.w<=table.x+table.w&&b.y+b.h<=table.y+table.h;
  const hits=(box,extra)=>(inTable(box)?0:10)
    +fixed.filter(o=>boxesOverlap(o,box)).length+extra.filter(o=>boxesOverlap(o,box)).length;

  const chips={}, placedChips=[];
  seats.forEach(pos=>{
    const c=seatCards(pos);
    const dx=TCX-c.x, dy=TCY-c.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
    // along the line to the centre, nudged sideways when the straight line is blocked
    const tx=-uy, ty=ux;
    let best=null;
    search: for(let d=12;d<=120;d+=3){
      for(const s of[0,12,-12,24,-24,36,-36]){
        const x=c.x+ux*d+tx*s, y=c.y+uy*d+ty*s, box=chipsBox(x,y), h=hits(box,placedChips);
        if(!best||h<best.h) best={x,y,box,h};
        if(h===0) break search;
      }
    }
    chips[pos]=best; placedChips.push(best.box);
  });

  const labels={}, placedLabels=[];
  seats.forEach(pos=>{
    const{x,y}=chips[pos];
    const lw=BET_LABEL_W, lh=BET_LABEL_H, midY=y-BET_CHIP_COUNT*3.8/2, side=13+lw/2;
    const up=BET_CHIP_COUNT*3.8+10+lh/2, down=10+lh/2;
    const offsets=[[side,0],[-side,0],[0,down],[0,-up],
      [side,lh+2],[-side,lh+2],[side,-(lh+2)],[-side,-(lh+2)],
      // farther out, for crowded 8–10 seat tables
      [0,down+lh+4],[0,-(up+lh+4)],[side+24,0],[-(side+24),0],
      [side,2*(lh+2)],[-side,2*(lh+2)],[side,-2*(lh+2)],[-side,-2*(lh+2)]];
    // last resort: further in toward the table centre, where the felt is open
    const cdx=TCX-x, cdy=TCY-midY, clen=Math.hypot(cdx,cdy)||1;
    [28,44,60].forEach(k=>offsets.push([cdx/clen*k,cdy/clen*k]));
    // and failing all of those, the nearest clear spot on a grid around the chips
    const grid=[];
    for(let gx=-104;gx<=104;gx+=8) for(let gy=-72;gy<=72;gy+=6) grid.push([gx,gy]);
    grid.sort((a,b)=>Math.hypot(a[0],a[1])-Math.hypot(b[0],b[1]));
    offsets.push(...grid);
    let best=null;
    for(const[ox,oy]of offsets){
      const box={x:x+ox-lw/2,y:midY+oy-lh/2,w:lw,h:lh};
      const h=hits(box,[...placedChips,...placedLabels]);
      if(!best||h<best.h) best={box,h};
      if(h===0) break;
    }
    labels[pos]=best.box; placedLabels.push(best.box);
  });

  _betLayoutFor=SEAT_DEG; _betLayout={chips,labels};
  return _betLayout;
}
function seatBet(pos){ const c=betLayout().chips[pos]; return c?{x:c.x,y:c.y}:seatCards(pos); }
function betLabelBox(pos){
  const l=betLayout().labels[pos];
  if(l) return l;
  const b=seatBet(pos);
  return{x:b.x+13,y:b.y-BET_LABEL_H,w:BET_LABEL_W,h:BET_LABEL_H};
}

// Geometry the renderer actually draws with, for layout tests only.
export function __videoLayoutForTest(playersCount){
  SEAT_DEG=seatAngles(playersCount);
  const seats=Object.keys(SEAT_DEG).map(pos=>{
    const a=seatOuter(pos), b=seatBet(pos);
    return{pos,avatar:{x:a.x,y:a.y,r:AVATAR_R},
      below:{x:a.x-26,y:a.y+AVATAR_R-7,w:52,h:15}, // position badge on the ring
      tag:allInTagBox(pos),
      cards:cardsBox(pos),chips:chipsBox(b.x,b.y),label:betLabelBox(pos)};
  });
  return{W,H,HUD_H,PANEL_W,board:boardBox(),seats};
}

// ════════════════════════════════════════════════════
// BACKGROUND — scattered money + chips
// ════════════════════════════════════════════════════
function drawBG(ctx){
  ctx.fillStyle='#06080f'; ctx.fillRect(0,0,W,H);

  // Scattered $100 bills (low opacity green rectangles)
  const bills=[
    [44,22,74,44,-14],[690,16,74,44,9],[10,368,74,44,17],[706,350,74,44,-7],
    [22,178,74,44,-21],[714,402,74,44,13],[58,432,74,44,6],[682,148,74,44,-15],
    [340,8,74,44,4],[420,462,74,44,-3],
  ];
  // Positions were laid out for 760×480 — scaled to the current canvas
  bills.forEach(([bx0,by0,bw,bh,ang])=>{
    const bx=bx0*W/760, by=by0*H/480;
    ctx.save();
    ctx.translate(bx+bw/2,by+bh/2); ctx.rotate(ang*Math.PI/180);
    ctx.globalAlpha=0.17;
    rr(ctx,-bw/2,-bh/2,bw,bh,5,'#14501e','rgba(30,100,40,0.5)',0.6);
    ctx.globalAlpha=0.09;
    ctx.fillStyle='#40d060'; ctx.font='bold 9px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('$100',0,3);
    ctx.restore();
  });

  // Scattered chips
  const chips=[
    [36,88,'#dc2626'],[720,108,'#e2e8f0'],[28,308,'#3b82f6'],[728,288,'#22c55e'],
    [52,452,'#dc2626'],[702,442,'#f59e0b'],[744,228,'#e2e8f0'],[16,242,'#3b82f6'],
    [380,10,'#fbbf24'],[382,468,'#dc2626'],
  ];
  chips.forEach(([cx0,cy0,col])=>{
    const cx=cx0*W/760, cy=cy0*H/480;
    ctx.beginPath(); ctx.arc(cx,cy,9,0,Math.PI*2);
    ctx.fillStyle=col+'1e'; ctx.fill();
    ctx.strokeStyle=col+'28'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2);
    ctx.strokeStyle=col+'14'; ctx.lineWidth=1; ctx.stroke();
  });

  // Edge vignette
  const vig=ctx.createRadialGradient(W/2,H/2,H*.18,W/2,H/2,H*.88);
  vig.addColorStop(0,'rgba(0,0,0,0)');
  vig.addColorStop(1,'rgba(0,0,0,0.74)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
}

// ════════════════════════════════════════════════════
// TABLE — mahogany rail + rich green felt + weave
// ════════════════════════════════════════════════════
function drawTable(ctx){
  const cx=TCX, cy=TCY, rx=TRX, ry=TRY;

  // Drop shadow
  setSh(ctx,'rgba(0,0,0,0.7)',16,0,8);
  ctx.beginPath(); ctx.ellipse(cx,cy+16,rx+28,ry+28,0,0,Math.PI*2);
  ctx.fillStyle='#000'; ctx.fill(); clrSh(ctx);

  // Outer dark wood
  ctx.beginPath(); ctx.ellipse(cx,cy,rx+30,ry+30,0,0,Math.PI*2);
  ctx.fillStyle='#0a0402'; ctx.fill();

  // Mahogany rail — brighter so VP8 doesn't wash it out
  ctx.beginPath(); ctx.ellipse(cx,cy,rx+22,ry+22,0,0,Math.PI*2);
  const railG=ctx.createLinearGradient(cx-rx,cy-ry,cx+rx,cy+ry);
  railG.addColorStop(0,'#3d0a08'); railG.addColorStop(0.25,'#8a2410');
  railG.addColorStop(0.5,'#b83018'); railG.addColorStop(0.75,'#8a2410');
  railG.addColorStop(1,'#3d0a08');
  ctx.fillStyle=railG; ctx.fill();

  // Rail sheen + outer glow
  setSh(ctx,'rgba(180,70,30,0.35)',12);
  ctx.beginPath(); ctx.ellipse(cx,cy,rx+22,ry+22,0,0,Math.PI*2);
  ctx.strokeStyle='rgba(220,110,50,0.45)'; ctx.lineWidth=3; ctx.stroke();
  clrSh(ctx);
  ctx.beginPath(); ctx.ellipse(cx,cy-2,rx+18,ry+18,0,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,170,80,0.12)'; ctx.lineWidth=2; ctx.stroke();

  // Inner dark lip
  ctx.beginPath(); ctx.ellipse(cx,cy,rx+7,ry+7,0,0,Math.PI*2);
  ctx.fillStyle='#0a0402'; ctx.fill();

  // Felt — brighter center for camera spotlight look
  ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  const feltG=ctx.createRadialGradient(cx-40,cy-30,8,cx,cy,rx*1.04);
  feltG.addColorStop(0,'#28924c'); feltG.addColorStop(0.32,'#1a6e38');
  feltG.addColorStop(0.75,'#0f5228'); feltG.addColorStop(1,'#082e18');
  ctx.fillStyle=feltG; ctx.fill();

  // Center spotlight (no clip needed - ellipse constrains it)
  ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  const spot=ctx.createRadialGradient(cx,cy,0,cx,cy,rx*.72);
  spot.addColorStop(0,'rgba(255,255,255,0.055)');
  spot.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=spot; ctx.fill();

  // PokerIsrael.org watermark
  ctx.globalAlpha=0.06; ctx.fillStyle='#fff';
  ctx.font='bold italic 22px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('PokerIsrael.org',cx,cy+ry*.55);
  ctx.globalAlpha=1;
}

// ════════════════════════════════════════════════════
// CARDS
// ════════════════════════════════════════════════════
function _face(ctx,x,y,w,h,rank,suit){
  rr(ctx,x,y,w,h,4,'#f8fafc',null);
  ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=.7;
  ctx.beginPath(); ctx.moveTo(x+4,y);ctx.arcTo(x+w,y,x+w,y+4,4);ctx.arcTo(x+w,y+h,x+w-4,y+h,4);
  ctx.arcTo(x,y+h,x,y+h-4,4);ctx.arcTo(x,y,x+4,y,4);ctx.closePath(); ctx.stroke();
  if(!rank||!suit) return;
  const col=SUIT_COLOR[suit]||'#1e293b'; const sym=SUIT_SYM[suit]||'?';
  ctx.fillStyle=col;
  ctx.font=`bold ${Math.round(w*.36)}px Arial`; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(rank,x+3,y+2);
  ctx.font=`${Math.round(w*.3)}px Arial`; ctx.fillText(sym,x+3,y+w*.42);
  ctx.font=`${Math.round(h*.44)}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(sym,x+w/2,y+h*.57);
}
function _back(ctx,x,y,w,h){
  rr(ctx,x,y,w,h,4,null,null);
  const g=ctx.createLinearGradient(x,y,x,y+h);
  g.addColorStop(0,'#1a3a8a'); g.addColorStop(1,'#0f2060');
  ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
  ctx.strokeRect(x+2,y+2,w-4,h-4);
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=.6;
  for(let i=1;i<4;i++){
    ctx.beginPath();ctx.moveTo(x+2,y+2+i*(h-4)/3);ctx.lineTo(x+w-2,y+2+i*(h-4)/3);ctx.stroke();
  }
}
function drawCard(ctx,x,y,w,h,rank,suit,faceUp=true){
  setSh(ctx,'rgba(0,0,0,0.65)',10,2,4);
  if(faceUp) _face(ctx,x,y,w,h,rank,suit); else _back(ctx,x,y,w,h);
  clrSh(ctx);
}
function drawCardFlip(ctx,x,y,w,h,rank,suit,t){
  const scaleX=t<.5?1-t*2:(t-.5)*2; const faceUp=t>=.5;
  ctx.save(); setSh(ctx,'rgba(0,0,0,0.55)',9,2,4);
  ctx.translate(x+w/2,y+h/2); ctx.scale(Math.max(.001,scaleX),1); ctx.translate(-(x+w/2),-(y+h/2));
  if(faceUp) _face(ctx,x,y,w,h,rank,suit); else _back(ctx,x,y,w,h);
  clrSh(ctx); ctx.restore();
}

// ════════════════════════════════════════════════════
// AVATAR TEMP CANVAS — tiny 74×74 for clip without GPU hit
// ════════════════════════════════════════════════════
let _avCv=null, _avCx=null;
function getAvCtx(){
  if(!_avCv){
    _avCv=document.createElement('canvas');
    _avCv.width=_avCv.height=(AVATAR_R+7)*2;
    _avCx=_avCv.getContext('2d');
  }
  return _avCx;
}

// ════════════════════════════════════════════════════
// PLAYER AVATAR — GGPoker style, large circular
// ════════════════════════════════════════════════════
function drawPlayerBox(ctx,pos,label,stack,isHero,isDealer=false,isWinner=false){
  const{x,y}=seatOuter(pos);
  const r=AVATAR_R;
  const sz=(r+7)*2, off=r+7;

  // Winner pulse glow
  if(isWinner){
    setSh(ctx,'#f8c030',14);
    ctx.beginPath(); ctx.arc(x,y,r+10,0,Math.PI*2);
    ctx.fillStyle='rgba(248,192,48,0.18)'; ctx.fill(); clrSh(ctx);
  }

  // Outer ring — gold for the winner, light for hero, dark otherwise
  ctx.beginPath(); ctx.arc(x,y,r+4,0,Math.PI*2);
  ctx.fillStyle=isWinner?'#f8c030':isHero?'#bfdbfe':'#0f172a'; ctx.fill();

  // Avatar interior on the tiny temp canvas (clip without a GPU hit): the
  // player's own colour with their name in it — no logo — so every seat is
  // told apart at a glance and matches its name colour in the action log.
  const ac=getAvCtx();
  ac.clearRect(0,0,sz,sz);
  ac.save();
  ac.beginPath(); ac.arc(off,off,r,0,Math.PI*2); ac.clip();
  ac.fillStyle=SEAT_COLOR[pos]||'#475569';
  ac.fillRect(0,0,sz,sz);
  const shade=ac.createLinearGradient(0,off-r,0,off+r);
  shade.addColorStop(0,'rgba(255,255,255,0.22)'); shade.addColorStop(1,'rgba(0,0,0,0.38)');
  ac.fillStyle=shade; ac.fillRect(0,0,sz,sz);
  // Name and stack both inside the circle — text hanging below the avatar ran
  // into the next seat down at the sides and into the cards at the top
  const stackDisp=isWinner?`+${typeof stack==='number'?stack.toLocaleString():stack}`:(typeof stack==='number'?stack.toLocaleString():stack);
  drawAvatarText(ac,label||'Player',String(stackDisp),isWinner?'#fde047':'#f1f5f9',off,off,r);
  ac.restore();

  // Composite tiny canvas onto main canvas
  ctx.drawImage(_avCv,Math.round(x-off),Math.round(y-off));

  // Position badge — straddles the bottom of the ring instead of hanging below it
  const posColors={
    BTN:'#7c3aed', BB:'#b91c1c', SB:'#c2410c',
    UTG:'#1d4ed8','UTG+1':'#0369a1', MP:'#0f766e','MP+1':'#0e7490', LJ:'#047857', HJ:'#15803d', CO:'#4d7c0f',
  };
  const pc=posColors[pos]||'#374151';
  const pw=Math.max(32,(pos.length)*7+14), ph=15;
  setSh(ctx,'rgba(0,0,0,0.4)',4);
  rr(ctx,x-pw/2,y+r-7,pw,ph,5,pc,'#0f172a',1);
  clrSh(ctx);
  ctx.fillStyle='#fff'; ctx.font='bold 8.5px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(pos,x,y+r-7+ph/2);

  // Dealer button (top-right corner of avatar)
  if(isDealer){
    // right of the top, clear of the ALL IN tag that sits on the top of the ring
    const dx=x+r*.87, dy=y-r*.5;
    setSh(ctx,'rgba(0,0,0,0.5)',5);
    ctx.beginPath(); ctx.arc(dx,dy,9.5,0,Math.PI*2);
    ctx.fillStyle='#f8c030'; ctx.fill(); clrSh(ctx);
    ctx.strokeStyle='#c09010'; ctx.lineWidth=1.2; ctx.stroke();
    ctx.fillStyle='#1a1000'; ctx.font='bold 8px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('D',dx,dy);
  }
}

// A player's name and stack inside their avatar. The name takes one line if it
// fits at a readable size, else two lines split at the space nearest the
// middle, else it's shrunk and cut with "…"; the stack goes underneath.
// Hebrew names render right-to-left on their own.
function drawAvatarText(c,name,stack,stackColor,cx,cy,r){
  const maxW=r*2-14;
  c.textAlign='center'; c.textBaseline='middle';
  c.shadowColor='rgba(0,0,0,0.7)'; c.shadowBlur=3;
  const fits=(s,px)=>{ c.font=`bold ${px}px Arial`; return c.measureText(s).width<=maxW; };
  let lines=null, px=9;
  for(let p=12;p>=10&&!lines;p--) if(fits(name,p)){ lines=[name]; px=p; }
  if(!lines){
    const words=name.trim().split(/\s+/);
    if(words.length>1){
      let best=null;
      for(let k=1;k<words.length;k++){
        const a=words.slice(0,k).join(' '), b=words.slice(k).join(' ');
        const d=Math.abs(a.length-b.length);
        if(!best||d<best.d) best={a,b,d};
      }
      for(let p=11;p>=8&&!lines;p--) if(fits(best.a,p)&&fits(best.b,p)){ lines=[best.a,best.b]; px=p; }
    }
  }
  if(!lines){ c.font='bold 9px Arial'; lines=[clipText(c,name,maxW)]; px=9; }

  const lineH=px+1, stackPx=10, gap=2;
  let yy=cy-(lines.length*lineH+gap+stackPx)/2+lineH/2;
  c.fillStyle='#ffffff'; c.font=`bold ${px}px Arial`;
  lines.forEach(l=>{ c.fillText(l,cx,yy); yy+=lineH; });
  yy+=gap-lineH/2+stackPx/2;
  c.font=`bold ${stackPx}px Arial`; c.fillStyle=stackColor;
  c.fillText(clipText(c,stack,maxW),cx,yy);
}
function clipText(c,s,maxW){
  if(c.measureText(s).width<=maxW) return s;
  let t=s;
  while(t.length>1&&c.measureText(t+'…').width>maxW) t=t.slice(0,-1);
  return t+'…';
}

// ════════════════════════════════════════════════════
// FOLD SLIDE — cards slide from seat to table center
// ════════════════════════════════════════════════════
function drawFoldSlide(ctx,pos,t){
  const{x,y}=seatCards(pos);
  const cw=30, ch=44, gap=4;
  const alpha=Math.max(0,1-easeOut(t)*1.35);
  if(alpha<=0) return;
  const ex=lerp(x,TCX,easeOut(t));
  const ey=lerp(y,TCY,easeOut(t));
  ctx.save();
  ctx.globalAlpha=alpha;
  const rot=easeOut(t)*0.25;
  ctx.translate(ex,ey); ctx.rotate(rot); ctx.translate(-ex,-ey);
  _back(ctx,ex-cw-gap/2,ey-ch/2,cw,ch);
  _back(ctx,ex+gap/2,    ey-ch/2,cw,ch);
  ctx.restore();
}

// ════════════════════════════════════════════════════
// HOLE CARDS
// ════════════════════════════════════════════════════
function drawHoleCards(ctx,pos,cards,faceUp=false,flipT=1){
  const{x,y}=seatCards(pos);
  const cw=30, ch=44, gap=4;
  const cx2=x-cw-gap/2, cy2=y-ch/2;
  if(!cards||cards.length<2){
    drawCard(ctx,cx2,cy2,cw,ch,null,null,false);
    drawCard(ctx,cx2+cw+gap,cy2,cw,ch,null,null,false);
    return;
  }
  if(flipT<1){
    drawCardFlip(ctx,cx2,cy2,cw,ch,cards[0].rank,cards[0].suit,flipT);
    drawCardFlip(ctx,cx2+cw+gap,cy2,cw,ch,cards[1].rank,cards[1].suit,Math.max(0,flipT-.12));
  } else if(faceUp){
    drawCard(ctx,cx2,cy2,cw,ch,cards[0].rank,cards[0].suit,true);
    drawCard(ctx,cx2+cw+gap,cy2,cw,ch,cards[1].rank,cards[1].suit,true);
  } else {
    _back(ctx,cx2,cy2,cw,ch);
    _back(ctx,cx2+cw+gap,cy2,cw,ch);
  }
}

// ════════════════════════════════════════════════════
// BOARD CARDS
// ════════════════════════════════════════════════════
function getBoardPos(idx){
  const cw=48, ch=68, gap=8;
  const total=5*(cw+gap)-gap;
  // Vertically centred: top and bottom seats both need room for their bets
  // between their hole cards and the board
  return{x:TCX-total/2+idx*(cw+gap), y:TCY-ch/2-4, w:cw, h:ch};
}
function drawBoard(ctx,cards,flipStates=[]){
  cards.forEach((c,i)=>{
    const{x,y,w,h}=getBoardPos(i);
    const ft=flipStates[i];
    if(ft!=null&&ft<1) drawCardFlip(ctx,x,y,w,h,c.rank,c.suit,ft);
    else drawCard(ctx,x,y,w,h,c.rank,c.suit,true);
  });
}

// ════════════════════════════════════════════════════
// CHIP STACK
// ════════════════════════════════════════════════════
const CHIP_PAL=['#dc2626','#1e293b','#3b82f6','#16a34a','#e2e8f0'];
function drawChipStack(ctx,cx,cy,count=5,c1='#dc2626',c2='#1e293b'){
  const r=8.5, th=3.8;
  for(let i=count-1;i>=0;i--){
    const yy=cy-i*th;
    const col=i%2===0?c1:c2;
    // Shadow edge
    ctx.beginPath(); ctx.ellipse(cx,yy+1.2,r,r*.30,0,0,Math.PI*2);
    ctx.fillStyle=col+'88'; ctx.fill();
    // Face
    ctx.beginPath(); ctx.ellipse(cx,yy,r,r*.35,0,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=.6; ctx.stroke();
    // Top highlight (white sheen)
    ctx.beginPath(); ctx.ellipse(cx,yy-r*.12,r*.55,r*.1,0,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.fill();
  }
}

// ════════════════════════════════════════════════════
// POT CENTER
// ════════════════════════════════════════════════════
function drawPotCenter(ctx,pot,isCash){
  if(pot<=0) return;
  // Just a chip pile under the board — the amount is in the left column. The
  // old pill above the board sat on the top seats' hole cards.
  const chipCy=TCY+62;
  drawChipStack(ctx,TCX-22,chipCy,4,'#dc2626','#1e293b');
  drawChipStack(ctx,TCX,   chipCy,5,'#e2e8f0','#1e293b');
  drawChipStack(ctx,TCX+22,chipCy,3,'#dc2626','#f8c030');
}

// ════════════════════════════════════════════════════
// MULTI-POT CENTER — several labeled piles side by side (main + side pots),
// shown together on the table — used only for genuine multi-way all-ins at
// different stack depths (hand_data.pots.length > 1)
// ════════════════════════════════════════════════════
function getPotPilePositions(n){
  const spacing=Math.min(150,(W-PANEL_W-200)/Math.max(1,n-1||1));
  const totalW=(n-1)*spacing;
  const startX=TCX-totalW/2;
  return Array.from({length:n},(_,i)=>({x:startX+i*spacing,y:TCY+82})); // below the board, as drawPotCenter
}
function drawPotPile(ctx,x,y,amount,label,isCash){
  if(amount<=0) return;
  const potStr=isCash?`₪${Math.round(amount).toLocaleString()}`:`${Math.round(amount).toLocaleString()}`;
  drawChipStack(ctx,x-13,y,4,'#dc2626','#1e293b');
  drawChipStack(ctx,x,   y,5,'#e2e8f0','#1e293b');
  drawChipStack(ctx,x+13,y,3,'#dc2626','#f8c030');
  const pw=112, ph=32;
  setSh(ctx,'rgba(0,0,0,0.55)',7);
  rr(ctx,x-pw/2,y-ph-9,pw,ph,9,'rgba(4,10,26,0.94)','#2d4a3a',1);
  clrSh(ctx);
  ctx.fillStyle='#64748b'; ctx.font='bold 8px Arial';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(label,x,y-ph-5);
  ctx.fillStyle='#f8c030'; ctx.font='bold 14px Arial';
  ctx.textBaseline='bottom';
  ctx.fillText(potStr,x,y-13);
}

// ════════════════════════════════════════════════════
// QUESTION CARD — "מה היית עושה?" (מצב שאלה, result==='unknown'). כרטיס
// מוגבה משלו במקום טקסט מרחף על שולחן עמוס — צריך "במה" משלו כי זו כל
// המטרה של הסרטון הזה, לא רק כיתוב סיום סטנדרטי
// ════════════════════════════════════════════════════
function drawQuestionCard(ctx,alpha){
  if(alpha<=0) return;
  ctx.save();
  ctx.globalAlpha=alpha;
  const cw=580, ch=210, cx=TCX-cw/2, cy=TCY-ch/2-6;
  setSh(ctx,'#60a5fa',30);
  rr(ctx,cx,cy,cw,ch,26,'rgba(6,12,28,0.96)','#60a5fa',2.5);
  clrSh(ctx);
  rr(ctx,cx+7,cy+7,cw-14,ch-14,20,null,'rgba(96,165,250,0.22)',1);

  ctx.textAlign='center'; ctx.textBaseline='middle';
  setSh(ctx,'#60a5fa',20);
  ctx.fillStyle='#93c5fd'; ctx.font='bold 62px Arial';
  ctx.fillText('🤔',TCX,cy+64);
  clrSh(ctx);
  ctx.fillStyle='#f0f9ff'; ctx.font='bold 40px Arial';
  ctx.fillText('מה היית עושה?',TCX,cy+134);
  ctx.fillStyle='rgba(191,219,254,0.75)'; ctx.font='bold 15px Arial';
  ctx.fillText('שתפו וקבלו תשובות — בלי לגלות איך היד הסתיימה',TCX,cy+172);
  ctx.restore();
}

// ════════════════════════════════════════════════════
// BET CHIPS NEAR PLAYER
// ════════════════════════════════════════════════════
function drawBetChips(ctx,pos,amount,isCash){
  if(!amount||amount<=0) return;
  const{x,y}=seatBet(pos);
  // Fixed stack height — the layout (seatBet/betLabelBox) reserves exactly this
  drawChipStack(ctx,x,y,BET_CHIP_COUNT,'#dc2626','#e2e8f0');
  const label=isCash?`₪${Math.round(amount).toLocaleString()}`:`${Math.round(amount).toLocaleString()}`;
  const box=betLabelBox(pos);
  rr(ctx,box.x,box.y,box.w,box.h,4,'rgba(4,10,26,0.9)','#1e3553',.8);
  ctx.fillStyle='#e2e8f0'; ctx.font='bold 9px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label,box.x+box.w/2,box.y+box.h/2);
}

// ════════════════════════════════════════════════════
// ACTION BADGE — GGPoker speech bubble
// ════════════════════════════════════════════════════
function drawActionBadge(ctx,pos,action,amount,isCash,alpha){
  if(alpha<=0) return;
  const{x,y}=seatOuter(pos);
  const COLS={
    fold:'#6b7280', check:'#22c55e', call:'#f8c030', limp:'#3b82f6',
    raise:'#ef4444', 'three-bet':'#dc2626', 'four-bet':'#ec4899',
    allin:'#e879f9', bet:'#f59e0b',
  };
  const LBLS={
    fold:'FOLD', check:'CHECK', call:'CALL', limp:'LIMP',
    raise:'RAISE', 'three-bet':'3BET', 'four-bet':'4BET', allin:'ALL-IN', bet:'BET',
  };
  const col=COLS[action]||'#e2e8f0';
  const lbl=LBLS[action]||action?.toUpperCase()||'?';
  const amtStr=amount>0?(isCash?` ₪${Math.round(amount).toLocaleString()}`:` ${Math.round(amount).toLocaleString()}`): '';
  const text=lbl+amtStr;
  ctx.font='bold 13px Arial';
  const tw=Math.max(64,ctx.measureText(text).width+28);
  const bh=28;
  // Clamp to the canvas — top-row seats (MP/HJ, y≈59) push by to a negative
  // y with the naive fixed offset, running the badge off the top edge. The
  // arrow below still points at (x,y) regardless, so clamping just shortens
  // the visual gap instead of leaving the badge fully off-screen.
  // On the outside of the seat — below the avatar for the bottom half of the
  // table, above it for the top half. Always above, it covered the bottom
  // seats' own hole cards (which sit between the avatar and the table centre).
  const outsideBelow=y>TCY;
  const bx=Math.max(PANEL_W+4,Math.min(W-tw-4,x-tw/2));
  const by=outsideBelow
    ? Math.min(H-bh-2,y+AVATAR_R+14)
    : Math.max(HUD_H+2,y-AVATAR_R-bh-14);

  ctx.globalAlpha=alpha;
  // Glow
  setSh(ctx,col,9);
  rr(ctx,bx,by,tw,bh,6,col,null);
  clrSh(ctx);
  // Arrow pointing to player
  ctx.beginPath();
  if(outsideBelow){ ctx.moveTo(x-8,by); ctx.lineTo(x,by-10); ctx.lineTo(x+8,by); }
  else { ctx.moveTo(x-9,by+bh); ctx.lineTo(x,by+bh+11); ctx.lineTo(x+9,by+bh); }
  ctx.closePath(); ctx.fillStyle=col; ctx.fill();
  // Text
  ctx.fillStyle=['call','check','limp','fold'].includes(action)?'#111111':'#ffffff';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,x,by+bh/2);
  ctx.globalAlpha=1;
}

// ════════════════════════════════════════════════════
// ACTION LOG — left panel
// ════════════════════════════════════════════════════
// Its own full-height column left of the table (above the pot box), so it can
// never cover a seat. Always drawn — empty until the first action — so the
// table doesn't shift when it fills. Names in each player's seat colour.
function drawMiniLog(ctx,events=[]){
  const x=6, y=HUD_H+6, w=PANEL_W-12, h=H-HUD_H-POT_BOX_H-12;
  rr(ctx,x,y,w,h,10,'rgba(4,10,26,0.92)','#1e3553',1);
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='bold 10px Arial';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('ACTION LOG',x+12,y+16);
  const ACTION_COL={
    fold:'#6b7280', check:'#22c55e', call:'#f8c030', limp:'#60a5fa',
    raise:'#fbbf24', 'three-bet':'#f87171', 'four-bet':'#f9a8d4', allin:'#e879f9', bet:'#fbbf24',
  };
  ACTION_COL.return='#94a3b8';
  const LBLS={fold:'fold',check:'check',call:'call',limp:'limp',raise:'raise',
    'three-bet':'3bet','four-bet':'4bet',allin:'all-in',bet:'bet',return:'returned'};
  // Rows grouped by street: a header (PREFLOP / FLOP / TURN / RIVER, with that
  // street's board cards) before each street's actions. Streets come from the
  // actions themselves and from the 'street' markers buildFrames adds when a
  // board is dealt, so a street with no action (all-in run-out) still shows.
  const STREET_NAME={preflop:'PREFLOP',flop:'FLOP',turn:'TURN',river:'RIVER'};
  const STREET_COL={preflop:'#60a5fa',flop:'#22d3ee',turn:'#a78bfa',river:'#34d399'};
  const rows=[];
  let cur=null;
  events.forEach(ev=>{
    if(ev.type==='street'){ rows.push({header:ev.street,cards:ev.cards,street:ev.street}); cur=ev.street; return; }
    const st=ev.street||cur;
    if(st&&st!==cur){ rows.push({header:st,cards:[],street:st}); cur=st; }
    rows.push({...ev,street:st});
  });

  // 16px rows: a 9-handed hand with an all-in (22 rows incl. street headers)
  // fits whole; longer hands scroll, keeping the street name on the top row
  const rowH=16, top=y+30, maxRows=Math.floor((h-38)/rowH);
  let shown=rows.slice(-maxRows);
  // scrolled past a street's header — keep its name on the top row
  if(shown.length&&!shown[0].header){
    const st=shown[0].street, hdr=rows.find(r=>r.header===st);
    shown=[{header:st,cards:hdr?.cards||[],street:st},...shown.slice(1)];
  }
  shown.forEach((ev,i)=>{
    const ry=top+i*rowH+rowH/2;
    if(ev.header){
      const col=STREET_COL[ev.header]||'#94a3b8';
      ctx.textAlign='left'; ctx.font='bold 10px Arial'; ctx.fillStyle=col;
      const name=STREET_NAME[ev.header]||ev.header;
      ctx.fillText(name,x+10,ry);
      let cx=x+14+ctx.measureText(name).width;
      (ev.cards||[]).forEach(card=>{
        const s=`${card.rank}${SUIT_SYM[card.suit]||''}`;
        ctx.font='bold 10px Arial';
        ctx.fillStyle=(card.suit==='h'||card.suit==='d')?'#f87171':'#e2e8f0';
        ctx.fillText(s,cx,ry);
        cx+=ctx.measureText(s).width+5;
      });
      ctx.strokeStyle=`${col}55`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(Math.min(cx+2,x+w-12),ry); ctx.lineTo(x+w-10,ry); ctx.stroke();
      return;
    }
    const isHero=ev.actor==='hero';
    ctx.textAlign='left'; ctx.font='bold 10px Arial';
    ctx.fillStyle=SEAT_COLOR[ev.pos]||(isHero?'#93c5fd':'#fca5a5');
    ctx.fillText(clipText(ctx,isHero?'Hero':(ev.opponentLabel||'Villain'),58),x+10,ry);
    const amtStr=ev.amount>0?` ${Math.round(ev.amount).toLocaleString()}`:'';
    ctx.fillStyle=ACTION_COL[ev.action]||'#e2e8f0';
    ctx.fillText((LBLS[ev.action]||ev.action||'?')+amtStr,x+72,ry);
    if(ev.bbVal&&ev.amount>0){
      ctx.fillStyle='#64748b'; ctx.font='8px Arial'; ctx.textAlign='right';
      ctx.fillText(`${Number((ev.amount/ev.bbVal).toFixed(1))}BB`,x+w-8,ry);
    }
  });
}

// ════════════════════════════════════════════════════
// CHIP PARTICLES
// ════════════════════════════════════════════════════
function drawChipParticles(ctx,fx,fy,tx,ty,t,amount=0){
  if(!fx||!fy||!tx||!ty||t<=0) return;
  const n=Math.min(16,6+Math.floor((amount||0)/700));
  for(let i=0;i<n;i++){
    const off=i/n;
    const ct=Math.max(0,Math.min(1,(t-off*.12)*2.3));
    if(ct<=0) continue;
    const et=easeInOut(ct);
    const spread=(1-et)*18; const angle=(i/n)*Math.PI*2;
    const px=fx+(tx-fx)*et+Math.cos(angle)*spread;
    const py=fy+(ty-fy)*et+Math.sin(angle)*spread;
    ctx.beginPath(); ctx.arc(px,py,5.5+Math.sin(et*Math.PI)*3,0,Math.PI*2);
    ctx.fillStyle=CHIP_PAL[i%CHIP_PAL.length]; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=.7; ctx.stroke();
  }
}

// ════════════════════════════════════════════════════
// TOP HUD BAR — GGPoker/WSOP broadcast style
// ════════════════════════════════════════════════════
function drawTopHUD(ctx,isCash,stakes,sb,bb,ante,tournamentStage){
  // Bar background
  rr(ctx,0,0,W,42,0,'rgba(6,8,15,0.95)',null);
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,42); ctx.lineTo(W,42); ctx.stroke();

  // Left: PokerIsrael logo box (red, like WSOP box)
  setSh(ctx,'rgba(139,24,24,0.5)',10);
  rr(ctx,8,6,82,30,5,'#8b1818',null); clrSh(ctx);
  // Red stripe accent
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.fillRect(8,19,82,17); // darker lower half
  ctx.fillStyle='#fff'; ctx.font='bold 12px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('PokerIsrael',49,15);
  ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.font='bold 8px Arial';
  ctx.fillText('.org',49,28);

  // Vertical separator
  ctx.strokeStyle='rgba(139,24,24,0.7)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(98,8); ctx.lineTo(98,34); ctx.stroke();

  // Blinds info
  if(isCash){
    ctx.fillStyle='#64748b'; ctx.font='bold 8px Arial';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('STAKES',106,19);
    ctx.fillStyle='#e2e8f0'; ctx.font='bold 15px Arial';
    ctx.fillText(stakes||'',162,19);
  } else {
    ctx.fillStyle='#60a5fa'; ctx.font='bold 8px Arial';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('BLINDS',106,14);
    ctx.fillStyle='#e2e8f0'; ctx.font='bold 14px Arial';
    const bStr=`${(sb||0).toLocaleString()} / ${(bb||0).toLocaleString()}${ante>0?` - ${(ante||0).toLocaleString()} (BB)`:''}`;
    ctx.fillText(bStr,152,14);
    if(tournamentStage){
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='8px Arial';
      ctx.textBaseline='middle';
      ctx.fillText(tournamentStage,106,30);
    }
  }

  // Right: HAND HISTORY badge
  rr(ctx,W-122,8,114,26,5,'rgba(4,10,26,0.88)','#1e3a6b',1);
  ctx.fillStyle='#64748b'; ctx.font='bold 9px Arial';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText('HAND HISTORY',W-14,21);
}

// ════════════════════════════════════════════════════
// STREET BADGE
// ════════════════════════════════════════════════════
function drawStreetBadge(ctx,label){
  const colors={'פרה-פלופ':'#60a5fa','פלופ':'#22d3ee','טרן':'#a78bfa','ריבר':'#34d399'};
  const col=colors[label]||'#e2e8f0';
  // In the top bar above the table's centre — on the felt it sat among the
  // bottom seats' bets
  ctx.font='bold 12px Arial';
  const tw=ctx.measureText(label).width+26;
  rr(ctx,TCX-tw/2,10,tw,22,6,`${col}22`,col,1);
  ctx.fillStyle=col; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label,TCX,21);
}

// ════════════════════════════════════════════════════
// POT DISPLAY — bottom of the left column
// ════════════════════════════════════════════════════
function drawPotDisplay(ctx,pot,sb,bb,ante,isCash,stakes){
  // Bottom of the left column, under the action log — in the bottom-right
  // corner it sat on top of the button/small blind seats
  const px=6, pw=PANEL_W-12, ph=POT_BOX_H-6, py=H-POT_BOX_H;
  setSh(ctx,'rgba(0,0,0,0.6)',12,0,4);
  rr(ctx,px,py,pw,ph,10,'rgba(4,11,26,0.94)','#1e3d6b',1.5);
  clrSh(ctx);
  ctx.fillStyle='#64748b'; ctx.font='bold 10px Arial';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('POT',px+12,py+9);
  ctx.fillStyle='#f8c030'; ctx.font='bold 24px Arial';
  ctx.fillText(`${isCash?'₪':''}${Math.round(pot).toLocaleString()}`,px+12,py+21);
  const bl=isCash?`Stakes: ${stakes||''}`:`Blinds: ${sb||0}/${bb||0}${ante>0?` · Ante ${ante}`:''}`;
  ctx.fillStyle='#475569'; ctx.font='9px Arial'; ctx.textBaseline='bottom';
  ctx.fillText(bl,px+12,py+ph-7);
}

// ════════════════════════════════════════════════════
// DRAW FULL SCENE
// ════════════════════════════════════════════════════
function drawScene(ctx,{
  allPlayers, heroPos, heroCards, heroCardsFaceUp=true,
  isCash, sb, bb, ante, stakes, tournamentStage,
  pot, stacks, board, flipStates,
  logEvents, currentStreet, betAmounts={},
  actionBadge=null, actionBadgeAlpha=0,
  showHeroCards=true, foldedActors=new Set(),
  revealedActors=new Set(), opponentCardsById={},
}){
  drawBG(ctx);
  drawTable(ctx);
  drawTopHUD(ctx,isCash,stakes,sb,bb,ante,tournamentStage);

  allPlayers.forEach(p=>{
    const stk=Math.round(stacks[p.isHero?'hero':p.id]??p.stack??0);
    const isDealer=p.position==='BTN';
    const isFolded=foldedActors.has(p.isHero?'hero':p.id);
    drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,isDealer,false);
    if(isFolded) return;
    if(p.isHero&&showHeroCards&&heroCards?.length>=2){
      drawHoleCards(ctx,p.position,heroCards,heroCardsFaceUp);
    } else if(!p.isHero){
      const revealed=revealedActors.has(p.id);
      drawHoleCards(ctx,p.position,revealed?opponentCardsById[p.id]:null,revealed);
    }
  });

  drawAllInTags(ctx,allInPositions(logEvents));
  if(board.length) drawBoard(ctx,board,flipStates||[]);
  // The felt pot pile only between betting rounds — while bets are out, top
  // seats' chips sit where it would be, and the pot is in the left column anyway
  const betsOut=Object.values(betAmounts).some(a=>a>0);
  if(!betsOut) drawPotCenter(ctx,pot,isCash);
  Object.entries(betAmounts).forEach(([pos,amt])=>drawBetChips(ctx,pos,amt,isCash));
  if(currentStreet) drawStreetBadge(ctx,currentStreet);
  if(actionBadge&&actionBadgeAlpha>0)
    drawActionBadge(ctx,actionBadge.pos,actionBadge.action,actionBadge.amount,isCash,actionBadgeAlpha);
  drawMiniLog(ctx,logEvents);
  drawPotDisplay(ctx,pot,sb,bb,ante,isCash,stakes);
}

// ════════════════════════════════════════════════════
// STATE COMPUTATION
// ════════════════════════════════════════════════════
// בליינד משוייך רק לשחקן שבאמת יושב ב-SB/BB ולא הימר בפרה-פלופ (ההימור שלו כבר
// כולל את הבליינד) — לא (sb+bb) שטוח שסופר את שניהם תמיד גם כששני אלה לא רלוונטיים
function computeInitialPot(hand_data,hero_position,opponents,sb,bb,ante){
  const preflopActions=hand_data?.streets?.preflop?.actions||[];
  const betActors=new Set(
    preflopActions.filter(a=>['bet','raise','three-bet','four-bet'].includes(a.action)&&a.amount).map(a=>String(a.actor))
  );
  const actors=[{id:'hero',position:hero_position},...opponents.map(o=>({id:o.id,position:o.position}))];
  let blindTotal=0;
  actors.forEach(a=>{
    if(betActors.has(String(a.id))) return;
    if(a.position==='BB') blindTotal+=(bb||0);
    else if(a.position==='SB') blindTotal+=(sb||0);
  });
  // Big blind ante — one ante in the pot, not one per player (same as the
  // wizard and the narrative). The caller passes 0 for cash games.
  return blindTotal+(ante||0);
}

function buildEvents(hand_data,hero_stack,opponents,sb,bb,ante,hero_position,isTournament){
  const stacks={hero:hero_stack};
  opponents.forEach(o=>stacks[o.id]=o.stack||0);
  let pot=computeInitialPot(hand_data,hero_position,opponents,sb,bb,isTournament?ante:0);
  const events=[];
  const streets=hand_data?.streets||{};
  // השלב שאחריו כבר אי-אפשר לבצע יותר פעולות הימור (כולם אול-אין/קיפלו) —
  // אותו זיהוי בדיוק כמו באשף (HandLoggerWizard), כדי שהסרטון יגלה קלפים
  // באותה נקודה בדיוק שבה האשף כבר הציג את פאנל הגילוי המוקדם
  const lockStreet=getAllInLockStreet(hand_data,hero_position,hero_stack,opponents,sb,bb,ante,isTournament);
  // The part of the biggest bet nobody matched goes back to its owner's stack
  // as soon as that betting round ends — not only at the very end, or the pot
  // on screen stays too big for the rest of the hand (same rule as the wizard
  // and the narrative, see handPots.js)
  const uncalled=getUncalledReturn(getContributions(hand_data,hero_position,opponents,sb,bb,ante,isTournament));
  const lastActionStreet=['river','turn','flop','preflop'].find(s=>(streets[s]?.actions||[]).length);
  ['preflop','flop','turn','river'].forEach(street=>{
    if(street==='flop'&&streets.flop?.board?.length)
      streets.flop.board.forEach((card,i)=>events.push({type:'card',street:'flop',cardIdx:i,card,pot,stacks:{...stacks}}));
    if(street==='turn'&&streets.turn?.board?.length)
      events.push({type:'card',street:'turn',cardIdx:3,card:streets.turn.board[0],pot,stacks:{...stacks}});
    if(street==='river'&&streets.river?.board?.length)
      events.push({type:'card',street:'river',cardIdx:4,card:streets.river.board[0],pot,stacks:{...stacks}});
    (streets[street]?.actions||[]).forEach(a=>{
      // גודל יחסי ("75%") מתייחס לגובה הקופה הנוכחי — parseFloat גולמי היה קורא
      // "75%" כ-75 צ'יפים, מציג סכומים/אנימציית צ'יפים שגויים לגמרי בכל יד עם
      // הימור באחוזים (פיצ'ר מרכזי באשף)
      const rawAmt=a.amount;
      const amount=(typeof rawAmt==='string'&&rawAmt.trim().endsWith('%'))
        ? Math.round(pot*(parseFloat(rawAmt)||0)/100)
        : (parseFloat(rawAmt)||0);
      const potBefore=pot; const stacksBefore={...stacks};
      const actorKey=a.actor==='hero'?'hero':a.actor;
      const isChip=['call','raise','three-bet','four-bet','allin','limp','bet'].includes(a.action);
      if(isChip&&amount>0&&stacks[actorKey]!=null){stacks[actorKey]=Math.max(0,stacks[actorKey]-amount);pot+=amount;}
      const opp=a.actor!=='hero'?opponents.find(o=>o.id===a.actor||o.id===parseInt(a.actor)):null;
      events.push({
        type:'action',street,actor:a.actor,action:a.action,amount,
        potBefore,potAfter:pot,stacksBefore,stacksAfter:{...stacks},
        opponentLabel:opp?.label||null, bbVal:bb||null,
        actorPos:a.actor==='hero'?hero_stack:opp?.position,
      });
    });
    if(uncalled&&street===lastActionStreet){
      const opp=uncalled.actor==='hero'?null:opponents.find(o=>String(o.id)===uncalled.actor);
      const key=uncalled.actor==='hero'?'hero':opp?.id;
      if(key!=null&&stacks[key]!=null){
        stacks[key]+=uncalled.amount; pot-=uncalled.amount;
        events.push({type:'return',street,actor:uncalled.actor,amount:uncalled.amount,
          pos:uncalled.actor==='hero'?hero_position:opp?.position,opponentLabel:opp?.label||null,
          potAfter:pot,stacksAfter:{...stacks}});
      }
    }
    if(street===lockStreet) events.push({type:'reveal'});
  });
  return{events,finalPot:pot,finalStacks:{...stacks}};
}

// ════════════════════════════════════════════════════
// BUILD FRAMES
// ════════════════════════════════════════════════════
export function buildFrames(state){
  const{
    game_type, tournament_stage, blind_sb:sb, blind_bb:bb, ante=0, cash_stakes,
    hero_position, hero_stack=0, hero_cards=[],
    hand_data:storedHandData={}, result, hero_profit,
  }=state;
  // Replayed in seat order even when the actions were saved out of turn
  // (hands recorded before the wizard enforced turn order) — see actionOrder.js
  const hand_data=resequenceHandActions(storedHandData,hero_position,storedHandData?.opponents||[],state.players_count);

  const opponents=hand_data?.opponents||[];
  const isCash=game_type==='cash'||game_type==='cash_online';

  // Every seat drawn below reads SEAT_DEG, so it is set before any frame is
  // built. Grown to fit any seat in the hand, so an understated players_count
  // can't drop a player back to the 0° fallback.
  const tableSize=Math.max(
    Number(state.players_count)||0,
    opponents.length+1,
    ...[hero_position,...opponents.map(o=>o.position)].filter(Boolean).map(minPlayersFor),
  );
  SEAT_DEG=seatAngles(tableSize);
  FRAME_NO=0;
  SEAT_COLOR={};
  opponents.forEach((o,i)=>{ if(o.position) SEAT_COLOR[o.position]=PLAYER_PALETTE[i%PLAYER_PALETTE.length]; });
  if(hero_position) SEAT_COLOR[hero_position]=HERO_COLOR;

  const{events,finalStacks,finalPot}=buildEvents(hand_data,hero_stack,opponents,sb,bb,ante,hero_position,!isCash);
  // finalPot מגיע ישירות מ-buildEvents (סכימת הפעולות בפועל, לא ניחוש
  // מ-hero_profit שהוא נטו ומטעה בקופה מחולקת) — לא מ-events[last].potAfter,
  // שיכול להיות אירוע 'reveal' בלי potAfter כשהאול-אין קורה על הריבר עצמו
  // מזהה היריב שבאמת ניצח, לא תמיד opponents[0]: אם בדיוק יריב אחד לא קיפל
  // עד השואודאון, הוא המנצח החד-משמעי; אחרת (2+ יריבים בשואודאון) אין די מידע
  // שמור כדי לדעת מי מהם ניצח בפועל, ומשתמשים ב-opponents[0] כברירת מחדל ידועה
  const winnerOpponent=(() => {
    if(result!=='lost') return null;
    const folded=new Set();
    ['preflop','flop','turn','river'].forEach(street=>{
      (hand_data?.streets?.[street]?.actions||[]).forEach(a=>{
        if(a.action==='fold') folded.add(String(a.actor));
      });
    });
    const remaining=opponents.filter(o=>!folded.has(String(o.id)));
    return remaining.length===1?remaining[0]:(opponents[0]||null);
  })();
  const winnerPos=result==='won'?hero_position:(result==='lost'?winnerOpponent?.position||null:null);

  const allPlayers=[
    {label:'Hero',position:hero_position,stack:hero_stack,isHero:true,id:'hero'},
    ...opponents.map(o=>({...o,isHero:false})),
  ];
  const initialPot=(sb||0)+(bb||0)+(isCash?0:(ante||0)); // one big blind ante
  const initialStacks={hero:hero_stack};
  opponents.forEach(o=>initialStacks[o.id]=o.stack||0);

  // קלפי יריב שנחשפו במהלך היד (אשף "קלפי יריב" / AllInRevealPanel) — ממופה
  // לפי actor id, בדיוק כמו hand_data.showdown.opponent_cards (אינדקס = סדר
  // opponents). סטטי לאורך כל הסרטון — מי בפועל *רואה* את הקלפים האלה נקבע
  // בנפרד ע"י revealedActors, שגדל עם הזמן (ראה events.forEach למטה)
  const opponentCardsById={};
  opponents.forEach((o,i)=>{
    const oc=hand_data?.showdown?.opponent_cards?.[i];
    if(oc?.length>=2) opponentCardsById[o.id]=oc;
  });

  // קופות-צד — hand_data.pots נשמר רק כשהיד באמת פוצלה (ראה handPots.js/
  // HandLoggerWizard); כל יד רגילה כולל אול-אין חד-על-חד לא נוגעת בזה כלל
  const pots=hand_data?.pots;
  const isMultiPot=Array.isArray(pots)&&pots.length>1;

  const STREET_LABELS={preflop:'פרה-פלופ',flop:'פלופ',turn:'טרן',river:'ריבר'};
  const frames=[];
  const base={
    allPlayers, heroPos:hero_position, heroCards:hero_cards,
    isCash, sb, bb, ante, stakes:cash_stakes, tournamentStage:tournament_stage,
    opponentCardsById,
  };

  // ── INTRO ────────────────────────────── 42f
  frames.push({duration:42,draw:(ctx,t)=>{
    drawBG(ctx);
    ctx.globalAlpha=Math.min(1,easeOut(t*1.4));
    drawTable(ctx); clrSh(ctx);
    ctx.globalAlpha=1;
    drawTopHUD(ctx,isCash,cash_stakes,sb,bb,ante,tournament_stage);

    // Logo appears center
    const a=Math.min(1,easeOut((t-.18)*2.8));
    if(a>0){
      ctx.globalAlpha=a;

      // Big PokerIsrael logo circle
      const logoR=52;
      setSh(ctx,'rgba(30,120,64,0.5)',12);
      ctx.beginPath(); ctx.arc(TCX,TCY-10,logoR+6,0,Math.PI*2);
      ctx.fillStyle='rgba(10,60,30,0.85)'; ctx.fill(); clrSh(ctx);
      ctx.beginPath(); ctx.arc(TCX,TCY-10,logoR,0,Math.PI*2);
      const introAvG=ctx.createRadialGradient(TCX-logoR*.3,TCY-10-logoR*.3,4,TCX,TCY-10,logoR);
      introAvG.addColorStop(0,'#1c3870'); introAvG.addColorStop(1,'#0c1e48');
      ctx.fillStyle=introAvG; ctx.fill();
      ctx.strokeStyle='#2a5ab0'; ctx.lineWidth=3; ctx.stroke();

      // Logo text (no clip)
      ctx.fillStyle='#fff'; ctx.font=`bold ${(logoR*.62)|0}px Arial`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('PI',TCX,TCY-10-logoR*.04);
      ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font=`${(logoR*.24)|0}px Arial`;
      ctx.fillText('ISRAEL',TCX,TCY-10+logoR*.5);

      ctx.fillStyle='#fff'; ctx.font='bold 26px Arial';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('PokerIsrael.org',TCX,TCY+54);
      ctx.fillStyle='#94a3b8'; ctx.font='13px Arial';
      const ctxLine=isCash?`קאש ${cash_stakes||''}`:`טורניר | ${tournament_stage||''} | ${sb||0}/${bb||0} BB`;
      ctx.fillText(ctxLine,TCX,TCY+80);
      ctx.globalAlpha=1;
    }
  }});

  // ── TABLE + PLAYERS FLY IN ─────────── 30f
  frames.push({duration:30,draw:(ctx,t)=>{
    drawScene(ctx,{...base,pot:initialPot,stacks:{...initialStacks},
      board:[],flipStates:[],logEvents:[],currentStreet:null,showHeroCards:false});
    allPlayers.forEach((p,i)=>{
      const a=Math.min(1,easeOut((t-i*.08)*5));
      if(a<1){
        ctx.globalAlpha=a;
        drawPlayerBox(ctx,p.position,p.label||'Hero',p.stack,p.isHero,p.position==='BTN',false);
        ctx.globalAlpha=1;
      }
    });
  }});

  // ── HERO CARDS FLIP ────────────────── 30f
  frames.push({duration:30,draw:(ctx,t)=>{
    drawBG(ctx); drawTable(ctx);
    drawTopHUD(ctx,isCash,cash_stakes,sb,bb,ante,tournament_stage);
    allPlayers.forEach(p=>{
      const stk=initialStacks[p.isHero?'hero':p.id]??p.stack??0;
      drawPlayerBox(ctx,p.position,p.label||'Hero',Math.round(stk),p.isHero,p.position==='BTN',false);
      if(!p.isHero) drawHoleCards(ctx,p.position,null,false);
    });
    if(hero_cards.length>=2){
      const ft0=Math.min(1,easeInOut(Math.max(0,t*2)));
      const ft1=Math.min(1,easeInOut(Math.max(0,(t-.15)*2)));
      const{x,y}=seatCards(hero_position);
      const cw=30, ch=44, gap=4;
      drawCardFlip(ctx,x-cw-gap/2,y-ch/2,cw,ch,hero_cards[0].rank,hero_cards[0].suit,ft0);
      drawCardFlip(ctx,x+gap/2,y-ch/2,cw,ch,hero_cards[1].rank,hero_cards[1].suit,ft1);
    }
    drawMiniLog(ctx,[]);
    drawPotDisplay(ctx,initialPot,sb,bb,ante,isCash,cash_stakes);
  }});

  // ── EVENT-DRIVEN FRAMES ──────────────────────────────
  let currentPot=initialPot;
  let currentStacks={...initialStacks};
  let logEvents=[];
  let revealedBoard=[];
  let flipStates=[];
  let currentStreet='פרה-פלופ';
  let betAmounts={};
  let foldedActors=new Set();
  // מי מהיריבים גלוי כרגע (קלפים כלפי מעלה) — ריק עד לרגע הגילוי בפועל, בין
  // אם באירוע 'reveal' (אול-אין לפני שהבורד הושלם) ובין אם בסצינת ה-RESULT
  // (שואודאון רגיל בסוף הריבר, ללא אול-אין באמצע)
  let revealedActors=new Set();

  events.forEach((ev,evIdx)=>{
    if(ev.type==='card'){
      // מאפסים את סמני ההימור ליד השחקנים בכל מעבר שלב, לא רק פלופ — בלי זה
      // סמן מהטרן נשאר "תקוע" על המסך גם בריבר (הבאג שהמשתמש דיווח עליו,
      // מאומת מול הסרטון האמיתי שלו)
      if(ev.street==='flop')  {currentStreet='פלופ'; betAmounts={};}
      else if(ev.street==='turn')  {currentStreet='טרן'; betAmounts={};}
      else if(ev.street==='river') {currentStreet='ריבר'; betAmounts={};}

      const newBoard=[...revealedBoard,ev.card];
      // street header in the action log, once that street's board is out
      if((ev.street==='flop'&&ev.cardIdx===2)||ev.street==='turn'||ev.street==='river'){
        logEvents=[...logEvents,{type:'street',street:ev.street,cards:ev.street==='flop'?newBoard.slice(0,3):[ev.card]}];
      }
      const snap={board:[...newBoard],pot:currentPot,stacks:{...currentStacks},log:[...logEvents],
        str:currentStreet,folded:new Set(foldedActors),revealed:new Set(revealedActors)};
      frames.push({duration:18,draw:(ctx,t)=>{
        const fStates=snap.board.map((_,i)=>i<snap.board.length-1?1:easeInOut(t));
        drawScene(ctx,{...base,pot:snap.pot,stacks:snap.stacks,
          board:snap.board,flipStates:fStates,logEvents:snap.log,
          currentStreet:snap.str,showHeroCards:true,heroCardsFaceUp:true,
          foldedActors:snap.folded,revealedActors:snap.revealed});
      }});
      // hold per street: flop=18f(0.6s), turn=24f(0.8s), river=40f(1.3s)
      const holdDur=ev.street==='river'?40:ev.street==='turn'?24:18;
      frames.push({duration:holdDur,draw:(ctx)=>{
        drawScene(ctx,{...base,pot:snap.pot,stacks:snap.stacks,
          board:snap.board,flipStates:Array(snap.board.length).fill(1),
          logEvents:snap.log,currentStreet:snap.str,showHeroCards:true,heroCardsFaceUp:true,
          foldedActors:snap.folded,revealedActors:snap.revealed});
      }});
      revealedBoard=newBoard; flipStates=Array(revealedBoard.length).fill(1);

    } else if(ev.type==='return'){
      // uncalled bet back to its owner — pot and stack from here on, plus a log line
      currentPot=ev.potAfter; currentStacks={...ev.stacksAfter};
      logEvents=[...logEvents,{actor:ev.actor,action:'return',amount:ev.amount,pos:ev.pos,opponentLabel:ev.opponentLabel}];

    } else if(ev.type==='reveal'){
      // אול-אין לפני שהבורד הושלם: מציגים את קלפי כל מי שנשאר ולא קיפל,
      // *לפני* שממשיכים לחלק את שאר קלפי הבורד — ראה [[project_poker_handlogger]]
      const toReveal=allPlayers.filter(p=>!p.isHero&&!foldedActors.has(p.id)&&opponentCardsById[p.id]);
      if(toReveal.length){
        const revealSnap={board:[...revealedBoard],str:currentStreet,bets:{...betAmounts},
          pot:currentPot,stacks:{...currentStacks},log:[...logEvents],folded:new Set(foldedActors)};
        frames.push({duration:10,draw:(ctx)=>{
          drawScene(ctx,{...base,pot:revealSnap.pot,stacks:revealSnap.stacks,
            board:revealSnap.board,flipStates:Array(revealSnap.board.length).fill(1),
            logEvents:revealSnap.log,currentStreet:revealSnap.str,betAmounts:revealSnap.bets,
            showHeroCards:true,heroCardsFaceUp:true,foldedActors:revealSnap.folded,
            revealedActors:new Set()});
          // (no "everyone's all-in" banner — usually only one player is; the
          // ALL IN tags on the players themselves say who, see drawAllInTags)
        }});
        frames.push({duration:28,draw:(ctx,t)=>{
          drawScene(ctx,{...base,pot:revealSnap.pot,stacks:revealSnap.stacks,
            board:revealSnap.board,flipStates:Array(revealSnap.board.length).fill(1),
            logEvents:revealSnap.log,currentStreet:revealSnap.str,betAmounts:revealSnap.bets,
            showHeroCards:true,heroCardsFaceUp:true,foldedActors:revealSnap.folded,
            revealedActors:new Set()});
          toReveal.forEach((p,i)=>{
            const ft=Math.min(1,easeInOut(Math.max(0,(t-i*.12)*2.2)));
            drawHoleCards(ctx,p.position,opponentCardsById[p.id],ft>=1,ft);
          });
        }});
        revealedActors=new Set([...revealedActors,...toReveal.map(p=>p.id)]);
        const afterSnap={folded:new Set(foldedActors),revealed:new Set(revealedActors)};
        frames.push({duration:16,draw:(ctx)=>{
          drawScene(ctx,{...base,pot:revealSnap.pot,stacks:revealSnap.stacks,
            board:revealSnap.board,flipStates:Array(revealSnap.board.length).fill(1),
            logEvents:revealSnap.log,currentStreet:revealSnap.str,betAmounts:revealSnap.bets,
            showHeroCards:true,heroCardsFaceUp:true,foldedActors:afterSnap.folded,
            revealedActors:afterSnap.revealed});
        }});
      }

    } else if(ev.type==='action'){
      const actorIsHero=ev.actor==='hero';
      const actorOpp=actorIsHero?null:opponents.find(o=>o.id===ev.actor||o.id===parseInt(ev.actor));
      const actorPos=actorIsHero?hero_position:actorOpp?.position;
      const hasChips=ev.amount>0;
      if(hasChips&&actorPos) betAmounts={...betAmounts,[actorPos]:(betAmounts[actorPos]||0)+ev.amount};

      const newLog=[...logEvents,{...ev,opponentLabel:actorOpp?.label||null,pos:actorPos}];
      const snap={board:[...revealedBoard],str:currentStreet,bets:{...betAmounts},
        folded:new Set(foldedActors),revealed:new Set(revealedActors)};
      const badge={pos:actorPos,action:ev.action,amount:ev.amount};

      // ── FOLD: slide cards to center, then update foldedActors ──
      if(ev.action==='fold'&&actorPos){
        const foldSnap={board:[...revealedBoard],str:currentStreet,bets:{...betAmounts},
          pot:currentPot,stacks:{...currentStacks},log:[...logEvents],
          folded:new Set(foldedActors),revealed:new Set(revealedActors)};
        frames.push({duration:14,draw:(ctx,t)=>{
          drawScene(ctx,{...base,pot:foldSnap.pot,stacks:foldSnap.stacks,
            board:foldSnap.board,flipStates:Array(foldSnap.board.length).fill(1),
            logEvents:foldSnap.log,currentStreet:foldSnap.str,betAmounts:foldSnap.bets,
            showHeroCards:true,heroCardsFaceUp:true,foldedActors:foldSnap.folded,
            revealedActors:foldSnap.revealed});
          drawFoldSlide(ctx,actorPos,easeInOut(t));
        }});
        foldedActors=new Set([...foldedActors,actorIsHero?'hero':ev.actor]);
        snap.folded=new Set(foldedActors);
      }

      // 40f — סגנון "PokerStars hand replayer" קלאסי (לפי סרטון ייחוס שהמשתמש
      // סיפק): הצ'יפים לא עפים מיד למרכז עם כל פעולה — סמן ההימור גדל *במקום*
      // ליד השחקן, נשאר שם וגלוי לאורך כל הסיבוב (הפרדה מרחבית ברורה בין
      // הפעולות של כל שחקן), והקופה למעלה היא תווית טקסט חיה שמסתנכרנת עם
      // סכום הסמנים. תנועה דרמטית למרכז שמורה רק לרגעים משמעותיים — סוף
      // סיבוב ההימורים (הטאטוא, ראה roundOver למטה), לא לכל פעולה בודדת.
      frames.push({duration:40,draw:(ctx,t)=>{
        const interpPot=lerp(ev.potBefore,ev.potAfter,hasChips?easeInOut(t):0);
        const interpStacks={};
        Object.keys(ev.stacksBefore).forEach(k=>{
          interpStacks[k]=lerp(ev.stacksBefore[k]||0,ev.stacksAfter[k]||0,hasChips?easeInOut(t):0);
        });
        const interpBets={...snap.bets};
        if(hasChips&&actorPos) interpBets[actorPos]=(betAmounts[actorPos]||0)*easeInOut(t);
        drawScene(ctx,{...base,pot:interpPot,stacks:interpStacks,
          board:snap.board,flipStates:Array(snap.board.length).fill(1),
          logEvents:newLog,currentStreet:snap.str,betAmounts:interpBets,
          showHeroCards:true,heroCardsFaceUp:true,foldedActors:snap.folded,
          revealedActors:snap.revealed,
          actionBadge:badge,actionBadgeAlpha:Math.min(1,t*4)});
      }});

      const pausePot=ev.potAfter, pauseStacks={...ev.stacksAfter};
      // 16f (היה 7) — עוד רגע החזקה אחרי שהצ'יפים הגיעו, לפני שעוברים לפעולה הבאה
      frames.push({duration:16,draw:(ctx,t)=>{
        drawScene(ctx,{...base,pot:pausePot,stacks:pauseStacks,
          board:snap.board,flipStates:Array(snap.board.length).fill(1),
          logEvents:newLog,currentStreet:snap.str,betAmounts:snap.bets,
          showHeroCards:true,heroCardsFaceUp:true,foldedActors:snap.folded,
          revealedActors:snap.revealed,
          actionBadge:badge,actionBadgeAlpha:1-easeOut(t)});
      }});

      logEvents=newLog; currentPot=ev.potAfter; currentStacks={...ev.stacksAfter};

      // סוף סיבוב הימורים בשלב הזה (הפעולה הבאה — אם יש — שייכת לשלב אחר,
      // או שאין פעולה נוספת בכלל): מטאטאים את כל סמני ההימור שנשארו ליד
      // השחקנים לתוך הקופה במרכז ואז מוחקים אותם — הפרדה ברורה בין הסיבוב
      // שנגמר לפעולה/לשלב הבא, במקום שהם פשוט יישארו תלויים על המסך
      const nextEv=events[evIdx+1];
      const roundOver=!nextEv||nextEv.type!=='action'||nextEv.street!==ev.street;
      if(roundOver&&Object.keys(betAmounts).length){
        const sweepFrom={...betAmounts};
        const sweepSnap={board:[...revealedBoard],str:currentStreet,pot:currentPot,
          stacks:{...currentStacks},log:[...logEvents],
          folded:new Set(foldedActors),revealed:new Set(revealedActors)};
        frames.push({duration:18,draw:(ctx,t)=>{
          const et=easeInOut(t);
          const fadingBets={};
          Object.entries(sweepFrom).forEach(([pos,amt])=>{ fadingBets[pos]=amt*(1-et); });
          drawScene(ctx,{...base,pot:sweepSnap.pot,stacks:sweepSnap.stacks,
            board:sweepSnap.board,flipStates:Array(sweepSnap.board.length).fill(1),
            logEvents:sweepSnap.log,currentStreet:sweepSnap.str,betAmounts:fadingBets,
            showHeroCards:true,heroCardsFaceUp:true,foldedActors:sweepSnap.folded,
            revealedActors:sweepSnap.revealed});
          Object.entries(sweepFrom).forEach(([pos,amt])=>{
            const{x,y}=seatBet(pos);
            drawChipParticles(ctx,x,y,TCX,TCY,et,amt);
          });
        }});
        betAmounts={};
      }
    }
  });

  // ── RESULT ──────────────────────────── 60-70f
  const preResultBoard=[...revealedBoard];
  const preResultStacks={...currentStacks};
  const winnerXY=winnerPos?seatOuter(winnerPos):{x:TCX,y:TCY};
  const resultColor=result==='won'?'#22c55e':result==='lost'?'#ef4444':'#f8c030';
  const resultLabel=result==='won'?'ניצחון! 🏆':result==='lost'?'הפסד 💀':'קופה מחולקת 🤝';
  // מציגים קלפי יריב בתוצאה כשידועים — בין אם כבר נחשפו קודם (אירוע 'reveal',
  // אול-אין באמצע היד) ובין אם זו הפעם הראשונה (שואודאון רגיל אחרי הריבר)
  const oppCardsAtResult=(p)=>opponentCardsById[p.id]||null;

  if(result==='unknown'){
    // "מה היית עושה?" — היד נעצרה מכוונת בנקודת החלטה (כפתור ? באשף), כדי
    // לשתף ולקבל פידבק בלי לחשוף תוצאה. בלי תזוזת צ'יפים, בלי מנצח — פשוט
    // עוצרים איפה שהפעולות שנרשמו נעצרות ושואלים
    // שלב 1 (50f, ~1.7s): השולחן עוד נראה לרגע לקונטקסט, הוילון מכהה במהירות
    // והכרטיס נכנס — לא נשארים כאן מספיק זמן בשביל לקרוא, זו רק המעבר
    frames.push({duration:50,draw:(ctx,t)=>{
      drawBG(ctx); drawTable(ctx);
      drawTopHUD(ctx,isCash,cash_stakes,sb,bb,ante,tournament_stage);
      allPlayers.forEach(p=>{
        const stk=Math.round(preResultStacks[p.isHero?'hero':p.id]??p.stack??0);
        drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,p.position==='BTN',false);
        if(p.isHero) drawHoleCards(ctx,p.position,hero_cards,true);
        else drawHoleCards(ctx,p.position,null,false); // יריב לא נחשף — זו כל הנקודה של מצב "שאלה"
      });
      drawBoard(ctx,preResultBoard,Array(preResultBoard.length).fill(1));
      if(isMultiPot){
        const potPositions=getPotPilePositions(pots.length);
        pots.forEach((pot,i)=>{
          const{x,y}=potPositions[i];
          const label=i===0?'MAIN POT':(pots.length>2?`SIDE POT ${i}`:'SIDE POT');
          drawPotPile(ctx,x,y,pot.amount,label,isCash);
        });
      } else {
        drawPotCenter(ctx,currentPot,isCash);
      }
      drawMiniLog(ctx,logEvents,allPlayers.map(p=>p.position));
      drawPotDisplay(ctx,currentPot,sb,bb,ante,isCash,cash_stakes);

      const rt=Math.min(1,t*2.2);
      // וילון הרבה יותר חזק (עד 0.88, לא 0.55) — השולחן צריך לשקוע לגמרי
      // לרקע כדי שהשאלה תהיה הדבר היחיד שבאמת קוראים, לא מתחרה עם הבלגן
      // של הקלפים/הצ'יפים/הלוג מתחת
      ctx.globalAlpha=easeOut(rt)*0.88;
      ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
      drawQuestionCard(ctx,easeOut(Math.min(1,t*1.8)));
    }});
    // שלב 2 (110f, ~3.7s): החזקה מלאה — רק הכרטיס, בלי הלוג/הקופה שמסיחים
    // את הדעת — הזמן העיקרי לקרוא ולצלם מסך
    frames.push({duration:110,draw:(ctx)=>{
      drawBG(ctx); drawTable(ctx);
      drawTopHUD(ctx,isCash,cash_stakes,sb,bb,ante,tournament_stage);
      allPlayers.forEach(p=>{
        const stk=Math.round(preResultStacks[p.isHero?'hero':p.id]??p.stack??0);
        drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,p.position==='BTN',false);
        if(p.isHero) drawHoleCards(ctx,p.position,hero_cards,true);
        else drawHoleCards(ctx,p.position,null,false);
      });
      if(preResultBoard.length) drawBoard(ctx,preResultBoard,Array(preResultBoard.length).fill(1));

      ctx.fillStyle='rgba(0,0,0,0.88)'; ctx.fillRect(0,0,W,H);
      drawQuestionCard(ctx,1);

      ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='bold 12px Arial';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText('PokerIsrael.org',TCX,H-10);
    }});
  } else if(isMultiPot){
    const potPositions=getPotPilePositions(pots.length);
    const potWinnerXY=pots.map(pot=>{
      const w=(pot.winners&&pot.winners[0])||null;
      if(!w) return {x:TCX,y:TCY};
      if(w==='hero') return seatOuter(hero_position);
      const opp=opponents.find(o=>String(o.id)===String(w));
      return opp?seatOuter(opp.position):{x:TCX,y:TCY};
    });
    const winSet=new Set();
    pots.forEach(pot=>(pot.winners||[]).forEach(w=>winSet.add(w)));

    frames.push({duration:70,draw:(ctx,t)=>{
      const moveT=Math.min(1,t*2);
      // סוכמים את חלקו של כל שחקן על פני *כל* הקופות לפני הציור — שחקן
      // שמנצח יותר מקופה אחת (למשל הקופה הראשית וגם קופת הצד) צריך שהאנימציה
      // תראה את הסכום המצטבר, לא רק את חלקו בקופה האחרונה שעברנו עליה
      const shareByActor={};
      pots.forEach(pot=>{
        const winners=pot.winners||[];
        if(!winners.length) return;
        const share=Math.floor(pot.amount/winners.length);
        winners.forEach(w=>{ shareByActor[w]=(shareByActor[w]||0)+share; });
      });
      const animStacks={...preResultStacks};
      Object.entries(shareByActor).forEach(([w,totalShare])=>{
        animStacks[w]=lerp(preResultStacks[w]||0,(preResultStacks[w]||0)+totalShare,easeInOut(moveT));
      });

      drawBG(ctx); drawTable(ctx);
      drawTopHUD(ctx,isCash,cash_stakes,sb,bb,ante,tournament_stage);
      allPlayers.forEach(p=>{
        const key=p.isHero?'hero':p.id;
        const stk=Math.round(animStacks[key]??p.stack??0);
        const isWin=winSet.has(key)&&t>.5;
        drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,p.position==='BTN',isWin);
        if(p.isHero) drawHoleCards(ctx,p.position,hero_cards,true);
        else { const oc=oppCardsAtResult(p); drawHoleCards(ctx,p.position,oc,!!oc); }
      });
      drawAllInTags(ctx,allInPositions(logEvents));
      drawBoard(ctx,preResultBoard,Array(preResultBoard.length).fill(1));
      pots.forEach((pot,i)=>{
        const{x,y}=potPositions[i];
        const remaining=lerp(pot.amount,0,easeInOut(moveT));
        const label=i===0?'MAIN POT':(pots.length>2?`SIDE POT ${i}`:'SIDE POT');
        drawPotPile(ctx,x,y,remaining,label,isCash);
        if(pot.winners?.length) drawChipParticles(ctx,x,y,potWinnerXY[i].x,potWinnerXY[i].y,moveT,pot.amount);
      });
      drawMiniLog(ctx,logEvents,allPlayers.map(p=>p.position));
      const totalRemaining=pots.reduce((s,pot)=>s+lerp(pot.amount,0,easeInOut(moveT)),0);
      drawPotDisplay(ctx,totalRemaining,sb,bb,ante,isCash,cash_stakes);

      if(t>.42){
        const rt=(t-.42)*1.6;
        ctx.globalAlpha=Math.min(.55,easeOut(rt)*.55);
        ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
        ctx.save();
        ctx.translate(TCX,TCY-18);
        const sc=.5+Math.min(.5,easeOut(rt)*.95); ctx.scale(sc,sc);
        ctx.globalAlpha=Math.min(1,easeOut(rt*2.5));
        setSh(ctx,resultColor,14);
        ctx.fillStyle=resultColor; ctx.font='bold 46px Arial';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(resultLabel,0,0);
        clrSh(ctx); ctx.restore();
        if(hero_profit){
          const ps=hero_profit>0?`+${hero_profit}`:`${hero_profit}`;
          ctx.globalAlpha=Math.min(1,easeOut((rt-.2)*3));
          ctx.fillStyle=resultColor; ctx.font='bold 24px Arial';
          ctx.textAlign='center';
          ctx.fillText(`${ps}${isCash?'₪':' chips'}`,TCX,TCY+58);
          ctx.globalAlpha=1;
        }
      }
    }});
  } else {
    frames.push({duration:60,draw:(ctx,t)=>{
      const moveT=Math.min(1,t*2);
      const animStacks={...preResultStacks};
      const winKey=result==='won'?'hero':winnerOpponent?.id;
      if(winKey!=null) animStacks[winKey]=lerp(preResultStacks[winKey]||0,(preResultStacks[winKey]||0)+finalPot,easeInOut(moveT));

      drawBG(ctx); drawTable(ctx);
      drawTopHUD(ctx,isCash,cash_stakes,sb,bb,ante,tournament_stage);
      allPlayers.forEach(p=>{
        const stk=Math.round(animStacks[p.isHero?'hero':p.id]??p.stack??0);
        const isWin=(result==='won'&&p.isHero)||(result==='lost'&&!p.isHero&&winnerOpponent&&String(p.id)===String(winnerOpponent.id));
        drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,p.position==='BTN',isWin&&t>.5);
        if(p.isHero) drawHoleCards(ctx,p.position,hero_cards,true);
        else { const oc=oppCardsAtResult(p); drawHoleCards(ctx,p.position,oc,!!oc); }
      });
      drawAllInTags(ctx,allInPositions(logEvents));
      drawBoard(ctx,preResultBoard,Array(preResultBoard.length).fill(1));
      drawPotCenter(ctx,lerp(currentPot,0,easeInOut(moveT)),isCash);
      drawChipParticles(ctx,TCX,TCY,winnerXY.x,winnerXY.y,moveT,finalPot);
      drawMiniLog(ctx,logEvents,allPlayers.map(p=>p.position));
      drawPotDisplay(ctx,lerp(currentPot,0,easeInOut(moveT)),sb,bb,ante,isCash,cash_stakes);

      if(t>.38){
        const rt=(t-.38)*1.65;
        ctx.globalAlpha=Math.min(.55,easeOut(rt)*.55);
        ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
        ctx.save();
        ctx.translate(TCX,TCY-18);
        const sc=.5+Math.min(.5,easeOut(rt)*.95); ctx.scale(sc,sc);
        ctx.globalAlpha=Math.min(1,easeOut(rt*2.5));
        setSh(ctx,resultColor,14);
        ctx.fillStyle=resultColor; ctx.font='bold 64px Arial';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(resultLabel,0,0);
        clrSh(ctx); ctx.restore();
        if(hero_profit){
          const ps=hero_profit>0?`+${hero_profit}`:`${hero_profit}`;
          ctx.globalAlpha=Math.min(1,easeOut((rt-.2)*3));
          ctx.fillStyle=resultColor; ctx.font='bold 26px Arial';
          ctx.textAlign='center';
          ctx.fillText(`${ps}${isCash?'₪':' chips'}`,TCX,TCY+50);
          ctx.globalAlpha=1;
        }
      }
    }});
  }

  // ── OUTRO ─────────────────────────── 30f (players visible + result overlay)
  // לא רלוונטי במצב "מה היית עושה?" — הסצינה של result==='unknown' למעלה כבר
  // כוללת סיום משלה (בלי תוצאה/תזוזת צ'יפים לחשוף)
  if(result!=='unknown'){
  frames.push({duration:30,draw:(ctx,t)=>{
    drawBG(ctx); drawTable(ctx);
    drawTopHUD(ctx,isCash,cash_stakes,sb,bb,ante,tournament_stage);

    // Draw players with final stacks
    const outroWinSet=isMultiPot
      ? new Set(pots.flatMap(pot=>pot.winners||[]))
      : new Set([result==='won'?'hero':(winnerOpponent?.id??null)].filter(k=>k!=null));
    allPlayers.forEach(p=>{
      const stk=Math.round((finalStacks[p.isHero?'hero':p.id]??p.stack??0));
      const isWin=outroWinSet.has(p.isHero?'hero':p.id);
      drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,p.position==='BTN',isWin);
      if(p.isHero) drawHoleCards(ctx,p.position,hero_cards,true);
      else { const oc=oppCardsAtResult(p); drawHoleCards(ctx,p.position,oc,!!oc); }
    });
    drawAllInTags(ctx,allInPositions(logEvents));
    if(preResultBoard.length) drawBoard(ctx,preResultBoard,Array(preResultBoard.length).fill(1));

    // Dark vignette for result overlay
    ctx.globalAlpha=0.52;
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=1;

    // Result text
    const sc=.8+Math.min(.2,easeOut(t)*.28);
    ctx.save(); ctx.translate(TCX,TCY-22); ctx.scale(sc,sc);
    ctx.globalAlpha=Math.min(1,easeOut(t*2.4));
    setSh(ctx,resultColor,16);
    ctx.fillStyle=resultColor; ctx.font='bold 58px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(resultLabel,0,0);
    clrSh(ctx); ctx.restore();

    if(hero_profit){
      const ps=hero_profit>0?`+${hero_profit}`:`${hero_profit}`;
      ctx.globalAlpha=Math.min(1,(t-.1)*3.5);
      setSh(ctx,'rgba(0,0,0,0.8)',6);
      ctx.fillStyle=resultColor; ctx.font='bold 26px Arial';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${ps}${isCash?'₪':' chips'}`,TCX,TCY+54);
      clrSh(ctx);
    }

    ctx.globalAlpha=Math.min(1,(t-.35)*4);
    ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='bold 12px Arial';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('PokerIsrael.org',TCX,H-10);
    ctx.globalAlpha=1;
  }});
  }

  // every drawn frame advances FRAME_NO (animation clock, see drawAllInTags)
  return{frames:frames.map(f=>({...f,draw:(ctx,t)=>{FRAME_NO++; f.draw(ctx,t);}})),W,H};
}

// ════════════════════════════════════════════════════
// RECORD VIDEO — WebCodecs (no captureStream, no GPU crash)
// ════════════════════════════════════════════════════
// 1.6× → 1536×864: about the pixel count the old 2× on 760×480 had (1520×960),
// so the 16:9 canvas doesn't raise the per-frame encoder memory on mobile
const RENDER_SCALE = 1.6;

export async function recordVideo(state,onProgress){
  // WebCodecs מדווח את עצמו כזמין (typeof VideoEncoder!=='undefined') גם
  // כשההגדרה בפועל (קודק/רזולוציה/דרייבר GPU) לא נתמכת במכשיר הספציפי —
  // configure/encode יכולים אז לזרוק או לדווח שגיאה ב-callback באמצע ההקלטה.
  // בלי ה-try/catch כאן, המשתמש נתקע עם "שגיאה בייצור הסרטון" בלי חלופה,
  // במקום ליפול בחזרה אוטומטית ל-MediaRecorder (recordVideoLegacy) שעובד
  // בכל דפדפן מודרני
  if(typeof VideoEncoder!=='undefined'){
    try{
      return await recordVideoWebCodecs(state,onProgress);
    }catch(e){
      console.error('WebCodecs recording failed, falling back to MediaRecorder:',e);
    }
  }
  return recordVideoLegacy(state,onProgress);
}

async function recordVideoWebCodecs(state,onProgress){
  const{frames,W,H}=buildFrames(state);
  const RW=W*RENDER_SCALE, RH=H*RENDER_SCALE;

  if(typeof VideoEncoder.isConfigSupported==='function'){
    const support=await VideoEncoder.isConfigSupported({codec:'vp8',width:RW,height:RH,bitrate:4_000_000,framerate:30});
    if(!support?.supported) throw new Error('VP8 WebCodecs config not supported on this device');
  }

  const canvas=document.createElement('canvas');
  canvas.width=RW; canvas.height=RH;
  const ctx=canvas.getContext('2d');
  ctx.scale(RENDER_SCALE,RENDER_SCALE);

  const FPS=30;
  const FRAME_US=Math.round(1_000_000/FPS);
  const total=frames.reduce((s,f)=>s+f.duration,0);

  // Dynamic import to avoid bundling issues
  const{Muxer,ArrayBufferTarget}=await import('webm-muxer');
  const muxer=new Muxer({
    target:new ArrayBufferTarget(),
    video:{codec:'V_VP8',width:RW,height:RH,frameRate:FPS},
  });

  let encErr=null;
  const encoder=new VideoEncoder({
    output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),
    error:(e)=>{encErr=e;},
  });
  encoder.configure({codec:'vp8',width:RW,height:RH,bitrate:4_000_000,framerate:FPS});

  let frameIdx=0;
  for(const f of frames){
    for(let i=0;i<f.duration;i++){
      if(encErr) throw encErr;
      // Backpressure — software VP8 encoding often lags behind frame generation
      // (especially at RENDER_SCALE 2× on mobile). Without this, raw frames pile
      // up in the encoder's internal queue (~5.8MB each) until the tab is
      // OOM-killed mid-recording instead of ever reaching onstop/resolve.
      while(encoder.encodeQueueSize>2){
        await new Promise(r=>encoder.addEventListener('dequeue',r,{once:true}));
        if(encErr) throw encErr;
      }
      f.draw(ctx,i/f.duration);
      const vf=new VideoFrame(canvas,{timestamp:frameIdx*FRAME_US,duration:FRAME_US});
      encoder.encode(vf,{keyFrame:frameIdx%FPS===0});
      vf.close();
      frameIdx++;
      if(onProgress) onProgress(Math.round((frameIdx/total)*100));
      // yield every 15 frames to keep UI responsive
      if(frameIdx%15===0) await new Promise(r=>setTimeout(r,0));
    }
  }

  await encoder.flush();
  if(encErr) throw encErr;
  muxer.finalize();
  return new Blob([muxer.target.buffer],{type:'video/webm'});
}

// Safari (iOS + macOS) doesn't support 'video/webm' in MediaRecorder at all — the
// constructor throws synchronously, which used to surface as a cryptic inline error
// with no fallback. Try formats in preference order and use whichever the browser
// actually supports instead of assuming webm everywhere.
const LEGACY_MIME_CANDIDATES=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4;codecs=h264','video/mp4'];
function pickSupportedMimeType(){
  return LEGACY_MIME_CANDIDATES.find(mt=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported?.(mt));
}

// Fallback for browsers without WebCodecs
async function recordVideoLegacy(state,onProgress){
  const{frames,W,H}=buildFrames(state);
  const RW=W*RENDER_SCALE, RH=H*RENDER_SCALE;
  const canvas=document.createElement('canvas');
  canvas.width=RW; canvas.height=RH;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.scale(RENDER_SCALE,RENDER_SCALE);
  const FPS=30, MS=Math.round(1000/FPS);
  const chunks=[];
  const stream=canvas.captureStream(FPS);
  const mimeType=pickSupportedMimeType();
  if(!mimeType) throw new Error('No supported video recording format on this browser');
  const blobType=mimeType.split(';')[0];
  const rec=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:1_500_000});
  rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
  const total=frames.reduce((s,f)=>s+f.duration,0);
  let seg=0,fin=0,drawn=0;
  rec.start(200);
  await new Promise((resolve,reject)=>{
    const tick=()=>{
      if(seg>=frames.length){rec.stop();resolve();return;}
      try{frames[seg].draw(ctx,fin/frames[seg].duration);}
      catch(e){rec.stop();reject(e);return;}
      drawn++; fin++;
      if(onProgress) onProgress(Math.round((drawn/total)*100));
      if(fin>=frames[seg].duration){seg++;fin=0;}
      setTimeout(tick,MS);
    };
    tick();
  });
  await new Promise(r=>{rec.onstop=r;});
  return new Blob(chunks,{type:blobType});
}
