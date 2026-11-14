// Prototipe statis: pengalih peran/layar, modal, dan hitungan tampilan. Semua data sintetis.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rp = n => (n < 0 ? '−Rp ' : 'Rp ') + Math.abs(Math.round(n)).toLocaleString('id-ID');
const f = n => Math.round(n).toLocaleString('id-ID');
const num = s => parseInt(String(s).replace(/\D/g, ''), 10) || 0;

// section = <section data-screen> yang ditampilkan (default: id)
const SCREENS = [
  { id: 'antrean', role: 'kasir', nav: 'kasir', label: '1 · Antrean Kasir' },
  { id: 'buka-shift', role: 'kasir', nav: 'kasir', label: '2 · Buka Shift (hitung kas awal)' },
  { id: 'tagihan', role: 'kasir', nav: 'kasir', label: '3 · Detail Tagihan' },
  { id: 'bayar', role: 'kasir', nav: 'kasir', label: '4 · Bayar (mode charge)' },
  { id: 'lunas', role: 'kasir', nav: 'kasir', label: '5 · Lunas' },
  { id: 'struk', role: 'kasir', nav: 'kasir', label: '6 · Struk' },
  { id: 'refund', section: 'struk', role: 'kasir', nav: 'kasir', label: '7 · Void / Refund' },
  { id: 'tutup-shift', role: 'kasir', nav: 'laporan', label: '8 · Tutup Shift (hitung laci)' },
  { id: 'laporan', role: 'kasir', nav: 'laporan', label: '9 · Laporan Kasir' },
  { id: 'diskon', section: 'tagihan', role: 'dokter', nav: 'kasir', label: '10 · Persetujuan Diskon (PIN)' },
  { id: 'pendapatan', role: 'dokter', nav: 'pendapatan', label: '11 · Pendapatan Saya' },
  { id: 'laporan-pemilik', section: 'laporan', role: 'pemilik', nav: 'laporan', label: '12 · Laporan Kasir (hanya lihat)' },
  { id: 'keuangan', role: 'pemilik', nav: 'keuangan', label: '13 · Dashboard Keuangan' },
  { id: 'audit', role: 'pemilik', nav: 'audit', label: '14 · Audit Void/Selisih' },
  { id: 'tarif', role: 'pemilik', nav: 'tarif', label: '15 · Tarif & Kebijakan' },
];
const DEFAULT = { kasir: 'antrean', dokter: 'pendapatan', pemilik: 'keuangan' };
const USERS = {
  kasir: ['SF', 'Sari Front Desk', 'Kasir · Front office'],
  dokter: ['NP', 'drg. Nadia Putri', 'Dokter gigi'],
  pemilik: ['RK', 'Rina Kusuma', 'Pemilik klinik'],
};
let role = 'kasir';

