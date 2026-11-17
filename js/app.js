/* ═══════════════════════════════════════════════════════════════
   Asistente Financiero – JS Modular v3.0
   CRUD + Aritmética en céntimos + Step Chart SVG + Simular compra
   ═══════════════════════════════════════════════════════════════ */

// ─── 1. PRECISIÓN MONETARIA ───
const Precision = {
  toCents(a)       { return Math.round(a * 100); },
  fromCents(c)     { return c / 100; },
  add(...amounts)  { return amounts.reduce((s, a) => s + Math.round(a * 100), 0) / 100; },
  subtract(a, b)   { return (Math.round(a * 100) - Math.round(b * 100)) / 100; },
  round(a)         { return Math.round(a * 100) / 100; },
};

// ─── 2. FORMATO ───
const Format = {
  soles(amount) {
    const abs = Math.abs(Precision.round(amount));
    const [intPart, decPart] = abs.toFixed(2).split('.');
    return `S/ ${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009')}.${decPart}`;
  },
  solesWithSign(amount) {
    return `${amount >= 0 ? '+' : '-'} ${Format.soles(amount)}`;
  },
  solesShort(amount) {
    const abs = Math.abs(Precision.round(amount));
    const sign = amount < 0 ? '-' : '';
    const intPart = Math.floor(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
    return `${sign}S/ ${intPart}`;
  },
  dayPad(d) { return String(d).padStart(2, '0'); },
};

// ─── 3. STORE REACTIVO ───
function createStore(init) {
  let state = structuredClone(init);
  const listeners = new Set();
  return {
    getState() { return state; },
    setState(fn) {
      state = structuredClone(typeof fn === 'function' ? fn(structuredClone(state)) : fn);
      listeners.forEach(cb => cb(state));
    },
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };
}

// ─── 4. DATOS INICIALES ───
const BASE_MOVEMENTS = [
  { id:1, day:5,  concept:'Servicios',                 type:'registered', amount:-150   },
  { id:2, day:10, concept:'Cuota',                     type:'registered', amount:-300   },
  { id:3, day:15, concept:'Alimentación y transporte', type:'estimated',  amount:-450   },
  { id:4, day:20, concept:'Ingreso esperado',          type:'pending',    amount: 1000  },
  { id:5, day:25, concept:'Compromiso',                type:'registered', amount:-700   },
];
const INITIAL_STATE = {
  saldoInicial:1200, horizonte:30, currentDay:1, activeTab:'resumen',
  movements: structuredClone(BASE_MOVEMENTS), simulations:[],
  editingId:null, deletingId:null, nextId:100,
};
const store = createStore(INITIAL_STATE);

// ─── 5. MOTOR DE CÁLCULO ───
const Engine = {
  computeDailyBalances(state) {
    const all = [...state.movements, ...state.simulations];
    const data = [];
    let balCents = Precision.toCents(state.saldoInicial);
    for (let d = 1; d <= state.horizonte; d++) {
      const dm = all.filter(m => m.day === d).sort((a,b) => a.amount - b.amount);
      let deltaCents = 0;
      dm.forEach(m => { deltaCents += Precision.toCents(m.amount); });
      balCents += deltaCents;
      data.push({ day:d, balance:Precision.fromCents(balCents), movements:dm, delta:Precision.fromCents(deltaCents) });
    }
    return data;
  },
  computeSummary(state) {
    const dd = Engine.computeDailyBalances(state);
    const all = [...state.movements, ...state.simulations];
    let minB = Infinity, minD = 1;
    dd.forEach(d => { if (d.balance < minB) { minB = d.balance; minD = d.day; } });
    const sumCents = (filter) => all.filter(filter).reduce((s,m) => s + Precision.toCents(m.amount), 0);
    return {
      dailyData:dd,
      projectionDay30: dd[dd.length-1].balance,
      minBalance:minB, minDay:minD,
      totalIncome:     Precision.fromCents(sumCents(m => m.amount > 0)),
      totalRegistered: Precision.fromCents(sumCents(m => m.type==='registered' && m.amount < 0)),
      totalEstimated:  Precision.fromCents(sumCents(m => m.type==='estimated'  && m.amount < 0)),
      saldoActual: state.saldoInicial, currentDay: state.currentDay,
    };
  },
};

// ─── 6. ICONOS SVG ───
const Icons = {
  home:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  payments:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  chart:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  help:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>`,
  calendar:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  shield:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  info:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  sparkle:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  plus:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  eye:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  refresh:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,
};

// ─── 7. HELPERS ───
function typeBadge(t) {
  const m = { registered:{l:'Pago registrado',c:'type-badge--registered'}, estimated:{l:'Gasto estimado',c:'type-badge--estimated'}, pending:{l:'Por confirmar',c:'type-badge--pending'}, simulated:{l:'Simulado',c:'type-badge--simulated'} };
  const v = m[t]||m.registered;
  return `<span class="type-badge ${v.c}">${v.l}</span>`;
}
function showToast(msg, dur=2500) {
  const t = document.getElementById('toast'); if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), dur);
}

// ─── 8. VISTA 1 — RESUMEN ───
function renderResumen(summary) {
  const { projectionDay30:p30, minBalance:minB, minDay:minD, totalIncome:tI, totalRegistered:tR, totalEstimated:tE, saldoActual:sA, currentDay:cD } = summary;
  const s = store.getState();
  const hasShort = minB < 0;
  const all = [...s.movements,...s.simulations];
  const incD = all.filter(m=>m.amount>0).map(m=>`${m.concept} (Día ${m.day})`).join(', ')||'Ninguno';
  const regD = all.filter(m=>m.type==='registered'&&m.amount<0).map(m=>m.concept).join(', ')||'Ninguno';
  const estD = all.filter(m=>m.type==='estimated'&&m.amount<0).map(m=>m.concept).join(', ')||'Ninguno';
  const statusTxt = hasShort
    ? `<strong>Posible faltante de ${Format.soles(Math.abs(minB))}</strong> desde el día ${minD}. Revisa tus compromisos o simula ajustes.`
    : `<strong>Sin faltantes en el escenario base.</strong> El saldo mínimo se alcanza desde el día ${minD}.`;
  return `
    <div class="balance-card"><div class="balance-card__label">Saldo actual</div><div class="balance-card__amount">${Format.soles(sA)}</div><div class="balance-card__date">Fecha de referencia: día ${cD}</div></div>
    <div class="projection-summary"><div class="projection-summary__item"><div class="projection-summary__label">Proyección al día 30</div><div class="projection-summary__value" style="color:${p30>=0?'var(--color-primary)':'var(--color-alert-accent)'}">${Format.soles(p30)}</div></div><div class="projection-summary__item"><div class="projection-summary__label">Saldo mínimo</div><div class="projection-summary__value" style="color:${minB>=0?'var(--color-text-primary)':'var(--color-alert-accent)'}">${Format.soles(minB)}</div><div class="projection-summary__detail">Desde el día ${minD}</div></div></div>
    <div class="section-title"><span class="section-title__icon">${Icons.calendar}</span>Plan de los próximos 30 días</div>
    <div class="plan-list">
      <div class="plan-row"><div class="plan-row__icon plan-row__icon--income">↑</div><div class="plan-row__info"><div class="plan-row__name">Ingreso esperado</div><div class="plan-row__detail">${incD}</div></div><div class="plan-row__amount plan-row__amount--positive">${Format.solesWithSign(tI)}</div></div>
      <div class="plan-row"><div class="plan-row__icon plan-row__icon--expense">↓</div><div class="plan-row__info"><div class="plan-row__name">Pagos registrados</div><div class="plan-row__detail">${regD}</div></div><div class="plan-row__amount plan-row__amount--negative">${Format.solesWithSign(tR)}</div></div>
      <div class="plan-row"><div class="plan-row__icon plan-row__icon--estimated">~</div><div class="plan-row__info"><div class="plan-row__name">Gastos estimados</div><div class="plan-row__detail">${estD}</div></div><div class="plan-row__amount plan-row__amount--estimated">${Format.solesWithSign(tE)}</div></div>
    </div>
    <div class="status-box ${hasShort?'status-box--alert':'status-box--ok'}"><span class="status-box__icon">${hasShort?Icons.warning:Icons.shield}</span><span class="status-box__text">${statusTxt}</span></div>
    <div class="btn-group"><button class="btn btn--primary" onclick="App.openSimModal()">${Icons.plus} Simular un gasto</button><button class="btn btn--outline" onclick="App.navigateTo('proyeccion')">${Icons.eye} Ver proyección</button></div>
    <div class="footnote">Los resultados dependen de los datos y supuestos ingresados.<br>Revisa tus compromisos si cambia tu planificación.</div>`;
}

// ─── 9. VISTA 2 — PAGOS ───
function renderPagos(summary) {
  const s = store.getState();
  const regPay = s.movements.filter(m=>m.type==='registered'&&m.amount<0);
  const totalReg = Math.abs(Precision.fromCents(regPay.reduce((a,m)=>a+Precision.toCents(m.amount),0)));
  const sorted = [...s.movements].sort((a,b)=>a.day-b.day||a.id-b.id);
  const cards = sorted.map(m => {
    if (s.deletingId===m.id) return `<div class="delete-confirm"><span class="delete-confirm__text">¿Eliminar «${m.concept}» del día ${m.day}?</span><button class="delete-confirm__btn delete-confirm__btn--yes" onclick="App.executeDelete(${m.id})">Sí</button><button class="delete-confirm__btn delete-confirm__btn--no" onclick="App.cancelDelete()">No</button></div>`;
    const ac = m.amount>=0?'movement-card__amount--positive':(m.type==='estimated'?'movement-card__amount--estimated':'movement-card__amount--negative');
    return `<div class="movement-card"><div class="movement-card__day movement-card__day--${m.type}"><span class="movement-card__day-num">${Format.dayPad(m.day)}</span><span class="movement-card__day-label">DÍA</span></div><div class="movement-card__body"><div class="movement-card__concept">${m.concept}</div><div class="movement-card__meta">${typeBadge(m.type)}</div></div><div class="movement-card__right"><div class="movement-card__amount ${ac}">${Format.solesWithSign(m.amount)}</div><div class="movement-card__actions"><button class="btn-icon" onclick="App.openCrudModal(${m.id})" title="Editar">${Icons.edit}</button><button class="btn-icon btn-icon--danger" onclick="App.confirmDelete(${m.id})" title="Eliminar">${Icons.trash}</button></div></div></div>`;
  }).join('');
  let simSec='';
  if(s.simulations.length>0){
    simSec=`<div class="section-title" style="margin-top:var(--space-2xl)"><span class="section-title__icon">${Icons.sparkle}</span>Simulaciones activas</div>`+s.simulations.map(m=>{const ac2=m.amount>=0?'movement-card__amount--positive':'movement-card__amount--negative';return `<div class="movement-card" style="opacity:.75"><div class="movement-card__day movement-card__day--simulated"><span class="movement-card__day-num">${Format.dayPad(m.day)}</span><span class="movement-card__day-label">DÍA</span></div><div class="movement-card__body"><div class="movement-card__concept">${m.concept}</div><div class="movement-card__meta">${typeBadge('simulated')}</div></div><div class="movement-card__right"><div class="movement-card__amount ${ac2}">${Format.solesWithSign(m.amount)}</div></div></div>`;}).join('');
  }
  return `
    <div class="pagos-header"><div><div class="pagos-header__label">Pagos registrados</div><div class="pagos-header__amount">${Format.soles(totalReg)}</div></div><div class="pagos-header__counter"><span class="pagos-header__counter-num">${regPay.length}</span><span class="pagos-header__counter-label">compromiso${regPay.length!==1?'s':''}</span></div></div>
    <div class="section-title"><span class="section-title__icon">${Icons.calendar}</span>Movimientos previstos</div><p style="font-size:.7rem;color:var(--color-text-muted);margin:-8px 0 var(--space-lg)">Próximos 30 días · Datos simulados</p>
    <div class="movements-list">${sorted.length?cards:'<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__text">No hay movimientos registrados.</div></div>'}</div>
    ${simSec}
    <div class="projection-summary" style="margin-top:var(--space-2xl)"><div class="projection-summary__item"><div class="projection-summary__label">Total ingresos</div><div class="projection-summary__value" style="color:var(--color-primary)">${Format.solesWithSign(summary.totalIncome)}</div></div><div class="projection-summary__item"><div class="projection-summary__label">Total egresos</div><div class="projection-summary__value" style="color:#DC2626">${Format.solesWithSign(Precision.add(summary.totalRegistered,summary.totalEstimated))}</div></div></div>
    <div class="btn-group"><button class="btn btn--primary" onclick="App.openCrudModal()">${Icons.plus} Registrar compromiso</button></div>
    <div style="text-align:center;margin-top:var(--space-xl)"><button class="btn-reset" onclick="App.resetToBase()">${Icons.refresh} Restablecer escenario base</button></div>
    <div class="footnote">Edita o elimina movimientos para ver el impacto en la proyección en tiempo real.</div>`;
}


// ═══════════════════════════════════════════════════════════════
// 10. STEP CHART SVG — Gráfico escalonado interactivo
// ═══════════════════════════════════════════════════════════════
function generateStepChartSVG(dailyData, summary) {
  const W = 380, H = 230;
  const pad = { t:28, r:12, b:32, l:55 };
  const cW = W-pad.l-pad.r, cH = H-pad.t-pad.b;

  const bals = dailyData.map(d => d.balance);
  const dMin = Math.min(...bals);
  const dMax = Math.max(...bals);
  const minY = Math.min(-300, Math.floor(dMin/100)*100 - 100);
  const maxY = Math.max(1500, Math.ceil(dMax/100)*100 + 100);
  const rY = maxY - minY;

  const fx = d => +(pad.l + ((d-1)/29)*cW).toFixed(1);
  const fy = v => +(pad.t + ((maxY-v)/rY)*cH).toFixed(1);

  // Change points
  const ch = [{ day:1, balance:bals[0] }];
  for (let i=1; i<30; i++) {
    if (bals[i] !== bals[i-1]) ch.push({ day:i+1, balance:bals[i], prev:bals[i-1] });
  }

  // Step path
  let sp = `M${fx(1)},${fy(ch[0].balance)}`;
  for (let i=1; i<ch.length; i++) {
    sp += ` L${fx(ch[i].day)},${fy(ch[i].prev)} L${fx(ch[i].day)},${fy(ch[i].balance)}`;
  }
  sp += ` L${fx(30)},${fy(ch[ch.length-1].balance)}`;

  // Fill path
  const fp = sp + ` L${fx(30)},${fy(minY)} L${fx(1)},${fy(minY)} Z`;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="step-chart" role="img" aria-label="Gráfico escalonado de proyección de saldo a 30 días">`;
  svg += `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0B6E4F" stop-opacity=".15"/><stop offset="100%" stop-color="#0B6E4F" stop-opacity=".02"/></linearGradient></defs>`;

  // Grid + Y labels
  const gStep = rY <= 1800 ? 300 : 500;
  for (let v = Math.ceil(minY/gStep)*gStep; v <= maxY; v += gStep) {
    const yy = fy(v);
    const isZ = v===0;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}" stroke="${isZ?'#EF444430':'#E5E9EC'}" stroke-width="${isZ?1:.5}" ${isZ?'stroke-dasharray="4,3"':''}/>`;
    svg += `<text x="${pad.l-8}" y="${+yy+3}" text-anchor="end" fill="#8896A6" font-size="8.5" font-family="system-ui">${v}</text>`;
  }

  // X labels
  [1,5,10,15,20,25,30].forEach(d => {
    svg += `<text x="${fx(d)}" y="${H-pad.b+15}" text-anchor="middle" fill="#8896A6" font-size="8.5" font-family="system-ui">D${d}</text>`;
    svg += `<line x1="${fx(d)}" y1="${fy(minY)}" x2="${fx(d)}" y2="${+fy(minY)+3}" stroke="#CCC" stroke-width=".5"/>`;
  });

  // Fill + line
  svg += `<path d="${fp}" fill="url(#sg)"/>`;
  svg += `<path d="${sp}" stroke="#0B6E4F" stroke-width="2.5" fill="none" stroke-linejoin="miter" stroke-linecap="round"/>`;

  // Points + labels
  ch.forEach((c,i) => {
    const cx = fx(c.day), cy = fy(c.balance);
    const isMin = c.day === summary.minDay;
    const wentUp = i>0 && c.balance > c.prev;

    const r = isMin ? 5 : 3.5;
    const fill = isMin ? '#EF4444' : '#0B6E4F';
    svg += `<circle class="data-point ${isMin?'data-point--min':''}" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="1.5"><title>Día ${c.day}: ${Format.soles(c.balance)}</title></circle>`;

    const lColor = isMin ? '#DC2626' : '#1A2332';
    const lWeight = isMin ? 'bold' : '600';
    const lSize = isMin ? '9.5' : '8';
    const lY = isMin ? (+cy+15) : wentUp ? (+cy-9) : (+cy-9);
    const lAnchor = i===0 ? 'start' : 'middle';
    svg += `<text x="${cx}" y="${lY}" text-anchor="${lAnchor}" fill="${lColor}" font-size="${lSize}" font-weight="${lWeight}" font-family="system-ui">${Format.solesShort(c.balance)}</text>`;
  });

  // End point if different from last change
  const last = ch[ch.length-1];
  if (last.day !== 30) {
    svg += `<circle class="data-point" cx="${fx(30)}" cy="${fy(last.balance)}" r="3" fill="#0B6E4F" stroke="#fff" stroke-width="1.5"><title>Día 30: ${Format.soles(last.balance)}</title></circle>`;
  }

  svg += `</svg>`;
  return svg;
}


