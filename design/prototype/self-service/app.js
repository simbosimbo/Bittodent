// Bittodent: prototipe Layanan Mandiri. Statis, DATA SINTETIS. Tidak ada data yang dikirim atau disimpan.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

// ---------- Data sintetis ----------
const BUDI = { subtotal: 450000 + 350000, deposit: 200000 };
const budiDue = (pct = 0) => BUDI.subtotal - Math.round(BUDI.subtotal * pct / 100) - BUDI.deposit;
console.assert(budiDue() === 600000, 'Sisa bayar Budi harus Rp 600.000 (800.000 - 200.000)');
console.assert(rp(budiDue()) === 'Rp 600.000', 'Format rupiah harus "Rp 600.000"');

const SERVICES = [
  { id: 'periksa', name: 'Pemeriksaan + konsultasi', min: 20, price: 150000 },
  { id: 'scaling', name: 'Scaling', min: 40, price: 400000 },
  { id: 'komposit', name: 'Tambalan komposit', min: 30, price: 450000 },
  { id: 'ekstraksi', name: 'Ekstraksi', min: 30, price: 350000 },
  { id: 'kontrol', name: 'Kontrol', min: 15, price: 0, note: 'gratis 14 hari' },
];
const SLOTS = ['09.00', '09.30', '10.00', '10.30', '11.00', '13.00', '13.30', '14.00', '14.30', '15.00', '15.30', '16.00'];
const DATES = [
  { d: 14, day: 'Sab', label: 'Sabtu, 14 Nov 2026', tag: 'Hari ini', taken: ['09.00', '09.30', '10.00', '10.30', '11.00', '13.00', '13.30', '14.00', '14.30', '15.00'] },
  { d: 15, day: 'Min', label: 'Minggu, 15 Nov 2026', closed: true },
  { d: 16, day: 'Sen', label: 'Senin, 16 Nov 2026', taken: ['09.00', '10.30', '13.30', '15.00'] },
  { d: 17, day: 'Sel', label: 'Selasa, 17 Nov 2026', taken: ['09.30', '10.00', '14.00'] },
  { d: 18, day: 'Rab', label: 'Rabu, 18 Nov 2026', taken: ['09.00', '11.00', '13.00'] },
];
// Jam beku prototipe: Sabtu 14 Nov 2026, 20.30 WIB. Slot hari ini yang sudah lewat tidak ditampilkan.
const NOW = { d: 14, t: '20.30' };
const openSlots = day => SLOTS.filter(t => !(day.d === NOW.d && t <= NOW.t));
const bookable = day => !day.closed && openSlots(day).some(t => !day.taken.includes(t));
console.assert(!bookable(DATES[0]) && openSlots(DATES[0]).length === 0, 'Hari ini 20.30: semua slot sudah lewat');
console.assert(openSlots(DATES[3]).length === SLOTS.length && bookable(DATES[3]), '17 Nov tidak terpengaruh jam beku');

// ---------- Mode & layar ----------
const MODES = {
  pasien: ['booking', 'data', 'otp', 'booking-ok', 'antrean', 'tagihan', 'bayar-qris', 'struk', 'kontrol', 'kedaluwarsa', 'sudah-dipakai'],
  kiosk: ['checkin', 'antrean', 'booking', 'data', 'otp', 'booking-ok'],
  fo: ['fo'],
  dokter: ['dokter'],
};
const LABELS = {
  booking: '1. Pilih layanan & slot', data: '2. Isi / konfirmasi data', otp: '3. Kode OTP WhatsApp',
  'booking-ok': '4. Booking terkonfirmasi', checkin: '5. Kiosk check-in', antrean: '6. Status antrean',
  tagihan: '7. Tagihan (Budi)', 'bayar-qris': '8. Bayar QRIS', struk: '9. Struk digital', kontrol: '10. Janji kontrol',
  kedaluwarsa: '11. Tautan kedaluwarsa', 'sudah-dipakai': '12. Tautan sudah dipakai', fo: '13. FO pengecualian', dokter: '14. Dokter: RM + kasir ringkas',
};
let mode = 'pasien';
const sel = $('#screen-select');