/* ---------- Pengalih ---------- */
const select = $('#screen-select');
function show(id) {
  if (id === 'laporan' && role === 'pemilik') id = 'laporan-pemilik';
  const s = SCREENS.find(x => x.id === id || String(SCREENS.indexOf(x) + 1) === String(id)) || SCREENS[0];
  role = s.role;
  $$('.backdrop').forEach(m => { if (!m.hidden) closeModal(m, false); });
  const sectionId = s.section || s.id;
  $$('.screen').forEach(el => { el.hidden = el.dataset.screen !== sectionId; el.classList.remove('dimmed'); });
  $$('[data-role]').forEach(b => b.setAttribute('aria-pressed', b.dataset.role === role));
  select.innerHTML = SCREENS.filter(x => x.role === role)
    .map(x => `<option value="${x.id}"${x.id === s.id ? ' selected' : ''}>${x.label}</option>`).join('');
  $$('.nav-item[data-nav]').forEach(b => b.dataset.nav === s.nav ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $$('[data-roles]').forEach(el => { el.hidden = !el.dataset.roles.split(/\s+/).includes(role); });
  const uangGroup = $('#ng-uang');
  if (uangGroup) uangGroup.hidden = !$$('#ng-uang + [role=list] .nav-item').some(b => !b.hidden);
  const [ini, name, desc] = USERS[role];
  $('#user-initials').textContent = ini; $('#user-name').textContent = name; $('#user-role').textContent = desc;
  history.replaceState(null, '', '#' + s.id);
  window.scrollTo(0, 0);
  if (s.id === 'diskon') {
    $('[data-screen=tagihan]').classList.add('dimmed');
    approved = false; $('#disc-approved').hidden = true; setDisc({ kind: 0, amount: 0 });
    requestDiscount(15);
  }
  if (s.id === 'bayar') resetCharge();
  if (s.id === 'refund') openModal($('#refund-modal'), $('#refund-open-struk'));
}
$$('[data-role]').forEach(b => b.addEventListener('click', () => { role = b.dataset.role; show(DEFAULT[role]); }));
select.addEventListener('change', () => show(select.value));

/* ---------- Tautan umum ---------- */
const toastEl = $('#toast');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.hidden = true), 3200);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-toast],[data-open],[data-close],[data-wa]');
  if (!t || t.disabled) return;
  if (t.dataset.close !== undefined) closeModal(t.closest('.backdrop'));
  if (t.dataset.go) { show(t.dataset.go); if (t.dataset.tabgo) selectTab(t.dataset.tabgo); }
  if (t.dataset.open) openModal($('#' + t.dataset.open), t);
  if (t.dataset.wa) openWa(t.dataset.wa, t);
  if (t.dataset.toast) toast(t.dataset.toast);
});

/* ---------- Modal (fokus terkunci, Esc = batal, klik latar tidak berbuat apa-apa) ---------- */
let lastFocus;
function openModal(m, from) {
  lastFocus = from || document.activeElement;
  if (m.id === 'refund-modal') resetRefund();
  m.hidden = false;
  (m.querySelector('[data-rstep]:not([hidden]) input:not([type=radio]), input:not([type=radio]),textarea,button') || m).focus();
}
function closeModal(m, restore = true) {
  if (!m) return;
  m.hidden = true;
  if (m.id === 'disc-modal' && discPending) { discPending = false; setDisc(prevDisc); }
  $$('.screen.dimmed').forEach(s => s.classList.remove('dimmed'));
  if (restore && lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
document.addEventListener('keydown', e => {
  const m = $$('.backdrop').find(x => !x.hidden);
  if (!m) return;
  if (e.key === 'Escape') { closeModal(m); return; }
  if (e.key !== 'Tab') return;
  const fs = $$('input,textarea,select,button', m).filter(x => !x.disabled && x.offsetParent);
  if (!fs.length) return;
  if (e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
});

// PIN 6 kotak: pindah otomatis, Backspace mundur; tombol aktif bila 6 digit terisi.
function wirePin(box, btn) {
  const pins = $$('input', box);
  pins.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      if (inp.value && pins[i + 1]) pins[i + 1].focus();
      btn.disabled = !pins.every(p => p.value);
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && pins[i - 1]) pins[i - 1].focus(); });
  });
  return () => { pins.forEach(p => (p.value = '')); btn.disabled = true; };
}

/* ---------- WhatsApp ---------- */
const WA = {
  piutang: ['Dewi Lestari', 'Halo Ibu Dewi, salam dari Klinik Gigi Senyum Sehat. Kami ingin mengingatkan sisa tagihan sebesar Rp 500.000 yang jatuh tempo pada Sabtu, 21 November 2026. Pembayaran bisa dilakukan di kasir klinik. Abaikan pesan ini bila sudah membayar. Terima kasih.'],
  tagihan: ['Budi Santoso', () => `Halo Bapak Budi, salam dari Klinik Gigi Senyum Sehat. Tagihan kunjungan hari ini (TG-2026-11014-001) sebesar ${rp(due())} belum dibayar. Silakan selesaikan di kasir klinik. Terima kasih.`],
  struk: ['Budi Santoso', () => `Halo Bapak Budi, terima kasih. Pembayaran tagihan TG-2026-11014-001 sebesar ${rp(paid.amount)} sudah kami terima pada 14 November 2026. Struk digital: (tautan contoh). Salam, Klinik Gigi Senyum Sehat.`],
};
function openWa(kind, from) {
  const [name, text] = WA[kind];
  $('#wa-to').textContent = `Ke: ${name} · 0800-000-0000 (nomor contoh)`;
  $('#wa-text').textContent = typeof text === 'function' ? text() : text;
  openModal($('#wa-modal'), from);
}