// ═══════════════════════════════════════════════════════════════
// 11. VISTA 3 — PROYECCIÓN
// ═══════════════════════════════════════════════════════════════
function renderProyeccion(summary) {
  const state = store.getState();
  const { dailyData:dd, minDay, minBalance, projectionDay30 } = summary;

  // Chart SVG
  const chartSVG = generateStepChartSVG(dd, summary);

  // Accessible table rows
  const keyDays = new Set([1]);
  dd.forEach(d => { if(d.movements.length>0) keyDays.add(d.day); });
  keyDays.add(30);
  const sorted = Array.from(keyDays).sort((a,b)=>a-b);

  const tRows = sorted.map(dn => {
    const d = dd[dn-1];
    const isMin = dn===minDay;
    const desc = d.movements.length ? d.movements.map(m=>m.concept).join(', ') : (dn===1?'Saldo inicial':'(Sin cambios)');
    const deltaS = d.delta!==0 ? Format.solesWithSign(d.delta) : '—';
    return `<tr class="${d.movements.length?'has-movement':''} ${isMin?'min-row':''}"><td>Día ${d.day}</td><td>${desc}</td><td style="color:${d.delta>0?'var(--color-primary)':d.delta<0?'#DC2626':'var(--color-text-muted)'}">${deltaS}</td><td style="font-weight:700;color:${d.balance<0?'var(--color-alert-accent)':'var(--color-text-primary)'}">${Format.soles(d.balance)}</td></tr>`;
  }).join('');

  // Min range text
  let minUntil = minDay;
  for (let i = minDay; i < dd.length; i++) {
    if (dd[i].balance > minBalance) { minUntil = dd[i].day; break; }
    minUntil = dd[i].day;
  }
  // Find recovery event
  let recoveryText = '';
  for (let i = minDay; i < dd.length; i++) {
    if (dd[i].balance > minBalance && dd[i].movements.length > 0) {
      const inc = dd[i].movements.filter(m=>m.amount>0);
      if (inc.length) recoveryText = `hasta antes del ingreso del día ${dd[i].day}`;
      else recoveryText = `hasta el día ${minUntil}`;
      break;
    }
  }
  if (!recoveryText) recoveryText = `hasta el día 30`;

  // Formula
  const tI = summary.totalIncome;
  const tR = Math.abs(summary.totalRegistered);
  const tE = Math.abs(summary.totalEstimated);
  const formulaResult = summary.projectionDay30;

  return `
    <div class="section-title" style="margin-top:0"><span class="section-title__icon">${Icons.chart}</span>Proyección del saldo</div>
    <p style="font-size:.7rem;color:var(--color-text-muted);margin:-8px 0 var(--space-lg)">Escenario base · Datos simulados</p>

    <div class="balance-card" style="padding:var(--space-xl) var(--space-2xl)">
      <div class="balance-card__label">Saldo proyectado al día 30</div>
      <div class="balance-card__amount">${Format.soles(projectionDay30)}</div>
    </div>

    <div class="section-title">Evolución durante 30 días</div>
    <p style="font-size:.65rem;color:var(--color-text-muted);margin:-8px 0 var(--space-sm)">Saldo en soles · Cambios al cierre de cada día</p>
    <div class="step-chart-wrapper">${chartSVG}</div>

    <details class="collapsible">
      <summary>📋 Ver tabla de fechas y saldos</summary>
      <div class="collapsible__content">
        <table class="daily-table" aria-label="Tabla de saldos por fecha"><thead><tr><th>Día</th><th>Evento</th><th>Mov.</th><th>Saldo</th></tr></thead><tbody>${tRows}</tbody></table>
      </div>
    </details>

    <div class="status-box ${minBalance>=0?'status-box--ok':'status-box--alert'}" style="margin-top:var(--space-lg)">
      <span class="status-box__icon">${minBalance>=0?Icons.info:Icons.warning}</span>
      <span class="status-box__text"><strong>Saldo mínimo: ${Format.soles(minBalance)}</strong> (Desde el día ${minDay} ${recoveryText}).</span>
    </div>

    <div class="formula-block">
      <div class="formula-block__title">${Icons.info} Datos utilizados</div>
      <div class="formula-block__equation">
        <span class="formula-block__term">${Format.soles(state.saldoInicial)}</span><span class="formula-block__label">saldo inicial</span>
        <span class="formula-block__op">+</span>
        <span class="formula-block__term">${Format.soles(tI)}</span><span class="formula-block__label">ingreso esperado</span>
        <span class="formula-block__op">−</span>
        <span class="formula-block__term">${Format.soles(tR)}</span><span class="formula-block__label">pagos registrados</span>
        <span class="formula-block__op">−</span>
        <span class="formula-block__term">${Format.soles(tE)}</span><span class="formula-block__label">gasto estimado</span>
        <span class="formula-block__op">=</span>
        <span class="formula-block__term formula-block__term--result">${Format.soles(formulaResult)}</span>
      </div>
    </div>

    <div class="btn-group"><button class="btn btn--primary" onclick="App.openCompraModal()">${Icons.sparkle} Simular una compra</button></div>
    <div class="footnote">Los valores se recalculan automáticamente al modificar movimientos en la pestaña Pagos.</div>`;
}


