// Memetakan pose tubuh (MediaPipe, 33 titik) ke sendi karakter blok CEKAS.
const lerp=(a,b,k)=>a+(b-a)*k;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function applyPose(char,v,{mirror=true,k=.35,legs=true}={}){
  const p=v.pose;if(!p)return false;
  const u=char.userData, s=u.rig??={};
  const seen=i=>(p[i]?.visibility??1)>.55;
  const set=(key,val)=>(s[key]=s[key]===undefined?val:lerp(s[key],val,k));
  const sx=dx=>mirror?-dx:dx;
  // Sudut di layar: 0 = menunjuk ke bawah, positif = ke kanan layar.
  const down=(a,b)=>Math.atan2(sx(b.x-a.x),b.y-a.y);
  // Sisi kanan layar = lengan +x karakter (karakter menghadap kamera).
  const right=mirror?{sh:12,el:14,wr:16,hip:24,kn:26,an:28}:{sh:11,el:13,wr:15,hip:23,kn:25,an:27};
  const left=mirror?{sh:11,el:13,wr:15,hip:23,kn:25,an:27}:{sh:12,el:14,wr:16,hip:24,kn:26,an:28};
  const w=v.poseWorld;
  for(const [side,arm,leg] of [[right,u.aR,u.lR],[left,u.aL,u.lL]]){
    const tag=arm===u.aR?"R":"L";
    if(seen(side.sh)&&seen(side.wr)){
      arm.rotation.z=set("a"+tag+"z",down(p[side.sh],p[side.wr]));
      const reach=w?clamp((w[side.sh].z-w[side.wr].z)/.45,-1,1):0;
      arm.rotation.x=set("a"+tag+"x",-reach*1.35);
    }
    if(legs&&seen(side.hip)&&seen(side.kn)&&seen(side.an)){
      leg.rotation.z=set("l"+tag+"z",clamp(down(p[side.hip],p[side.an]),-.9,.9));
      const torso=Math.hypot(p[11].x-p[23].x,p[11].y-p[23].y)||.3;
      const thigh=Math.hypot(p[side.kn].x-p[side.hip].x,p[side.kn].y-p[side.hip].y);
      leg.rotation.x=set("l"+tag+"x",-clamp(1-thigh/(torso*.82),0,1)*1.6);
    }
  }
  const mid=(a,b)=>({x:(p[a].x+p[b].x)/2,y:(p[a].y+p[b].y)/2});
  if(seen(11)&&seen(12)){
    let lean;
    if(seen(23)&&seen(24)){const sh=mid(11,12),hp=mid(23,24);lean=Math.atan2(sx(sh.x-hp.x),hp.y-sh.y);}
    else{const a=p[mirror?11:12],b=p[mirror?12:11];lean=-Math.atan2(b.y-a.y,Math.abs(b.x-a.x))*.8;}
    u.body.rotation.z=set("bz",-clamp(lean,-.7,.7));
  }
  if(seen(7)&&seen(8)&&seen(0)){
    const a=p[mirror?7:8],b=p[mirror?8:7];
    u.head.rotation.z=set("hz",clamp(-Math.atan2(b.y-a.y,Math.abs(b.x-a.x)+1e-3),-.6,.6));
    const span=Math.abs(p[7].x-p[8].x)||.05, turn=(p[0].x-(p[7].x+p[8].x)/2)/span;
    u.head.rotation.y=set("hy",clamp(sx(turn)*1.6,-.9,.9));
  }
  return true;
}
