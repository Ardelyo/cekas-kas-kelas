import { flight } from "./sky-effects.mjs";
import { mkChar } from "./actors.mjs";
import { spellFx } from "./spell-fx.mjs";
import { spellDNA } from "./spell-shape.mjs";
import { sfx } from "./duel-sfx.mjs";
const T = window.THREE;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => {x=clamp(x); return x*x*(3-2*x);};
const mix = (a,b,x) => a+(b-a)*x;
// Hit-stop: time crawls around the moment of contact, then snaps back.
const warp = r => r<.47 ? r*.52/.47 : r<.67 ? .52+(r-.47)*.25 : .57+(r-.67)*.43/.33;

function glowTexture(){
  const c=document.createElement("canvas");c.width=c.height=128;
  const g=c.getContext("2d"), r=g.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,"rgba(255,255,255,1)");r.addColorStop(.18,"rgba(255,255,255,.85)");
  r.addColorStop(.45,"rgba(255,255,255,.25)");r.addColorStop(1,"rgba(255,255,255,0)");
  g.fillStyle=r;g.fillRect(0,0,128,128);
  return new T.CanvasTexture(c);
}

export function skyStage(renderer) {
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(39,1,.1,170);
  scene.fog=new T.FogExp2(0xaedbff,.024);
  scene.add(new T.HemisphereLight(0xfffaff,0x7089be,1.4));
  const sun=new T.DirectionalLight(0xffefcb,1.4);sun.position.set(-5,8,5);scene.add(sun);
  const dome=new T.Mesh(new T.SphereGeometry(100,36,24),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,uniforms:{dusk:{value:0},tint:{value:new T.Vector3(1,1,1)}},
    vertexShader:"varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:"uniform float dusk;uniform vec3 tint;varying vec3 v;void main(){vec3 d=normalize(v);vec3 c=mix(vec3(.85,.93,1.),vec3(.10,.37,.83),smoothstep(-.22,.55,d.y));c=mix(c,mix(vec3(.13,.16,.42),vec3(.02,.05,.18),smoothstep(-.2,.6,d.y)),dusk);float s=distance(d,normalize(vec3(-.55,.24,-1.)));c+=vec3(.65,.52,.23)*exp(-8.*s)*(1.-dusk*.7);c=mix(c,vec3(1.,.97,.8),(1.-smoothstep(.073,.078,s))*(1.-dusk));c+=tint*dusk*.22*smoothstep(-.3,.4,d.y);gl_FragColor=vec4(c,1.);}"
  }));scene.add(dome);
  const cloudGeo=new T.IcosahedronGeometry(1,1), cloudMat=new T.MeshLambertMaterial({color:0xf3f8ff,flatShading:true});
  const clouds=new T.Group();scene.add(clouds);
  for(let i=0;i<36;i++){
    const a=i*2.39996,r=12+(i%5)*4;
    for(let j=0;j<3;j++){
      const c=new T.Mesh(cloudGeo,cloudMat);c.position.set(Math.cos(a)*r+j*2,-4+(i%4)*.65+j%2,Math.sin(a)*r);
      c.scale.set(3.8+j*.4,1.3+j*.2,2.8);clouds.add(c);
    }
  }
  const hue=[0xd6ff3f,0x65dfff];
  const add=m=>{scene.add(m);return m;};
  const lit=(geometry,color)=>add(new T.Mesh(geometry,new T.MeshLambertMaterial({color,flatShading:true})));
  for(const x of [-2.6,2.6]){
    const rock=lit(new T.ConeGeometry(1.7,2,7),0x4466aa);rock.rotation.z=Math.PI;rock.position.set(x,-1.15,0);
    const plinth=lit(new T.CylinderGeometry(1.65,1.75,.24,7),0xe4f5ff);plinth.position.set(x,-.12,0);
  }
  const additive=(color,extra={})=>new T.MeshBasicMaterial({color,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,...extra});

  // ---- VFX kit ----
  const fx=spellFx(scene);
  const glowTex=glowTexture();
  const glow=(color,s)=>{const sp=add(new T.Sprite(new T.SpriteMaterial({map:glowTex,color,transparent:true,blending:T.AdditiveBlending,depthWrite:false})));sp.scale.setScalar(s);sp.visible=false;sp.renderOrder=6;return sp;};
  const cores=hue.map(()=>glow(0xffffff,.8)), halos=hue.map(c=>glow(c,2.6)), hands=hue.map(c=>glow(c,1));
  const flash=glow(0xffffff,1);
  const shock=add(new T.Mesh(new T.RingGeometry(.86,1,72),additive(0xffffff)));shock.rotation.x=-Math.PI/2;shock.visible=false;
  const shock2=add(new T.Mesh(new T.RingGeometry(.94,1,72),additive(0xffffff)));shock2.visible=false;
  const bolts=Array.from({length:14},()=>{
    const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(new Float32Array(16*3),3));
    const l=add(new T.Line(g,new T.LineBasicMaterial({color:0xffffff,transparent:true,blending:T.AdditiveBlending,depthWrite:false})));
    l.frustumCulled=false;l.visible=false;l.renderOrder=7;return l;
  });
  const rocks=Array.from({length:18},(_,i)=>{const r=lit(new T.DodecahedronGeometry(.07+(i%3)*.04),i%2?0xc9d8f2:0x6d86bf);r.visible=false;r.userData.v=new T.Vector3();return r;});
  const shieldMat=c=>new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    uniforms:{c:{value:new T.Color(c)},o:{value:0},time:{value:0},hit:{value:0}},
    vertexShader:"varying vec3 n;varying vec3 v;varying vec2 u;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=-mv.xyz;u=uv;gl_Position=projectionMatrix*mv;}",
    fragmentShader:"uniform vec3 c;uniform float o,time,hit;varying vec3 n;varying vec3 v;varying vec2 u;void main(){float f=pow(1.-abs(dot(n,normalize(v))),2.2);vec2 h=vec2(u.x*28.,u.y*14.);float grid=step(.9,fract(h.x+.5*floor(h.y)))+step(.88,fract(h.y));float scan=smoothstep(.0,.08,abs(fract(u.y*2.-time*.8)-.5));float a=(f*1.4+grid*.22*(1.-scan*.5)+hit*.6)*o;gl_FragColor=vec4(c*(1.+hit)+f*.4,a);}"
  });
  const shields=hue.map(c=>{const m=add(new T.Mesh(new T.SphereGeometry(1.25,32,20),shieldMat(c)));m.visible=false;m.renderOrder=5;return m;});

  // ---- sigil yang digambar pemain ----
  const sigil=new T.Group();scene.add(sigil);
  const ink=new T.MeshBasicMaterial({color:0xbfff56,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const core=new T.MeshBasicMaterial({color:0xffffea,transparent:true,depthWrite:false});
  let gesture=null, caster=0, dna=null, lastNow=0, fxTimer=0, charging=false;
  const pen=new T.Vector3(), v1=new T.Vector3(), v2=new T.Vector3(), camDir=new T.Vector3();
  function clearSpell(){
    gesture=null;dna=null;
    while(sigil.children.length){const line=sigil.children[0];sigil.remove(line);line.geometry.dispose();}
  }
  function prepareSpell(path,side=0){
    caster=side;clearSpell();
    const curve=new T.CatmullRomCurve3(path.map(([x,y])=>new T.Vector3(x*2.5,y*2.5,0)));
    gesture=curve;
    dna=path.dna||spellDNA(path.map(([x,y])=>[x,-y]));
    ink.color.setHex(dna.color);core.color.setHex(dna.element==="ombak"?0xe8f6ff:0xffffea);
    const segments=Math.min(240,Math.max(40,path.length*2));
    for(const [radius,material] of [[.07*dna.power,ink],[.025*dna.power,core]]){
      const stroke=new T.Mesh(new T.TubeGeometry(curve,segments,radius,6,false),material);
      if(material===core)stroke.position.z=.07;
      sigil.add(stroke);
    }
  }
  function impactFrame(){
    const b=document.body;b.classList.remove("fx-impact");void b.offsetWidth;b.classList.add("fx-impact");
    clearTimeout(fxTimer);fxTimer=setTimeout(()=>b.classList.remove("fx-impact"),460);
  }
  function setCharge(on){if(on!==charging){charging=on;document.body.classList.toggle("fx-charge",on);}}
  function zap(line,a,b,jag){
    const p=line.geometry.attributes.position;
    for(let i=0;i<16;i++){
      const u=i/15, k=Math.sin(Math.PI*u)*jag;
      p.setXYZ(i,mix(a.x,b.x,u)+(Math.random()-.5)*k,mix(a.y,b.y,u)+(Math.random()-.5)*k,mix(a.z,b.z,u)+(Math.random()-.5)*k);
    }
    p.needsUpdate=true;line.visible=true;
  }
  function hideFx(){
    [...cores,...halos,...hands,flash,shock,shock2,...bolts,...rocks,...shields].forEach(o=>o.visible=false);
    fx.ground.visible=fx.front.visible=fx.burstCircle.visible=false;
  }

  const sprites=new Map();
  let pair=[], visible=false, shot=null, aspect=1;
  function enter(a,b){
    pair.forEach(c=>scene.remove(c));
    pair=[a,b].map(k=>{if(!sprites.has(k))sprites.set(k,mkChar(k,false));const c=sprites.get(k);scene.add(c);return c;});
    visible=true;
  }
  function skip(){setCharge(false);hideFx();if(shot){const done=shot.done;shot=null;clearSpell();done();}}
  function cut(kind,side,bab,done){
    shot={kind,side,bab,start:performance.now(),done,burst:false,cues:new Set()};
    fx.setSigil(gesture?dna.sides:0,gesture?dna.accent:hue[side===1?1:0]);
    const tint=gesture?dna.tint:(side===1?[.4,.85,1]:[.8,1,.3]);dome.material.uniforms.tint.value.set(...tint);
  }
  const cue=(name,when,fn)=>{if(shot&&!shot.cues.has(name)&&when){shot.cues.add(name);fn();}};

  function draw(now){
    if(!visible)return false;
    const width=renderer.domElement.clientWidth,height=renderer.domElement.clientHeight;
    if(width&&height&&aspect!==width/height){aspect=width/height;camera.aspect=aspect;camera.updateProjectionMatrix();}
    const dt=Math.min(.05,(now-(lastNow||now))/1000);lastNow=now;
    const kind=shot?.kind,side=shot?.side??0,bab=shot?.bab??0;
    const length=kind==="intro"?4.4:kind==="outro"?3.3:3.2;
    const raw=shot?clamp((now-shot.start)/(1000*length)):0;
    const hit=kind==="clash", at=.54;
    const t=hit?warp(raw):raw;
    const attack=hit&&side!==3;
    const impact=hit?clamp((t-at)/.35):0;
    const focus=side===1?1:0, dir=focus===0?1:-1;
    const swing=hit?smooth((t-.32)/.19)*(1-smooth((t-.62)/.33)):0;
    const leap=hit?Math.sin(Math.PI*swing):0;
    const contact=side>=2?0:dir*1.97;
    // Langit meredup saat jurus diisi, kembali cerah setelah benturan.
    dome.material.uniforms.dusk.value=attack?smooth(t/.2)*(1-smooth((t-.6)/.3))*.85:0;

    pair.forEach((c,i)=>{
      const sign=i===0?1:-1,u=c.userData;
      const attacks=side===2||side===i;
      const path=hit?flight(t,bab,side===2?2.1:3.72):null;
      const travel=attack?(attacks?path.x:-.6*Math.sin(impact*Math.PI)):0;
      const rise=kind==="intro"?2.4*(1-smooth(t/.38)):0;
      c.position.set(sign*(-2.6+travel),rise+Math.sin(now*.003+i)*.035+(attack&&attacks?path.y:0),attack&&attacks?path.z:0);
      c.rotation.y=sign*(kind==="outro"?.25:1.03);
      const recoil=attack&&!attacks?Math.sin(impact*Math.PI)*.55:0;
      c.rotation.z=attack?(attacks?-sign*swing*.36:sign*recoil):0;
      u.aR.rotation.x=-.45-(attacks&&hit?swing*1.25:0);u.aL.rotation.x=-.55+(attacks&&hit?swing*.75:0);
      u.aR.rotation.z=kind==="outro"&&(side===2||side===i)?2.65:0;
      u.body.rotation.y=0;u.head.rotation.x=0;
      if(hit&&side===3){u.aR.rotation.x=u.aL.rotation.x=-1.4*smooth((t-.15)/.1);}
      if(attack&&attacks){
        const charge=smooth(t/.075)*(1-smooth((t-.26)/.14));
        if(i===caster&&gesture){
          gesture.getPointAt(smooth(t/.26),pen);
          u.aR.rotation.z+=charge*(.65+pen.x*.48);u.aR.rotation.x-=charge*(1.05+pen.y*.45);
          u.body.rotation.y=charge*(-.25+pen.x*.17);u.head.rotation.x=charge*(.13-pen.y*.08);
        }else{u.aR.rotation.x-=charge*1.3;u.aR.rotation.z+=charge*.4;}
        u.aL.rotation.x-=charge*.54;
      }
      u.lL.rotation.x=leap*.65;u.lR.rotation.x=-leap*.75;
    });

    // ---- kamera ----
    let tx=0,ty=1.1,cx=Math.sin(now*.00032)*1.1,cy=2.25,cz=9.4;
    if(kind==="intro"){
      if(t<.42){cx=mix(-6,-1,smooth(t/.42));cy=mix(-2.4,2.15,smooth(t/.42));cz=mix(13,8,t/.42);}
      else if(t<.64){tx=-2.6;cx=-1.2;cy=1.4;cz=3.9;}
      else if(t<.83){tx=2.6;cx=1.4;cy=1.45;cz=3.9;}
      else{cz=mix(11,8.6,smooth((t-.83)/.17));}
    }else if(hit){
      if(side===3){
        cx=mix(-1.6,1.1,smooth(t));cy=2.3;cz=mix(9.4,7.6,smooth(t));
      }else if(t<.32){
        const push=smooth(t/.32);
        tx=side===2?0:-dir*2.6;ty=1.48;
        cx=side===2?1.2:tx+dir*mix(2.2,1.2,push);
        cy=mix(.9,1.5,push);cz=side===2?mix(9.5,8.2,push):mix(4.6,3,push);
      }else if(t<.54){
        const p=smooth((t-.32)/.22);
        tx=mix(side===2?0:-dir*2.6,contact,p);
        if(bab===1){cx=tx+dir*1.1;cy=mix(6.7,2.25,p);cz=mix(4.8,5.5,p);ty=1.45+leap;}
        else if(bab===2){cx=tx+dir*mix(-2.4,.9,p);cy=mix(.35,1.25,p);cz=5.7;}
        else{cx=tx-dir*.65;cy=1.18;cz=mix(6.3,4.75,p);}
      }else{
        const pull=smooth((t-.58)/.39);
        tx=contact*(1-pull);ty=1.38;
        cx=tx+dir*mix(.6,1.6,pull);cy=mix(1.45,2.6,pull);
        cz=mix(bab===2?6.6:5.25,9.2,pull);
        cx+=Math.sin(impact*41)*.28*(1-impact)**2;cy+=Math.cos(impact*37)*.18*(1-impact)**2;
      }
    }else if(kind==="outro"){tx=side===2?0:dir*-2.6;cx=tx+mix(2,.6,smooth(t));cy=1.35+t*.65;cz=side===2?9:mix(7,4.2,smooth(t));}
    camera.position.set(cx,cy,cz*Math.max(1,1.45/aspect));camera.lookAt(tx,ty,0);
    if(attack)camera.rotateZ(dir*(bab===1?-.085:.055)*Math.sin(Math.PI*swing));
    const fovKick=attack?6*Math.sin(Math.PI*clamp((t-.3)/.24))-4*Math.max(0,1-impact*3)*(t>=at?1:0):0;
    if(Math.abs(camera.fov-(39+fovKick))>.01){camera.fov=39+fovKick;camera.updateProjectionMatrix();}
    camera.getWorldDirection(camDir);

    // ---- sigil ----
    sigil.visible=attack&&sigil.children.length>0&&t<at+.005;
    if(sigil.visible){
      const reveal=smooth(t/.26), shoot=smooth((t-.29)/.25);
      sigil.position.set(mix(caster===0?-2.35:2.35,contact,shoot),1.42+.34*Math.sin(Math.PI*shoot),.83);
      sigil.quaternion.copy(camera.quaternion);sigil.rotateZ(.14*Math.sin(Math.PI*shoot)+shoot*dir*-1.2);
      sigil.scale.setScalar(.6+.25*shoot*(1+.1*Math.sin(now*.05)));
      ink.opacity=.85;core.opacity=1;
      for(const line of sigil.children){const count=line.geometry.index.count;line.geometry.setDrawRange(0,Math.floor(count*reveal/3)*3);}
      sigil.updateMatrixWorld(true);
    }

    hideFx();
    setCharge(attack&&t<.3);
    if(hit&&shot){
      const spell=gesture?dna:{kind:"nova",element:"cahaya",color:hue[focus],accent:0xffffff,power:1,spin:1,bolts:3};
      if(attack){
        cue("charge",t>.01,()=>sfx.charge());
        cue("cast",gesture&&t>.06,()=>sfx.cast());
        cue("whoosh",t>.3,()=>sfx.whoosh());
        if(spell.element==="petir")cue("zap",t>.36,()=>sfx.zap());
      }
      pair.forEach((hero,i)=>{
        if(!(attack&&(side===2||side===i)))return;
        const color=gesture&&i===caster?dna.color:hue[i];
        const sign=i===0?1:-1;
        // Tenaga terkumpul di tangan.
        const charge=smooth(t/.1)*(1-smooth((t-.3)/.06));
        if(charge>.01){
          u_hand(hero,v1);
          hands[i].visible=true;hands[i].position.copy(v1);hands[i].material.color.setHex(color);
          hands[i].scale.setScalar(.6+1.4*charge+.25*Math.sin(now*.04));hands[i].material.opacity=charge;
          if(Math.random()<.5)fx.emit(v1.x,v1.y,v1.z,fx.rnd(.5),fx.rnd(.5)+.6,fx.rnd(.5),color,.4,.05,.95,.6);
          for(let k=0;k<4;k++){
            v2.set(fx.rnd(2),fx.rnd(2),fx.rnd(2)).normalize().multiplyScalar(1.8+Math.random());
            fx.emit(v1.x+v2.x,v1.y+v2.y,v1.z+v2.z,-v2.x*5,-v2.y*5,-v2.z*5,color,.36,.06+Math.random()*.05,.97,.3);
          }
        }
        // Lingkaran sihir di tanah.
        if(i===focus||side===2){
          fx.ground.visible=charge>.01;
          if(fx.ground.visible){
            fx.ground.position.set(hero.position.x,.03,hero.position.z);fx.ground.rotation.set(-Math.PI/2,0,now*.0021*sign);
            fx.ground.scale.setScalar(3.8*charge*(1+.04*Math.sin(now*.03)));fx.ground.material.opacity=charge;
          }
          const ring=smooth(t/.18)*(1-smooth((t-.48)/.08));
          fx.front.visible=ring>.01;
          if(fx.front.visible){
            if(sigil.visible)fx.front.position.copy(sigil.position).addScaledVector(camDir,.35);
            else fx.front.position.set(hero.position.x+sign*.6,1.3,hero.position.z+.4);
            fx.front.quaternion.copy(camera.quaternion);fx.front.rotateZ(-now*.0032);
            fx.front.scale.setScalar(2.9*ring);fx.front.material.opacity=.9*ring;
          }
        }
        // Proyektil: inti putih + halo warna jurus, dengan jejak partikel.
        if(t>.29&&t<at){
          if(gesture&&i===caster&&sigil.visible)v1.copy(sigil.position);
          else v1.set(hero.position.x+sign*.5,hero.position.y+1.15,hero.position.z+.3);
          const flick=1+.15*Math.sin(now*.09+i);
          cores[i].visible=halos[i].visible=true;
          cores[i].position.copy(v1);halos[i].position.copy(v1);
          cores[i].scale.setScalar(.9*flick);halos[i].scale.setScalar(3.2*flick);halos[i].material.color.setHex(color);
          halos[i].material.opacity=.75;
          for(let k=0;k<8;k++)fx.emit(v1.x+fx.rnd(.4),v1.y+fx.rnd(.4),v1.z+fx.rnd(.4),-sign*(1+Math.random()*3),fx.rnd(1),fx.rnd(1),color,.4+Math.random()*.4,.06+Math.random()*.1,.9,Math.random()*.5);
          if(gesture&&i===caster)for(let k=0;k<6;k++){
            gesture.getPointAt(Math.random(),v2);sigil.localToWorld(v2);
            fx.emit(v2.x,v2.y,v2.z,-sign*(1+Math.random()*2),fx.rnd(1),fx.rnd(1),color,.45,.06+Math.random()*.07,.9,.2);
          }
          if(spell.element==="petir"||Math.random()<.12){
            const b=bolts[i*2];b.material.color.setHex(color);
            v2.copy(v1).add(new T.Vector3(fx.rnd(2.4),fx.rnd(2),fx.rnd(1)));zap(b,v1,v2,.5);
          }
        }
      });

      if(attack){
        const color=spell.color;
        cue("impact",t>=at,()=>{
          sfx.impact(side===2?1.2:1);
          if(spell.element==="petir")sfx.zap();
          const shape=gesture?gesture.getSpacedPoints(90).map(p=>p.clone().multiplyScalar(.8).applyQuaternion(camera.quaternion))
            :Array.from({length:60},(_,i)=>new T.Vector3(Math.cos(i*.105),Math.sin(i*.105),0).multiplyScalar(1.4).applyQuaternion(camera.quaternion));
          fx.burst(v2.set(contact,1.35,.5),shape,spell,dir,camDir);
          if(side===2)fx.burst(v2,shape,{kind:"nova",element:"cahaya",color:hue[1],accent:0xffffff,power:.8,spin:1},-dir,camDir);
          const ice=spell.element==="kristal",rockColor=ice?0xdff4ff:spell.element==="meteor"?0xe6ff9a:null;
          rocks.forEach((r,k)=>{if(rockColor)r.material.color.setHex(k%2?rockColor:0xffffff);else r.material.color.setHex(k%2?0xc9d8f2:0x6d86bf);r.scale.setScalar(ice?1.6:1);r.position.set(contact+fx.rnd(1.4),.2,fx.rnd(1.2));r.userData.v.set(fx.rnd(7),3+Math.random()*6,fx.rnd(5));r.rotation.set(k,k*2,0);});
          impactFrame();
        });
        if(t>=at){
          const blast=clamp((t-at)/.12), wave=clamp((t-at)/.3);
          flash.visible=blast<1;flash.position.set(contact,1.35,.6);flash.scale.setScalar(1+smooth(blast)*11);flash.material.opacity=1-blast;
          fx.burstCircle.visible=blast<1;
          if(fx.burstCircle.visible){
            fx.burstCircle.position.set(contact,1.35,.55);fx.burstCircle.quaternion.copy(camera.quaternion);fx.burstCircle.rotateZ(blast*2);
            fx.burstCircle.scale.setScalar(1.2+smooth(blast)*7);fx.burstCircle.material.opacity=1-blast;
          }
          shock.visible=wave<1;shock.position.set(contact,.06,0);shock.scale.setScalar(.5+smooth(wave)*9);shock.material.opacity=(1-wave)*.9;shock.material.color.setHex(spell.accent);shock2.material.color.setHex(spell.color);
          shock2.visible=wave<1;shock2.position.set(contact,1.35,.5);shock2.quaternion.copy(camera.quaternion);shock2.scale.setScalar(.6+smooth(wave)*6);shock2.material.opacity=(1-wave)*.8;
          const zapTime=spell.element==="petir"?.24:.1;
          if(t<at+zapTime)bolts.forEach((b,k)=>{
            if(k>=spell.bolts)return;
            b.material.color.setHex(k%3?spell.accent:0xffffff);
            const a=k*.449+Math.random()*.4,r=2.4+Math.random()*1.8;
            v1.set(contact,1.35,.5);v2.set(contact+Math.cos(a)*r,1.35+Math.sin(a)*r*.8,.5+fx.rnd(1.5));zap(b,v1,v2,.7);
          });
          rocks.forEach(r=>{
            if(impact>=1)return;
            r.visible=true;r.userData.v.y-=14*dt;r.position.addScaledVector(r.userData.v,dt);r.rotation.x+=dt*8;r.rotation.y+=dt*6;
          });
        }
      }else{
        // Keduanya meleset: perisai energi bertahan dari serangan liar di tengah.
        cue("shield",t>.15,()=>sfx.shield());
        cue("clang",t>=at,()=>{sfx.clang();fx.burst(v2.set(0,1.3,.4),Array.from({length:30},(_,i)=>new T.Vector3(Math.cos(i*.21),Math.sin(i*.21),0).multiplyScalar(.6)),"nova",0xffffff,1,camDir);});
        const up=smooth((t-.12)/.12)*(1-smooth((t-.86)/.1));
        shields.forEach((s,i)=>{
          s.visible=up>.01;s.position.copy(pair[i].position);s.position.y+=1.1;
          s.scale.setScalar(.85+.15*up);s.rotation.y=now*.0006;
          const u=s.material.uniforms;u.o.value=up;u.time.value=now*.001;u.hit.value=Math.max(0,1-Math.abs(t-at)*12);
        });
      }
    }
    fx.step(dt);
    clouds.rotation.y=now*.000014;renderer.render(scene,camera);
    if(shot&&raw>=1)skip();
    return true;
  }
  function u_hand(hero,out){
    hero.userData.aR.getWorldPosition(out);out.y-=.35;
    return out;
  }
  return {enter,draw,cut,skip,prepareSpell,leave(){clearSpell();fx.clear();hideFx();setCharge(false);visible=false;shot=null;}};
}