// ═══════════════════════════════════════════════════════════════
// 12. LÓGICA DE SIMULACIÓN DE COMPRA (PF02 / PF03)
// ═══════════════════════════════════════════════════════════════

/** Encuentra el mejor día para realizar una compra sin causar faltante. */
function findBestPurchaseDay(state, purchaseAmount) {
  let bestDay = 1, bestMin = -Infinity;
  for (let d = 1; d <= 30; d++) {
    const tmp = structuredClone(state);
    tmp.simulations.push({ id:99999, day:d, concept:'Compra', type:'simulated', amount:-Precision.fromCents(Precision.toCents(purchaseAmount)) });
    const s = Engine.computeSummary(tmp);
    if (s.minBalance > bestMin) { bestMin = s.minBalance; bestDay = d; }
  }
  return { bestDay, bestMinBalance: bestMin };
}

/** Genera la explicación paso a paso del impacto de la compra. */
function buildCompraExplanation(state, amount, day) {
  const simState = structuredClone(state);
  simState.simulations.push({ id:99999, day, concept:'Compra simulada', type:'simulated', amount:-Precision.fromCents(Precision.toCents(amount)) });
  const simDaily = Engine.computeDailyBalances(simState);
  const origDaily = Engine.computeDailyBalances(state);

  const events = [];
  for (let i = 0; i < simDaily.length; i++) {
    const d = simDaily[i];
    if (d.movements.length > 0) {
      events.push({
        day: d.day,
        balance: d.balance,
        origBalance: origDaily[i].balance,
        movements: d.movements,
        isAlert: d.balance < 0,
        isPurchase: d.day === day,
      });
    }
  }
  return events;
}