function setMode(m) {
  mode = m;
  document.body.className = 'm-' + m;
  $$('.seg [data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  sel.innerHTML = MODES[m].map(id => `<option value="${id}">${LABELS[id]}</option>`).join('');
  syncSwitcherHeight();
}

let countdownTimer;
function show(id, push = true) {
  if (!LABELS[id]) id = MODES[mode][0];
  if (!MODES[mode].includes(id)) setMode(Object.keys(MODES).find(m => MODES[m].includes(id)));
  $$('.screen').forEach(s => (s.hidden = s.dataset.screen !== id));
  sel.value = id;
  if (push && location.hash.slice(1) !== id) history.replaceState(null, '', location.pathname + location.search.replace(/[?&]layar=[^&]*/, '') + '#' + id);
  window.scrollTo(0, 0);
  clearInterval(countdownTimer);
  if (id === 'bayar-qris' && !qrisFailed) startCountdown();
  if (id === 'checkin') { $('#kiosk-idle').hidden = false; $('#kiosk-active').hidden = true; }
  if (id === 'otp') setTimeout(() => $('#otp input').focus(), 0);
}

$$('.seg [data-mode]').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); show(MODES[b.dataset.mode][0]); }));
sel.addEventListener('change', () => show(sel.value));

// Tinggi switcher berubah saat membungkus di 390px → atur offset elemen sticky.
function syncSwitcherHeight() { document.documentElement.style.setProperty('--sw', $('#switcher').offsetHeight + 'px'); }
window.addEventListener('resize', syncSwitcherHeight);

// ---------- Toast & delegasi ----------
const toastEl = $('#toast'); let toastTimer;
function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.hidden = true), 3600);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-toast],[data-close]');
  if (!t) return;
  if (t.dataset.toast) { e.preventDefault(); toast(t.dataset.toast); }
  if (t.dataset.go) show(t.dataset.go);
  if (t.hasAttribute('data-close')) t.closest('.backdrop').hidden = true;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.backdrop').forEach(b => (b.hidden = true)); });

// ---------- Pemilih tanggal & slot (dipakai booking dan kontrol) ----------
function slotPicker(datesEl, slotsEl, state, onChange) {
  function render() {
    datesEl.innerHTML = DATES.map(x => {
      const off = x.closed ? 'Tutup' : bookable(x) ? '' : 'Tidak ada slot';
      return `<button type="button" data-d="${x.d}" aria-pressed="${x.d === state.date}" ${off ? 'disabled' : ''}
      aria-label="${x.label}${off ? ', ' + off.toLowerCase() : ''}"><small>${x.tag || x.day}</small>${x.d} Nov<small>${off}</small></button>`;
    }).join('');
    const day = DATES.find(x => x.d === state.date), open = openSlots(day);
    const group = (title, list) => !list.length ? '' : `<p class="slot-group">${title}</p><div class="slots">${list.map(t => {
      const taken = day.taken.includes(t);
      return `<button type="button" data-t="${t}" aria-pressed="${t === state.time}" ${taken ? 'disabled' : ''} aria-label="${t}${taken ? ', sudah terisi' : ''}">${t}</button>`;
    }).join('')}</div>`;
    slotsEl.innerHTML = open.length
      ? group('Pagi', open.filter(t => t < '12.00')) + group('Siang', open.filter(t => t > '12.00'))
      : '<p class="help" style="margin-top:8px">Tidak ada slot</p>';
    onChange();
  }
  datesEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-d]'); if (!b || b.disabled) return;
    state.date = +b.dataset.d;
    if (DATES.find(x => x.d === state.date).taken.includes(state.time)) state.time = null;
    render();
  });
  slotsEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-t]'); if (!b || b.disabled) return;
    state.time = b.dataset.t; render();
  });
  render();
  return render;
}

