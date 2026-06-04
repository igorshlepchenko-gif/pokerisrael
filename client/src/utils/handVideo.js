// PokerIsrael – Top-Down Table Video (inspired by poker broadcast style)
// Style: dark damask background, teal felt, thick orange rail, player cards on table

// ════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════
const W = 760, H = 480;

// Table – large, centered
const TCX = 385, TCY = 248;
const TRX = 290, TRY = 168;

// Teal-green felt colours
const FELT_INNER  = '#1e8868';
const FELT_OUTER  = '#0e5040';
// Orange rail
const RAIL_LIGHT  = '#f0a030';
const RAIL_DARK   = '#b07020';

const SUIT_SYM   = { s:'♠', h:'♥', d:'♦', c:'♣' };
const SUIT_COLOR = { s:'#1e293b', h:'#dc2626', d:'#dc2626', c:'#1e293b' };

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
function rr(ctx, x, y, w, h, r, fill, stroke, sw=1) {
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

// ════════════════════════════════════════════════════════
// DAMASK BACKGROUND
// ════════════════════════════════════════════════════════
function drawBG(ctx) {
  // Base dark charcoal
  ctx.fillStyle = '#1a1c2e';
  ctx.fillRect(0, 0, W, H);

  // Damask/floral tile pattern
  const step = 38;
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 0.7;
  for (let gx = 0; gx < W + step; gx += step) {
    for (let gy = 0; gy < H + step; gy += step) {
      // 4-petal flower
      for (let p = 0; p < 4; p++) {
        const px = gx + (p === 0 ? 9 : p === 2 ? -9 : 0);
        const py = gy + (p === 1 ? 9 : p === 3 ? -9 : 0);
        const angle = p * Math.PI / 2;
        ctx.beginPath();
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2);
        ctx.restore();
        ctx.stroke();
      }
      // Center diamond
      ctx.beginPath();
      ctx.moveTo(gx, gy-5); ctx.lineTo(gx+5, gy);
      ctx.lineTo(gx, gy+5); ctx.lineTo(gx-5, gy);
      ctx.closePath(); ctx.stroke();
    }
  }

  // Subtle radial vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*.25, W/2, H/2, H*.75);
  vig.addColorStop(0,'rgba(0,0,0,0)');
  vig.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);
}

// ════════════════════════════════════════════════════════
// TABLE (top-down oval, teal + orange)
// ════════════════════════════════════════════════════════
function drawTable(ctx) {
  const cx=TCX, cy=TCY, rx=TRX, ry=TRY;

  // Drop shadow
  setSh(ctx,'rgba(0,0,0,0.85)',50,0,18);
  ctx.beginPath(); ctx.ellipse(cx,cy+12,rx+18,ry+18,0,0,Math.PI*2);
  ctx.fillStyle='#000'; ctx.fill(); clrSh(ctx);

  // Outer dark band
  ctx.beginPath(); ctx.ellipse(cx,cy,rx+26,ry+26,0,0,Math.PI*2);
  ctx.fillStyle='#1a0c04'; ctx.fill();

  // Orange/amber rail (thick)
  ctx.beginPath(); ctx.ellipse(cx,cy,rx+18,ry+18,0,0,Math.PI*2);
  const rail=ctx.createLinearGradient(cx-rx,cy-ry,cx+rx,cy+ry);
  rail.addColorStop(0,   '#a05c10');
  rail.addColorStop(0.25,RAIL_LIGHT);
  rail.addColorStop(0.5, '#ffc040');
  rail.addColorStop(0.75,RAIL_LIGHT);
  rail.addColorStop(1,   '#a05c10');
  ctx.fillStyle=rail; ctx.fill();

  // Inner rail lip
  ctx.beginPath(); ctx.ellipse(cx,cy,rx+5,ry+5,0,0,Math.PI*2);
  ctx.fillStyle='#160a02'; ctx.fill();

  // Teal felt
  ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  const felt=ctx.createRadialGradient(cx-70,cy-55,15,cx,cy,rx*1.1);
  felt.addColorStop(0,   FELT_INNER);
  felt.addColorStop(0.5, '#168058');
  felt.addColorStop(1,   FELT_OUTER);
  ctx.fillStyle=felt; ctx.fill();

  // Felt texture lines
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,0.018)'; ctx.lineWidth=1;
  for(let yy=cy-ry; yy<cy+ry; yy+=10){
    ctx.beginPath(); ctx.moveTo(cx-rx,yy); ctx.lineTo(cx+rx,yy); ctx.stroke();
  }
  // PokerIsrael.org — subtle centered
  ctx.globalAlpha=0.08;
  ctx.fillStyle='#fff';
  ctx.font='bold italic 24px Georgia, serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('PokerIsrael.org', cx, cy+ry*.55);
  ctx.globalAlpha=1;
  ctx.restore();
}