// ─── 13. VISTA 4 — AYUDA ───
function renderAyuda() {
  return `
    <div class="section-title"><span class="section-title__icon">${Icons.sparkle}</span>Centro de ayuda</div>
    <div class="help-card"><div class="help-card__icon">📊</div><div class="help-card__title">¿Cómo funciona el asistente?</div><div class="help-card__text">Este asistente proyecta tu saldo día a día durante 30 días, considerando tus pagos registrados, gastos estimados e ingresos esperados. Identifica posibles faltantes de liquidez y te permite simular escenarios.</div></div>
    <div class="help-card"><div class="help-card__icon">🤖</div><div class="help-card__title">Gastos estimados (ML)</div><div class="help-card__text">Los gastos marcados como "Gasto estimado" se calculan mediante un modelo de Machine Learning que analiza patrones de consumo históricos. En esta propuesta académica se usan datos simulados.</div></div>
    <div class="help-card"><div class="help-card__icon">🧪</div><div class="help-card__title">Simulaciones</div><div class="help-card__text">Usa el botón "Simular un gasto" o "Simular una compra" para agregar movimientos hipotéticos y ver cómo impactan tu proyección sin modificar los datos reales.</div></div>
    <div class="help-card"><div class="help-card__icon">✏️</div><div class="help-card__title">Editar y eliminar</div><div class="help-card__text">En la pestaña "Pagos" puedes editar o eliminar cualquier movimiento. Los cambios recalculan automáticamente toda la proyección. Usa "Restablecer escenario base" para volver a los datos originales.</div></div>
    <div class="help-card"><div class="help-card__icon">⚠️</div><div class="help-card__title">Datos simulados</div><div class="help-card__text">Esta es una propuesta académica con datos ficticios. En un entorno productivo, los datos se obtendrían de APIs bancarias reales con autenticación segura (Open Banking).</div></div>
    <div class="status-box status-box--ok" style="margin-top:var(--space-lg)"><span class="status-box__icon">${Icons.info}</span><span class="status-box__text"><strong>Propuesta académica.</strong> Los montos y proyecciones son illustrativos. No constituyen asesoría financiera.</span></div>
    <div class="footnote">Asistente financiero v3.0 · Proyecto de innovación y transformación digital.</div>`;
}


