export function secondDeck(money) {
  const missing=3+Math.floor(Math.random()*6), weeks=2;
  return [
    {name:"Sisa iuran",clue:`${missing} siswa belum membayar selama dua minggu. Iuran per minggu Rp5.000.`,ask:"Berapa iuran yang masih ditunggu?",options:[missing*weeks*5000,missing*5000,(missing+1)*weeks*5000].map(money),correct:0,why:`${missing} siswa × 2 minggu × Rp5.000 = ${money(missing*weeks*5000)}.`},
    {name:"Cocokkan saldo",clue:"Saldo awal Rp80.000. Buku mencatat pembelian tinta Rp18.000 dan pengembalian toko Rp3.000.",ask:"Saldo mana yang cocok dengan bukti?",options:[65000,59000,95000].map(money),correct:0,why:"Rp80.000 − Rp18.000 + Rp3.000 = Rp65.000."},
    {name:"Pilih pos kas",clue:"Kelas mengirim bantuan kepada teman yang sedang sakit. Pos sosial masih mencukupi.",ask:"Dari pos mana bantuan dicatat?",options:["Sosial","Operasional","Acara"],correct:0,why:"Bantuan untuk teman yang sakit termasuk pengeluaran sosial."}
  ];
}
export function playerCard(name,side,q){
  const keys=side===0?'123':'JKL';
  return `<section class="duelist" data-side="${side}"><p class="eyebrow">P${side+1} · ${name}</p><h2>${q.ask}</h2><p>${q.clue}</p><div class="options">${q.answers.map((a,i)=>`<button data-dwell data-seat="${side}" data-choice="${i}"><kbd>${keys[i]}</kbd> ${a.label}</button>`).join("")}</div><small class="lock"></small></section>`;
}
