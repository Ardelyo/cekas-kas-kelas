import {spellDNA, ELEMENTS} from "./spell-shape.mjs";
import {sfx} from "./duel-sfx.mjs";

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

const hexA = (hex,a) => hex + Math.round(a*255).toString(16).padStart(2,"0");

export function drawSpell(panel,round,cast,name="") {
  panel.innerHTML=`<p class="eyebrow">Jurus langit · Babak ${round+1}</p><h2>${name?name+", ukir jurusmu":"Ukir jurusmu"}</h2>
    <p>Tarik satu goresan. Bentuk, arah, ukuran, dan kecepatan goresanmu menentukan nama dan wujud jurus.</p>
    <div class="rune-pad"><canvas aria-label="Bidang gambar jurus"></canvas><span aria-hidden="true">Mulai goresan di sini</span><strong class="spell-stamp" hidden></strong><em class="spell-element" hidden></em></div>
    <ul class="spell-legend" aria-label="Petunjuk elemen"><li style="--c:${ELEMENTS.petir.css}"><b>Zigzag</b>Petir</li><li style="--c:${ELEMENTS.cahaya.css}"><b>Lingkaran</b>Cahaya</li><li style="--c:${ELEMENTS.angin.css}"><b>Spiral</b>Angin</li><li style="--c:${ELEMENTS.ombak.css}"><b>Gelombang</b>Ombak</li><li style="--c:${ELEMENTS.meteor.css}"><b>Tarik ke bawah</b>Meteor</li><li style="--c:${ELEMENTS.kristal.css}"><b>Garis tegas</b>Kristal</li></ul>
    <div class="actions"><button class="button quiet" data-dwell data-rune>Gunakan jurus bawaan</button></div>`;
  const canvas=panel.querySelector("canvas"), ctx=canvas.getContext("2d");
  const pad=panel.querySelector(".rune-pad"), hint=pad.querySelector("span"), stamp=pad.querySelector(".spell-stamp");
  const fallback=panel.querySelector("[data-rune]");
  const calm=matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pointer=null, points=[], finished=false, spell=null, began=0, released=0, w=0, h=0, last=performance.now(), spin=0;
  const sparks=[];

  function fit(){
    const rect=canvas.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio);
    if(rect.width===w&&rect.height===h)return;
    w=rect.width;h=rect.height;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function spark(x,y,speed,color,life=.5){
    const a=Math.random()*Math.PI*2, v=speed*(.3+Math.random());
    sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,color,size:1+Math.random()*2.4});
  }
  function circle(now){
    const R=Math.min(w,h)*.43, cx=w/2, cy=h/2;
    const color=spell?spell.css:"#d6ff3f";
    const glow=spell?Math.max(.35,1-(now-released)/900):pointer!==null?.42:.2;
    ctx.save();ctx.translate(cx,cy);
    ctx.strokeStyle=hexA(color,glow);ctx.fillStyle=hexA(color,glow);ctx.shadowColor=color;ctx.shadowBlur=spell?18:6;
    const pulse=spell?1+.08*Math.sin((now-released)/60)*Math.max(0,1-(now-released)/600):1;
    ctx.scale(pulse,pulse);
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.stroke();
    ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,R*.9,0,7);ctx.stroke();
    ctx.save();ctx.rotate(spin);
    for(let i=0;i<36;i++){ctx.rotate(Math.PI/18);ctx.fillRect(-.8,-R,1.6,i%3?4:9);}
    const n=spell?(spell.sides||6):6, step=n===5?2:1;
    ctx.lineWidth=1.4;ctx.beginPath();
    for(let i=0;i<=n;i++){const a=i*step*2*Math.PI/n-Math.PI/2;const x=Math.cos(a)*R*.9,y=Math.sin(a)*R*.9;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
    ctx.stroke();
    ctx.restore();
    ctx.rotate(-spin*1.6);ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(0,0,R*.55,0,7);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
  }
  function trail(now){
    if(points.length<2)return;
    const color=spell?spell.css:"#c5ff53";
    const flash=spell?Math.max(0,1-(now-released)/350):0;
    ctx.save();ctx.lineCap=ctx.lineJoin="round";ctx.globalCompositeOperation="lighter";
    const n=points.length;
    // Tapered stroke: thin at the start, thick toward the brush tip, like an ink brush.
    for(const [blur,width,stroke] of [[22,9,hexA(color,.5)],[10,4.5,color],[0,1.8,"#fbffe8"]]){
      ctx.shadowBlur=blur;ctx.shadowColor=color;ctx.strokeStyle=stroke;
      for(let i=1;i<n;i++){
        ctx.lineWidth=width*(.35+.65*i/n)*(1+flash*1.4);
        ctx.beginPath();ctx.moveTo(...points[i-1]);ctx.lineTo(...points[i]);ctx.stroke();
      }
    }
    if(pointer!==null){
      const [x,y]=points.at(-1);
      const g=ctx.createRadialGradient(x,y,0,x,y,16);g.addColorStop(0,"#ffffff");g.addColorStop(.3,hexA(color,.8));g.addColorStop(1,hexA(color,0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,16,0,7);ctx.fill();
    }
    ctx.restore();
  }
  function frame(now){
    if(!canvas.isConnected)return;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    fit();spin+=dt*(spell?2.4:.35);
    ctx.clearRect(0,0,w,h);
    circle(now);trail(now);
    ctx.save();ctx.globalCompositeOperation="lighter";
    for(let i=sparks.length-1;i>=0;i--){
      const s=sparks[i];s.life-=dt;if(s.life<=0){sparks.splice(i,1);continue;}
      s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=.94;s.vy=s.vy*.94+30*dt;
      ctx.globalAlpha=s.life/s.max;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.size*(s.life/s.max),0,7);ctx.fill();
    }
    ctx.restore();
    requestAnimationFrame(frame);
  }
  fit();requestAnimationFrame(frame);

  function release(path,ms=0){
    if(finished)return;
    finished=true;fallback.disabled=true;
    spell=spellDNA(path,{pad:Math.hypot(w,h)||0,ms});released=performance.now();
    const info=spell;
    document.body.dataset.spell=info.name;
    hint.hidden=true;stamp.hidden=false;stamp.textContent=info.name;stamp.style.setProperty("--c",info.css);
    const tag=pad.querySelector(".spell-element");tag.hidden=false;tag.textContent=`Elemen ${ELEMENTS[info.element].word} · Kekuatan ${Math.round(info.power*60)}`;tag.style.setProperty("--c",info.css);
    pad.classList.add("cast");sfx.cast();pad.style.setProperty("--c",info.css);
    for(let i=0;i<path.length;i+=Math.max(1,Math.floor(path.length/70)))spark(path[i][0],path[i][1],160,i%3?info.css:"#ffffff",.8);
    const out=centered(path);out.dna=spell;
    setTimeout(()=>cast(out),calm?120:900);
  }
  fallback.onclick=()=>{
    fit();
    const s=Math.min(w,h)*.9, ox=(w-s)/2, oy=(h-s)/2;
    points=presets[round].map(([x,y])=>[ox+x*s,oy+y*s]);
    release(points);
  };
  fallback.focus({preventScroll:true});
  function append(e){
    const rect=canvas.getBoundingClientRect();
    const x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));
    const y=Math.max(0,Math.min(rect.height,e.clientY-rect.top));
    const prev=points.at(-1);
    if(prev&&Math.hypot(prev[0]-x,prev[1]-y)<2)return;
    if(points.length>=500)points=points.filter((_,i)=>i%2===0);
    points.push([x,y]);sfx.scratch();
    for(let i=0;i<2;i++)spark(x,y,90,i?"#ffffff":"#d6ff3f",.45);
  }
  canvas.onpointerdown=e=>{
    if(finished||pointer!==null||e.button!==0)return;
    fit();pointer=e.pointerId;points=[];began=performance.now();canvas.setPointerCapture(pointer);hint.hidden=true;pad.classList.add("drawing");append(e);
  };
  canvas.onpointermove=e=>{if(pointer===e.pointerId)append(e)};
  canvas.onpointerup=e=>{
    if(pointer!==e.pointerId)return;
    append(e);pointer=null;pad.classList.remove("drawing");
    if(points.some(([x,y])=>Math.hypot(x-points[0][0],y-points[0][1])>=14))release(points,performance.now()-began);
    else{hint.hidden=false;hint.textContent="Tarik sedikit lebih panjang";}
  };
  canvas.onpointercancel=()=>{pointer=null;pad.classList.remove("drawing");hint.hidden=false;};
}
