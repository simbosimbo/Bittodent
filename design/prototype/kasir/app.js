// Prototipe statis: pengalih peran/layar, modal, dan hitungan tampilan. Semua data sintetis.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rp = n => (n < 0 ? '−Rp ' : 'Rp ') + Math.abs(Math.round(n)).toLocaleString('id-ID');
const num = s => parseInt(String(s).replace(/\D/g, ''), 10) || 0;

const SCREENS = [
  { id: 'antrean', n: 1, role: 'kasir', nav: 'kasir', label: '1 · Antrean Kasir' },
  { id: 'tagihan', n: 2, role: 'kasir', nav: 'kasir', label: '2 · Detail Tagihan & Bayar' },
  { id: 'lunas', n: 3, role: 'kasir', nav: 'kasir', label: '3 · Lunas' },
  { id: 'struk', n: 4, role: 'kasir', nav: 'kasir', label: '4 · Struk' },
  { id: 'laporan', n: 5, role: 'kasir', nav: 'laporan', label: '5 · Laporan Kasir' },
  { id: 'diskon', n: 6, role: 'dokter', nav: 'kasir', label: '6 · Persetujuan Diskon' },
  { id: 'pendapatan', n: 7, role: 'dokter', nav: 'pendapatan', label: '7 · Pendapatan Saya' },
  { id: 'keuangan', n: 8, role: 'pemilik', nav: 'keuangan', label: '8 · Dashboard Keuangan' },
  { id: 'audit', n: 9, role: 'pemilik', nav: 'audit', label: '9 · Audit Void/Selisih' },
  { id: 'tarif', n: 10, role: 'pemilik', nav: 'tarif', label: '10 · Tarif & Kebijakan' },
];
const USERS = {
  kasir: ['SF', 'Sari Front Desk', 'Kasir · Front office'],
  dokter: ['NP', 'drg. Nadia Putri', 'Dokter gigi'],
  pemilik: ['RK', 'Rina Kusuma', 'Pemilik klinik'],
};