// ═══════════════════════════════════════════════════════════════
// 14. CONTROLADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════
const App = {
  init() {
    store.subscribe(() => App.render());
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', () => App.navigateTo(i.dataset.tab)));
    App.render();
  },
  navigateTo(tab) { store.setState(s => ({...s, activeTab:tab, deletingId:null})); },
  render() {
    const state = store.getState();
    const summary = Engine.computeSummary(state);
    const views = { resumen:renderResumen, pagos:renderPagos, proyeccion:renderProyeccion, ayuda:renderAyuda };
    Object.entries(views).forEach(([n,fn]) => {
      const el = document.getElementById(`view-${n}`);
      if (!el) return;
      if (n===state.activeTab) { el.innerHTML = fn(summary); el.classList.add('active'); }
      else { el.classList.remove('active'); el.innerHTML = ''; }
    });
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.tab===state.activeTab));
  },

  // ── CRUD (Pagos) ──
  openCrudModal(editId) {
    const modal = document.getElementById('crudModal');
    App._clearCrudErrors();
    if (typeof editId==='number') {
      const m = store.getState().movements.find(x=>x.id===editId); if(!m) return;
      store.setState(s=>({...s,editingId:editId}));
      document.getElementById('crudModalTitle').textContent='Editar compromiso';
      document.getElementById('crudBtnSave').textContent='Guardar cambios';
      document.getElementById('crudConcept').value=m.concept;
      document.getElementById('crudDay').value=m.day;
      document.getElementById('crudAmount').value=Math.abs(m.amount).toFixed(2);
      document.getElementById('crudType').value=m.amount>=0?'pending':m.type;
    } else {
      store.setState(s=>({...s,editingId:null}));
      document.getElementById('crudModalTitle').textContent='Registrar compromiso';
      document.getElementById('crudBtnSave').textContent='Registrar';
      document.getElementById('crudConcept').value='';
      document.getElementById('crudDay').value='';
      document.getElementById('crudAmount').value='';
      document.getElementById('crudType').value='registered';
    }
    modal.classList.add('open');
    setTimeout(()=>document.getElementById('crudConcept').focus(),100);
  },
  closeCrudModal() { document.getElementById('crudModal').classList.remove('open'); store.setState(s=>({...s,editingId:null})); App._clearCrudErrors(); },
  _clearCrudErrors() {
    ['crudConceptError','crudAmountError','crudDayError'].forEach(id=>{const e=document.getElementById(id);if(e){e.classList.remove('visible');e.textContent='';}});
    ['crudConcept','crudAmount','crudDay','crudType'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.remove('form-input--error','form-select--error');});
  },
  _validateCrudForm() {
    let ok=true;
    const c=document.getElementById('crudConcept').value.trim();
    const cE=document.getElementById('crudConceptError'),cI=document.getElementById('crudConcept');
    if(!c){cE.textContent='El concepto es obligatorio.';cE.classList.add('visible');cI.classList.add('form-input--error');ok=false;}else{cE.classList.remove('visible');cI.classList.remove('form-input--error');}
    const aR=document.getElementById('crudAmount').value,a=parseFloat(aR);
    const aE=document.getElementById('crudAmountError'),aI=document.getElementById('crudAmount');
    if(aR.trim()===''||isNaN(a)||a<=0){aE.textContent='El monto debe ser mayor a S/ 0.00.';aE.classList.add('visible');aI.classList.add('form-input--error');ok=false;}else{aE.classList.remove('visible');aI.classList.remove('form-input--error');}
    const dR=document.getElementById('crudDay').value,d=parseFloat(dR);
    const dE=document.getElementById('crudDayError'),dI=document.getElementById('crudDay');
    if(dR.trim()===''||isNaN(d)||!Number.isInteger(d)||d<1||d>30){dE.textContent='Debe ser un número entero entre 1 y 30.';dE.classList.add('visible');dI.classList.add('form-input--error');ok=false;}else{dE.classList.remove('visible');dI.classList.remove('form-input--error');}
    return ok;
  },
  saveCrud() {
    if(!App._validateCrudForm()) return;
    const concept=document.getElementById('crudConcept').value.trim();
    const type=document.getElementById('crudType').value;
    const day=parseInt(document.getElementById('crudDay').value,10);
    const raw=parseFloat(document.getElementById('crudAmount').value);
    const precise=Precision.fromCents(Precision.toCents(raw));
    const signed=type==='pending'?precise:-precise;
    const st=store.getState();
    if(st.editingId!==null){
      store.setState(s=>{const i=s.movements.findIndex(m=>m.id===s.editingId);if(i!==-1)s.movements[i]={...s.movements[i],concept,type,day,amount:signed};s.editingId=null;return s;});
      showToast('✓ Compromiso actualizado');
    }else{
      store.setState(s=>{s.movements.push({id:s.nextId++,day,concept,type,amount:signed});return s;});
      showToast('✓ Compromiso registrado');
    }
    App.closeCrudModal();
  },
  confirmDelete(id){store.setState(s=>({...s,deletingId:id}));},
  cancelDelete(){store.setState(s=>({...s,deletingId:null}));},
  executeDelete(id){store.setState(s=>{s.movements=s.movements.filter(m=>m.id!==id);s.deletingId=null;return s;});showToast('✓ Compromiso eliminado');},
  resetToBase(){store.setState(s=>({...s,movements:structuredClone(BASE_MOVEMENTS),simulations:[],deletingId:null,editingId:null,nextId:100}));showToast('✓ Escenario base restablecido');},

  // ── Simulación rápida (Resumen) ──
  openSimModal(){
    document.getElementById('simModal').classList.add('open');
    document.getElementById('simAmount').value='';document.getElementById('simDay').value='15';
    document.getElementById('simConcept').value='';document.getElementById('simType').value='expense';
    const r=document.querySelector('.sim-result');if(r)r.classList.remove('visible');
  },
  closeSimModal(){document.getElementById('simModal').classList.remove('open');},
  previewSimulation(){
    const a=parseFloat(document.getElementById('simAmount').value),d=parseInt(document.getElementById('simDay').value,10);
    const c=document.getElementById('simConcept').value.trim()||'Gasto simulado',t=document.getElementById('simType').value;
    if(isNaN(a)||a<=0||isNaN(d)||d<1||d>30)return;
    const signed=t==='income'?Precision.fromCents(Precision.toCents(a)):-Precision.fromCents(Precision.toCents(a));
    const tmp=structuredClone(store.getState());tmp.simulations.push({id:Date.now(),day:d,concept:c,type:t==='income'?'pending':'simulated',amount:signed});
    const pv=Engine.computeSummary(tmp),cur=Engine.computeSummary(store.getState());
    const r=document.querySelector('.sim-result');
    r.innerHTML=`<div class="sim-result__row"><span class="sim-result__label">Proyección actual</span><span class="sim-result__value">${Format.soles(cur.projectionDay30)}</span></div><div class="sim-result__row"><span class="sim-result__label">Con simulación</span><span class="sim-result__value" style="color:${pv.projectionDay30>=0?'var(--color-primary)':'var(--color-alert-accent)'}">${Format.soles(pv.projectionDay30)}</span></div><div class="sim-result__row"><span class="sim-result__label">Nuevo saldo mínimo</span><span class="sim-result__value" style="color:${pv.minBalance>=0?'var(--color-text-primary)':'var(--color-alert-accent)'}">${Format.soles(pv.minBalance)} (día ${pv.minDay})</span></div>`;
    r.classList.add('visible');
  },
  confirmSimulation(){
    const a=parseFloat(document.getElementById('simAmount').value),d=parseInt(document.getElementById('simDay').value,10);
    const c=document.getElementById('simConcept').value.trim()||'Gasto simulado',t=document.getElementById('simType').value;
    if(isNaN(a)||a<=0||isNaN(d)||d<1||d>30)return;
    const signed=t==='income'?Precision.fromCents(Precision.toCents(a)):-Precision.fromCents(Precision.toCents(a));
    store.setState(s=>{s.simulations.push({id:Date.now(),day:d,concept:c,type:t==='income'?'pending':'simulated',amount:signed});return s;});
    App.closeSimModal();showToast('✓ Simulación agregada');
  },

  // ══════════════════════════════════════════════════════
  // SIMULAR UNA COMPRA (PF02 / PF03)
  // ══════════════════════════════════════════════════════
  openCompraModal() {
    const modal = document.getElementById('compraModal');
    document.getElementById('compraAmount').value = '450.00';
    document.getElementById('compraDay').value = '12';
    document.getElementById('compraResults').classList.remove('visible');
    document.getElementById('compraResults').innerHTML = '';
    modal.classList.add('open');
  },

  closeCompraModal() {
    // PF03: cierra sin guardar nada — el state nunca fue modificado
    document.getElementById('compraModal').classList.remove('open');
    document.getElementById('compraResults').classList.remove('visible');
    document.getElementById('compraResults').innerHTML = '';
  },

  calculateCompra() {
    const rawA = parseFloat(document.getElementById('compraAmount').value);
    const rawD = parseInt(document.getElementById('compraDay').value, 10);
    if (isNaN(rawA) || rawA <= 0 || isNaN(rawD) || rawD < 1 || rawD > 30) return;

    const amount = Precision.fromCents(Precision.toCents(rawA));
    const day = rawD;
    const state = store.getState();

    // Original scenario
    const origSummary = Engine.computeSummary(state);

    // Simulated scenario (temporary — NOT stored in state)
    const simState = structuredClone(state);
    simState.simulations.push({ id:99999, day, concept:'Compra simulada', type:'simulated', amount:-amount });
    const simSummary = Engine.computeSummary(simState);

    const hasShortfall = simSummary.minBalance < 0;
    const shortfallAmount = Math.abs(simSummary.minBalance);

    // ── Alert card ──
    let alertHTML;
    if (hasShortfall) {
      alertHTML = `<div class="compra-alert compra-alert--warning">
        <div class="compra-alert__title">Posible faltante · Día ${simSummary.minDay}</div>
        <div class="compra-alert__amount">${Format.soles(shortfallAmount)}</div>
        <div class="compra-alert__subtitle">Saldo mínimo proyectado: -${Format.soles(shortfallAmount)}</div>
      </div>`;
    } else {
      alertHTML = `<div class="compra-alert compra-alert--ok">
        <div class="compra-alert__title">Sin faltantes detectados</div>
        <div class="compra-alert__amount">${Format.soles(simSummary.minBalance)}</div>
        <div class="compra-alert__subtitle">Saldo mínimo proyectado: ${Format.soles(simSummary.minBalance)}</div>
      </div>`;
    }

    // ── Comparison table ──
    const origMinCls = origSummary.minBalance < 0 ? 'val-negative' : 'val-neutral';
    const simMinCls  = simSummary.minBalance  < 0 ? 'val-negative' : 'val-positive';
    const origD30Cls = origSummary.projectionDay30 < 0 ? 'val-negative' : 'val-neutral';
    const simD30Cls  = simSummary.projectionDay30  < 0 ? 'val-negative' : 'val-positive';

    const tableHTML = `<table class="comparison-table" aria-label="Comparación de escenarios">
      <thead><tr><th>Indicador</th><th>Original</th><th>Con compra</th></tr></thead>
      <tbody>
        <tr><td>Saldo mínimo</td><td class="${origMinCls}">${Format.soles(origSummary.minBalance)}</td><td class="${simMinCls}">${simSummary.minBalance < 0 ? '-' : ''}${Format.soles(simSummary.minBalance)}</td></tr>
        <tr><td>Saldo al día 30</td><td class="${origD30Cls}">${Format.soles(origSummary.projectionDay30)}</td><td class="${simD30Cls}">${Format.soles(simSummary.projectionDay30)}</td></tr>
      </tbody>
    </table>`;

    // ── Key message ──
    let messageHTML = '';
    if (hasShortfall && simSummary.projectionDay30 >= 0) {
      messageHTML = `<div class="key-message"><span class="key-message__icon">⚡</span><span>Un saldo final positivo puede ocultar un faltante antes del siguiente ingreso.</span></div>`;
    }

    // ── Explanation (collapsible) ──
    const events = buildCompraExplanation(state, amount, day);
    const stepsHTML = events.map((ev, idx) => {
      let cls = '';
      if (ev.isAlert) cls = ' explanation-step--alert';
      else if (ev.isPurchase) cls = ' explanation-step--purchase';

      const movDesc = ev.movements.map(m => {
        const sign = m.amount >= 0 ? '+' : '';
        return `${m.concept} (${sign}${Format.soles(m.amount)})`;
      }).join(' · ');

      return `<div class="explanation-step${cls}">
        <div class="explanation-step__num">${idx+1}</div>
        <div class="explanation-step__text">
          <strong>Día ${ev.day}</strong> — ${movDesc}<br>
          Saldo: <strong style="color:${ev.balance<0?'#DC2626':'var(--color-text-primary)'}">${Format.soles(ev.balance)}</strong>${ev.isAlert?' ⚠️ Faltante':''}
        </div>
      </div>`;
    }).join('');

    // Recommendation
    const best = findBestPurchaseDay(state, amount);
    let recoHTML = '';
    if (hasShortfall && best.bestMinBalance >= 0) {
      recoHTML = `<div class="recommendation-box">
        <span class="recommendation-box__icon">💡</span>
        <span><strong>Recomendación algorítmica:</strong> Realiza la compra a partir del <strong>día ${best.bestDay}</strong>, después de recibir el ingreso esperado. Tu saldo mínimo sería <strong>${Format.soles(best.bestMinBalance)}</strong> y evitarías el faltante.</span>
      </div>`;
    } else if (hasShortfall) {
      recoHTML = `<div class="recommendation-box" style="background:#FFF3E6;border-color:#F0B87A;color:#9C4221">
        <span class="recommendation-box__icon">⚠️</span>
        <span><strong>Atención:</strong> No se encontró un día en los próximos 30 días que evite el faltante para este monto. Considera reducir el monto o postergar la compra.</span>
      </div>`;
    }

    const explanationBlock = `<details class="collapsible" style="margin-top:var(--space-lg)">
      <summary>💡 Ver explicación</summary>
      <div class="collapsible__content">
        <div class="explanation-steps">${stepsHTML}</div>
        ${recoHTML}
      </div>
    </details>`;

    // ── Assemble results ──
    const resultsEl = document.getElementById('compraResults');
    resultsEl.innerHTML = alertHTML + tableHTML + messageHTML + explanationBlock + `
      <div class="btn-group" style="margin-top:var(--space-xl)">
        <button class="btn btn--outline" onclick="App.closeCompraModal()">Cerrar simulación</button>
      </div>`;
    resultsEl.classList.add('visible');
  },
};

// ─── 15. INIT ───
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
