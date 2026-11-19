import {mkChar} from "./actors.mjs";
import {skyStage} from "./sky-stage.mjs";
const T=window.THREE;
export function classroom(canvas,onVisit){
  const renderer=new T.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  let sky;
  const scene=new T.Scene(), camera=new T.OrthographicCamera();
  scene.background=new T.Color(0xbddcf4);
  camera.position.set(6,7.8,14); camera.lookAt(0,1,0);
  scene.add(new T.HemisphereLight(0xffffff,0x9baecd,1.25));
  const sun=new T.DirectionalLight(0xfff4cb,1.1);sun.position.set(-4,8,5);scene.add(sun);
  function box(w,h,d,x,y,z,color){
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color}));
    mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  function sign(word,x,y,z,w,h,bg="#193f50"){
    const c=document.createElement("canvas");c.width=600;c.height=160;
    const g=c.getContext("2d");g.fillStyle=bg;g.fillRect(0,0,600,160);g.textAlign="center";g.textBaseline="middle";g.fillStyle="#ffffff";g.font="bold 52px sans-serif";g.fillText(word,300,80,572);
    const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:new T.CanvasTexture(c)}));m.position.set(x,y,z);scene.add(m);return m;
  }
  box(11,.3,7,0,-.16,0,0x365183);
  for(let x=-5;x<=5;x++)for(let z=-3;z<=3;z++)box(.99,.035,.99,x,0,z,(x+z)%2?0xe1d7be:0xf1e7d1);
  box(11,3.5,.16,0,1.75,-3.5,0xeaf2f0);box(.16,3.5,7,-5.5,1.75,0,0xc8d8e2);
  for(const z of [-2,0,2]){box(.12,1.6,1.55,-5.38,2.3,z,0x73bdf2);box(.16,.08,1.6,-5.3,2.3,z,0xffffff)}
  box(4.9,1.6,.16,-1.65,2.15,-3.33,0xb58754);
  const board=sign("PENTAS XI-F2",-1.65,2.15,-3.235,4.75,1.46);
  const door=box(1.45,2.9,.18,4,1.45,-3.29,0x436e98);sign("XI-F2",4,2.35,-3.18,1,.38);box(.13,.1,.16,4.5,1.45,-3.13,0xffce73);
  function table(x,z){const top=box(1.85,.15,.95,x,.98,z,0xd7a368);for(const dx of [-.73,.73])for(const dz of [-.34,.34])box(.1,.92,.1,x+dx,.48,z+dz,0x43546b);return top}
  const desk=table(1,-.55);box(.56,.08,.4,1,.111+ .95,-.55,0x184d8b);table(-3,-.8);
  const stations=[[-2.7,.6],[1,.75],[4,-1.65]];
  let celebrateUntil=0, celebratePlayer=false, celebrateRival=false;
  let actor,opponent,goal=null,active=true,lastPlace=-1,last=0;
  const cast=new Map();
  function character(name){if(!cast.has(name))cast.set(name,mkChar(name,false));return cast.get(name);}
  function characters(a,b){
    if(actor)scene.remove(actor,opponent);
    actor=character(a);opponent=character(b);scene.add(actor,opponent);
    actor.position.set(-.8,.04,2);opponent.position.set(2.8,.04,.55);opponent.rotation.y=-.18;goal=null;lastPlace=-1;
  }
  const keys=new Set();
  addEventListener("keydown",e=>{if(active&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();keys.add(e.key);goal=null;}});
  addEventListener("keyup",e=>keys.delete(e.key));addEventListener("blur",()=>keys.clear());
  function visit(i){if(active){goal=stations[i];lastPlace=-1;}}
  canvas.onclick=e=>{if(!active)return;const rect=canvas.getBoundingClientRect();const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),camera);
    const hit=ray.intersectObjects([board,desk,door])[0];if(hit){visit([board,desk,door].indexOf(hit.object));return;}
    const p=new T.Vector3();if(ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),p))goal=[Math.max(-4.7,Math.min(4.8,p.x)),Math.max(.6,Math.min(2.9,p.z))];};
  new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!h)return;const size=Math.max(4.6,6.5*h/w);Object.assign(camera,{left:-size*w/h,right:size*w/h,top:size,bottom:-size,near:.1,far:80});camera.updateProjectionMatrix();renderer.setSize(w,h,false)}).observe(canvas);
  function draw(now){const dt=Math.min(.08,(now-last)/1000);last=now;
    if(sky?.draw(now)){requestAnimationFrame(draw);return;}
    if(actor&&active){let dx=+keys.has("ArrowRight")-+keys.has("ArrowLeft"),dz=+keys.has("ArrowDown")-+keys.has("ArrowUp");
      if(goal){dx=goal[0]-actor.position.x;dz=goal[1]-actor.position.z}
      const dist=Math.hypot(dx,dz),step=Math.min(dist,dt*4.5);
      if(dist>.05){actor.position.x=T.MathUtils.clamp(actor.position.x+dx/dist*step,-4.7,4.8);actor.position.z=T.MathUtils.clamp(actor.position.z+dz/dist*step,actor.position.x > 3 ? -2 : .53,2.9);actor.rotation.y=Math.atan2(dx,dz);}
      else goal=null;
      const swing=dist>.05?Math.sin(now*.014)*.35:0;actor.userData.lL.rotation.x=swing;actor.userData.lR.rotation.x=-swing;
      const i=stations.findIndex(([x,z])=>Math.hypot(x-actor.position.x,z-actor.position.z)<.45);
      if(i!==lastPlace){lastPlace=i;if(i>=0)onVisit(i);}
    }
    const cheering=now<celebrateUntil&&!active;
    if(actor)actor.userData.aR.rotation.z=cheering&&celebratePlayer?2.6+Math.sin(now*.012)*.16:0;
    if(opponent){
      opponent.userData.body.position.y=.02*Math.sin(now*.002);
      opponent.userData.aL.rotation.z=cheering&&celebrateRival?-2.6-Math.sin(now*.012)*.16:0;
    }
    renderer.render(scene,camera);requestAnimationFrame(draw);
  }requestAnimationFrame(draw);
  return {characters,visit,enterSky(a,b){sky??=skyStage(renderer);sky.enter(a,b)},prepareSpell(path,side){sky.prepareSpell(path,side)},cut(kind,side,bab,done){sky.cut(kind,side,bab,done)},skip(){sky?.skip()},leaveSky(){sky?.leave()},celebrate(playerWon,rivalWon){
    celebratePlayer=playerWon;celebrateRival=rivalWon;celebrateUntil=performance.now()+2200;
  },enable(v){active=v;goal=null;keys.clear();if(!v&&actor){actor.rotation.y=.25;actor.userData.lL.rotation.x=actor.userData.lR.rotation.x=0;}}};
}