/* ---------- Tagihan: diskon (bawaan 0%) & saldo deposit ---------- */
const SUBTOTAL = 800000, SALDO = 200000;
const KASIR_LIMIT = Math.min(SUBTOTAL * 0.10, 100000); // 10% atau Rp 100.000, mana yang lebih kecil
const REFUND_LIMIT = 500000;                          // di atas ini perlu PIN pemilik
const KAS_SISTEM = 500000 + 450000 + 600000;          // kas awal + tunai Hendra + tunai Budi
let disc = { kind: 0, amount: 0 }, prevDisc = disc, approved = false, discPending = false;
let paid = { method: 'Tunai', amount: 600000, lines: [['Uang diterima', 600000], ['Kembalian', 0]] };
let refundTunai = 0, refundCount = 0, refunded = 0;
const refundable = () => paid.amount - refunded;

const saldoUsed = () => ($('#use-saldo').checked ? Math.min(SALDO, SUBTOTAL - disc.amount) : 0);
const due = () => SUBTOTAL - disc.amount - saldoUsed();

// Semua angka turunan ditulis ke [data-b=kunci].
function bind() {
  const B = {
    due: rp(due()),
    'disc-label': disc.kind === 'nominal' ? '(nominal)' : disc.kind ? disc.kind + '%' : '(tanpa)',
    'disc-amt': rp(-disc.amount),
    'saldo-amt': rp(-saldoUsed()),
    paid: rp(paid.amount),
    method: paid.method,
    'pay-line': paid.lines.map(([k, v]) => `${k} ${typeof v === 'number' ? rp(v) : v}`).join(' · '),
    'refund-tunai': rp(refundTunai),
    'refund-count': refundCount,
    'kas-sistem': rp(KAS_SISTEM - refundTunai),
  };
  $$('[data-b]').forEach(el => { if (el.dataset.b in B) el.textContent = B[el.dataset.b]; });
  const money = [['Subtotal', f(SUBTOTAL)],
    ['Diskon' + (disc.amount ? ' ' + B['disc-label'] : ''), disc.amount ? '−' + f(disc.amount) : '0'],
    ['Total', f(SUBTOTAL - disc.amount)], ['Saldo deposit', saldoUsed() ? '−' + f(saldoUsed()) : '0']];
  $('#p-money').innerHTML = money.map(([k, v]) => `<div class="p-row"><span>${k}</span><span>${v}</span></div>`).join('') +
    `<div class="p-row p-big"><span>Dibayar</span><span>Rp ${f(paid.amount)}</span></div>` +
    `<div class="p-row"><span>Metode</span><span>${paid.method}</span></div>` +
    paid.lines.map(([k, v]) => `<div class="p-row"><span>${k}</span><span>${typeof v === 'number' ? f(v) : v}</span></div>`).join('') +
    `<div class="p-row"><span>Sisa saldo deposit</span><span>${f(SALDO - saldoUsed())}</span></div>`;
  renderCharge(); renderClose();
}
function setDisc(d) {
  disc = d;
  $$('[data-disc]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.disc) === String(d.kind)));
  $('#disc-nominal').hidden = d.kind !== 'nominal';
  bind();
}
function requestDiscount(pct) {
  const amount = SUBTOTAL * pct / 100;
  if (amount <= KASIR_LIMIT || approved) return setDisc({ kind: pct, amount });
  prevDisc = disc; discPending = true;
  setDisc({ kind: pct, amount });
  const m = $('#disc-modal');
  $('[data-step=form]', m).hidden = false; $('[data-step=done]', m).hidden = true;
  resetDiscPin();
  openModal(m);
  $('#pin input').focus();
}
$$('[data-disc]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.disc;
  if (k === 'nominal') { setDisc({ kind: 'nominal', amount: num($('#disc-nominal').value) }); $('#disc-nominal').focus(); }
  else requestDiscount(Number(k));
}));
$('#disc-nominal').addEventListener('input', e => {
  const v = Math.min(num(e.target.value), SUBTOTAL);
  e.target.value = v ? v.toLocaleString('id-ID') : '';
  const over = v > KASIR_LIMIT && !approved;
  e.target.setAttribute('aria-invalid', over);
  e.target.style.borderColor = over ? 'var(--danger-fg)' : '';
  if (over) toast(`Di atas batas kasir (maks. ${rp(KASIR_LIMIT)} untuk tagihan ini) — perlu PIN dokter atau admin.`);
  disc = { kind: 'nominal', amount: over ? KASIR_LIMIT : v }; bind();
});
$('#use-saldo').addEventListener('change', bind);

