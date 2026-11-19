import {secondDeck,playerCard} from "./local-duel.mjs";
import {drawSpell} from "./draw-spell.mjs";
import {classroom} from "./room.mjs";
import {connectCamera} from "./camera.mjs";
import {auditCase} from "./rounds.mjs";
import {sfx} from "./duel-sfx.mjs";
import {loadCustom,openMaker,removeCustom} from "./character-maker.mjs";
import {versus,cutIn,victory,clearCine} from "./cinema-ui.mjs";

const $=id=>document.getElementById(id), panel=$("panel");
const baseNames=["Cinta","Rafa","Jahfal","Nabila","Revalina","Tarina","Ardellio"];
let custom=loadCustom(), names=[...baseNames,...custom.map(c=>c.name)];
const customBy=n=>custom.find(c=>c.name===n);
const key=n=>customBy(n)?.id??n.toLowerCase();
const money=n=>"Rp"+n.toLocaleString("id-ID");
const photo=n=>customBy(n)?.face??`../assets/team/face-${n.toLowerCase()}.webp`;
const greetings=["“Berapa uang yang sudah masuk?”","“Coba cocokkan bukti dengan buku kas.”","“Bel sudah bunyi. Siap tanding?”"];
let player="Cinta", rival="Rafa", phase="hub", venue=-1, room;
let questions=[], index=0, scores, times, began, opponentTime, opponentChoice, answerTime, picked, timer, run=0;
let local=false, guestQuestions=[], locks=[];
const roundLimit=15;
const pickButton=(text,act)=>`<button class="button primary" data-dwell data-act="${act}">${text}</button>`;
function header(){
 $("versus").innerHTML=`<img src="${photo(player)}" alt="">${player} <small>vs</small> <img src="${photo(rival)}" alt="">${rival} · ${local?"P2":"CPU"}`;
}
function film(kind,side,done){
 if(!room || questions.length===1 || matchMedia("(prefers-reduced-motion: reduce)").matches){done();return;}
 phase="film";
 const drawn=document.body.dataset.spell;
 document.body.classList.add("cinema");
 document.body.dataset.shot=kind;
 const fighter=side===0?player:rival;
 $("take").textContent=kind==="intro"?"ARENA LANGIT / XI-F2":kind==="outro"?"HASIL DUEL":"BABAK "+(index+1);
 $("beat").textContent=kind==="intro"?player+" vs "+rival:kind==="outro"?(side===2?"Seri":fighter+" menang"):side===3?"Keduanya bertahan":side===2?"Benturan ganda":fighter+" / "+(document.body.dataset.spell||["Luncur kilat","Tebasan bukti","Segel langit"][index]);
 delete document.body.dataset.spell;
 $("skip-film").focus({preventScroll:true});
 clearCine();
 const meta=i=>({name:i?rival:player,photo:photo(i?rival:player)});
 if(kind==="intro"){versus(meta(0),meta(1));sfx.sting();}
 else if(kind==="outro"){victory(fighter,photo(fighter),side===2);sfx.fanfare(side!==2);}
 else if(side<3){
   const owner=side===2?0:side;
   const list=(side===2?[0,1]:[side]).map(i=>({...meta(i),side:i,color:i?"#65dfff":"#d6ff3f",spell:i===owner&&drawn?drawn:["Luncur Kilat","Tebasan Bukti","Segel Langit"][index]}));
   setTimeout(()=>{if(phase==="film")cutIn(list)},120);
 }
 room.cut(kind,side,index,()=>{
   clearCine();
   document.body.classList.remove("cinema");delete document.body.dataset.shot;
   done();panel.focus({preventScroll:true});
 });
}
$("skip-film").onclick=()=>room?.skip();
panel.tabIndex=-1;
function hub(){
 local=false;document.body.classList.remove("split-round");
 room?.leaveSky();document.body.classList.remove("sky-duel","cinema");
 run++;clearInterval(timer);phase="hub";room?.enable(true);document.body.classList.remove("playing");
 document.querySelectorAll("[data-place]").forEach(b=>b.disabled=false);
 header();
 panel.innerHTML=`<p class="eyebrow">PERSIAPAN PENTAS</p><h2>Pilih tokohmu</h2>
 <div class="players">${names.map(n=>`<button class="pick" data-dwell data-player="${n}" aria-pressed="${n===player}"><img class="avatar" alt="" src="${photo(n)}">${n}</button>`).join("")}<button class="pick add" data-dwell data-maker><span class="avatar">+</span>Tokoh baru</button></div>${customBy(player)?`<button class="linkish" data-remove>Hapus tokoh ${player}</button>`:""}
 <p class="evidence-line">${venue<0?"Bu Wali · “Besok kelas mau pentas. Kas kita cukup?”":greetings[venue]}</p>
 <p>${venue===0?"Latihan menghitung iuran di papan tulis.":venue===1?"Latihan memeriksa transaksi di meja kas.":"Tiga babak melawan "+rival+". Jawaban benar mendapat satu poin. Jika seri, waktu jawaban benar menentukan pemenang."}</p><div class="actions">${venue===0||venue===1?pickButton("Coba latihan","train"):""}${pickButton("Mulai duel","duel")}</div>
 <div class="local-entry"><label>Pemain 2 <select id="guest">${names.filter(n=>n!==player).map(n=>`<option ${n===rival?"selected":""}>${n}</option>`).join("")}</select></label>${pickButton("Duel dua pemain","local")}<small>Satu layar · P1 tekan 1/2/3, P2 tekan J/K/L, atau sentuh jawaban.</small></div>`;
}
try{room=classroom($("world"),i=>{if(phase==="hub"){venue=i;hub()}})}catch(e){console.warn(e);$("guide").textContent="Pilih lokasi dengan tombol di bawah gambar kelas."}
function characters(){room?.characters(key(player),key(rival));}
characters();hub();
document.querySelectorAll("[data-place]").forEach(b=>{b.setAttribute("data-dwell","");b.onclick=()=>{const i=Number(b.dataset.place);if(room)room.visit(i);else{venue=i;hub()}}});
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr;}
async function start(training){
 if(phase!=="hub")return;
 const ticket=++run;phase="loading";room?.enable(false);document.body.classList.add("playing");
 document.querySelectorAll("[data-place]").forEach(b=>b.disabled=true);
 panel.innerHTML="<p>Menyiapkan buku kas…</p>";
 const paid=21+Math.floor(Math.random()*8), due=5000, total=paid*due;
 try{
 const audit=await auditCase(Math.floor(Math.random()*3));
 if(run!==ticket)return;
 const altered=audit.rows[audit.firstInvalid];
 const all=[
 {name:"Hitung iuran",speaker:"Rafa",clue:`Ada 36 siswa. ${paid} siswa sudah menyetor ${money(due)} per orang.`,ask:"Berapa uang yang sudah masuk?",options:[total,(36-paid)*due,36*due].map(money),correct:0,why:`${paid} × ${money(due)} = ${money(total)}. Sisanya masih tagihan.`},
 {name:"Cari bukti",speaker:"Revalina",clue:audit.clue,ask:"Baris mana yang berubah?",options:audit.rows.map((r,i)=>`#${i+1} · ${r.shown[0]} · ${r.shown[1]<0?"−":"+"}${money(r.shown[1])}`),correct:audit.firstInvalid,why:`Hash pertama yang berbeda ada di baris ${audit.firstInvalid+1}. Catatan asli: ${altered.original[0]}, ${money(altered.original[1])} (${altered.original[1]<0?"keluar":"masuk"}).`},
 {name:"Putuskan belanja",speaker:"Tarina",clue:`Dekorasi pentas Rp60.000. Saldo tersedia ${money(total)}. Belanja mulai Rp50.000 perlu persetujuan kelas.`,ask:"Apa langkah pertama?",options:["Ajukan usulan ke siswa","Langsung kurangi saldo","Catat sebagai pemasukan"],correct:0,why:`Siswa memberi suara, lalu Bu Wali mengesahkan. Setelah disahkan, saldo simulasi menjadi ${money(total-60000)}.`}
 ];
 questions=training?[all[venue]]:all;
 guestQuestions=local?secondDeck(money):[];
 [...questions,...guestQuestions].forEach(q=>{q.answers=shuffle(q.options.map((label,i)=>({label,right:i===q.correct})))});
 index=0;scores=[0,0];times=[0,0];
 if(!training && room){room.enterSky(key(player),key(rival));document.body.classList.add("sky-duel");}
 film("intro",2,question);
 }catch(e){console.error(e);phase="error";panel.innerHTML='<p>Buka arena lewat localhost agar buku kas bisa diperiksa.</p>'+pickButton("Kembali","hub");}
}
function question(){
 if(local){
   phase="split";locks=[null,null];
   document.body.classList.add("split-round");
   panel.innerHTML=`<p class="clock" id="clock"></p><div class="split-cards">${playerCard(player,0,questions[index])}${playerCard(rival,1,guestQuestions[index])}</div>`;
   began=performance.now();timer=setInterval(tickLocal,100);tickLocal();return;
 }
 const q=questions[index];phase="question";picked=-1;answerTime=null;
 opponentTime=4+Math.random()*5;
 const right=q.answers.findIndex(a=>a.right);
 opponentChoice=Math.random()<.69?right:(right+1+Math.floor(Math.random()*2))%3;
 began=performance.now();
 panel.innerHTML=`<p class="eyebrow">${questions.length===1?"LATIHAN":"BABAK "+(index+1)+" / 3"} · ${q.name}</p><h2>${q.ask}</h2><p class="evidence-line"><strong>${q.speaker}</strong><br>${q.clue}</p><div class="options">${q.answers.map((a,i)=>`<button data-dwell data-answer="${i}"><small>${i+1} · </small>${a.label}</button>`).join("")}</div><p class="clock" id="clock"></p><small id="opponent"></small>`;
 updateClock();timer=setInterval(updateClock,100);
}
function tickLocal(){
 const remaining=roundLimit-(performance.now()-began)/1000;
 $("clock").textContent=`Babak ${index+1}/3 · ${Math.max(0,Math.ceil(remaining))} detik`;
 if(remaining>0&&!locks.every(Boolean))return;
 clearInterval(timer);phase="resolving";
 document.body.classList.remove("split-round");
 const deck=[questions[index],guestQuestions[index]], fighters=[player,rival];
 const hits=deck.map((q,i)=>Boolean(q.answers[locks[i]?.choice]?.right));
 const attackers=[];
 hits.forEach((hit,i)=>{if(hit){scores[i]++;times[i]+=locks[i].elapsed;attackers.push(i)}});
 function result(){
   phase="review";
   panel.innerHTML=`<h2>Hasil babak ${index+1}</h2>${deck.map((q,i)=>`<p class="evidence-line"><strong>${fighters[i]} · ${!locks[i]?"Waktu habis":hits[i]?"Benar":"Belum tepat"}</strong><br>${q.why}</p>`).join("")}<p class="clock">${player} ${scores[0]} – ${scores[1]} ${rival}</p>${pickButton(index===2?"Lihat hasil":"Babak berikutnya","next")}`;
 }
 function castNext(){
   const side=attackers.shift();
   if(side===undefined){result();return}
   phase="drawing";drawSpell(panel,index,path=>{room.prepareSpell(path,side);film("clash",side,castNext)},fighters[side]);
 }
 if(!room||matchMedia("(prefers-reduced-motion: reduce)").matches)result();
 else if(attackers.length)castNext();
 else film("clash",3,result);
}
function localAnswer(side,choice){
 if(phase!=="split"||locks[side])return;
 const elapsed=(performance.now()-began)/1000;
 if(elapsed<roundLimit){
   locks[side]={choice,elapsed};
   const card=panel.querySelector(`[data-side="${side}"]`);
   card.querySelectorAll("button").forEach((b,i)=>{b.disabled=true;if(i===choice)b.classList.add("chosen")});
   card.querySelector(".lock").textContent="Jawaban terkunci";
 }
 tickLocal();
}
function updateClock(){
 const elapsed=(performance.now()-began)/1000;
 $("clock").textContent="Sisa "+Math.max(0,Math.ceil(roundLimit-elapsed))+" detik";
 $("opponent").textContent=rival+(elapsed>=opponentTime?" sudah mengunci jawaban.":" sedang berpikir…");
 if(elapsed>=roundLimit&&answerTime===null)answerTime=roundLimit;
 if(answerTime!==null&&elapsed>=opponentTime)review();
}
function answer(i){
 if(phase!=="question"||answerTime!==null)return;
 const elapsed=(performance.now()-began)/1000;
 if(elapsed<roundLimit){picked=i;answerTime=elapsed;}
 panel.querySelectorAll("[data-answer]").forEach(b=>{b.disabled=true;if(Number(b.dataset.answer)===picked)b.style.borderColor="var(--lime)"});
 updateClock();
}
function review(){
 clearInterval(timer);phase="review";
 const q=questions[index],a=q.answers,correct=a.find(v=>v.right);
 const playerHit=Boolean(a[picked]?.right), rivalHit=a[opponentChoice].right;
 const side=playerHit?(rivalHit?2:0):(rivalHit?1:3);
 room?.celebrate(playerHit,rivalHit);
 [picked,opponentChoice].forEach((v,i)=>{if(a[v]?.right){scores[i]++;times[i]+=i?opponentTime:answerTime;}});
 function clash(){ film("clash",side,()=>{phase="review";
 panel.innerHTML=`<p class="eyebrow">${q.name}</p><h2>${picked<0?"Waktu habis":a[picked].right?"Jawabanmu tepat":"Cek jawabannya"}</h2><p class="evidence-line"><strong>${correct.label}</strong><br>${q.why}</p><p>${rival} memilih <strong>${a[opponentChoice].label}</strong>.</p><p class="clock">${player} ${scores[0]} – ${scores[1]} ${rival}</p>${pickButton(index+1===questions.length?"Lihat hasil":"Babak berikutnya","next")}`;
 });}
 if(playerHit && room && questions.length>1 && !matchMedia("(prefers-reduced-motion: reduce)").matches){
   phase="drawing";
   drawSpell(panel,index,path=>{room.prepareSpell(path);clash()});
 }else clash();
}
function finish(){
 phase="end";const diff=scores[0]-scores[1] || Math.round((times[1]-times[0])*10);
 film("outro",diff===0?2:diff>0?0:1,()=>{phase="end";
 panel.innerHTML=`<p class="eyebrow">PAPAN SKOR XI-F2</p><h2>${diff===0?"Hasil seri":(diff>0?player:rival)+" menang!"}</h2><div class="bigscore">${scores[0]} – ${scores[1]}</div><p>${player} melawan ${rival}. Total waktu jawaban benar masing-masing ${times[0].toFixed(1)} dan ${times[1].toFixed(1)} detik.</p>${pickButton("Kembali ke kelas","hub")}`;
 });
}
panel.onclick=e=>{
 const b=e.target.closest("button");if(!b)return;
 if(b.hasAttribute("data-maker")&&phase==="hub"){openMaker(panel,names,c=>{custom.push(c);names.push(c.name);player=c.name;rival="Rafa";characters();venue=-1;hub();},hub);}
 else if(b.hasAttribute("data-remove")&&phase==="hub"){const c=customBy(player);if(c&&confirm(`Hapus tokoh ${c.name}?`)){removeCustom(c.id);custom=custom.filter(x=>x!==c);names=names.filter(n=>n!==c.name);player="Cinta";rival="Rafa";characters();hub();}}
 else if(b.dataset.player){player=b.dataset.player;rival=player==="Rafa"?"Cinta":"Rafa";characters();venue=-1;hub();}
 else if(b.hasAttribute("data-seat"))localAnswer(Number(b.dataset.seat),Number(b.dataset.choice));
 else if(b.dataset.act==="local"&&phase==="hub"){local=true;rival=$("guest").value;characters();header();start(false)}
 else if(b.hasAttribute("data-answer"))answer(Number(b.dataset.answer));
 else if(b.dataset.act==="hub"){venue=-1;hub()}
 else if(b.dataset.act==="next"&&phase==="review"){if(++index<questions.length)question();else finish();}
 else if(b.dataset.act==="train"||b.dataset.act==="duel")start(b.dataset.act==="train");
};
addEventListener("keydown",e=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
 const key=e.key.toLowerCase();
 if(phase==="split"){const n="123jkl".indexOf(key);if(key.length===1&&n>=0){e.preventDefault();localAnswer(Math.floor(n/3),n%3)}}
 else if(/^[1-3]$/.test(key))answer(Number(key)-1)});
sfx.bindToggle($("sound"));
connectCamera({button:$("camera"),video:$("camera-feed"),cursor:$("hand-cursor"),status:$("camera-status"),canSelect:()=>true});
