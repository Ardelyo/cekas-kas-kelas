// Pengaturan lanjutan Arena: disimpan per perangkat, berlaku langsung.
const KEY="cekas-duel-settings";
export const DEFAULTS={deviceId:"",mirror:true,preview:true,skeleton:true,cursor:true,dwell:650,smooth:.55,
  drawGesture:"point",drawArea:"full",pinch:.32,ar:false,body:false,quality:"auto",volume:.55};
let state={...DEFAULTS};
try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch{}
const subs=new Set();
export const settings={
  get:k=>state[k],
  set(k,v){if(state[k]===v)return;state[k]=v;try{localStorage.setItem(KEY,JSON.stringify(state))}catch{};subs.forEach(f=>f(k,v));},
  on(f){subs.add(f);return()=>subs.delete(f);}
};
export const QUALITY={low:{ratio:1,particles:.45},medium:{ratio:1.25,particles:.75},high:{ratio:2,particles:1},auto:{ratio:1.6,particles:.85}};
export const quality=()=>QUALITY[state.quality]||QUALITY.auto;

const row=(label,control,help="")=>`<label class="set-row"><span><b>${label}</b>${help?`<small>${help}</small>`:""}</span>${control}</label>`;
const toggle=k=>`<input type="checkbox" data-k="${k}" role="switch">`;
const range=(k,min,max,step)=>`<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}"><output data-o="${k}"></output>`;
const select=(k,opts)=>`<select data-k="${k}">${opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>`;

let dialog=null;
export function openSettings(){
  if(!dialog){
    dialog=document.createElement("dialog");dialog.className="settings";dialog.setAttribute("aria-label","Pengaturan lanjutan");
    dialog.innerHTML=`<form method="dialog">
      <header><p class="eyebrow">PENGATURAN LANJUTAN</p><h2>Arena & kamera</h2><button class="set-close" value="close" aria-label="Tutup">✕</button></header>
      <section><h3>Kamera</h3>
        ${row("Perangkat kamera",`<select data-k="deviceId" id="set-device"><option value="">Kamera depan (bawaan)</option></select>`,"Daftar lengkap muncul setelah kamera diizinkan.")}
        ${row("Cermin",toggle("mirror"),"Gerakan kanan tampil di kanan, seperti cermin.")}
        ${row("Pratinjau kecil",toggle("preview"),"Video kecil di pojok arena saat AR mati.")}
        ${row("Tampilkan kerangka",toggle("skeleton"),"Garis tangan dan tubuh yang terbaca kamera.")}
      </section>
      <section><h3>Kontrol tangan</h3>
        ${row("Kursor tangan",toggle("cursor"),"Arahkan telapak, tahan untuk memilih tombol.")}
        ${row("Lama tahan",range("dwell",350,1500,50),"Milidetik sebelum tombol terpilih.")}
        ${row("Kehalusan gerak",range("smooth",0,.9,.05),"Lebih tinggi = lebih stabil, sedikit lebih lambat.")}
      </section>
      <section><h3>Menggambar di udara</h3>
        ${row("Gestur pena",select("drawGesture",[["point","Tunjuk dengan telunjuk"],["pinch","Cubit jempol + telunjuk"]]),"Pena turun selama gestur ditahan.")}
        ${row("Area gambar",select("drawArea",[["full","Seluruh bidang kamera"],["cursor","Ikuti kursor di layar"]]),"Seluruh bidang kamera paling mudah.")}
        ${row("Kepekaan cubit",range("pinch",.18,.5,.01),"Lebih tinggi = cubitan lebih mudah terdeteksi.")}
      </section>
      <section><h3>Tubuh & AR</h3>
        ${row("Kontrol seluruh tubuh",toggle("body"),"Karaktermu meniru gerak tangan, kaki, badan, dan kepalamu.")}
        ${row("Mode AR",toggle("ar"),"Arena tampil di atas video webcam-mu.")}
      </section>
      <section><h3>Grafis & suara</h3>
        ${row("Kualitas",select("quality",[["auto","Otomatis"],["low","Hemat (HP lama)"],["medium","Sedang"],["high","Tinggi"]]))}
        ${row("Volume",range("volume",0,1,.05))}
      </section>
      <footer><button type="button" class="button quiet" data-reset>Kembalikan bawaan</button><button class="button primary" value="close">Selesai</button></footer>
    </form>`;
    document.body.append(dialog);
    const paint=()=>dialog.querySelectorAll("[data-k]").forEach(el=>{
      const v=state[el.dataset.k];
      if(el.type==="checkbox")el.checked=!!v;else el.value=String(v);
      const o=dialog.querySelector(`[data-o="${el.dataset.k}"]`);
      if(o)o.textContent=el.dataset.k==="dwell"?v+" ms":el.dataset.k==="volume"?Math.round(v*100)+"%":Number(v).toFixed(2);
    });
    dialog.addEventListener("input",e=>{
      const el=e.target.closest("[data-k]");if(!el)return;
      const v=el.type==="checkbox"?el.checked:el.type==="range"?Number(el.value):el.value;
      settings.set(el.dataset.k,v);paint();
    });
    dialog.querySelector("[data-reset]").onclick=()=>{Object.entries(DEFAULTS).forEach(([k,v])=>settings.set(k,v));paint();};
    dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
    dialog.paint=paint;
  }
  navigator.mediaDevices?.enumerateDevices?.().then(list=>{
    const sel=dialog.querySelector("#set-device");
    const cams=list.filter(d=>d.kind==="videoinput"&&d.deviceId);
    sel.innerHTML=`<option value="">Kamera depan (bawaan)</option>`+cams.map((d,i)=>`<option value="${d.deviceId}">${(d.label||"Kamera "+(i+1)).replace(/[<>&"]/g,"")}</option>`).join("");
    sel.value=state.deviceId;
  }).catch(()=>{});
  dialog.paint();dialog.showModal();
}