const resetDiscPin = wirePin($('#pin'), $('#disc-approve'));
$('#disc-approve').addEventListener('click', () => {
  approved = true; discPending = false;
  $('#disc-approved').hidden = false;
  const m = $('#disc-modal');
  $('[data-step=form]', m).hidden = true; $('[data-step=done]', m).hidden = false;
  $('[data-step=done] button', m).focus();
});

/* ---------- Bayar: mode charge (ubin metode + keypad) ---------- */
const METHOD_NAME = { tunai: 'Tunai', qris: 'QRIS', edc: 'EDC', transfer: 'Transfer', split: 'Split' };
let method = 'tunai', cashStr = '', splitStr = '';
const keyed = () => (method === 'split' ? splitStr : cashStr);
const setKeyed = s => { s = s.replace(/^0+/, '').slice(0, 10); method === 'split' ? (splitStr = s) : (cashStr = s); renderCharge(); };

function resetCharge() { cashStr = ''; splitStr = ''; setMethod('tunai'); }
function setMethod(m) {
  method = m;
  $$('.tile').forEach(t => t.setAttribute('aria-checked', t.dataset.method === m));
  $$('#screen-bayar [data-mpanel]').forEach(p => (p.hidden = p.dataset.mpanel !== m));
  $('#keypad-wrap').hidden = !(m === 'tunai' || m === 'split');
  $('#chip-pas').hidden = m === 'split';
  renderCharge();
}
function renderCharge() {
  const d = due(), cash = num(cashStr), a = num(splitStr), ch = cash - d;
  $('#cash-in').textContent = rp(cash);
  $('#change-box').classList.toggle('short', ch < 0);
  $('#change-label').textContent = ch < 0 ? 'Kurang' : 'Kembalian';
  $('#change-amt').textContent = rp(Math.abs(ch));
  $('#split-a').textContent = rp(a);
  $('#split-b').textContent = rp(Math.max(0, d - a));
  const cta = $('#charge-cta');
  cta.disabled = method === 'tunai' ? cash < d : method === 'split' ? !(a > 0 && a < d) : false;
  cta.textContent = (method === 'tunai' || method === 'split' ? 'Terima ' : 'Pembayaran diterima · ') + rp(d);
}
$$('.tile').forEach(t => t.addEventListener('click', () => setMethod(t.dataset.method)));
function pressKey(k) {
  const s = keyed();
  if (k === 'back') setKeyed(s.slice(0, -1));
  else if (k === '000') setKeyed(s ? s + '000' : s);
  else setKeyed(s + k);
}
$$('#keypad [data-key]').forEach(b => b.addEventListener('click', () => pressKey(b.dataset.key)));
// Pecahan MENAMBAH ke uang diterima (seperti menumpuk lembaran); "Uang pas" mengisi tepat sisa.
$$('[data-chip]').forEach(b => b.addEventListener('click', () => {
  const c = b.dataset.chip;
  setKeyed(c === 'pas' ? String(due()) : c === 'reset' ? '' : String(num(keyed()) + Number(c)));
}));
document.addEventListener('keydown', e => {
  if ($('#screen-bayar').hidden || $$('.backdrop').some(m => !m.hidden) || e.target.closest('input,select,textarea')) return;
  if (!(method === 'tunai' || method === 'split')) return;
  if (/^\d$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('back');
  else if (e.key === 'Enter' && !$('#charge-cta').disabled) $('#charge-cta').click();
});
$('#split-b-method').addEventListener('change', renderCharge);
$('#charge-cta').addEventListener('click', () => {
  const d = due();
  if (method === 'tunai') paid = { method: 'Tunai', amount: d, lines: [['Uang diterima', num(cashStr)], ['Kembalian', num(cashStr) - d]] };
  else if (method === 'split') {
    const a = num(splitStr), m2 = $('#split-b-method').value;
    paid = { method: `Tunai + ${m2}`, amount: d, lines: [['Tunai', a], [m2, d - a]] };
  } else paid = { method: METHOD_NAME[method], amount: d, lines: [['Ref.', '(contoh)']] };
  refunded = 0;
  bind();
  show('lunas');
});

/* ---------- Void / Refund ---------- */
const resetRefundPin = wirePin($('#refund-pin'), $('#refund-approve'));
const rStep = s => $$('#refund-modal [data-rstep]').forEach(p => (p.hidden = p.dataset.rstep !== s));
const refundAmt = () => num($('#refund-amount').value);
const refundMethod = () => $('input[name=refund-method]:checked').value;
const R_METHOD = { tunai: 'tunai dari laci', saldo: 'ke saldo deposit pasien (non-tunai)', transfer: 'transfer ke rekening pasien (non-tunai)' };
function resetRefund() {
  rStep('form');
  $('#refund-amount').value = refundable() ? f(refundable()) : '';
  $('#refund-reason').value = ''; $('#refund-note').value = '';
  $('#refund-m-tunai').checked = true;
  resetRefundPin(); refundCheck();
}
function refundCheck() {
  const amt = refundAmt(), other = $('#refund-reason').value === 'Lainnya';
  $('#refund-note-req').textContent = other ? '(wajib untuk "Lainnya")' : '(opsional)';
  const ok = amt > 0 && amt <= refundable() && $('#refund-reason').value && (!other || $('#refund-note').value.trim());
  const owner = amt > REFUND_LIMIT;
  $('#refund-owner-note').hidden = !owner;
  $('#refund-amount').setAttribute('aria-invalid', amt > refundable());
  $('#refund-next').disabled = !ok;
  $('#refund-next').textContent = owner ? 'Lanjut: persetujuan pemilik' : 'Catat pengembalian';
}
$('#refund-amount').addEventListener('input', e => { const v = num(e.target.value); e.target.value = v ? f(v) : ''; refundCheck(); });
['#refund-reason', '#refund-note'].forEach(s => $(s).addEventListener('input', refundCheck));
$$('input[name=refund-method]').forEach(r => r.addEventListener('change', refundCheck));
$$('[data-ramt]').forEach(b => b.addEventListener('click', () => {
  $('#refund-amount').value = f(b.dataset.ramt === 'full' ? refundable() : Number(b.dataset.ramt)); refundCheck();
}));
$('#refund-next').addEventListener('click', () => {
  if (refundAmt() <= REFUND_LIMIT) return recordRefund(null);
  $('#refund-summary').innerHTML = `<dt>Jumlah</dt><dd>${rp(refundAmt())}</dd><dt>Alasan</dt><dd>${$('#refund-reason').value}</dd><dt>Lewat</dt><dd>${R_METHOD[refundMethod()]}</dd>`;
  rStep('owner'); $('#refund-pin input').focus();
});
$('#refund-back').addEventListener('click', () => { resetRefundPin(); rStep('form'); });
$('#refund-approve').addEventListener('click', () => recordRefund('Rina Kusuma (pemilik, PIN)'));
function recordRefund(approver) {
  const amt = refundAmt(), m = refundMethod(), full = amt === paid.amount;
  refundCount++; refunded += amt;
  if (m === 'tunai') refundTunai += amt;
  $('#refund-done-text').textContent = `${full ? 'Void penuh' : 'Refund sebagian'} ${rp(amt)} · ${R_METHOD[m]}` +
    (m === 'tunai' ? ' — uang keluar dari laci, kas sistem ikut berkurang' : ' — tidak mengubah isi laci') +
    ` · alasan: ${$('#refund-reason').value} · ${approver ? 'disetujui ' + approver : 'dicatat kasir (≤ Rp 500.000)'} · 20.35`;
  const st = $('#lunas-status'); st.className = 'chip chip-void'; st.textContent = full ? 'void' : 'refund sebagian';
  const banner = $('#refund-banner'); banner.hidden = false;
  $('span', banner).textContent = `${full ? 'Void' : 'Refund'} ${rp(amt)} dicatat (${$('#refund-reason').value}). Tagihan asli tetap tersimpan dan terkunci.`;
  bind();
  rStep('done'); $('#refund-modal [data-rstep=done] button').focus();
}

/* ---------- Struk ---------- */
$$('[data-paper]').forEach(t => t.addEventListener('click', () => {
  $$('[data-paper]').forEach(x => x.setAttribute('aria-selected', x === t));
  const p = $('#paper'); p.classList.remove('w58', 'w80', 'a5'); p.classList.add(t.dataset.paper);
}));
$('#salinan-toggle').addEventListener('change', e => {
  $('#paper').classList.toggle('salinan', e.target.checked);
  $('.salinan-note').hidden = !e.target.checked;
});

/* ---------- Laporan ---------- */
function selectTab(name) {
  $$('[data-tab]').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === name));
  $$('[data-screen=laporan] .tabpanel').forEach(p => (p.hidden = p.id !== 'tp-' + name));
}
$$('[data-tab]').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));