// ---------- 1. Booking ----------
const booking = { svc: 'scaling', date: 17, time: '09.00' };
$('#services').innerHTML = SERVICES.map(s => `<button type="button" class="service" data-svc="${s.id}" aria-pressed="false">
  <span class="tick"><svg aria-hidden="true"><use href="#i-check"/></svg></span>
  <span class="grow"><b>${s.name}</b><small>${s.min} mnt${s.note ? ', ' + s.note : ''}</small></span>
  <span class="rp">${rp(s.price)}</span></button>`).join('');
function syncBooking() {
  $$('#services .service').forEach(b => b.setAttribute('aria-pressed', b.dataset.svc === booking.svc));
  const s = SERVICES.find(x => x.id === booking.svc), d = DATES.find(x => x.d === booking.date);
  $('#to-data').disabled = !booking.time;
  $('#booking-summary').textContent = booking.time
    ? `${s.name}: ${d.label}, ${booking.time} WIB`
    : 'Pilih jam.';
}
$('#services').addEventListener('click', e => {
  const b = e.target.closest('[data-svc]'); if (!b) return;
  booking.svc = b.dataset.svc; syncBooking();
});
const renderBooking = slotPicker($('#dates'), $('#slots-wrap'), booking, syncBooking);
$('#to-data').addEventListener('click', () => show('data'));

// ---------- 2. Data ----------
const RATNA = { nama: 'Ratna Dewi Anggraini', lahir: '1997-03-12', jk: 'P', wa: '0800-000-0001', email: '' };
function fillData(p) {
  $('#f-nama').value = p.nama; $('#f-lahir').value = p.lahir; $('#f-wa').value = p.wa; $('#f-email').value = p.email;
  $$('input[name="jk"]').forEach(r => (r.checked = r.value === p.jk));
}
fillData(RATNA);
$('#not-me').addEventListener('click', () => {
  fillData({ nama: '', lahir: '', jk: '', wa: '', email: '' });
  $('#prefill-banner').hidden = true; $('#f-nama').focus();
});
$('#data-form').addEventListener('submit', e => {
  e.preventDefault();
  const ok = $('#f-nama').value.trim() && $('#f-lahir').value && $('input[name="jk"]:checked') && $('#f-wa').value.replace(/\D/g, '').length >= 9;
  $('#data-err').hidden = !!ok;
  if (!ok) return;
  $('#otp-to').textContent = $('#f-wa').value;
  show('otp');
});

// ---------- 3. OTP (pola PIN kasir). Kode tidak disimpan & tidak di-log. ----------
const otpInputs = $$('#otp input');
const otpBtn = $('#otp-verify');
otpInputs.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '').slice(-1);
    if (inp.value && otpInputs[i + 1]) otpInputs[i + 1].focus();
    otpBtn.disabled = !otpInputs.every(p => p.value);
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && otpInputs[i - 1]) otpInputs[i - 1].focus(); });
  inp.addEventListener('paste', e => {
    const digits = (e.clipboardData.getData('text').match(/\d/g) || []).slice(0, 6);
    if (!digits.length) return;
    e.preventDefault();
    digits.forEach((d, k) => otpInputs[k] && (otpInputs[k].value = d));
    otpBtn.disabled = !otpInputs.every(p => p.value);
  });
});
otpBtn.addEventListener('click', () => {
  otpInputs.forEach(p => (p.value = '')); otpBtn.disabled = true;
  const s = SERVICES.find(x => x.id === booking.svc), d = DATES.find(x => x.d === booking.date);
  $('#bok-name').textContent = $('#f-nama').value;
  $('#bok-svc').textContent = `${s.name} (${s.min} mnt)`;
  $('#bok-date').textContent = d.label;
  $('#bok-time').textContent = booking.time + ' WIB';
  $('#bok-price').textContent = rp(s.price);
  show('booking-ok');
});

