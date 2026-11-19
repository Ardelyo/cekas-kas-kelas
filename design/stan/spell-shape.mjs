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