/* ---------- Pengalih ---------- */
const select = $('#screen-select');
function show(id) {
  const s = SCREENS.find(x => x.id === id || String(x.n) === String(id)) || SCREENS[0];
  $$('.backdrop').forEach(m => { if (!m.hidden) closeModal(m, false); });
  const sectionId = s.id === 'diskon' ? 'tagihan' : s.id;
  $$('.screen').forEach(el => { el.hidden = el.dataset.screen !== sectionId; el.classList.remove('dimmed'); });
  $$('[data-role]').forEach(b => b.setAttribute('aria-pressed', b.dataset.role === s.role));
  select.innerHTML = SCREENS.filter(x => x.role === s.role)
    .map(x => `<option value="${x.id}"${x.id === s.id ? ' selected' : ''}>${x.label}</option>`).join('');
  $$('.nav-item[data-nav]').forEach(b => b.dataset.nav === s.nav ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $$('[data-roles]').forEach(el => {
    const ok = el.dataset.roles.split(/\s+/).includes(s.role);
    el.hidden = !ok;
  });
  const uangItems = $$('#ng-uang + [role=list] .nav-item').filter(b => !b.hidden);
  const uangGroup = $('#ng-uang');
  if (uangGroup) uangGroup.hidden = uangItems.length === 0;
  const [ini, name, role] = USERS[s.role];
  $('#user-initials').textContent = ini; $('#user-name').textContent = name; $('#user-role').textContent = role;
  history.replaceState(null, '', '#' + s.id);
  window.scrollTo(0, 0);
  if (s.id === 'diskon') {
    $('[data-screen=tagihan]').classList.add('dimmed');
    approved = false; $('#disc-approved').hidden = true; setDisc({ kind: 5, amount: 40000 });
    requestDiscount(15, true);
  }
}
$$('[data-role]').forEach(b => b.addEventListener('click', () => show(SCREENS.find(x => x.role === b.dataset.role).id)));
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
  if (!t) return;
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
  m.hidden = false;
  (m.querySelector('input:not([type=radio]),textarea,button') || m).focus();
}
function closeModal(m, restore = true) {
  if (!m) return;
  m.hidden = true;
  if (m.id === 'disc-modal' && discPending) { discPending = false; setDisc(prevDisc); }
  $('[data-screen=tagihan]').classList.remove('dimmed');
  if (restore && lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
document.addEventListener('keydown', e => {
  const m = $$('.backdrop').find(x => !x.hidden);
  if (!m) return;
  if (e.key === 'Escape') { closeModal(m); return; }
  if (e.key !== 'Tab') return;
  const f = $$('input,textarea,select,button', m).filter(x => !x.disabled && x.offsetParent);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
});

/* ---------- WhatsApp ---------- */
const WA = {
  piutang: ['Dewi Lestari', 'Halo Ibu Dewi, salam dari Klinik Gigi Senyum Sehat. Kami ingin mengingatkan sisa pembayaran sebesar Rp 500.000 yang jatuh tempo pada Sabtu, 21 November 2026. Pembayaran bisa dilakukan di kasir klinik. Abaikan pesan ini bila sudah membayar. Terima kasih.'],
  tagihan: ['Budi Santoso', 'Halo Bapak Budi, salam dari Klinik Gigi Senyum Sehat. Tagihan kunjungan hari ini (TG-2026-11014-001) sebesar Rp 560.000 belum dibayar. Silakan selesaikan di kasir klinik. Terima kasih.'],
  struk: ['Budi Santoso', 'Halo Bapak Budi, terima kasih. Pembayaran tagihan TG-2026-11014-001 sebesar Rp 560.000 sudah kami terima pada 14 November 2026. Struk digital: (tautan contoh). Salam, Klinik Gigi Senyum Sehat.'],
};
function openWa(kind, from) {
  const [name, text] = WA[kind];
  $('#wa-to').textContent = `Ke: ${name} · 0800-000-0000 (nomor contoh)`;
  $('#wa-text').textContent = text;
  openModal($('#wa-modal'), from);
}

/* ---------- Tagihan: diskon, saldo, metode ---------- */
const SUBTOTAL = 800000, SALDO = 200000;
const KASIR_LIMIT = Math.min(SUBTOTAL * 0.10, 100000); // 10% atau Rp 100.000, mana yang lebih kecil
let disc = { kind: 5, amount: 40000 }, prevDisc = disc, approved = false, discPending = false;

function due() {
  const after = SUBTOTAL - disc.amount;
  return Math.max(0, after - ($('#use-saldo').checked ? Math.min(SALDO, after) : 0));
}
function setDisc(d) {
  disc = d;
  $$('[data-disc]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.disc) === String(d.kind)));
  $('#disc-nominal').hidden = d.kind !== 'nominal';
  $('#disc-label').textContent = d.kind === 'nominal' ? '(nominal)' : d.kind ? d.kind + '%' : '';
  recalc();
}
function recalc() {
  $('#disc-amt').textContent = rp(-disc.amount);
  $('#saldo-amt').textContent = $('#use-saldo').checked ? rp(-SALDO) : 'Rp 0';
  $$('[data-due]').forEach(el => (el.textContent = rp(due())));
  const ch = num($('#cash-in').value) - due();
  $('#change-box').classList.toggle('short', ch < 0);
  $('#change-box').firstElementChild.textContent = ch < 0 ? 'Kurang' : 'Kembalian';
  $('#change-amt').textContent = rp(Math.abs(ch));
  const left = due() - num($('#split-a').value) - num($('#split-b').value);
  $('#split-box').classList.toggle('short', left !== 0);
  $('#split-label').textContent = left === 0 ? 'Pas — total sesuai' : left > 0 ? 'Masih kurang' : 'Lebih';
  $('#split-amt').textContent = rp(Math.abs(left));
}
function requestDiscount(pct, asDoctor) {
  const amount = SUBTOTAL * pct / 100;
  if (amount <= KASIR_LIMIT || approved) return setDisc({ kind: pct, amount });
  prevDisc = disc; discPending = true;
  setDisc({ kind: pct, amount });
  const m = $('#disc-modal');
  $('[data-step=form]', m).hidden = false; $('[data-step=done]', m).hidden = true;
  $$('#pin input').forEach(i => (i.value = '')); $('#disc-approve').disabled = true;
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
  if (over) toast('Di atas batas kasir (maks. Rp 80.000 untuk tagihan ini) — perlu PIN dokter atau admin.');
  disc = { kind: 'nominal', amount: over ? KASIR_LIMIT : v }; recalc();
});
$('#use-saldo').addEventListener('change', recalc);

// PIN: 6 kotak, pindah otomatis, Backspace mundur.
const pins = $$('#pin input');
pins.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '').slice(-1);
    if (inp.value && pins[i + 1]) pins[i + 1].focus();
    $('#disc-approve').disabled = !pins.every(p => p.value);
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && pins[i - 1]) pins[i - 1].focus(); });
});
$('#disc-approve').addEventListener('click', () => {
  approved = true; discPending = false;
  $('#disc-approved').hidden = false;
  const m = $('#disc-modal');
  $('[data-step=form]', m).hidden = true; $('[data-step=done]', m).hidden = false;
  $('[data-step=done] button', m).focus();
});