// ---------- 5. Kiosk check-in ----------
$('#kiosk-idle').addEventListener('click', () => {
  $('#kiosk-idle').hidden = true; $('#kiosk-active').hidden = false; $('#kode-err').hidden = true; $('#kode').focus();
});
function checkin() {
  const ok = $('#kode').value.toUpperCase().replace(/\s/g, '') === 'SS-17-R4T';
  $('#kode-err').hidden = ok;
  if (ok) { $('#kode').value = ''; show('antrean'); }
}
$('#do-checkin').addEventListener('click', checkin);
$('#kode').addEventListener('keydown', e => { if (e.key === 'Enter') checkin(); });
$('#sim-scan').addEventListener('click', () => { $('#kode').value = 'SS-17-R4T'; checkin(); });
$('#kiosk-book').addEventListener('click', () => { booking.date = 17; booking.time = null; renderBooking(); show('booking'); });

// ---------- 8. QRIS ----------
let qrisFailed = false;
function startCountdown() {
  let left = 14 * 60 + 59;
  const el = $('#countdown');
  const tick = () => { el.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; left = Math.max(0, left - 1); };
  tick(); countdownTimer = setInterval(tick, 1000);
}
function setQrisFailed(f) {
  qrisFailed = f;
  $('#qris-pending').hidden = f; $('#qris-failed').hidden = !f;
  $('#qris-ok').hidden = f; $('#qris-new').hidden = !f;
  clearInterval(countdownTimer); if (!f) startCountdown();
}
$('#qris-ok').addEventListener('click', () => show('struk'));
$('#qris-new').addEventListener('click', () => { setQrisFailed(false); toast('QR baru dibuat (contoh).'); });

// ---------- 10. Kontrol ----------
const kontrol = { date: 18, time: '10.00' };
slotPicker($('#k-dates'), $('#k-slots-wrap'), kontrol, () => {
  $('#k-confirm').disabled = !kontrol.time;
  $('#k-summary').textContent = kontrol.time ? `${DATES.find(x => x.d === kontrol.date).label}, ${kontrol.time} WIB` : 'Pilih jam.';
});
$('#k-confirm').addEventListener('click', () => {
  $('#k-ok-date').textContent = DATES.find(x => x.d === kontrol.date).label;
  $('#k-ok-time').textContent = kontrol.time + ' WIB';
  $('#kontrol-form').hidden = true; $('#kontrol-ok').hidden = false; window.scrollTo(0, 0);
});
$('#k-change').addEventListener('click', () => { $('#kontrol-form').hidden = false; $('#kontrol-ok').hidden = true; });

// ---------- 12. Sudah dipakai ----------
$('#used-toggle').addEventListener('click', e => {
  const open = $('#used-summary').hidden;
  $('#used-summary').hidden = !open; e.currentTarget.setAttribute('aria-expanded', open);
});

