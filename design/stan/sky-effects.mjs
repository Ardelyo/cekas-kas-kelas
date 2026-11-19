const T = window.THREE;
const cap = n => Math.max(0, Math.min(1, n));
const ease = n => { const p = cap(n); return p*p*(3-2*p); };

// Sample the same flight path for the actor and the ribbon behind its hand.
export function flight(t, round, reach) {
  const forward = ease((t-.32)/.21);
  const retreat = ease((t-.64)/.29);
  const travel = forward*(1-retreat);
  const arc = Math.sin(Math.PI*forward)*(1-retreat);
  return {
    x: reach*travel,
    y: arc*[.35, 1.9, 1.15][round],
    z: arc*[.55, -.42, .2][round]
  };
}

export function skyEffects(scene, colors) {
  function surface(geometry, color, parent) {
    const material = new T.MeshBasicMaterial({color, side:T.DoubleSide, transparent:true, depthWrite:false});
    const object = new T.Mesh(geometry, material);
    parent.add(object);
    return object;
  }
  const ribbons = colors.map(color => {
    const count = 24;
    const geometry = new T.BufferGeometry();
    const positions = new T.BufferAttribute(new Float32Array(count*6),3);
    geometry.setAttribute('position', positions);
    const indices = [];
    for(let i=0;i<count-1;i++){
      const a=i*2;
      indices.push(a,a+1,a+2,a+1,a+3,a+2);
    }
    geometry.setIndex(indices);
    const ribbon = surface(geometry,color,scene);
    ribbon.frustumCulled=false;
    return ribbon;
  });
  // Twelve engraved marks make the last impact read like a minted coin.
  const mint = new T.Group();
  scene.add(mint);
  const tick = new T.PlaneGeometry(.055,.22);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    const mark=surface(tick,i%3===0?0xffffff:0xe9ff89,mint);
    mark.position.set(-Math.sin(a)*1.1, Math.cos(a)*1.1,0);
    mark.rotation.z=a;
  }
  const landing = colors.map(color=>surface(new T.RingGeometry(.92,1,48),color,scene));
  const chips = new T.Group();
  scene.add(chips);
  const chipGeo = new T.CylinderGeometry(.068,.068,.023,8);
  for(let i=0;i<12;i++) surface(chipGeo,i%3===0?0xfff0ad:0xd9aa41,chips);

  return function animate(kind, side, round, t, contact) {
    ribbons.forEach((r,i)=>{
      r.visible=kind==='clash'&&(side===2||i===side)&&t>.32&&t<.66;
      if(!r.visible)return;
      const sign=i===0?1:-1, points=r.geometry.attributes.position;
      for(let j=0;j<24;j++){
        const u=j/23, p=flight(t-(1-u)*.14,round,side===2?2.1:3.72);
        const x=sign*(-2.6+p.x), y=1.12+p.y, width=.12*u;
        points.setXYZ(j*2,x,y-width,p.z+.24);
        points.setXYZ(j*2+1,x,y+width,p.z+.24);
      }
      points.needsUpdate=true;
      r.material.opacity=.82*(1-ease((t-.53)/.13));
    });
    landing.forEach((ring,i)=>{
      const start=kind==='intro'?.35:.26;
      const p=cap((t-start)/(kind==='intro'?.22:.38));
      ring.visible=(kind==='intro'||(kind==='clash'&&side===3))&&p>0&&p<1;
      if(!ring.visible)return;
      ring.rotation.x=-Math.PI/2;
      ring.position.set(i===0?-2.6:2.6,.03,0);
      ring.scale.setScalar(.45+2.4*p);
      ring.material.opacity=1-p;
    });
    const p=cap((t-.54)/.39);
    mint.visible=chips.visible=kind==='clash'&&round===2&&side!==3&&p>0&&p<1;
    if(!mint.visible)return;
    mint.position.set(contact,1.45,.65);
    mint.rotation.z=.65*(1-ease(p));
    mint.scale.setScalar(.45+1.7*ease(p));
    mint.children.forEach(m=>m.material.opacity=1-p);
    chips.position.copy(mint.position);
    chips.children.forEach((coin,i)=>{
      const a=i*2.39996, r=(1.4+(i%4)*.37)*p;
      coin.position.set(Math.cos(a)*r, Math.sin(a)*r+1.8*p-2.4*p*p, Math.sin(i*4)*p);
      coin.rotation.set(i+p*7,i*.7+p*4,0);
      coin.material.opacity=1-ease((p-.55)/.45);
    });
  };
}
