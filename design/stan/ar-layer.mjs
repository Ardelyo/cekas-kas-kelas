// Lapisan AR: webcam sebagai latar arena (atau pratinjau kecil), plus kerangka tangan/tubuh.
import {vision,onVision} from "./vision.mjs";
import {settings} from "./settings.mjs";

const POSE=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[15,19],[16,20]];
const HAND=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export function arLayer({video,room,onAR}){
  const sk=document.createElement("canvas");sk.className="skeleton";sk.setAttribute("aria-hidden","true");sk.hidden=true;
  const hud=document.createElement("div");hud.className="cam-hud";hud.hidden=true;hud.setAttribute("aria-hidden","true");
  room.append(sk,hud);
  const g=sk.getContext("2d");
  let mode="", wasActive=false, lastAR=false;
  function place(){
    const on=vision.active, ar=on&&settings.get("ar"), pip=on&&!ar&&settings.get("preview");
    const next=ar?"ar":pip?"pip":"";
    video.classList.toggle("ar-bg",ar);video.classList.toggle("pip",pip);video.classList.toggle("mirror",settings.get("mirror"));
    if(next&&video.parentElement!==room)room.prepend(video);
    if(!next&&video.parentElement===room)document.body.append(video);
    sk.className="skeleton "+next;sk.hidden=!(next&&settings.get("skeleton"));
    hud.hidden=!on;
    document.body.classList.toggle("ar-on",ar);
    mode=next;
    if(ar!==lastAR){lastAR=ar;onAR(ar);}
  }
  settings.on(k=>{if(["ar","preview","skeleton","mirror"].includes(k))place();});

  function draw(v){
    if(sk.hidden)return;
    const box=sk.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio);
    if(!box.width)return;
    if(sk.width!==Math.round(box.width*dpr)){sk.width=Math.round(box.width*dpr);sk.height=Math.round(box.height*dpr);}
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,box.width,box.height);
    const vw=video.videoWidth||16, vh=video.videoHeight||9, s=Math.max(box.width/vw,box.height/vh);
    const ox=(box.width-vw*s)/2, oy=(box.height-vh*s)/2, mirror=settings.get("mirror");
    const at=p=>[ox+(mirror?1-p.x:p.x)*vw*s, oy+p.y*vh*s];
    const lines=(pts,pairs,color,width)=>{
      g.strokeStyle=color;g.lineWidth=width;g.lineCap="round";g.shadowColor=color;g.shadowBlur=8;g.beginPath();
      for(const [a,b] of pairs){if((pts[a].visibility??1)<.5||(pts[b].visibility??1)<.5)continue;g.moveTo(...at(pts[a]));g.lineTo(...at(pts[b]));}
      g.stroke();g.shadowBlur=0;g.fillStyle="#fff";
      for(const [i] of pairs){if((pts[i].visibility??1)<.5)continue;const [x,y]=at(pts[i]);g.beginPath();g.arc(x,y,width*.8,0,7);g.fill();}
    };
    if(v.pose)lines(v.pose,POSE,"#d6ff3fcc",mode==="pip"?2:4);
    if(v.hand){
      lines(v.hand,HAND,"#65dfffdd",mode==="pip"?1.5:3);
      const [x,y]=at(v.hand[8]);g.fillStyle="#d6ff3f";g.beginPath();g.arc(x,y,mode==="pip"?3:7,0,7);g.fill();
    }
  }
  let hudAt=0;
  onVision((v,now)=>{
    if(!!v.active!==wasActive){wasActive=!!v.active;place();}
    draw(v);
    if(now-hudAt>500){hudAt=now;hud.textContent=`${v.fps} fps · tangan ${v.hand?"✓":"–"}${settings.get("body")?` · tubuh ${v.pose?"✓":"–"}`:""}`;}
  });
  place();
}
