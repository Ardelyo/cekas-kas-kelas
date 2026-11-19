const presets = [
  [[.18,.66],[.52,.22],[.46,.52],[.82,.34]],
  [[.22,.72],[.29,.49],[.48,.3],[.69,.24],[.8,.29],[.66,.45],[.4,.6]],
  Array.from({length:37}, (_,i)=>{const a=i*Math.PI/12,r=.05+i*.008;return [.5+r*Math.cos(a),.5+r*Math.sin(a)]})
];

// Keep the mark's proportions when moving from the drawing surface into the sky.
function centered(points) {
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const left=Math.min(...xs), top=Math.min(...ys);
  const w=Math.max(...xs)-left, h=Math.max(...ys)-top, size=Math.max(w,h,1);
  return points.map(([x,y])=>[(x-left-w/2)/size,(top+h/2-y)/size]);
}

export function drawSpell(panel,round,cast,name="") {
  panel.innerHTML=`<p class="eyebrow">Jurus langit · Babak ${round+1}</p><h2>${name?name+", ukir jurusmu":"Ukir jurusmu"}</h2>
    <p>Tarik satu garis dengan jari atau mouse. Angkat untuk melepaskan sihir.</p>
    <div class="rune-pad"><canvas aria-label="Bidang gambar jurus"></canvas><span aria-hidden="true">Mulai goresan di sini</span></div>
    <div class="actions"><button class="button quiet" data-dwell data-rune>Gunakan jurus bawaan</button></div>`;
  const canvas=panel.querySelector('canvas'), ctx=canvas.getContext('2d');
  const hint=panel.querySelector('.rune-pad span'), fallback=panel.querySelector('[data-rune]');
  let pointer=null, points=[], finished=false;
  function release(path){
    if(finished)return;
    finished=true;
    cast(centered(path));
  }
  fallback.onclick=()=>release(presets[round].map(([x,y])=>[x*240,y*240]));
  fallback.focus({preventScroll:true});
  function append(e){
    const rect=canvas.getBoundingClientRect();
    const x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));
    const y=Math.max(0,Math.min(rect.height,e.clientY-rect.top));
    const last=points.at(-1);
    if(last&&Math.hypot(last[0]-x,last[1]-y)<2)return;
    if(points.length>=500)points=points.filter((_,i)=>i%2===0);
    points.push([x,y]);
    ctx.clearRect(0,0,rect.width,rect.height);
    ctx.beginPath();ctx.moveTo(...points[0]);
    for(let i=1;i<points.length-1;i++){
      const [a,b]=points[i], [c,d]=points[i+1];
      ctx.quadraticCurveTo(a,b,(a+c)/2,(b+d)/2);
    }
    ctx.lineTo(x,y);
    ctx.lineCap=ctx.lineJoin='round';
    ctx.shadowBlur=14;ctx.shadowColor='#baff41';ctx.strokeStyle='#c5ff53';ctx.lineWidth=5;ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='#f8ffdc';ctx.lineWidth=1.8;ctx.stroke();
  }
  canvas.onpointerdown=e=>{
    if(finished||pointer!==null||e.button!==0)return;
    const rect=canvas.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio);
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.scale(dpr,dpr);
    pointer=e.pointerId;points=[];canvas.setPointerCapture(pointer);hint.hidden=true;append(e);
  };
  canvas.onpointermove=e=>{if(pointer===e.pointerId)append(e)};
  canvas.onpointerup=e=>{
    if(pointer!==e.pointerId)return;
    append(e);pointer=null;
    if(points.some(([x,y])=>Math.hypot(x-points[0][0],y-points[0][1])>=14))release(points);
    else{hint.hidden=false;hint.textContent='Tarik sedikit lebih panjang';}
  };
  canvas.onpointercancel=()=>{pointer=null;hint.hidden=false;};
}