// ---------- 13. FO pengecualian ----------
const FO = {
  siti: { name: 'Siti Marlina', inv: 'TG-2026-11014-005', amt: 150000 },
  alya: { name: 'Alya Rahmawati (dibayar orang tua)', inv: 'TG-2026-11014-003', amt: 300000 },
  fajar: { name: 'Fajar Pratama', inv: 'TG-2026-11014-002', amt: 400000 },
};
let payKey = null, payMethod = 'tunai', cashIn = 0;
function renderPay() {
  const due = FO[payKey].amt;
  $$('#pay-modal .tile').forEach(t => t.setAttribute('aria-pressed', t.dataset.method === payMethod));
  $('#pay-tunai').hidden = payMethod !== 'tunai'; $('#pay-edc').hidden = payMethod !== 'edc';
  const opts = [...new Set([due, Math.ceil(due / 100000) * 100000, Math.ceil(due / 50000) * 50000 + 50000, 500000, 1000000])].filter(v => v >= due).sort((a, b) => a - b).slice(0, 4);
  $('#cash-preset').innerHTML = opts.map(v => `<button type="button" data-v="${v}" aria-pressed="${v === cashIn}">${v === due ? 'Uang pas' : rp(v)}</button>`).join('');
  const ch = $('#change');
  ch.classList.toggle('short', cashIn < due);
  ch.firstElementChild.textContent = cashIn < due ? 'Kurang' : 'Kembalian';
  ch.lastElementChild.textContent = rp(Math.abs(cashIn - due));
  $('#pay-confirm').disabled = payMethod === 'tunai' && cashIn < due;
}
$('#screen-fo').addEventListener('click', e => {
  const p = e.target.closest('[data-pay]'), w = e.target.closest('[data-wa]');
  if (p) {
    payKey = p.dataset.pay; payMethod = 'tunai'; cashIn = FO[payKey].amt; $('#edc-ref').value = '';
    $('#pay-who').textContent = `${FO[payKey].name}, ${FO[payKey].inv}`;
    $('#pay-amt').textContent = rp(FO[payKey].amt);
    renderPay(); $('#pay-modal').hidden = false; $('#pay-modal .tile').focus();
  }
  if (w) toast(`Pratinjau WA ke 0800-000-0002 (contoh): "Tagihan Klinik Gigi Senyum Sehat ${rp(FO[w.dataset.wa].amt)}: [tautan]". Tidak dikirim.`);
});
$$('#pay-modal .tile').forEach(t => t.addEventListener('click', () => { payMethod = t.dataset.method; renderPay(); }));
$('#cash-preset').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { cashIn = +b.dataset.v; renderPay(); } });
$('#pay-confirm').addEventListener('click', () => {
  const row = $(`[data-row="${payKey}"]`);
  row.classList.add('done');
  row.querySelector('.amt .chip').className = 'chip chip-paid';
  row.querySelector('.amt .chip').textContent = 'lunas';
  row.querySelector('.row-cta').innerHTML = `<span class="muted small">Lunas ${payMethod === 'tunai' ? 'tunai' : 'EDC'}, Sari</span>`;
  $('#kpi-open').textContent = $$('#screen-fo .row:not(.done)').length;
  $('#pay-modal').hidden = true;
  toast(`${FO[payKey].name}: lunas ${rp(FO[payKey].amt)}, ${payMethod === 'tunai' ? 'tunai' : 'EDC'}.`);
});

// ---------- 14. Dokter: kasir ringkas ----------
let discPct = 0;
$('#disc').addEventListener('click', e => {
  const b = e.target.closest('[data-pct]'); if (!b) return;
  discPct = +b.dataset.pct;
  $$('#disc button').forEach(x => x.setAttribute('aria-pressed', x === b));
  const disc = Math.round(BUDI.subtotal * discPct / 100);
  $('#disc-line').hidden = $('#disc-reason-wrap').hidden = !discPct;
  $('#disc-pct').textContent = discPct + '%';
  $('#disc-amt').textContent = '−' + rp(disc);
  $('#doc-due').textContent = rp(budiDue(discPct));
});
console.assert(budiDue(15) === 480000, 'Diskon 15%: 800.000 - 120.000 - 200.000 = 480.000');
$('#send-bill').addEventListener('click', () => toast(`Tagihan ${rp(budiDue(discPct))} ke WA 0800-000-0000 (contoh). Tidak dikirim.`));
$('#to-fo').addEventListener('click', () => toast(`Tagihan ${rp(budiDue(discPct))} diserahkan ke FO.`));

// ---------- Rute awal ----------
// ?layar=tagihan, #tagihan, ?mode=kiosk, ?demo=qris|qris-gagal|kedaluwarsa|dipakai|kiosk|fo|dokter
const q = new URLSearchParams(location.search);
const DEMO = { qris: 'bayar-qris', 'qris-gagal': 'bayar-qris', kedaluwarsa: 'kedaluwarsa', dipakai: 'sudah-dipakai', kiosk: 'checkin', fo: 'fo', dokter: 'dokter', bayar: 'tagihan' };
if (q.get('demo') === 'qris-gagal') setQrisFailed(true);
if (MODES[q.get('mode')]) setMode(q.get('mode')); else setMode('pasien');
show(q.get('layar') || DEMO[q.get('demo')] || location.hash.slice(1) || MODES[mode][0]);
window.addEventListener('hashchange', () => show(location.hash.slice(1), false));
