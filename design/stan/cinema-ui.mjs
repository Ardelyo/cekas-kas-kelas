// Lapisan sinematik 2D di atas kanvas 3D: splash VS, cut-in jurus, banner kemenangan.
let nodes=[];
function add(html,cls,ms){
  const room=document.querySelector(".room");if(!room)return null;
  const el=document.createElement("div");
  el.className="cine-ui "+cls;el.setAttribute("aria-hidden","true");el.innerHTML=html;
  room.append(el);nodes.push(el);
  setTimeout(()=>{el.remove();nodes=nodes.filter(n=>n!==el);},ms);
  return el;
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);

export function versus(a,b){
  add(`<div class="vs-half p1"><img src="${a.photo}" alt=""><b>${esc(a.name)}</b></div>
    <div class="vs-half p2"><b>${esc(b.name)}</b><img src="${b.photo}" alt=""></div>
    <i class="vs-slash"></i><strong class="vs-mark">VS</strong>`,"vs",2700);
}
export function cutIn(list){
  add(list.map((c,i)=>`<div class="cut ${c.side?"right":"left"}" style="--c:${c.color};--i:${i};--n:${list.length}">
    <div class="cut-lines"></div><img src="${c.photo}" alt="">
    <div class="cut-text"><small>${esc(c.name)}</small><b>${esc(c.spell)}</b></div></div>`).join(""),"cutin",1050);
}
export function victory(name,photo,draw){
  add(`<div class="win-rays"></div>${draw?"":`<img src="${photo}" alt="">`}
    <strong>${draw?"SERI!":"MENANG!"}</strong><small>${draw?"Keduanya seimbang":esc(name)}</small>`,"win",3300);
}
export function clearCine(){nodes.forEach(n=>n.remove());nodes=[];}
