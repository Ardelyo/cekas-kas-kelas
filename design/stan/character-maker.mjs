// Pembuat tokoh: foto pemain jadi wajah karakter 3D. Disimpan hanya di perangkat (localStorage).
import {registerChar} from "./actors.mjs";
const KEY="cekas-duel-chars", LIMIT=6;
const OUTFITS=[["Putih",0xf2f5fb,0x72839f],["Lime",0xb9e23a,0x2c3a55],["Langit",0x4d9bf0,0x23345a],["Malam",0x1f3468,0x2b3a5c],["Pasir",0xcdbb55,0x34405e]];
const hex=n=>"#"+n.toString(16).padStart(6,"0");
export const cleanName=s=>String(s).normalize("NFC").replace(/[^\p{L}\p{N} .'-]/gu,"").replace(/\s+/g," ").trim().slice(0,14);

function read(){try{const l=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(l)?l:[]}catch{return []}}
function write(list){try{localStorage.setItem(KEY,JSON.stringify(list));return true}catch{return false}}
const valid=c=>c&&typeof c.id==="string"&&/^u-[a-z0-9]+$/.test(c.id)&&typeof c.face==="string"&&c.face.startsWith("data:image/")&&cleanName(c.name||"");

export function loadCustom(){
  const list=read().filter(valid).slice(0,LIMIT);
  list.forEach(c=>{c.name=cleanName(c.name);registerChar(c.id,c)});
  return list;
}
export function removeCustom(id){write(read().filter(c=>c.id!==id));}

function average(ctx,x,y,w,h){
  const d=ctx.getImageData(x,y,w,h).data;let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
  return (Math.round(r/n)<<16)|(Math.round(g/n)<<8)|Math.round(b/n);
}

export function openMaker(panel,taken,done,cancel){
  const full=read().filter(valid).length>=LIMIT;
  panel.innerHTML=`<p class="eyebrow">TOKOH BARU</p><h2>Jadikan fotomu tokoh</h2>
  <div class="maker">
    <div class="maker-face"><canvas width="256" height="256" aria-label="Pratinjau wajah tokoh"></canvas><span class="maker-empty">Belum ada foto</span>
      <label class="button quiet maker-upload">Pilih foto<input type="file" accept="image/*" hidden></label></div>
    <div class="maker-fields">
      <label>Nama tokoh<input id="maker-name" maxlength="14" autocomplete="off" placeholder="mis. Dimas"></label>
      <label>Perbesar wajah<input type="range" id="maker-zoom" min="1" max="3" step="0.01" value="1.3"></label>
      <fieldset><legend>Rambut</legend>${[["short","Pendek"],["long","Panjang"],["hijab","Hijab"]].map(([v,l],i)=>`<label class="chip"><input type="radio" name="maker-style" value="${v}" ${i?"":"checked"}>${l}</label>`).join("")}</fieldset>
      <fieldset><legend>Seragam</legend>${OUTFITS.map(([l,c],i)=>`<label class="swatch" style="--s:${hex(c)}" title="${l}"><input type="radio" name="maker-top" value="${i}" ${i?"":"checked"}><span></span></label>`).join("")}</fieldset>
    </div>
  </div>
  <p class="maker-note">Seret foto untuk mengatur posisi wajah. Foto hanya disimpan di perangkat ini.</p>
  <p class="maker-error" role="alert">${full?"Maksimal 6 tokoh. Hapus salah satu tokoh dulu.":""}</p>
  <div class="actions"><button class="button primary" data-make ${full?"disabled":""}>Simpan tokoh</button><button class="button quiet" data-cancel>Batal</button></div>`;
  const $=s=>panel.querySelector(s);
  const canvas=$("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true}),zoom=$("#maker-zoom"),error=$(".maker-error");
  let img=null, ox=0, oy=0, drag=null;
  function paint(){
    ctx.fillStyle="#0b244e";ctx.fillRect(0,0,256,256);
    if(!img)return;
    const base=256/Math.min(img.width,img.height), s=base*Number(zoom.value);
    const w=img.width*s,h=img.height*s;
    ox=Math.min(0,Math.max(256-w,ox));oy=Math.min(0,Math.max(256-h,oy));
    ctx.drawImage(img,ox,oy,w,h);
  }
  function center(){
    const s=256/Math.min(img.width,img.height)*Number(zoom.value);
    ox=(256-img.width*s)/2;oy=(256-img.height*s)/2.6;paint();
  }
  $("input[type=file]").onchange=e=>{
    const file=e.target.files[0];error.textContent="";
    if(!file)return;
    if(!file.type.startsWith("image/")){error.textContent="Pilih file gambar (JPG, PNG, atau WEBP).";return;}
    if(file.size>15e6){error.textContent="Foto terlalu besar. Maksimal 15 MB.";return;}
    const url=URL.createObjectURL(file),next=new Image();
    next.onload=()=>{img=next;URL.revokeObjectURL(url);$(".maker-empty").hidden=true;center();};
    next.onerror=()=>{URL.revokeObjectURL(url);error.textContent="Foto tidak bisa dibaca. Coba foto lain.";};
    next.src=url;
  };
  let last=Number(zoom.value);
  zoom.oninput=()=>{const z=Number(zoom.value);if(img){const k=z/last;ox=128-(128-ox)*k;oy=128-(128-oy)*k;paint();}last=z;};
  canvas.onpointerdown=e=>{if(!img)return;drag={x:e.clientX,y:e.clientY,ox,oy};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;const k=256/canvas.getBoundingClientRect().width;ox=drag.ox+(e.clientX-drag.x)*k;oy=drag.oy+(e.clientY-drag.y)*k;paint();};
  canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
  paint();
  $("[data-cancel]").onclick=cancel;
  $("[data-make]").onclick=()=>{
    const name=cleanName($("#maker-name").value);
    if(!img){error.textContent="Pilih foto dulu.";return;}
    if(!name){error.textContent="Beri nama tokohmu.";return;}
    if(taken.some(n=>n.toLowerCase()===name.toLowerCase())){error.textContent="Nama itu sudah dipakai. Pilih nama lain.";return;}
    const outfit=OUTFITS[Number(panel.querySelector("[name=maker-top]:checked").value)];
    const c={id:"u-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,
      face:canvas.toDataURL("image/webp",.82),
      skin:average(ctx,80,150,96,40),hair:average(ctx,40,0,176,22),
      style:panel.querySelector("[name=maker-style]:checked").value,top:outfit[1],bot:outfit[2]};
    if(!c.face.startsWith("data:image/webp"))c.face=canvas.toDataURL("image/jpeg",.85);
    const list=read().filter(valid);list.push(c);
    if(!write(list)){error.textContent="Penyimpanan perangkat penuh. Hapus tokoh lain dulu.";return;}
    registerChar(c.id,c);done(c);
  };
}
