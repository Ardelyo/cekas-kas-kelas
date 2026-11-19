// Partikel aditif + lingkaran sihir untuk jurus yang digambar pemain.
const T = window.THREE;

function circleTexture(sides) {
  const c=document.createElement("canvas");c.width=c.height=512;
  const g=c.getContext("2d");g.translate(256,256);
  g.strokeStyle=g.fillStyle="#fff";g.shadowColor="#fff";g.shadowBlur=8;
  for(const [r,w] of [[244,6],[226,2],[162,3],[118,1.5]]){g.lineWidth=w;g.beginPath();g.arc(0,0,r,0,7);g.stroke();}
  for(let i=0;i<48;i++){g.save();g.rotate(i*Math.PI/24);g.fillRect(-1.5,-240,3,i%4?9:18);g.restore();}
  for(let i=0;i<16;i++){
    g.save();g.rotate(i*Math.PI/8);g.translate(0,-194);g.lineWidth=3;g.beginPath();
    const k=i%4;
    if(k===0){g.moveTo(-10,10);g.lineTo(0,-12);g.lineTo(10,10);}
    else if(k===1){g.arc(0,0,9,0,7);g.moveTo(0,-15);g.lineTo(0,15);}
    else if(k===2){g.moveTo(-10,-10);g.lineTo(10,10);g.moveTo(10,-10);g.lineTo(-10,10);}
    else g.rect(-8,-8,16,16);
    g.stroke();g.restore();
  }
  const star=(n,step,r,rot=0)=>{g.beginPath();for(let i=0;i<=n;i++){const a=i*step*2*Math.PI/n-Math.PI/2+rot;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();};
  g.lineWidth=3.5;
  if(!sides){star(3,1,226);star(3,1,226,Math.PI);}
  else star(sides,sides===5?2:1,226);
  g.lineWidth=2;star(sides||6,1,118,Math.PI/(sides||6));
  const tex=new T.CanvasTexture(c);
  return tex;
}

export function spellFx(scene) {
  const textures=new Map();
  const disc=()=>{
    const m=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));
    m.visible=false;m.renderOrder=3;scene.add(m);return m;
  };
  const ground=disc(), front=disc(), burstCircle=disc();
  function setSigil(sides,color){
    if(!textures.has(sides))textures.set(sides,circleTexture(sides));
    for(const m of [ground,front,burstCircle]){m.material.map=textures.get(sides);m.material.color.setHex(color);m.material.needsUpdate=true;}
  }

  const N=1400;
  const pos=new Float32Array(N*3), col=new Float32Array(N*3), ls=new Float32Array(N*2);
  const vel=new Float32Array(N*3), life=new Float32Array(N), max=new Float32Array(N), size=new Float32Array(N), drag=new Float32Array(N);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.BufferAttribute(pos,3));
  geometry.setAttribute("color",new T.BufferAttribute(col,3));
  geometry.setAttribute("aLs",new T.BufferAttribute(ls,2));
  const points=new T.Points(geometry,new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,
    vertexShader:"attribute vec2 aLs;varying vec3 vC;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aLs.y*420./-mv.z;gl_Position=projectionMatrix*mv;vC=color;vA=aLs.x;}",
    fragmentShader:"varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,1.6);gl_FragColor=vec4(vC*(.6+a*1.4),a*vA);}"
  }));
  points.frustumCulled=false;points.renderOrder=4;scene.add(points);
  let cursor=0;
  const tint=new T.Color(), white=new T.Color(0xffffff);
  function emit(x,y,z,vx,vy,vz,color,lifetime,s,d=.92,whiteness=0){
    const i=cursor;cursor=(cursor+1)%N;
    pos.set([x,y,z],i*3);vel.set([vx,vy,vz],i*3);
    tint.setHex(color).lerp(white,whiteness);col.set([tint.r,tint.g,tint.b],i*3);
    life[i]=max[i]=lifetime;size[i]=s;drag[i]=d;
  }
  const rnd=s=>(Math.random()-.5)*s;
  const tmp=new T.Vector3(), tan=new T.Vector3(), axis=new T.Vector3();

  // The impact explodes in the silhouette of what the player drew, styled by the spell's element.
  function burst(center,shape,dna,dir,view){
    axis.copy(view).normalize();
    const el=dna.element, n=Math.round(420*dna.power);
    for(let i=0;i<n;i++){
      const p=shape[(Math.random()*shape.length)|0];
      tmp.copy(p);
      const r=tmp.length()||1;
      const out=tmp.clone().multiplyScalar((2+Math.random()*3.4)*dna.power/r);
      let life=.7+Math.random()*.8, size=.09+Math.random()*.16, drag=.9, color=Math.random()<.3?dna.accent:dna.color;
      if(el==="cahaya")out.setLength(4.4*dna.power);
      if(el==="angin"){tan.crossVectors(tmp,axis).normalize().multiplyScalar(5*dna.spin);out.add(tan);}
      if(el==="kristal"){out.multiplyScalar(.6);size*=1.5;drag=.95;life*=1.4;}
      if(el==="petir"){out.x+=rnd(7);out.y+=rnd(7);life*=.6;}
      if(el==="ombak"){out.x*=2.2;out.y=Math.abs(out.y)*.5+1.5;drag=.93;}
      if(el==="meteor"){out.multiplyScalar(.5);out.x+=dir*(3+Math.random()*5);out.y-=2+Math.random()*3;}
      if(dna.kind==="lance")out.x+=dir*2.5;
      emit(center.x+p.x*.9,center.y+p.y*.9,center.z+p.z*.9,out.x,out.y,out.z+rnd(1.5),color,life,size,drag,Math.random()*.4);
    }
    for(let i=0;i<160;i++){
      const a=Math.random()*Math.PI*2,b=rnd(2),v=6+Math.random()*9;
      emit(center.x,center.y,center.z,Math.cos(a)*v,Math.sin(a)*v,b*v*.3,0xffffff,.25+Math.random()*.35,.05+Math.random()*.06,.86);
    }
  }
  function step(dt){
    const k=dt*60;
    for(let i=0;i<N;i++){
      if(life[i]<=0){ls[i*2]=0;continue;}
      life[i]-=dt;
      const f=Math.pow(drag[i],k);
      vel[i*3]*=f;vel[i*3+1]=vel[i*3+1]*f-.9*dt;vel[i*3+2]*=f;
      pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt;
      const p=Math.max(0,life[i]/max[i]);
      ls[i*2]=Math.min(1,p*1.6);ls[i*2+1]=size[i]*(.4+.6*p);
    }
    geometry.attributes.position.needsUpdate=geometry.attributes.color.needsUpdate=geometry.attributes.aLs.needsUpdate=true;
  }
  function clear(){life.fill(0);ls.fill(0);for(const m of [ground,front,burstCircle])m.visible=false;}
  return {ground,front,burstCircle,setSigil,emit,burst,step,clear,rnd};
}