// ════════════════════════════════════════════════════════
// CARD DRAWING
// ════════════════════════════════════════════════════════
function _face(ctx,x,y,w,h,rank,suit){
  rr(ctx,x,y,w,h,4,'#f8fafc',null);
  ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=.6;
  ctx.beginPath(); ctx.moveTo(x+4,y);ctx.arcTo(x+w,y,x+w,y+4,4);ctx.arcTo(x+w,y+h,x+w-4,y+h,4);ctx.arcTo(x,y+h,x,y+h-4,4);ctx.arcTo(x,y,x+4,y,4);ctx.closePath();ctx.stroke();
  if(!rank||!suit) return;
  const col=SUIT_COLOR[suit]||'#1e293b'; const sym=SUIT_SYM[suit]||'?';
  ctx.fillStyle=col;
  ctx.font=`bold ${Math.round(w*.34)}px Arial`; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(rank,x+3,y+2);
  ctx.font=`${Math.round(w*.28)}px Arial`; ctx.fillText(sym,x+3,y+w*.38);
  ctx.font=`${Math.round(h*.42)}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(sym,x+w/2,y+h*.56);
}
function _back(ctx,x,y,w,h){
  rr(ctx,x,y,w,h,4,'#1e3a6e',null);
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#1e3a8a'); g.addColorStop(1,'#1d4ed8');
  ctx.fillStyle=g; ctx.fillRect(x+2,y+2,w-4,h-4);
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=.8;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x+2,y+2+i*(h-4)/3);ctx.lineTo(x+w-2,y+2+i*(h-4)/3);ctx.stroke();}
}
function drawCard(ctx,x,y,w,h,rank,suit,faceUp=true){
  setSh(ctx,'rgba(0,0,0,0.55)',8,2,4);
  if(faceUp)_face(ctx,x,y,w,h,rank,suit); else _back(ctx,x,y,w,h);
  clrSh(ctx);
}
function drawCardFlip(ctx,x,y,w,h,rank,suit,t){
  const scaleX=t<.5?1-t*2:(t-.5)*2; const faceUp=t>=.5;
  ctx.save();setSh(ctx,'rgba(0,0,0,0.5)',8,2,4);
  ctx.translate(x+w/2,y+h/2);ctx.scale(Math.max(.001,scaleX),1);ctx.translate(-(x+w/2),-(y+h/2));
  if(faceUp)_face(ctx,x,y,w,h,rank,suit);else _back(ctx,x,y,w,h);
  clrSh(ctx);ctx.restore();
}

// ════════════════════════════════════════════════════════
// CHIP STACK
// ════════════════════════════════════════════════════════
const CHIP_PAL=['#dc2626','#1e293b','#3b82f6','#16a34a','#e2e8f0'];
function drawChipStack(ctx,cx,cy,count=5,c1='#dc2626',c2='#1e293b'){
  const r=8,th=3.5;
  for(let i=count-1;i>=0;i--){
    const yy=cy-i*th;
    ctx.beginPath();ctx.ellipse(cx,yy+1,r,r*.3,0,0,Math.PI*2);
    ctx.fillStyle=i%2===0?c1:c2;ctx.fill();
    ctx.beginPath();ctx.ellipse(cx,yy,r,r*.34,0,0,Math.PI*2);
    const cf=ctx.createRadialGradient(cx-2,yy-1,0,cx,yy,r);
    cf.addColorStop(0,i%2===0?'#f87171':'#475569');cf.addColorStop(1,i%2===0?c1:c2);
    ctx.fillStyle=cf;ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=.4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-r*.4,yy);ctx.lineTo(cx+r*.4,yy);
    ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.stroke();
  }
}

// ════════════════════════════════════════════════════════
// SEAT POSITIONS
// ════════════════════════════════════════════════════════
// Angles: 0°=right, 90°=bottom, 180°=left, 270°=top (canvas y-down)
// BTN at bottom-right (close to viewer, like reference image)
const SEAT_DEG={BTN:42, SB:80, BB:130, UTG:178, 'UTG+1':215, MP:248, HJ:292, CO:338};

// Outside rail — player info box
function seatOuter(pos){
  const deg=SEAT_DEG[pos]||0; const rad=deg*Math.PI/180;
  return{x:TCX+(TRX+54)*Math.cos(rad), y:TCY+(TRY+44)*Math.sin(rad)};
}
// On felt near seat — hole cards
function seatCards(pos){
  const deg=SEAT_DEG[pos]||0; const rad=deg*Math.PI/180;
  return{x:TCX+(TRX-40)*Math.cos(rad), y:TCY+(TRY-26)*Math.sin(rad)};
}
// Bet area (between player and center)
function seatBet(pos){
  const deg=SEAT_DEG[pos]||0; const rad=deg*Math.PI/180;
  return{x:TCX+(TRX*.55)*Math.cos(rad), y:TCY+(TRY*.55)*Math.sin(rad)};
}

// ════════════════════════════════════════════════════════
// PLAYER BOX (outside rail)
// ════════════════════════════════════════════════════════
function drawPlayerBox(ctx, pos, label, stack, isHero, isDealer=false, isWinner=false){
  const {x,y}=seatOuter(pos);
  const bw=72, bh=36;
  const bx=x-bw/2, by=y-bh/2;

  // Glow for winner
  if(isWinner){setSh(ctx,'#fbbf24',16);rr(ctx,bx-2,by-2,bw+4,bh+4,8,'rgba(251,191,36,0.15)',null);clrSh(ctx);}

  // Box background
  const boxBg=isHero?'rgba(29,78,216,0.25)':'rgba(10,18,36,0.92)';
  const boxBorder=isHero?'#3b82f6':isWinner?'#fbbf24':'#2d3d55';
  rr(ctx,bx,by,bw,bh,6,boxBg,boxBorder,isHero?1.5:1);

  // Avatar circle
  ctx.beginPath();ctx.arc(bx+14,by+bh/2,10,0,Math.PI*2);
  ctx.fillStyle=isHero?'#1d4ed8':'#1e3a5f';ctx.fill();
  ctx.strokeStyle=isHero?'#60a5fa':'#3b5270';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText((label||'P')[0].toUpperCase(),bx+14,by+bh/2);

  // Name
  ctx.fillStyle=isHero?'#93c5fd':'#e2e8f0';
  ctx.font='bold 9px Arial';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText((label||'Player').substring(0,8),bx+28,by+5);

  // Stack
  const stackDisp=isWinner?`+${stack}`:stack;
  ctx.fillStyle=isWinner?'#fbbf24':isHero?'#60a5fa':'#94a3b8';
  ctx.font='bold 9px Arial';ctx.textBaseline='bottom';
  ctx.fillText(`$${typeof stackDisp==='number'?stackDisp.toLocaleString():stackDisp}`,bx+28,by+bh-4);

  // Dealer button
  if(isDealer){
    ctx.beginPath();ctx.arc(bx+bw-6,by+6,7,0,Math.PI*2);
    ctx.fillStyle='#fff';ctx.fill();
    ctx.strokeStyle='#1d4ed8';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#1d4ed8';ctx.font='bold 7px Arial';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('D',bx+bw-6,by+6);
  }

  // Position badge (small, on outer edge of box)
  const posC={BTN:'#7c3aed',BB:'#b91c1c',SB:'#c2410c'};
  const pc=posC[pos]||'#1e4d7b';
  const pw=26,ph=11;
  rr(ctx,x-pw/2,by-ph-2,pw,ph,3,pc,null);
  ctx.fillStyle='#fff';ctx.font='bold 6.5px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(pos,x,by-ph/2-2);
}

// ════════════════════════════════════════════════════════
// HOLE CARDS (on the felt, near seat)
// ════════════════════════════════════════════════════════
function drawHoleCards(ctx, pos, cards, faceUp=false, flipT=1){
  const {x,y}=seatCards(pos);
  const cw=32, ch=45, gap=3;
  const cx2=x-cw-gap/2, cy2=y-ch/2;
  if(!cards||cards.length<2){
    // Face-down placeholder
    drawCard(ctx,cx2,cy2,cw,ch,null,null,false);
    drawCard(ctx,cx2+cw+gap,cy2,cw,ch,null,null,false);
    return;
  }
  if(flipT<1){
    drawCardFlip(ctx,cx2,cy2,cw,ch,cards[0].rank,cards[0].suit,flipT);
    drawCardFlip(ctx,cx2+cw+gap,cy2,cw,ch,cards[1].rank,cards[1].suit,Math.max(0,flipT-.12));
  } else {
    if(faceUp){
      drawCard(ctx,cx2,cy2,cw,ch,cards[0].rank,cards[0].suit,true);
      drawCard(ctx,cx2+cw+gap,cy2,cw,ch,cards[1].rank,cards[1].suit,true);
    } else {
      _back(ctx,cx2,cy2,cw,ch);
      _back(ctx,cx2+cw+gap,cy2,cw,ch);
    }
  }
}

// ════════════════════════════════════════════════════════
// BOARD CARDS (center of table)
// ════════════════════════════════════════════════════════
function getBoardPos(idx){
  const cw=52,ch=74,gap=9;
  const total=5*(cw+gap)-gap;
  const sx=TCX-total/2;
  return{x:sx+idx*(cw+gap), y:TCY-ch/2-15, w:cw, h:ch};
}
function drawBoard(ctx,cards,flipStates=[]){
  if(!cards.length) return;
  cards.forEach((c,i)=>{
    const{x,y,w,h}=getBoardPos(i);
    const ft=flipStates[i];
    if(ft!=null&&ft<1) drawCardFlip(ctx,x,y,w,h,c.rank,c.suit,ft);
    else drawCard(ctx,x,y,w,h,c.rank,c.suit,true);
  });
}

// ════════════════════════════════════════════════════════
// POT CHIPS + LABEL (center of table, above board)
// ════════════════════════════════════════════════════════
function drawPotCenter(ctx, pot, isCash){
  if(pot<=0) return;
  // Chip stacks in center (decorative)
  const potStr=isCash?`₪${Math.round(pot).toLocaleString()}`:`${Math.round(pot).toLocaleString()} chips`;
  const chipCy=TCY-65;
  drawChipStack(ctx,TCX-18,chipCy,5,'#dc2626','#1e293b');
  drawChipStack(ctx,TCX,   chipCy,6,'#1e293b','#e2e8f0');
  drawChipStack(ctx,TCX+18,chipCy,4,'#dc2626','#fbbf24');

  // POT label
  const pw=120,ph=22;
  rr(ctx,TCX-pw/2,chipCy-ph-6,pw,ph,6,'rgba(4,12,28,0.88)','#2d4a6a',1);
  ctx.fillStyle='#64748b';ctx.font='9px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('POT',TCX-30,chipCy-ph/2-6);
  ctx.fillStyle='#fbbf24';ctx.font='bold 14px Arial';
  ctx.fillText(potStr,TCX+10,chipCy-ph/2-6);
}

// ════════════════════════════════════════════════════════
// BET CHIPS near each player
// ════════════════════════════════════════════════════════
function drawBetChips(ctx, pos, amount, isCash){
  if(!amount||amount<=0) return;
  const{x,y}=seatBet(pos);
  const stacks=Math.max(2,Math.min(8,Math.ceil(amount/500)));
  drawChipStack(ctx,x,y,stacks,'#dc2626','#e2e8f0');
  const label=isCash?`₪${Math.round(amount).toLocaleString()}`:`${Math.round(amount).toLocaleString()}`;
  const lw=52,lh=14;
  rr(ctx,x-lw/2,y+10,lw,lh,4,'rgba(4,12,28,0.88)','#1e3553',.8);
  ctx.fillStyle='#e2e8f0';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(label,x,y+17);
}

// ════════════════════════════════════════════════════════
// ACTION BADGE (brief label near player, fades)
// ════════════════════════════════════════════════════════
function drawActionBadge(ctx, pos, action, amount, isCash, alpha){
  if(alpha<=0) return;
  const{x,y}=seatOuter(pos);
  const ACTION_COLORS={
    fold:'#6b7280', check:'#22c55e', call:'#3b82f6', limp:'#3b82f6',
    raise:'#f59e0b','three-bet':'#ef4444','four-bet':'#ec4899',
    allin:'#e879f9', bet:'#f59e0b',
  };
  const LABELS={
    fold:'FOLD',check:'CHECK',call:'CALL',limp:'LIMP',
    raise:'RAISE','three-bet':'3BET','four-bet':'4BET',allin:'ALL-IN',bet:'BET',
  };
  const col=ACTION_COLORS[action]||'#e2e8f0';
  const lbl=LABELS[action]||action?.toUpperCase()||'?';
  const amtStr=amount>0?(isCash?` ₪${Math.round(amount).toLocaleString()}`:` ${Math.round(amount).toLocaleString()}`): '';

  const text=lbl+amtStr;
  const tw=Math.max(48,ctx.measureText(text).width+20);
  const bx=x-tw/2, by=y-52;

  ctx.globalAlpha=alpha;
  setSh(ctx,col,10);
  rr(ctx,bx,by,tw,22,6,`${col}33`,col,1.5);
  clrSh(ctx);
  ctx.fillStyle=col;ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(text,x,by+11);
  ctx.globalAlpha=1;
}

// ════════════════════════════════════════════════════════
// SMALL ACTION LOG (top-left corner)
// ════════════════════════════════════════════════════════
function drawMiniLog(ctx, events, maxRows=5){
  if(!events.length) return;
  const lw=185, lh=Math.min(events.length,maxRows)*20+26;
  const lx=8, ly=8;
  rr(ctx,lx,ly,lw,lh,8,'rgba(4,10,26,0.9)','#1e3553',1);
  ctx.fillStyle='#334155';ctx.font='bold 9px Arial';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText('ACTION LOG',lx+10,ly+7);

  const ACTION_COL={fold:'#6b7280',check:'#22c55e',call:'#60a5fa',limp:'#60a5fa',
    raise:'#fbbf24','three-bet':'#f87171','four-bet':'#f9a8d4',allin:'#e879f9',bet:'#fbbf24'};
  const shown=events.slice(-maxRows);
  shown.forEach((ev,i)=>{
    const ey=ly+20+i*20;
    const isHero=ev.actor==='hero';
    const col=ACTION_COL[ev.action]||'#e2e8f0';
    const name=(isHero?'Hero':(ev.opponentLabel||'Villain')).substring(0,6);
    const amtStr=ev.amount>0?` ${Math.round(ev.amount).toLocaleString()}`: '';
    const LABELS={fold:'fold',check:'check',call:'call',limp:'limp',raise:'raise',
      'three-bet':'3bet','four-bet':'4bet',allin:'all-in',bet:'bet'};
    const actionStr=(LABELS[ev.action]||ev.action||'?')+amtStr;

    ctx.fillStyle=isHero?'#93c5fd':'#fca5a5';
    ctx.font='bold 9px Arial';ctx.textBaseline='middle';
    ctx.fillText(`${name}:`,lx+10,ey+10);
    ctx.fillStyle=col;
    ctx.fillText(actionStr,lx+52,ey+10);

    // BB hint
    if(ev.bbVal&&ev.amount>0){
      const bbs=Number((ev.amount/ev.bbVal).toFixed(1));
      ctx.fillStyle='#475569';ctx.font='8px Arial';
      ctx.fillText(`(${bbs}BB)`,lx+135,ey+10);
    }
  });
}

// ════════════════════════════════════════════════════════
// CHIP PARTICLES  (from → to)
// ════════════════════════════════════════════════════════
function drawChipParticles(ctx,fx,fy,tx,ty,t,amount=0){
  if(!fx||!fy||!tx||!ty||t<=0) return;
  const n=Math.min(14,6+Math.floor((amount||0)/800));
  for(let i=0;i<n;i++){
    const off=i/n;
    const ct=Math.max(0,Math.min(1,(t-off*.14)*2.2));
    if(ct<=0) continue;
    const et=easeInOut(ct);
    const spread=(1-et)*16; const angle=(i/n)*Math.PI*2;
    const px=fx+(tx-fx)*et+Math.cos(angle)*spread;
    const py=fy+(ty-fy)*et+Math.sin(angle)*spread;
    ctx.beginPath();ctx.arc(px,py,5+Math.sin(et*Math.PI)*2.5,0,Math.PI*2);
    ctx.fillStyle=CHIP_PAL[i%CHIP_PAL.length];ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=.7;ctx.stroke();
  }
}

// ════════════════════════════════════════════════════════
// BRANDING BUG (top right)
// ════════════════════════════════════════════════════════
function drawBrand(ctx){
  const bw=110,bh=40,bx=W-bw-6,by=6;
  rr(ctx,bx,by,bw,bh,6,'rgba(4,10,26,0.88)','#1e3553',1);
  ctx.fillStyle='#e2e8f0';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText('PokerIsrael',bx+bw/2,by+7);
  ctx.fillStyle='#334155';ctx.font='7.5px Arial';ctx.textBaseline='bottom';
  ctx.fillText('HAND HISTORY',bx+bw/2,by+bh-7);
}

// Street badge
function drawStreetBadge(ctx,label){
  const colors={'פרה-פלופ':'#60a5fa','פלופ':'#22d3ee','טרן':'#a78bfa','ריבר':'#34d399'};
  const col=colors[label]||'#e2e8f0';
  ctx.font='bold 11px Arial';
  const tw=ctx.measureText(label).width+20;
  rr(ctx,TCX-tw/2,TCY+ry_board_label(),tw,20,5,`${col}22`,col,.8);
  ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(label,TCX,TCY+ry_board_label()+10);
}
function ry_board_label(){return TRY*.62;}

// ════════════════════════════════════════════════════════
// STATE COMPUTATION
// ════════════════════════════════════════════════════════
function buildEvents(hand_data,hero_stack,opponents,sb,bb,ante){
  const stacks={hero:hero_stack};
  opponents.forEach(o=>stacks[o.id]=o.stack||0);
  let pot=(sb||0)+(bb||0)+(ante||0)*(opponents.length+1);
  const events=[];
  const streets=hand_data?.streets||{};

  ['preflop','flop','turn','river'].forEach(street=>{
    if(street==='flop'&&streets.flop?.board?.length)
      streets.flop.board.forEach((card,i)=>events.push({type:'card',street:'flop',cardIdx:i,card,pot,stacks:{...stacks}}));
    if(street==='turn'&&streets.turn?.board?.length)
      events.push({type:'card',street:'turn',cardIdx:3,card:streets.turn.board[0],pot,stacks:{...stacks}});
    if(street==='river'&&streets.river?.board?.length)
      events.push({type:'card',street:'river',cardIdx:4,card:streets.river.board[0],pot,stacks:{...stacks}});

    (streets[street]?.actions||[]).forEach(a=>{
      const amount=parseFloat(a.amount)||0;
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
  });
  return{events,finalPot:pot,finalStacks:{...stacks}};
}

// ════════════════════════════════════════════════════════
// DRAW FULL SCENE
// ════════════════════════════════════════════════════════
function drawScene(ctx,{
  allPlayers, heroPos, heroCards, heroCardsFaceUp=true,
  isCash, sb, bb, ante, stakes,
  pot, stacks, board, flipStates,
  logEvents, currentStreet, betAmounts={},
  chipFrom=null, chipTo=null, chipT=0, chipAmt=0,
  actionBadge=null, actionBadgeAlpha=0,
  showHeroCards=true,
}){
  drawBG(ctx);
  drawTable(ctx);

  // Player boxes (outside rail) + hole cards (on felt)
  allPlayers.forEach(p=>{
    const stk=Math.round(stacks[p.isHero?'hero':p.id]??p.stack??0);
    const isDealer=p.position==='BTN';
    drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,isDealer,false);

    // Hole cards on felt
    if(p.isHero&&showHeroCards&&heroCards?.length>=2){
      drawHoleCards(ctx,p.position,heroCards,heroCardsFaceUp);
    } else if(!p.isHero){
      drawHoleCards(ctx,p.position,null,false); // face-down
    }
  });

  // Board
  if(board.length) drawBoard(ctx,board,flipStates||[]);

  // Pot chips in center
  drawPotCenter(ctx,pot,isCash);

  // Bet chips near each player
  Object.entries(betAmounts).forEach(([pos,amt])=>drawBetChips(ctx,pos,amt,isCash));

  // Chip particles
  if(chipT>0&&chipFrom&&chipTo)
    drawChipParticles(ctx,chipFrom.x,chipFrom.y,chipTo.x,chipTo.y,chipT,chipAmt);

  // Street badge
  if(currentStreet) drawStreetBadge(ctx,currentStreet);

  // Action badge near player
  if(actionBadge&&actionBadgeAlpha>0){
    drawActionBadge(ctx,actionBadge.pos,actionBadge.action,actionBadge.amount,isCash,actionBadgeAlpha);
  }

  // Mini action log
  if(logEvents.length) drawMiniLog(ctx,logEvents);

  // HUD bottom right
  drawPotDisplay(ctx,pot,sb,bb,ante,isCash,stakes);
  drawBrand(ctx);
}

function drawPotDisplay(ctx,pot,sb,bb,ante,isCash,stakes){
  const pw=162,ph=46,px=W-pw-8,py=H-ph-8;
  setSh(ctx,'rgba(0,0,0,0.6)',12,0,4);
  rr(ctx,px,py,pw,ph,8,'rgba(4,11,26,0.93)','#1e3d6b',1.5);
  clrSh(ctx);
  ctx.fillStyle='#475569';ctx.font='9px Arial';ctx.textAlign='right';ctx.textBaseline='top';
  ctx.fillText('POT',px+pw-10,py+7);
  ctx.fillStyle='#fbbf24';ctx.font='bold 18px Arial';
  ctx.fillText(Math.round(pot).toLocaleString(),px+pw-10,py+20);
  const bl=isCash?`Stakes: ${stakes||''}`:`Blinds: ${sb||0}/${bb||0}${ante>0?` · Ante ${ante}`:''}`;
  ctx.fillStyle='#334155';ctx.font='8.5px Arial';ctx.textBaseline='bottom';
  ctx.fillText(bl,px+pw-10,py+ph-7);
}

// ════════════════════════════════════════════════════════
// BUILD FRAMES
// ════════════════════════════════════════════════════════
export function buildFrames(state){
  const{
    game_type,tournament_stage,blind_sb:sb,blind_bb:bb,ante=0,cash_stakes,
    hero_position,hero_stack=0,hero_cards=[],
    hand_data={},result,hero_profit,
  }=state;

  const opponents=hand_data?.opponents||[];
  const isCash=game_type==='cash'||game_type==='cash_online';
  const finalPot=Math.abs(hero_profit||0)||((sb||0)+(bb||0));
  const winnerPos=result==='won'?hero_position:(result==='lost'&&opponents[0]?.position?opponents[0].position:null);

  const allPlayers=[
    {label:'Hero',position:hero_position,stack:hero_stack,isHero:true,id:'hero'},
    ...opponents.map(o=>({...o,isHero:false})),
  ];

  const{events,finalStacks}=buildEvents(hand_data,hero_stack,opponents,sb,bb,ante);
  const initialPot=(sb||0)+(bb||0)+(ante||0)*(opponents.length+1);
  const initialStacks={hero:hero_stack};
  opponents.forEach(o=>initialStacks[o.id]=o.stack||0);

  const STREET_LABELS={preflop:'פרה-פלופ',flop:'פלופ',turn:'טרן',river:'ריבר'};
  const frames=[];

  const base={allPlayers,heroPos:hero_position,heroCards:hero_cards,isCash,sb,bb,ante,stakes:cash_stakes};

  // ── INTRO ──────────────────────────────── 55f
  frames.push({duration:55,draw:(ctx,t)=>{
    drawBG(ctx);
    ctx.globalAlpha=Math.min(1,easeOut(t*1.5));
    drawTable(ctx);clrSh(ctx);
    ctx.globalAlpha=1;
    drawBrand(ctx);
    const a=Math.min(1,easeOut((t-.2)*2.5));
    if(a>0){
      ctx.globalAlpha=a;
      setSh(ctx,'#1e8868',30);
      ctx.fillStyle='#fff';ctx.font='bold 28px Georgia,serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('PokerIsrael.org',TCX,TCY-8);clrSh(ctx);
      ctx.fillStyle='#a7f3d0';ctx.font='13px Arial';
      const ctxLine=isCash?`קאש ${cash_stakes||''}`:`טורניר | ${tournament_stage||''} | ${sb||0}/${bb||0} BB`;
      ctx.fillText(ctxLine,TCX,TCY+22);
      ctx.globalAlpha=1;
    }
  }});

  // ── TABLE + PLAYERS ───────────────────── 45f
  frames.push({duration:45,draw:(ctx,t)=>{
    drawScene(ctx,{...base,pot:initialPot,stacks:{...initialStacks},
      board:[],flipStates:[],logEvents:[],currentStreet:null,showHeroCards:false});
    allPlayers.forEach((p,i)=>{
      const a=Math.min(1,easeOut((t-i*.1)*4));
      if(a<1){ctx.globalAlpha=a;drawPlayerBox(ctx,p.position,p.label||'Hero',p.stack,p.isHero,p.position==='BTN',false);ctx.globalAlpha=1;}
    });
  }});

  // ── HERO CARDS FLIP ─────────────────── 38f
  frames.push({duration:38,draw:(ctx,t)=>{
    drawBG(ctx);drawTable(ctx);
    allPlayers.forEach(p=>{
      const stk=initialStacks[p.isHero?'hero':p.id]??p.stack??0;
      drawPlayerBox(ctx,p.position,p.label||'Hero',Math.round(stk),p.isHero,p.position==='BTN',false);
      if(!p.isHero) drawHoleCards(ctx,p.position,null,false);
    });
    // Hero cards flipping
    if(hero_cards.length>=2){
      const ft0=Math.min(1,easeInOut(Math.max(0,t*2)));
      const ft1=Math.min(1,easeInOut(Math.max(0,(t-.15)*2)));
      const{x,y}=seatCards(hero_position);
      const cw=32,ch=45,gap=3;
      drawCardFlip(ctx,x-cw-gap/2,y-ch/2,cw,ch,hero_cards[0].rank,hero_cards[0].suit,ft0);
      drawCardFlip(ctx,x+gap/2,y-ch/2,cw,ch,hero_cards[1].rank,hero_cards[1].suit,ft1);
    }
    drawPotDisplay(ctx,initialPot,sb,bb,ante,isCash,cash_stakes);
    drawBrand(ctx);
  }});

  // ── EVENT-DRIVEN FRAMES ──────────────────────────────
  let currentPot=initialPot;
  let currentStacks={...initialStacks};
  let logEvents=[];
  let revealedBoard=[];
  let flipStates=[];
  let currentStreet='פרה-פלופ';
  let betAmounts={};  // pos → chips this street

  events.forEach(ev=>{
    if(ev.type==='card'){
      if(ev.street==='flop') currentStreet='פלופ';
      else if(ev.street==='turn') currentStreet='טרן';
      else if(ev.street==='river') currentStreet='ריבר';
      if(ev.street==='flop') betAmounts={}; // clear bets each street

      const newBoard=[...revealedBoard,ev.card];
      const snapBoard=[...newBoard];
      const snapPot=currentPot,snapStacks={...currentStacks};
      const snapLog=[...logEvents],snapStr=currentStreet;

      frames.push({duration:24,draw:(ctx,t)=>{
        const fStates=snapBoard.map((_,i)=>i<snapBoard.length-1?1:easeInOut(t));
        drawScene(ctx,{...base,pot:snapPot,stacks:snapStacks,
          board:snapBoard,flipStates:fStates,logEvents:snapLog,
          currentStreet:snapStr,showHeroCards:true,heroCardsFaceUp:true});
      }});
      frames.push({duration:14,draw:(ctx,t)=>{
        drawScene(ctx,{...base,pot:snapPot,stacks:snapStacks,
          board:snapBoard,flipStates:Array(snapBoard.length).fill(1),
          logEvents:snapLog,currentStreet:snapStr,showHeroCards:true,heroCardsFaceUp:true});
      }});
      revealedBoard=newBoard;flipStates=Array(revealedBoard.length).fill(1);

    } else if(ev.type==='action'){
      const actorIsHero=ev.actor==='hero';
      const actorOpp=actorIsHero?null:opponents.find(o=>o.id===ev.actor||o.id===parseInt(ev.actor));
      const actorPos=actorIsHero?hero_position:actorOpp?.position;
      const fromXY=actorPos?seatOuter(actorPos):null;
      const toXY={x:TCX,y:TCY};
      const hasChips=ev.amount>0;

      // Update bet amounts
      if(hasChips&&actorPos){
        betAmounts={...betAmounts,[actorPos]:(betAmounts[actorPos]||0)+ev.amount};
      }

      const newLog=[...logEvents,{...ev,opponentLabel:actorOpp?.label||null}];
      const snapBoard=[...revealedBoard];
      const snapStr=currentStreet;
      const snapBets={...betAmounts};
      const badge={pos:actorPos,action:ev.action,amount:ev.amount};

      // Chip animation frame (26f)
      frames.push({duration:26,draw:(ctx,t)=>{
        const interpPot=lerp(ev.potBefore,ev.potAfter,hasChips?easeInOut(t):0);
        const interpStacks={};
        Object.keys(ev.stacksBefore).forEach(k=>{
          interpStacks[k]=lerp(ev.stacksBefore[k]||0,ev.stacksAfter[k]||0,hasChips?easeInOut(t):0);
        });
        // Bet amounts grow as chips move
        const interpBets={...snapBets};
        if(hasChips&&actorPos) interpBets[actorPos]=(betAmounts[actorPos]||0)*easeInOut(t);

        drawScene(ctx,{...base,pot:interpPot,stacks:interpStacks,
          board:snapBoard,flipStates:Array(snapBoard.length).fill(1),
          logEvents:newLog,currentStreet:snapStr,betAmounts:interpBets,
          showHeroCards:true,heroCardsFaceUp:true,
          chipFrom:hasChips?fromXY:null,chipTo:hasChips?toXY:null,
          chipT:hasChips?t:0,chipAmt:ev.amount,
          actionBadge:badge,actionBadgeAlpha:Math.min(1,t*4)});
      }});

      // Pause frame (10f) — badge fades out
      const pausePot=ev.potAfter,pauseStacks={...ev.stacksAfter};
      frames.push({duration:10,draw:(ctx,t)=>{
        drawScene(ctx,{...base,pot:pausePot,stacks:pauseStacks,
          board:snapBoard,flipStates:Array(snapBoard.length).fill(1),
          logEvents:newLog,currentStreet:snapStr,betAmounts:snapBets,
          showHeroCards:true,heroCardsFaceUp:true,
          actionBadge:badge,actionBadgeAlpha:1-easeOut(t)});
      }});

      logEvents=newLog;currentPot=ev.potAfter;currentStacks={...ev.stacksAfter};
    }
  });

  // ── RESULT: chips flow to winner ────── 85f
  const preResultBoard=[...revealedBoard];
  const preResultStacks={...currentStacks};
  const winnerXY=winnerPos?seatOuter(winnerPos):{x:TCX,y:TCY};
  const resultColor=result==='won'?'#22c55e':result==='lost'?'#ef4444':'#fbbf24';
  const resultLabel=result==='won'?'ניצחון! 🏆':result==='lost'?'הפסד 💀':'סיר מחולק 🤝';

  frames.push({duration:85,draw:(ctx,t)=>{
    const moveT=Math.min(1,t*2);
    const animStacks={...preResultStacks};
    const winKey=result==='won'?'hero':opponents[0]?.id;
    if(winKey!=null) animStacks[winKey]=lerp(preResultStacks[winKey]||0,(preResultStacks[winKey]||0)+finalPot,easeInOut(moveT));

    // Winner box glow
    const winnerPlayer=allPlayers.find(p=>(result==='won'?p.isHero:!p.isHero&&p===allPlayers[1]));
    drawBG(ctx);drawTable(ctx);
    allPlayers.forEach(p=>{
      const stk=Math.round(animStacks[p.isHero?'hero':p.id]??p.stack??0);
      const isWin=(result==='won'&&p.isHero)||(result==='lost'&&!p.isHero&&p===allPlayers[1]);
      if(isWin&&t>.5){
        setSh(ctx,'#fbbf24',20);
        const{x,y}=seatOuter(p.position);
        ctx.beginPath();ctx.arc(x,y,40,0,Math.PI*2);ctx.fillStyle='rgba(251,191,36,.12)';ctx.fill();clrSh(ctx);
      }
      drawPlayerBox(ctx,p.position,p.label||'Hero',stk,p.isHero,p.position==='BTN',isWin&&t>.5);
      if(p.isHero) drawHoleCards(ctx,p.position,hero_cards,true);
      else drawHoleCards(ctx,p.position,null,false);
    });
    drawBoard(ctx,preResultBoard,Array(preResultBoard.length).fill(1));
    drawPotCenter(ctx,lerp(currentPot,0,easeInOut(moveT)),isCash);
    drawChipParticles(ctx,TCX,TCY,winnerXY.x,winnerXY.y,moveT,finalPot);
    drawMiniLog(ctx,logEvents);
    drawPotDisplay(ctx,lerp(currentPot,0,easeInOut(moveT)),sb,bb,ante,isCash,cash_stakes);
    drawBrand(ctx);

    // Result overlay
    if(t>.4){
      const rt=(t-.4)*1.7;
      ctx.globalAlpha=Math.min(.6,easeOut(rt)*.6);
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
      ctx.save();
      ctx.translate(TCX,TCY-16);
      const sc=.55+Math.min(.45,easeOut(rt)*.9);ctx.scale(sc,sc);
      ctx.globalAlpha=Math.min(1,easeOut(rt*2.5));
      setSh(ctx,resultColor,40);
      ctx.fillStyle=resultColor;ctx.font='bold 62px Arial';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.direction='rtl';ctx.fillText(resultLabel,0,0);ctx.direction='ltr';
      clrSh(ctx);ctx.restore();
      if(hero_profit){
        const ps=hero_profit>0?`+${hero_profit}`:`${hero_profit}`;
        ctx.globalAlpha=Math.min(1,easeOut((rt-.2)*3));
        ctx.fillStyle=resultColor;ctx.font='bold 24px Arial';
        ctx.textAlign='center';ctx.fillText(`${ps}${isCash?'₪':' chips'}`,TCX,TCY+46);
        ctx.globalAlpha=1;
      }
    }
  }});

  // ── OUTRO ──────────────────────────── 42f
  frames.push({duration:42,draw:(ctx,t)=>{
    drawBG(ctx);drawTable(ctx);
    const sc=.75+Math.min(.25,easeOut(t)*.5);
    ctx.save();ctx.translate(TCX,TCY-14);ctx.scale(sc,sc);
    ctx.globalAlpha=Math.min(1,easeOut(t*2));
    setSh(ctx,resultColor,35);
    ctx.fillStyle=resultColor;ctx.font='bold 54px Arial';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.direction='rtl';ctx.fillText(resultLabel,0,0);ctx.direction='ltr';
    clrSh(ctx);ctx.restore();
    if(hero_profit){
      const ps=hero_profit>0?`+${hero_profit}`:`${hero_profit}`;
      ctx.globalAlpha=Math.min(1,(t-.15)*3);
      ctx.fillStyle=resultColor;ctx.font='bold 22px Arial';
      ctx.textAlign='center';ctx.fillText(`${ps}${isCash?'₪':' chips'}`,TCX,TCY+48);
    }
    ctx.globalAlpha=Math.min(1,(t-.35)*4);
    ctx.fillStyle='#334155';ctx.font='bold 12px Arial';
    ctx.textAlign='center';ctx.fillText('PokerIsrael.org',TCX,H-14);
    ctx.globalAlpha=1;
    drawBrand(ctx);
  }});

  return{frames,W,H};
}

// ════════════════════════════════════════════════════════
// RECORD VIDEO
// ════════════════════════════════════════════════════════
export async function recordVideo(state,onProgress){
  const{frames,W,H}=buildFrames(state);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  const FPS=30;
  const chunks=[];
  const stream=canvas.captureStream(FPS);
  const mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
  const rec=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:4_000_000});
  rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
  const total=frames.reduce((s,f)=>s+f.duration,0);
  let seg=0,fin=0,drawn=0;
  rec.start(100);
  await new Promise(resolve=>{
    const tick=()=>{
      if(seg>=frames.length){rec.stop();resolve();return;}
      const f=frames[seg];
      f.draw(ctx,fin/f.duration);
      drawn++;fin++;
      if(onProgress)onProgress(Math.round((drawn/total)*100));
      if(fin>=f.duration){seg++;fin=0;}
      requestAnimationFrame(tick);
    };
    tick();
  });
  await new Promise(r=>{rec.onstop=r;});
  return new Blob(chunks,{type:'video/webm'});
}
