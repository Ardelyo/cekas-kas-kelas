import { flight, skyEffects } from "./sky-effects.mjs";
import { mkChar } from "./actors.mjs";
import { spellFx } from "./spell-fx.mjs";
import { readSpell, SPELLS } from "./spell-shape.mjs";
const T = window.THREE;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => {x=clamp(x); return x*x*(3-2*x);};
const mix = (a,b,x) => a+(b-a)*x;
// Hit-stop: time crawls around the moment of contact, then snaps back.
const warp = r => r<.47 ? r*.52/.47 : r<.67 ? .52+(r-.47)*.25 : .57+(r-.67)*.43/.33;

export function skyStage(renderer) {
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(39,1,.1,170);
  scene.fog=new T.FogExp2(0xaedbff,.024);
  scene.add(new T.HemisphereLight(0xfffaff,0x7089be,1.4));
  const sun=new T.DirectionalLight(0xffefcb,1.4);sun.position.set(-5,8,5);scene.add(sun);
  const dome=new T.Mesh(new T.SphereGeometry(100,36,24),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:"varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:"varying vec3 v;void main(){vec3 d=normalize(v);vec3 c=mix(vec3(.85,.93,1.),vec3(.10,.37,.83),smoothstep(-.22,.55,d.y));float s=distance(d,normalize(vec3(-.55,.24,-1.)));c+=vec3(.65,.52,.23)*exp(-8.*s);c=mix(c,vec3(1.,.97,.8),1.-smoothstep(.073,.078,s));gl_FragColor=vec4(c,1.);}"
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
  function mesh(geometry,color,lit=false){
    const mat=lit?new T.MeshLambertMaterial({color,flatShading:true}):new T.MeshBasicMaterial({color,side:T.DoubleSide});
    const m=new T.Mesh(geometry,mat);scene.add(m);return m;
  }
  for(const x of [-2.6,2.6]){
    const rock=mesh(new T.ConeGeometry(1.7,2,7),0x4466aa,true);rock.rotation.z=Math.PI;rock.position.set(x,-1.15,0);
    const plinth=mesh(new T.CylinderGeometry(1.65,1.75,.24,7),0xe4f5ff,true);plinth.position.set(x,-.12,0);
  }
  const ring=mesh(new T.TorusGeometry(1,.035,6,60),0xffffd4);
  const wave=mesh(new T.TorusGeometry(.85,.055,6,52),0x93edff);
  const shape=new T.Shape();shape.moveTo(-1.8,-.83);shape.quadraticCurveTo(.9,-.85,1.9,1.05);shape.quadraticCurveTo(1.13,-1.32,-1.8,-.83);
  const slash=mesh(new T.ShapeGeometry(shape,36),hue[0]);
  const echoSlash=mesh(new T.ShapeGeometry(shape,36),0x9eeaff);
  const seal=mesh(new T.RingGeometry(.965,1,6),0xd6ff3f);
  const guards=hue.map(color=>mesh(new T.IcosahedronGeometry(.98,0),color));
  guards.forEach(m=>{m.material.wireframe=true;});
  const rays=new T.Group();scene.add(rays);
  const rayGeo=new T.ConeGeometry(.078,1.7,3);
  for(let i=0;i<22;i++){
    const ray=mesh(rayGeo,i%3===0?0xffffff:hue[i%2]);rays.add(ray);
    const angle=i*2.39996;
    ray.userData.dir=new T.Vector3(Math.cos(angle),Math.sin(angle),.25*Math.sin(i*4)).normalize();
    ray.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),ray.userData.dir);
  }
  const animateEffects=skyEffects(scene,hue);
  const fx=spellFx(scene);
  let spellKind="nova", lastNow=0, fxTimer=0, charging=false;
  const v1=new T.Vector3(), v2=new T.Vector3(), camDir=new T.Vector3();
  function impactFrame(){
    const b=document.body;b.classList.remove("fx-impact");void b.offsetWidth;b.classList.add("fx-impact");
    clearTimeout(fxTimer);fxTimer=setTimeout(()=>b.classList.remove("fx-impact"),460);
  }
  function setCharge(on){if(on!==charging){charging=on;document.body.classList.toggle("fx-charge",on);}}
  const sigil=new T.Group();
  scene.add(sigil);
  const ink=new T.MeshBasicMaterial({color:0xbfff56,transparent:true,depthWrite:false});
  const core=new T.MeshBasicMaterial({color:0xffffea,transparent:true,depthWrite:false});
  let gesture=null, caster=0;
  const pen=new T.Vector3();
  function clearSpell(){
    gesture=null;spellKind="nova";
    while(sigil.children.length){
      const line=sigil.children[0];sigil.remove(line);line.geometry.dispose();
    }
  }
  function prepareSpell(path,side=0){
    caster=side;
    clearSpell();
    const curve=new T.CatmullRomCurve3(path.map(([x,y])=>new T.Vector3(x*2.5,y*2.5,0)));
    gesture=curve;
    spellKind=readSpell(path);
    ink.color.setHex(SPELLS[spellKind].color);
    const segments=Math.min(240,Math.max(40,path.length*2));
    for(const [radius,material] of [[.065,ink],[.024,core]]){
      const stroke=new T.Mesh(new T.TubeGeometry(curve,segments,radius,6,false),material);
      if(material===core)stroke.position.z=.07;
      sigil.add(stroke);
    }
  }
  const sprites=new Map();
  let pair=[], visible=false, shot=null, aspect=1;
  function enter(a,b){
    pair.forEach(c=>scene.remove(c));
    pair=[a,b].map(k=>{if(!sprites.has(k))sprites.set(k,mkChar(k,false));const c=sprites.get(k);scene.add(c);return c;});
    visible=true;
  }
  function skip(){setCharge(false);if(shot){const done=shot.done;shot=null;clearSpell();done();}}
  function cut(kind,side,bab,done){
    shot={kind,side,bab,start:performance.now(),done,burst:false};
    fx.setSigil(gesture?SPELLS[spellKind].sides:0,gesture?SPELLS[spellKind].color:hue[side===1?1:0]);
  }
  function draw(now){
    if(!visible)return false;
    const width=renderer.domElement.clientWidth,height=renderer.domElement.clientHeight;
    if(width&&height&&aspect!==width/height){aspect=width/height;camera.aspect=aspect;camera.updateProjectionMatrix();}
    const kind=shot?.kind,side=shot?.side??0,bab=shot?.bab??0;
    const length=kind==="intro"?4.4:kind==="outro"?3.3:3.2;
    const raw=shot?clamp((now-shot.start)/(1000*length)):0;
    const hit=kind==="clash", at=.54;
    const t=hit?warp(raw):raw;
    const impact=hit?clamp((t-at)/.35):0;
    const burst=side!==3&&hit&&t>=at&&t<.89;
    const focus=side===1?1:0, dir=focus===0?1:-1;
    const swing=hit?smooth((t-.32)/.19)*(1-smooth((t-.62)/.33)):0;
    const leap=hit?Math.sin(Math.PI*swing):0;
    pair.forEach((c,i)=>{
      const sign=i===0?1:-1,u=c.userData;
      const attacks=side===2||side===i;
      const path=hit?flight(t,bab,side===2?2.1:3.72):null;
      const travel=hit&&side!==3?(attacks?path.x:-.5*Math.sin(impact*Math.PI)):0;
      const rise=kind==="intro"?2.4*(1-smooth(t/.38)):0;
      c.position.set(sign*(-2.6+travel),rise+Math.sin(now*.003+i)*.035+(hit&&attacks?path.y:0),hit&&attacks?path.z:0);
      c.rotation.y=sign*(kind==="outro"?.25:1.03);
      c.rotation.z=hit?(attacks?-sign*swing*.36:sign*Math.sin(impact*Math.PI)*.48):0;
      u.aR.rotation.x=-.45-(attacks?swing*1.25:0);u.aL.rotation.x=-.55+(attacks?swing*.75:0);
      u.aR.rotation.z=kind==="outro"&&(side===2||side===i)?2.65:0;
      u.body.rotation.y=0;u.head.rotation.x=0;
      if(hit&&i===caster&&gesture){
        const charge=smooth(t/.075)*(1-smooth((t-.26)/.14));
        gesture.getPointAt(smooth(t/.26),pen);
        u.aR.rotation.z+=charge*(.65+pen.x*.48);
        u.aR.rotation.x-=charge*(1.05+pen.y*.45);
        u.aL.rotation.x-=charge*.54;
        u.body.rotation.y=charge*(-.25+pen.x*.17);
        u.head.rotation.x=charge*(.13-pen.y*.08);
      }
      u.lL.rotation.x=leap*.65;u.lR.rotation.x=-leap*.75;
    });
    const contact=side>=2?0:dir*1.97;
    animateEffects(kind,side,bab,t,contact);
    ring.visible=wave.visible=rays.visible=burst;slash.visible=side!==3&&hit&&t>.38&&t<.75;
    echoSlash.visible=slash.visible&&(bab===1||side===2);
    if(echoSlash.visible){echoSlash.position.set(contact+.2,1.45,.51);echoSlash.rotation.z=1.65-t*1.4;echoSlash.scale.setScalar(swing+.45);}
    seal.visible=hit&&bab===2&&burst;
    if(seal.visible){seal.position.set(contact,1.5,.6);seal.rotation.z=Math.PI/6+impact*.4;seal.scale.setScalar(1.45+impact*.85);}
    guards.forEach((g,i)=>{g.visible=hit&&side===3&&t>.28&&t<.88;if(g.visible){g.position.copy(pair[i].position);g.position.y+=1.2;g.rotation.y=t*4;g.scale.setScalar(.9+.25*Math.sin(Math.PI*t));}});
    if(burst){
      for(const [i,m] of [ring,wave].entries()){m.position.set(contact,1.25,.25);m.scale.setScalar(.28+impact*(i?3.2:2.25));m.rotation.set(i?.85:.12,.2,bab*.4);}
      rays.position.set(contact,1.25,.2);rays.children.forEach((r,i)=>{r.visible=bab!==2||i%2===0;r.position.copy(r.userData.dir).multiplyScalar(.3+impact*(1.6+i%4*.47));r.scale.setScalar((1-impact)*1.6+.03);});
    }
    if(slash.visible){slash.material.color.setHex(hue[focus]);slash.position.set(contact-dir*(1-swing),1.4,.48);slash.scale.set(dir*(.7+swing),.75+swing,1);slash.rotation.z=(bab-1)*.8+dir*(t-.5)*4;}
    let tx=0,ty=1.1,cx=Math.sin(now*.00032)*1.1,cy=2.25,cz=9.4;
    if(kind==="intro"){
      if(t<.42){cx=mix(-6,-1,smooth(t/.42));cy=mix(-2.4,2.15,smooth(t/.42));cz=mix(13,8,t/.42);}
      else if(t<.64){tx=-2.6;cx=-1.2;cy=1.4;cz=3.9;}
      else if(t<.83){tx=2.6;cx=1.4;cy=1.45;cz=3.9;}
      else{cz=mix(11,8.6,smooth((t-.83)/.17));}
    }else if(hit){
      if(side===3){
        cx=mix(-1.6,1.1,smooth(t));cy=2.3;cz=9.4;
      }else if(t<.32){
        // From the rival's shoulder, cut to the striker before the launch.
        const push=smooth(t/.32);
        tx=side===2?0:-dir*2.6;ty=1.48;
        cx=side===2?1.2:tx+dir*mix(2.2,1.4,push);
        cy=mix(1.05,1.55,push);cz=side===2?8.6:mix(4.3,3.25,push);
      }else if(t<.54){
        const p=smooth((t-.32)/.22);
        tx=mix(side===2?0:-dir*2.6,contact,p);
        if(bab===1){
          // Crane above the rising fighter, then drop to eye level.
          cx=tx+dir*1.1;cy=mix(6.7,2.25,p);cz=mix(4.8,5.5,p);ty=1.45+leap;
        }else if(bab===2){
          cx=tx+dir*mix(-2.4,.9,p);cy=mix(.35,1.25,p);cz=5.7;
        }else{
          cx=tx-dir*.65;cy=1.18;cz=mix(6.3,4.75,p);
        }
      }else{
        const pull=smooth((t-.58)/.39);
        tx=contact*(1-pull);ty=1.38;
        cx=tx+dir*mix(.6,1.6,pull);cy=mix(1.45,2.6,pull);
        cz=mix(bab===2?6.6:5.25,9.2,pull);
        cx+=Math.sin(impact*41)*.28*(1-impact)**2;cy+=Math.cos(impact*37)*.18*(1-impact)**2;
      }
    }else if(kind==="outro"){tx=side===2?0:dir*-2.6;cx=tx+mix(2,.6,smooth(t));cy=1.35+t*.65;cz=side===2?9:mix(7,4.2,smooth(t));}
    camera.position.set(cx,cy,cz*Math.max(1,1.45/aspect));camera.lookAt(tx,ty,0);
    if(hit&&side!==3)camera.rotateZ(dir*(bab===1?-.085:.055)*Math.sin(Math.PI*swing));
    sigil.visible=hit&&sigil.children.length>0&&t<.84;
    if(sigil.visible){
      const reveal=smooth(t/.26), shoot=smooth((t-.29)/.25), fade=smooth((t-.59)/.25);
      sigil.position.set(mix(caster===0?-2.35:2.35,contact,shoot),1.42+.34*Math.sin(Math.PI*shoot),.83);
      sigil.quaternion.copy(camera.quaternion);
      sigil.rotateZ(.14*Math.sin(Math.PI*shoot));
      sigil.scale.setScalar(.58+.35*shoot+.65*fade);
      ink.opacity=.55*(1-fade);core.opacity=1-fade;
      for(const line of sigil.children){
        const count=line.geometry.index.count;
        line.geometry.setDrawRange(0,Math.floor(count*reveal/3)*3);
      }
    }
    const dt=Math.min(.05,(now-(lastNow||now))/1000);lastNow=now;
    const fxOn=hit&&side!==3&&!!shot;
    setCharge(fxOn&&t<.3);
    if(fxOn){
      const attacker=side===1?1:0, hero=pair[attacker];
      const color=gesture?SPELLS[spellKind].color:hue[attacker], kindNow=gesture?spellKind:"nova";
      camera.getWorldDirection(camDir);
      const charge=smooth(t/.1)*(1-smooth((t-.3)/.1));
      fx.ground.visible=charge>.01;
      if(fx.ground.visible){
        fx.ground.position.set(hero.position.x,.03,hero.position.z);fx.ground.rotation.set(-Math.PI/2,0,now*.0021);
        fx.ground.scale.setScalar(3.8*charge*(1+.04*Math.sin(now*.03)));fx.ground.material.opacity=charge;
      }
      const ring=smooth(t/.18)*(1-smooth((t-.5)/.12));
      fx.front.visible=ring>.01;
      if(fx.front.visible){
        if(sigil.visible)fx.front.position.copy(sigil.position).addScaledVector(camDir,.35);
        else fx.front.position.set(hero.position.x,1.3,hero.position.z+.5);
        fx.front.quaternion.copy(camera.quaternion);fx.front.rotateZ(-now*.0032);
        fx.front.scale.setScalar(2.9*ring);fx.front.material.opacity=.9*ring;
      }
      if(t<.27)for(let i=0;i<5;i++){
        v1.set(fx.rnd(2),fx.rnd(2),fx.rnd(2)).normalize().multiplyScalar(2+Math.random());
        fx.emit(hero.position.x+v1.x,hero.position.y+1.2+v1.y,hero.position.z+v1.z,-v1.x*5,-v1.y*5,-v1.z*5,color,.38,.07+Math.random()*.05,.97,.3);
      }
      if(gesture&&sigil.visible){
        sigil.updateMatrixWorld(true);
        if(t<.28){
          gesture.getPointAt(smooth(t/.26),v1);sigil.localToWorld(v1);
          for(let i=0;i<4;i++)fx.emit(v1.x,v1.y,v1.z,fx.rnd(1.6),fx.rnd(1.6)+.4,fx.rnd(1.6),color,.5+Math.random()*.4,.08+Math.random()*.08,.9,i?0:.7);
        }else if(t<.56){
          for(let i=0;i<10;i++){
            gesture.getPointAt(Math.random(),v1);sigil.localToWorld(v1);
            fx.emit(v1.x,v1.y,v1.z,-dir*(1+Math.random()*2.5),fx.rnd(1),fx.rnd(1),color,.45+Math.random()*.4,.06+Math.random()*.1,.9,Math.random()*.4);
          }
        }
      }else if(t>.3&&t<.56){
        for(const [i,c] of pair.entries())if(side===2||i===side)for(let k=0;k<6;k++)
          fx.emit(c.position.x+fx.rnd(.5),c.position.y+1.1+fx.rnd(.6),c.position.z+fx.rnd(.5),-(i?-1:1)*2,fx.rnd(1),fx.rnd(1),hue[i],.4,.08+Math.random()*.06,.9,.2);
      }
      if(!shot.burst&&t>=at){
        shot.burst=true;
        const shape=gesture?gesture.getSpacedPoints(90).map(p=>p.clone().multiplyScalar(.8).applyQuaternion(camera.quaternion))
          :Array.from({length:60},(_,i)=>new T.Vector3(Math.cos(i*.105),Math.sin(i*.105),0).multiplyScalar(1.4).applyQuaternion(camera.quaternion));
        fx.burst(v2.set(contact,1.35,.5),shape,kindNow,color,dir,camDir);
        if(side===2)fx.burst(v2,shape,"nova",hue[1],-dir,camDir);
        impactFrame();
      }
      const blast=clamp((t-at)/.12);
      fx.burstCircle.visible=t>=at&&blast<1;
      if(fx.burstCircle.visible){
        fx.burstCircle.position.set(contact,1.35,.55);fx.burstCircle.quaternion.copy(camera.quaternion);fx.burstCircle.rotateZ(blast*2);
        fx.burstCircle.scale.setScalar(1.2+smooth(blast)*7);fx.burstCircle.material.opacity=1-blast;
      }
    }else{fx.ground.visible=fx.front.visible=fx.burstCircle.visible=false;}
    fx.step(dt);
    clouds.rotation.y=now*.000014;renderer.render(scene,camera);
    if(shot&&raw>=1)skip();
    return true;
  }
  return {enter,draw,cut,skip,prepareSpell,leave(){clearSpell();fx.clear();setCharge(false);visible=false;shot=null;}};
}
