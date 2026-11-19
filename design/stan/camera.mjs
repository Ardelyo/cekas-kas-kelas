// Kontrol tangan: kursor tahan-untuk-memilih, dan menggambar jurus di udara.
import {vision,onVision,startVision,stopVision} from "./vision.mjs";
import {settings} from "./settings.mjs";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function connectCamera({button,video,cursor,status,canSelect}){
  let pos=null, target=null, started=0, selected=false;
  let pen=null, penPos=null, downN=0, upN=0;

  const message=text=>{status.hidden=false;status.textContent=text;};
  const mx=p=>settings.get("mirror")?1-p.x:p.x;
  const ease=(prev,next)=>{
    if(!prev)return next;
    const a=1-settings.get("smooth")*.85;
    return {x:prev.x+(next.x-prev.x)*a,y:prev.y+(next.y-prev.y)*a};
  };
  function show(p){cursor.hidden=false;cursor.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;}
  function clearTarget(){
    if(target){target.classList.remove("is-hover");target.style.removeProperty("--hold");}
    target=null;selected=false;
  }
  // Gestur pena. "point": telunjuk lurus, jari tengah & manis menekuk. "pinch": jempol menyentuh telunjuk.
  function penGesture(h){
    if(settings.get("drawGesture")==="pinch"){
      const gap=dist(h[4],h[8])/(dist(h[0],h[9])||.1), th=settings.get("pinch");
      return gap<(pen?th*1.45:th);
    }
    const w=h[0], straight=(tip,pip)=>dist(h[tip],w)>dist(h[pip],w)*1.12;
    return straight(8,6)&&!straight(12,10)&&!straight(16,14);
  }
  function activePad(){
    const c=document.querySelector(".rune-pad canvas");
    return c&&!c.closest(".rune-pad").classList.contains("cast")?c:null;
  }
  function fire(type,canvas,p){
    canvas.dispatchEvent(new PointerEvent(type,{pointerId:77,pointerType:"pen",isPrimary:true,button:0,buttons:type==="pointerup"?0:1,clientX:p.x,clientY:p.y,bubbles:true}));
  }
  function lift(){
    if(pen&&penPos&&pen.isConnected)fire("pointerup",pen,penPos);
    pen=null;downN=upN=0;cursor.classList.remove("is-drawing");
  }
  const padState=(c,s)=>{const pad=c?.closest(".rune-pad");if(pad&&pad.dataset.hand!==s)pad.dataset.hand=s;};

  onVision((v,now)=>{
    if(!v.active){lift();clearTarget();cursor.hidden=true;pos=penPos=null;return;}
    const h=v.hand, pad=activePad();
    if(pad){
      clearTarget();pos=null;
      if(!h){
        // Tangan hilang sebentar (blur, keluar bingkai) tidak langsung memutus goresan.
        if(pen&&now-v.handAt>380)lift();
        if(!pen){cursor.hidden=true;padState(pad,"none");}
        return;
      }
      const pinch=settings.get("drawGesture")==="pinch";
      const raw=pinch?{x:(h[4].x+h[8].x)/2,y:(h[4].y+h[8].y)/2}:h[8];
      let p;
      if(settings.get("drawArea")==="full"){
        const r=pad.getBoundingClientRect();
        p={x:r.left+clamp((mx(raw)-.2)/.6,0,1)*r.width,y:r.top+clamp((raw.y-.18)/.56,0,1)*r.height};
      }else p={x:clamp((mx(raw)-.14)/.72,0,1)*innerWidth,y:clamp((raw.y-.16)/.68,0,1)*innerHeight};
      penPos=ease(penPos,p);show(penPos);
      if(penGesture(h)){downN++;upN=0;}else{upN++;downN=0;}
      if(!pen&&downN>=2){pen=pad;fire("pointerdown",pen,penPos);cursor.classList.add("is-drawing");}
      else if(pen&&upN>=3)lift();
      else if(pen)fire("pointermove",pen,penPos);
      padState(pad,pen?"drawing":"ready");
      return;
    }
    if(pen)lift();
    penPos=null;
    if(!settings.get("cursor")||!h){cursor.hidden=true;pos=null;clearTarget();return;}
    // Pusat telapak lebih stabil daripada ujung jari untuk menunjuk tombol.
    const palm=h[9];
    pos=ease(pos,{x:clamp((mx(palm)-.14)/.72,0,1)*(innerWidth-2),y:clamp((palm.y-.16)/.68,0,1)*(innerHeight-2)});
    show(pos);
    const next=canSelect()?document.elementFromPoint(pos.x,pos.y)?.closest("[data-dwell]:not(:disabled)"):null;
    if(next!==target){clearTarget();target=next;if(target){started=now;target.classList.add("is-hover");}}
    if(!target||selected)return;
    const progress=clamp((now-started)/settings.get("dwell"),0,1);
    target.style.setProperty("--hold",`${progress*100}%`);
    if(progress===1){selected=true;target.click();}
  });

  function paint(){button.textContent=vision.active?"Matikan kamera":"Aktifkan kamera";button.setAttribute("aria-pressed",String(vision.active));}
  button.addEventListener("click",async()=>{
    if(vision.active){stopVision();paint();message("Kamera mati. Mouse dan sentuh tetap bisa dipakai.");return;}
    button.disabled=true;button.textContent="Menyiapkan kamera…";
    try{
      await startVision(video);
      message(`Kamera aktif. Tahan telapak di atas tombol untuk memilih. Saat menggambar jurus, ${settings.get("drawGesture")==="pinch"?"cubit jempol + telunjuk":"tunjuk dengan telunjuk"} lalu gerakkan tangan. Video diproses di perangkat.`);
    }catch(e){
      console.warn("Gagal memulai kamera.",e);stopVision();
      message(e.name==="NotAllowedError"?"Izin kamera belum diberikan. Izinkan di browser atau lanjut pakai mouse."
        :e.name==="Insecure"?"Kamera hanya bisa dipakai dari localhost atau HTTPS."
        :"Kamera belum bisa dipakai. Cek webcam dan jalankan setup-camera.py jika aset kamera belum terpasang.");
    }finally{button.disabled=false;paint();}
  });
  addEventListener("pagehide",stopVision);
}