/* ---------- Buka/Tutup shift: hitung per pecahan ---------- */
const DENOMS = [[100000, 'kertas'], [50000, 'kertas'], [20000, 'kertas'], [10000, 'kertas'], [5000, 'kertas'], [2000, 'kertas'],
  [1000, 'kertas'], [1000, 'koin'], [500, 'koin'], [200, 'koin'], [100, 'koin']];
// Contoh hitungan: buka = Rp 500.000; tutup = Rp 1.550.000 (kas awal + tunai Hendra 450.000 + Budi 600.000).
const OPEN_COUNTS = [0, 4, 8, 8, 6, 9, 5, 4, 3, 5, 5];
const CLOSE_COUNTS = [8, 9, 8, 8, 6, 9, 5, 4, 3, 5, 5];
console.assert(DENOMS.reduce((s, [v], i) => s + v * OPEN_COUNTS[i], 0) === 500000, 'kas awal contoh harus Rp 500.000');
console.assert(DENOMS.reduce((s, [v], i) => s + v * CLOSE_COUNTS[i], 0) === KAS_SISTEM, 'hitung tutup contoh harus = kas sistem');

function denomTable(el, prefix, counts, onChange) {
  el.innerHTML = DENOMS.map(([v, k], i) => {
    const id = `${prefix}-qty-${v}${k === 'koin' ? '-koin' : ''}`, name = `Rp ${f(v)} ${k}`;
    return `<div class="denom" data-i="${i}">
      <label class="d-label" for="${id}"><b class="num">${f(v)}</b><small>${k}</small></label>
      <div class="stepper"><button type="button" data-inc="-1" aria-label="Kurangi ${name}">−</button><input class="num" id="${id}" inputmode="numeric" value="${counts[i]}" aria-label="Jumlah ${name}"><button type="button" data-inc="1" aria-label="Tambah ${name}">+</button></div>
      <span class="d-sub rp">${rp(v * counts[i])}</span></div>`;
  }).join('');
  const total = () => $$('.denom', el).reduce((s, r) => s + DENOMS[r.dataset.i][0] * num($('input', r).value), 0);
  const update = row => { $('.d-sub', row).textContent = rp(DENOMS[row.dataset.i][0] * num($('input', row).value)); onChange(total()); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-inc]'); if (!b) return;
    const row = b.closest('.denom'), inp = $('input', row);
    inp.value = Math.max(0, num(inp.value) + Number(b.dataset.inc)); update(row);
  });
  el.addEventListener('input', e => { const row = e.target.closest('.denom'); e.target.value = num(e.target.value); update(row); });
  return total;
}
const openTotal = denomTable($('#denom-open'), 'open', OPEN_COUNTS, t => {
  $('#open-total').textContent = $('#open-big').textContent = rp(t);
  const diff = t - 500000;
  $('#open-diff').classList.toggle('short', diff !== 0);
  $('#open-diff-label').textContent = diff === 0 ? 'Sesuai standar' : 'Beda dari standar';
  $('#open-diff-amt').textContent = rp(diff);
});
$('#open-shift').addEventListener('click', () => {
  $('#open-done-amt').textContent = rp(openTotal());
  $('#open-form').hidden = true; $('#open-done').hidden = false;
});

