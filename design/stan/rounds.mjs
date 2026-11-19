export const pockets = [
  ["operasional", "Operasional", "Alat dan perlengkapan kelas"],
  ["sosial", "Sosial", "Bantuan dan kepedulian"],
  ["acara", "Acara", "Kegiatan kelas"],
  ["cadangan", "Cadangan", "Dana darurat"],
];

export const transactions = [
  { title: "Beli spidol papan tulis", amount: 15000, pocket: "operasional" },
  { title: "Bantuan untuk teman yang sakit", amount: 20000, pocket: "sosial" },
  { title: "Iuran buat pentas kelas", amount: 25000, pocket: "acara", income: true },
  { title: "Sisihkan dana darurat", amount: 10000, pocket: "cadangan", transfer: true },
  { title: "Beli dekorasi pentas", amount: 18000, pocket: "acara" },
  { title: "Fotokopi modul kelas", amount: 60000, pocket: "operasional", approval: true },
];

const cases = [
  {
    clue: "Kuitansi spidol tercatat Rp15.000.",
    rows: [["Iuran kelas", 40000], ["Spidol papan tulis", -15000], ["Dekorasi kelas", -12000]],
    changed: 1, value: ["Spidol papan tulis", -45000],
  },
  {
    clue: "Bukti belanja pertama menyebut kertas karton.",
    rows: [["Kertas karton", -10000], ["Iuran sosial", 30000], ["Cetak lembar tugas", -20000]],
    changed: 0, value: ["Konsumsi rapat", -10000],
  },
  {
    clue: "Pengembalian dana dari toko menambah saldo Rp25.000.",
    rows: [["Iuran kelas", 60000], ["Beli perlengkapan", -40000], ["Pengembalian dana", 25000]],
    changed: 2, value: ["Pengembalian dana", -25000],
  },
];

export async function auditCase(index) {
  const { clue, rows, changed, value } = cases[index];
  const hash = async (previous, row) => {
    const input = new TextEncoder().encode(JSON.stringify([previous, row]));
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  };
  let originalPrev = "GENESIS";
  let currentPrev = "GENESIS";
  const result = [];
  for (const [i, original] of rows.entries()) {
    const shown = i === changed ? value : original;
    const [stored, recalculated] = await Promise.all([
      hash(originalPrev, original),
      hash(currentPrev, shown),
    ]);
    result.push({ original, shown, stored, recalculated, valid: stored === recalculated });
    originalPrev = stored;
    currentPrev = recalculated;
  }
  return { clue, rows: result, firstInvalid: result.findIndex(row => !row.valid) };
}
