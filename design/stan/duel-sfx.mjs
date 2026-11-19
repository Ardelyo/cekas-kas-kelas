// Sound FX sintetis (WebAudio) — tanpa file audio, ringan untuk mobile.
let ctx=null, master=null, noiseBuf=null, last=0;
let muted=false;
try{muted=localStorage.getItem("cekas-duel-mute")==="1";}catch{}

function ac(){
  if(muted)return null;
  if(!ctx){
    const A=window.AudioContext||window.webkitAudioContext; if(!A)return null;
    ctx=new A();
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;
    master=ctx.createGain();master.gain.value=.55;master.connect(comp);comp.connect(ctx.destination);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  }
  if(ctx.state==="suspended")ctx.resume();
  return ctx;
}
function env(g,t,attack,dur,peak){
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(peak,t+attack);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
}
function tone({type="sine",f0,f1=f0,dur=.4,gain=.3,at=0,attack=.005,filter=0}){
  const c=ac();if(!c)return;const t=c.currentTime+at;
  const o=c.createOscillator(),g=c.createGain();o.type=type;
  o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
  env(g,t,attack,dur,gain);
  let node=o;
  if(filter){const f=c.createBiquadFilter();f.type="lowpass";f.frequency.value=filter;o.connect(f);node=f;}
  node.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05);
}
function noise({type="bandpass",f0,f1=f0,q=1,dur=.4,gain=.3,at=0,attack=.005}){
  const c=ac();if(!c)return;const t=c.currentTime+at;
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  s.buffer=noiseBuf;s.loop=true;f.type=type;f.Q.value=q;
  f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  env(g,t,attack,dur,gain);
  s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+.05);
}

export const sfx={
  // Goresan kuas: desis halus, dibatasi agar tidak menumpuk.
  scratch(){
    const now=performance.now();if(now-last<70)return;last=now;
    noise({type:"bandpass",f0:2400+Math.random()*1800,q:6,dur:.09,gain:.05});
  },
  charge(){
    noise({type:"bandpass",f0:250,f1:4200,q:2.5,dur:.95,gain:.28,attack:.6});
    tone({type:"sawtooth",f0:90,f1:420,dur:.95,gain:.12,attack:.5,filter:1400});
    [0,.12,.24,.36,.48].forEach((at,i)=>tone({f0:880*Math.pow(1.19,i),dur:.25,gain:.06,at}));
  },
  cast(){
    [1046,1568,2093].forEach((f,i)=>tone({type:"triangle",f0:f,dur:.9,gain:.12,at:i*.03}));
    noise({type:"highpass",f0:6000,dur:.35,gain:.08});
  },
  whoosh(){
    noise({type:"bandpass",f0:500,f1:2600,q:1.4,dur:.18,gain:.35,attack:.12});
    noise({type:"bandpass",f0:2600,f1:300,q:1.2,dur:.5,gain:.3,at:.16,attack:.01});
  },
  impact(heavy=1){
    tone({f0:140,f1:32,dur:.9,gain:.9*heavy,attack:.002});
    tone({type:"square",f0:70,f1:30,dur:.35,gain:.18*heavy,filter:400});
    noise({type:"lowpass",f0:6000,f1:150,q:.7,dur:.8,gain:.6*heavy,attack:.002});
    noise({type:"highpass",f0:3000,dur:.07,gain:.5,attack:.001});
    noise({type:"bandpass",f0:900,f1:200,q:.8,dur:1.4,gain:.12,at:.08,attack:.05});
  },
  zap(){
    for(let i=0;i<3;i++)noise({type:"bandpass",f0:3000+Math.random()*3000,q:10,dur:.06,gain:.18,at:i*.05});
    tone({type:"sawtooth",f0:1800,f1:200,dur:.18,gain:.06});
  },
  shield(){
    tone({f0:220,dur:1.1,gain:.15,attack:.15});tone({f0:331,dur:1.1,gain:.1,attack:.2});
    noise({type:"bandpass",f0:1200,q:8,dur:1,gain:.05,attack:.3});
  },
  clang(){
    [523,784,1244,1660].forEach((f,i)=>tone({type:"triangle",f0:f,f1:f*.98,dur:1.2-i*.15,gain:.14}));
    noise({type:"highpass",f0:4000,dur:.12,gain:.3});
  },
  sting(){
    // Taiko + riser + benturan akord saat "VS" mendarat.
    [0,.22,.44].forEach(at=>{tone({f0:110,f1:48,dur:.35,gain:.7,at});noise({type:"lowpass",f0:900,f1:100,dur:.2,gain:.25,at});});
    noise({type:"bandpass",f0:300,f1:5000,q:2,dur:.5,gain:.15,at:.1,attack:.4});
    [196,247,294,392].forEach(f=>tone({type:"sawtooth",f0:f,dur:1.4,gain:.07,at:.55,filter:2200}));
    tone({f0:90,f1:35,dur:1,gain:.8,at:.55});
  },
  fanfare(win=true){
    const notes=win?[523,659,784,1046]:[392,440,392];
    notes.forEach((f,i)=>{tone({type:"square",f0:f,dur:.32,gain:.07,at:i*.13,filter:3000});tone({type:"triangle",f0:f/2,dur:.4,gain:.12,at:i*.13});});
    if(win)[523,659,784].forEach(f=>tone({type:"sawtooth",f0:f,dur:1.4,gain:.05,at:.55,filter:2500}));
  },
  isMuted:()=>muted,
  bindToggle(button){
    if(!button)return;
    const paint=()=>{button.setAttribute("aria-pressed",String(!muted));button.textContent=muted?"Suara: mati":"Suara: nyala";};
    button.onclick=()=>{muted=!muted;try{localStorage.setItem("cekas-duel-mute",muted?"1":"0")}catch{};if(muted&&ctx)ctx.suspend();paint();if(!muted)sfx.cast();};
    paint();
  }
};