let closeTotal = () => 0;
function renderClose() {
  const counted = closeTotal(), diff = counted - (KAS_SISTEM - refundTunai);
  $('#close-total').textContent = $('#close-counted').textContent = rp(counted);
  $('#var-amt').textContent = rp(diff);
  $('#var-label').textContent = diff === 0 ? 'Selisih · sesuai' : diff < 0 ? 'Selisih · kurang' : 'Selisih · lebih';
  $('#var-box').classList.toggle('short', diff !== 0);
  $('#var-reason-wrap').hidden = diff === 0;
}
closeTotal = denomTable($('#denom-close'), 'close', CLOSE_COUNTS, renderClose);
$('#close-shift').addEventListener('click', () => {
  const sys = KAS_SISTEM - refundTunai, counted = closeTotal(), diff = counted - sys;
  if (diff !== 0 && !$('#var-reason').value.trim()) {
    $('#var-reason').focus(); return toast('Ada selisih — isi alasan dulu sebelum menutup shift.');
  }
  $('#close-summary').innerHTML = [['Kas awal', rp(500000)], ['Tunai masuk', rp(1050000)], ['Refund tunai', rp(refundTunai)],
    ['Seharusnya di laci', rp(sys)], ['Dihitung', rp(counted)], ['Selisih', rp(diff)],
    ...(diff ? [['Alasan', $('#var-reason').value.trim()]] : []), ['Non-tunai (QRIS)', rp(400000)], ['Transaksi lunas', '3']]
    .map(([k, v]) => `<dt>${k}</dt><dd>${v.replace(/</g, '&lt;')}</dd>`).join('');
  $('#close-form').hidden = true; $('#close-done').hidden = false;
  $('#laporan-shift-chip').textContent = 'shift ditutup 20.30';
  $$('#laporan-tutup-shift, #antrean-tutup-shift').forEach(b => { b.disabled = true; b.textContent = 'Shift ditutup 20.30'; });
});

/* ---------- Pendapatan & Audit ---------- */
$$('[data-period]').forEach(b => b.addEventListener('click', () => {
  $$('[data-period]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $$('[data-periodpanel]').forEach(p => (p.hidden = p.dataset.periodpanel !== b.dataset.period));
}));
$$('[data-filter]').forEach(b => b.addEventListener('click', () => {
  const fl = b.dataset.filter;
  $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $$('[data-kind-card]').forEach(c => (c.hidden = fl !== 'semua' && !c.dataset.kindCard.split(' ').includes(fl)));
  $$('tr[data-kind]').forEach(r => (r.hidden = fl !== 'semua' && fl !== 'selisih' && r.dataset.kind !== fl));
}));

/* ---------- Mulai ---------- */
bind();
console.assert(due() === 600000 && disc.amount === 0, 'Budi: diskon 0, sisa dibayar Rp 600.000');
show(new URLSearchParams(location.search).get('layar') || location.hash.slice(1) || 'antrean');
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
