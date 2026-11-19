// Membaca goresan pemain menjadi jenis jurus. Skala bebas: piksel atau koordinat ternormalisasi.
export const SPELLS = {
  lance:  {name:"Tombak Langit", hint:"Garis lurus",  color:0xd6ff3f, css:"#d6ff3f", sides:3},
  nova:   {name:"Nova Biru",     hint:"Lingkaran",    color:0x65dfff, css:"#65dfff", sides:0},
  storm:  {name:"Badai Petir",   hint:"Zigzag",       color:0xf2ffc4, css:"#f2ffc4", sides:5},
  spiral: {name:"Pusaran Kas",   hint:"Spiral",       color:0x9ff3ff, css:"#9ff3ff", sides:8},
  arc:    {name:"Tebasan Bulan", hint:"Lengkung",     color:0xd6ff3f, css:"#e4ff7a", sides:4}
};

function resample(points, step) {
  const out=[points[0]];
  let [px,py]=points[0], carry=0;
  for(let i=1;i<points.length;i++){
    let [x,y]=points[i], d=Math.hypot(x-px,y-py);
    while(carry+d>=step){
      const k=(step-carry)/d;
      px+=(x-px)*k; py+=(y-py)*k; out.push([px,py]);
      d=Math.hypot(x-px,y-py); carry=0;
    }
    carry+=d; px=x; py=y;
  }
  return out;
}

export function readSpell(raw) {
  if(!raw || raw.length<3) return "lance";
  const xs=raw.map(p=>p[0]), ys=raw.map(p=>p[1]);
  const diag=Math.hypot(Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys)) || 1;
  const pts=resample(raw, diag/26);
  if(pts.length<4) return "lance";
  let length=0;
  for(let i=1;i<pts.length;i++) length+=Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
  const chord=Math.hypot(pts.at(-1)[0]-pts[0][0], pts.at(-1)[1]-pts[0][1]);
  let turn=0, corners=0;
  for(let i=1;i<pts.length-1;i++){
    const a=Math.atan2(pts[i][1]-pts[i-1][1], pts[i][0]-pts[i-1][0]);
    const b=Math.atan2(pts[i+1][1]-pts[i][1], pts[i+1][0]-pts[i][0]);
    let d=b-a; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
    turn+=d; if(Math.abs(d)>1.0) corners++;
  }
  const spin=Math.abs(turn);
  if(spin>2.6*Math.PI) return "spiral";
  if(chord<.3*diag && spin>1.4*Math.PI) return "nova";
  if(corners>=2) return "storm";
  if(chord/length>.88) return "lance";
  return "arc";
}

// ===== DNA jurus: setiap goresan menghasilkan nama, elemen, dan gaya VFX sendiri =====
export const ELEMENTS = {
  petir:   {word:"Petir",   color:0xf2ffc4, accent:0xd6ff3f, css:"#f2ffc4", tint:[.85,1,.35]},
  angin:   {word:"Angin",   color:0x9ff3ff, accent:0xffffff, css:"#9ff3ff", tint:[.5,.95,1]},
  cahaya:  {word:"Cahaya",  color:0xfffbe0, accent:0xd6ff3f, css:"#fffbe0", tint:[1,1,.8]},
  kristal: {word:"Kristal", color:0xbfe9ff, accent:0x65dfff, css:"#bfe9ff", tint:[.6,.85,1]},
  ombak:   {word:"Ombak",   color:0x4d9bf0, accent:0x9ff3ff, css:"#6fb4ff", tint:[.25,.55,1]},
  meteor:  {word:"Meteor",  color:0xd6ff3f, accent:0xfff2a8, css:"#d6ff3f", tint:[.8,1,.3]}
};
const NOUN = {lance:"Tombak", nova:"Nova", storm:"Badai", spiral:"Pusaran", arc:"Tebasan"};

function features(raw){
  const xs=raw.map(p=>p[0]), ys=raw.map(p=>p[1]);
  const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys), diag=Math.hypot(w,h)||1;
  const pts=resample(raw,diag/26);
  let corners=0, waves=0, prevSign=0, turn=0;
  for(let i=1;i<pts.length-1;i++){
    const a=Math.atan2(pts[i][1]-pts[i-1][1],pts[i][0]-pts[i-1][0]);
    const b=Math.atan2(pts[i+1][1]-pts[i][1],pts[i+1][0]-pts[i][0]);
    let d=b-a; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
    turn+=d; if(Math.abs(d)>1)corners++;
    const s=Math.abs(d)>.12?Math.sign(d):0;
    if(s&&prevSign&&s!==prevSign)waves++; if(s)prevSign=s;
  }
  return {w,h,diag,corners,waves,turn,dx:raw.at(-1)[0]-raw[0][0],dy:raw.at(-1)[1]-raw[0][1]};
}

// `raw` dalam koordinat layar (y ke bawah). `pad` = ukuran bidang, `ms` = lama menggambar.
export function spellDNA(raw, {pad=0, ms=0}={}){
  const kind=readSpell(raw), f=features(raw);
  let element;
  if(f.corners>=3) element="petir";
  else if(kind==="spiral") element="angin";
  else if(kind==="nova") element="cahaya";
  else if(f.h>f.w*1.5) element=f.dy>0?"meteor":"kristal";
  else if(f.waves>=2) element="ombak";
  else element=kind==="arc"?"ombak":"kristal";
  const size=pad?f.diag/pad:.6;
  const fast=ms>0&&ms<380, slow=ms>1800;
  let mod="";
  if(f.corners>=5) mod="Seribu";
  else if(fast) mod="Kilat";
  else if(size>.85) mod="Agung";
  else if(slow) mod="Abadi";
  else if(f.waves>=4) mod="Berantai";
  else if(f.dx<0&&kind!=="nova"&&kind!=="spiral") mod="Terbalik";
  const e=ELEMENTS[element];
  const sides=f.corners>=3?Math.min(9,f.corners+2):SPELLS[kind].sides;
  const power=Math.min(1.6,.75+size*.5+(fast?.25:0)+(f.corners>=5?.15:0));
  return {kind, element, mod, name:`${NOUN[kind]} ${e.word}${mod?" "+mod:""}`, color:e.color, accent:e.accent, css:e.css, tint:e.tint, sides, power,
    spin:f.turn<0?-1:1, bolts:element==="petir"?8+Math.min(8,f.corners):3};
}