// Metode bayar
$$('.method').forEach(b => b.addEventListener('click', () => {
  $$('.method').forEach(x => x.setAttribute('aria-checked', x === b));
  $$('[data-mpanel]').forEach(p => (p.hidden = p.dataset.mpanel !== b.dataset.method));
  $('#paybar-method').textContent = b.textContent.trim();
}));
$$('[data-cash]').forEach(b => b.addEventListener('click', () => {
  $('#cash-in').value = (b.dataset.cash === '560000' ? due() : num(b.dataset.cash)).toLocaleString('id-ID'); recalc();
}));
['#cash-in', '#split-a', '#split-b'].forEach(s => $(s).addEventListener('input', e => {
  const v = num(e.target.value); e.target.value = v ? v.toLocaleString('id-ID') : ''; recalc();
}));

/* ---------- Void / Refund ---------- */
const voidCheck = () => {
  const part = $('input[name=void-amt]:checked').value === 'part';
  $('#void-part').hidden = !part;
  const amt = part ? num($('#void-part').value) : 760000;
  $('#void-confirm').disabled = $('#void-reason').value.trim().length < 10 || amt <= 0 || amt > 760000;
  $('#void-confirm').textContent = part ? 'Ajukan refund' : 'Ajukan void';
};
$$('input[name=void-amt]').forEach(r => r.addEventListener('change', voidCheck));
['#void-reason', '#void-part'].forEach(s => $(s).addEventListener('input', voidCheck));
$('#void-confirm').addEventListener('click', () => {
  const part = $('input[name=void-amt]:checked').value === 'part';
  closeModal($('#void-modal'));
  $('#void-banner').hidden = false;
  $('#void-banner span').textContent = (part ? `Permintaan refund ${rp(num($('#void-part').value))}` : 'Permintaan void penuh') +
    ' tercatat · menunggu tinjauan pemilik. Tagihan tetap tersimpan dan terkunci; tidak ada data yang dihapus.';
  const st = $('#lunas-status'); st.className = 'chip chip-void'; st.textContent = part ? 'refund diajukan' : 'void diajukan';
  const b = $('#void-open'); b.disabled = true; b.textContent = 'Menunggu tinjauan pemilik';
});

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
const SYSTEM_CASH = 1510000;
$('#count-in').addEventListener('input', e => {
  const v = num(e.target.value); e.target.value = v ? v.toLocaleString('id-ID') : '';
  const diff = v - SYSTEM_CASH;
  $('#var-amt').textContent = diff === 0 ? 'Rp 0' : rp(diff);
  $('#var-box').classList.toggle('short', diff !== 0);
  $('#var-reason-wrap').hidden = diff === 0;
});
$('#close-shift').addEventListener('click', () => {
  if (!$('#var-reason-wrap').hidden && !$('#var-reason').value.trim()) {
    $('#var-reason').focus(); return toast('Ada selisih — isi alasan dulu sebelum menutup shift.');
  }
  toast('Prototipe: shift ditutup 20.30 dan rekap dikirim ke pemilik.');
});

/* ---------- Pendapatan & Audit ---------- */
$$('[data-period]').forEach(b => b.addEventListener('click', () => {
  $$('[data-period]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $$('[data-periodpanel]').forEach(p => (p.hidden = p.dataset.periodpanel !== b.dataset.period));
}));
$$('[data-filter]').forEach(b => b.addEventListener('click', () => {
  const f = b.dataset.filter;
  $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $$('[data-kind-card]').forEach(c => (c.hidden = f !== 'semua' && !c.dataset.kindCard.split(' ').includes(f)));
  $$('tr[data-kind]').forEach(r => (r.hidden = f !== 'semua' && f !== 'selisih' && r.dataset.kind !== f));
}));

/* ---------- Mulai ---------- */
recalc();
show(new URLSearchParams(location.search).get('layar') || location.hash.slice(1) || 'antrean');
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
