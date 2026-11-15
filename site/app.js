'use strict';

const data = globalThis.FINN_DATA;
const engine = globalThis.FINN_ENGINE;
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const mode = document.querySelector('#mode');
const nav = document.querySelector('#nav');
const list = new Intl.NumberFormat('en-IN', {maximumFractionDigits:1});
const dateFmt = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', timeZone:'Asia/Kolkata'});
const iconPaths = {
  brief:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 16h5"/>',
  research:'<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  network:'<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="m11 7-5 9m7-9 5 9M7.4 18h9.2"/>',
  settings:'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="#f7f8f4"/><circle cx="15" cy="12" r="2" fill="#f7f8f4"/><circle cx="11" cy="17" r="2" fill="#f7f8f4"/>',
  arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
  external:'<path d="M13 4h7v7m0-7-9 9"/><path d="M17 14v5H5V7h5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + iconPaths[name] + '</svg>';
const safe = str => String(str ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const source = (url, label) => {
  if (!/^https:\/\//i.test(url ?? '')) return '';
  return `<a class="source" href="${safe(url)}" target="_blank" rel="noopener noreferrer">${safe(label)} ${icon('external')}</a>`;
};
const number = value => Number.isFinite(value) ? list.format(value) : '—';
const volumeNumber = new Intl.NumberFormat('en-IN', {maximumFractionDigits:2});
const volumeRatio = value => volumeNumber.format(value) + '×';
const signed = value => !Number.isFinite(value) ? '—' : (value > 0 ? '+' : value < 0 ? '−' : '') + number(Math.abs(value)) + '%';
const date = value => dateFmt.format(new Date(value.length === 10 ? value + 'T12:00:00+05:30' : value));
const defaultRules = {price:2, volume:1.9};
const readRules = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('finn.alerts'));
    if (saved?.price >= 0.1 && saved.price <= 100 && saved?.volume >= 1 && saved.volume <= 100) return saved;
  } catch {}
  return defaultRules;
};
const state = {days:1, category:'All', rules:readRules(), feed:null, live:false, route:'brief'};
let researchRequest = 0;
let modalOpener;

document.querySelector('#settings').innerHTML = icon('settings');
function announce(message) { document.querySelector('#status').textContent = message; }

function updateNav() {
  nav.innerHTML = [['brief','Brief'],['research','Research'],['network','Network']].map(([id, label]) =>
    `<a href="#${id}" ${state.route === id ? 'aria-current="page"' : ''}>${icon(id)}${label}</a>`).join('');
  mode.classList.toggle('live', state.live);
  document.querySelector('#mode-label').textContent = state.live ? 'Live sources' : 'Historical replay';
}

function contactCard(contact) {
  const initials = contact.name.split(' ').slice(0,2).map(word => word[0]).join('');
  return `<article class="panel contact">
    <div class="contact-head"><div class="avatar ${safe(contact.color)}" aria-hidden="true">${safe(initials)}</div>
    <div><h3>${safe(contact.name)}</h3><p class="muted">${safe(contact.role)} · ${safe(contact.employer)}</p></div></div>
    <p>${safe(contact.why)}</p><p class="muted">Employment ${safe(contact.tenure)} · Last spoke ${safe(contact.met)} · Synthetic contact</p>
    ${contact.path ? `<div class="evidence-path"><b>Possible route · unverified</b>
      <div class="path"><span>You</span>${icon('arrow')}<span>${safe(contact.name)}</span>${icon('arrow')}<span>${safe(contact.path.name)}</span></div>
      <p class="muted">${safe(contact.path.basis)}. ${safe(contact.path.detail)}</p></div>` : ''}
  </article>`;
}

function getEventContext(event) { return event.weight >= 40 ? engine.context(data, event.ticker, event.person) : null; }

function eventCard(event, featured = false) {
  const context = getEventContext(event);
  const tag = {Leadership:'leadership','M&A':'ma'}[event.kind] ?? '';
  return `<article class="card ${featured ? 'featured' : ''}">
    <button type="button" class="card-link" data-event="${safe(event.id)}">
      <span class="card-meta"><span class="ticker">${safe(event.ticker)}</span><span class="tag ${tag}">${safe(event.kind)}</span><time datetime="${safe(event.date)}">${date(event.date)}</time></span>
      <span class="card-title"><span>${safe(event.title)}</span>${icon('arrow')}</span>
      ${event.summary && event.summary !== event.title ? `<p>${safe(event.summary)}</p>` : ''}
    </button>
    ${context ? `<div class="network-strip">${icon('network')} ${context.path ? 'Possible introduction via' : 'Context from'} <b>${safe(context.name)}</b></div>` : ''}
  </article>`;
}

function feed() {
  return state.live && state.feed ? state.feed : {events:data.events, market:data.market, asOf:data.replay};
}
function renderBrief() {
  const current = feed();
  const all = engine.digest(current.events, current.asOf, state.days, 'All');
  const selected = engine.digest(current.events, current.asOf, state.days, state.category);
  const important = selected.filter(event => event.weight >= 40);
  const routine = selected.filter(event => event.weight < 40);
  const links = all.filter(getEventContext).length;
  const alerts = engine.alerts(current.market.filter(item => engine.inWindow(item.date, current.asOf, Math.max(state.days, state.live ? 7 : 1))), state.rules);
  const categories = ['All', ...new Set(all.map(event => event.kind))];
  const quietOpen = document.querySelector('.quiet')?.open;
  app.innerHTML = `
    <section class="hero" aria-labelledby="brief-title">
      <div class="radar" aria-hidden="true"><i></i><i></i><i></i></div>
      <div><div class="eyebrow">Portfolio intelligence <span aria-hidden="true">/</span> ${state.live ? 'Live sources' : 'April 2026 replay'}</div>
      <h1 id="brief-title">The portfolio brief</h1>
      <p>Material filings, unusual moves, and who to call for context.</p>
      <div class="hero-stats"><span><strong>${data.portfolio.length}</strong> companies</span><span><strong>${all.filter(event => event.weight >= 40).length}</strong> material ${all.filter(event => event.weight >= 40).length === 1 ? 'filing' : 'filings'}</span><span><strong>${links}</strong> network ${links === 1 ? 'lead' : 'leads'}</span></div></div>
    </section>
    <div class="layout">
      <section aria-labelledby="priority-title">
        <div class="section-head"><h2 id="priority-title">Worth your attention</h2>
          <div class="segment" role="group" aria-label="Filing window">
            ${[[1,'24h'],[7,'7 days'],[30,'30 days']].map(([value,label]) => `<button data-days="${value}" aria-pressed="${state.days === value}">${label}</button>`).join('')}
          </div>
        </div>
        ${categories.length > 1 ? `<div class="filter" role="group" aria-label="Filing category">${categories.map(category =>
          `<button class="chip" data-category="${safe(category)}" aria-pressed="${state.category === category}">${safe(category)}</button>`).join('')}</div>` : ''}
        ${current.errors?.filings ? `<p class="empty error">${safe(current.errors.filings)}</p>` : ''}
        ${important.length ? `<div class="card-list">${important.map((event,i) => eventCard(event,i === 0)).join('')}</div>`
          : '<div class="empty">No material filings in this view. Try another window or category.</div>'}
        ${routine.length ? `<details class="quiet" ${quietOpen || state.category === 'Routine' ? 'open' : ''}><summary>${routine.length} routine ${routine.length === 1 ? 'disclosure' : 'disclosures'}</summary>
          <div class="card-list">${routine.map(event => eventCard(event)).join('')}</div></details>` : ''}
      </section>
      <aside class="rail" aria-label="Portfolio shortcuts">
        <section class="panel"><div class="panel-head"><h2>Market tripwires</h2><button class="inline-action" data-dialog="rules">Edit rules</button></div>
          ${alerts.length ? alerts.map(bar => `<button class="market-row" data-market="${safe(bar.ticker)}"><strong>${safe(bar.ticker)}</strong>
           <span class="change ${bar.move < 0 ? 'negative' : 'positive'}">${signed(bar.move)}</span>
           <small>${bar.ratio == null ? '' : volumeRatio(bar.ratio) + ' volume'} ${icon('arrow')}</small></button>`).join('') :
           `<p class="rule-label">${state.live && current.errors?.market ? safe(current.errors.market) : 'No threshold crossings in view.'}</p>`}
          <p class="rule-label">±${number(state.rules.price)}% close or ≥${number(state.rules.volume)}× volume · ${'NSE end of day'}</p>
          ${state.live && current.market.length < data.portfolio.length ? `<p class="rule-label">Available market data for ${current.market.length} of ${data.portfolio.length} tickers.</p>` : ''}
        </section>
        <section class="panel ask-panel"><div class="eyebrow">Network</div><h3>Who can sanity-check a thesis?</h3>
          <p>Search your contacts by company, appointment or sector.</p>
          <a href="#network/IT%20services" class="action-link">Explore IT services ${icon('arrow')}</a>
        </section>
        <section class="panel"><div class="panel-head"><h3>Watchlist</h3><button class="inline-action" data-dialog="portfolio">All ${data.portfolio.length} companies</button></div>
          ${data.portfolio.slice(0,3).map(([symbol, name]) => `<button class="watch-row" data-research="${symbol}"><strong>${symbol}</strong><small>${safe(name)}</small></button>`).join('')}
        </section>
      </aside>
    </div>
    <p class="footer-note">${state.live ? 'NSE best-effort filings and daily prices · synthetic contacts · India time' :
      'Selected historical issuer disclosures through 23 Apr 2026 · NSE end-of-day prices · synthetic contacts · India time'}</p>`;
}

function guidancePanel(guide) {
  return `<section class="panel analysis"><div class="panel-head"><h3>Guidance vs. delivery</h3>${source(guide.source,'Issuer tracker')}</div>
   <p>IT-services revenue, US$ million at guided exchange rates.</p>
   <div class="guidance-list">${guide.rows.map(row => {
     const g = engine.guidance(row);
     return `<div class="guide-row"><div class="guide-top"><strong>${g.period}</strong><span>${g.verdict}</span></div>
     <div class="guide-track" aria-hidden="true"><i style="--pos:${g.position*100}%"></i></div>
     <div class="guide-values"><span>${number(g.low)}–${number(g.high)}</span><strong>Actual ${number(g.actual)}</strong></div></div>`;
   }).join('')}</div></section>`;
}

function renderDossier(symbol, dossier) {
  const contact = engine.context(data,symbol);
  return `<div class="brief-heading"><div class="eyebrow">${safe(symbol)} · ${safe(dossier.period)}</div>
    <h2>${safe(dossier.name)}</h2><p>${safe(dossier.thesis)}</p></div>
    <div class="metrics">${dossier.metrics.map(([label,value,change]) =>
      `<div class="metric"><span>${safe(label)}</span><b>${safe(value)}</b><small>${safe(change)}</small></div>`).join('')}</div>
    <div class="pairs">${dossier.pairs.map(([label,body,url,caption]) => `<article class="panel pair"><h3>${safe(label)}</h3>
      <p>${safe(body)}</p>${source(url,caption)}</article>`).join('')}</div>
    ${dossier.guidance ? guidancePanel(dossier.guidance) : ''}
    <section class="panel analysis"><h3>Investor read</h3><p>${safe(dossier.take)}</p><strong>Question to test</strong><p>${safe(dossier.ask)}</p></section>
    ${contact ? `<section class="result"><div class="section-head"><h2>Who can help</h2></div><div class="contacts">${contactCard(contact)}</div></section>` : ''}`;
}

function renderEvidence(result, lookupError = '') {
  const kinds = [...new Set(result.documents.map(doc => doc.kind))];
  const limited = kinds.length < 2 || result.documents.some(doc => !doc.passages.length);
  const contact = engine.context(data,result.ticker);
  return `<div class="brief-heading"><div class="eyebrow">Live source search · ${safe(result.ticker)}</div>
    <h2>Primary-source evidence</h2><p>${limited ? 'Partial document coverage. Review the available passages and original documents.' :
    'Review matched passages from the annual report and earnings call.'}</p></div>
    <div class="contacts">${result.documents.map(doc => `<article class="panel pair"><h3>${safe(doc.kind)}</h3>
      ${doc.url ? '' : `<small>${safe(doc.label)} · local PDF</small>`}
      ${doc.passages.length ? doc.passages.map(passage => `<p><strong>Page ${passage.page}</strong> · ${safe(passage.text)}</p>`).join('') :
      '<p>No matching text could be extracted.</p>'}${source(doc.url,doc.label)}</article>`).join('')}</div>
    ${!result.documents.length ? `<p class="empty">${safe(lookupError || 'No issuer report or transcript was discovered for this ticker.')}</p>` : ''}
    ${result.note ? `<p class="footer-note">${safe(result.note)}</p>` : ''}
    ${limited ? `<form id="document-form" class="panel result" data-symbol="${safe(result.ticker)}">
      <div class="panel-head"><h3>Use issuer PDFs</h3></div>
      <div class="settings-grid">
        <label class="field">Annual report<input type="file" name="report" accept="application/pdf,.pdf"></label>
        <label class="field">Earnings call transcript<input type="file" name="transcript" accept="application/pdf,.pdf"></label>
        <button class="button primary">Extract evidence</button>
      </div>
      <p class="rule-label">Processed by this server in memory. Up to 40 MB per PDF.</p>
      <p class="rule-label" id="document-message" role="status"></p>
    </form>` : ''}
    ${contact ? `<section class="result"><div class="section-head"><h2>Who can help</h2></div><div class="contacts">${contactCard(contact)}</div></section>` : ''}`;
}
let evidence = null;

function showEvidence(target, result, error) {
  evidence = result;
  target.innerHTML = renderEvidence(result,error);
}

async function importDocuments(form, values) {
  const message = form.querySelector('#document-message');
  const entries = ['report','transcript'].map(kind => [kind,values.get(kind)]).filter(([,file]) => file?.size);
  if (!entries.length || entries.some(([,file]) => file.size > 40*1024*1024)) {
    message.textContent = 'Choose at least one PDF. Each file can be up to 40 MB.';
    return;
  }
  const current = evidence;
  const button = form.querySelector('button');
  button.disabled = true;
  message.textContent = 'Reading issuer PDFs…';
  const results = await Promise.allSettled(entries.map(([kind,file]) =>
    api('/api/research/document?' + new URLSearchParams({ticker:form.dataset.symbol,kind,name:file.name}),
      {method:'POST',body:file,headers:{'Content-Type':'application/pdf'}})));
  if (!form.isConnected) return;
  const imported = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason.message);
  if (imported.length) {
    const documents = [...current.documents.filter(doc => !imported.some(result => result.kind === doc.kind)), ...imported];
    showEvidence(document.querySelector('#research-result'),{...current,documents,
      note:'Extractive research. Read the cited pages in the original PDFs.' + (errors.length ? ' ' + errors.join(' ') : '')});
  } else {
    message.textContent = errors.join(' ');
    button.disabled = false;
  }
}
function renderResearch(symbol = '') {
  app.innerHTML = `<section class="page-title"><div class="eyebrow">Fundamental research</div>
    <h1>Research a company</h1><p>Compare management’s story with the underlying disclosures.</p></section>
    <form class="searchbox" id="research-form"><label for="ticker">NSE ticker</label>
    <input id="ticker" name="ticker" value="${safe(symbol)}" placeholder="e.g. WIPRO or MARUTI" maxlength="26" required autocomplete="off">
    <button class="button primary">Research ${icon('arrow')}</button></form>
    <div class="scenarios" aria-label="Example research tickers">${Object.entries(data.research).map(([id,item]) =>
      `<button class="chip" data-research="${id}" aria-pressed="${id === symbol}">${safe(item.name)}</button>`).join('')}</div>
    <div class="result" id="research-result" aria-live="polite">${!symbol ?
      '<div class="empty">Choose a company or enter an NSE ticker. Try Wipro to compare four quarters of revenue against guidance.</div>' : ''}</div>`;
  if (!symbol) return;
  const target = document.querySelector('#research-result');
  const request = ++researchRequest;
  if (data.research[symbol] && Object.hasOwn(data.research,symbol)) {
    target.innerHTML = renderDossier(symbol,data.research[symbol]);
    return;
  }
  if (!/^[A-Z0-9][A-Z0-9&-]{0,19}$/.test(symbol)) {
    target.innerHTML = '<div class="empty error">Enter an NSE ticker such as MARUTI or INFY.NS.</div>';
    return;
  }
  if (location.protocol === 'file:') {
    target.innerHTML = '<div class="empty">This standalone replay includes four research briefs. Run the repository’s Python server to look up more NSE tickers.</div>';
    return;
  }
  target.innerHTML = '<div class="empty">Looking up issuer reports and earnings-call transcripts…</div>';
  api('/api/research?ticker=' + encodeURIComponent(symbol)).then(result => {
    if (request === researchRequest && target.isConnected) showEvidence(target,result);
  }).catch(error => {
    if (request === researchRequest && target.isConnected) {
      if (error.message.includes('Start the repository')) {
        target.innerHTML = `<div class="empty">${safe(error.message)}</div>`;
      } else {
        showEvidence(target,{ticker:symbol,documents:[]},error.message);
      }
    }
  });
}
function renderNetwork(query = '') {
  const hits = engine.network(data,query);
  app.innerHTML = `<section class="page-title"><div class="eyebrow">Private network · synthetic demo</div>
    <h1>Who can help?</h1><p>Find a relevant contact by company, sector or an incoming executive.</p></section>
    <form class="searchbox" id="network-form"><label for="query">Search your network</label>
    <input id="query" name="query" value="${safe(query)}" placeholder="e.g. rural lending" required maxlength="110" autocomplete="off">
    <button class="button primary">Find context ${icon('arrow')}</button></form>
    <div class="scenarios" aria-label="Sample queries">${['IT services','Kimsuka Narsimhan','Rural lending','Wipro'].map(term =>
      `<button class="chip" data-network="${term}" aria-pressed="${query === term}">${term}</button>`).join('')}</div>
    <section class="result" aria-live="polite">${query ?
     `<div class="section-head"><h2>${hits.length ? (hits.length + (hits.length === 1 ? ' relevant contact' : ' relevant contacts')) : 'No contacts found'}</h2></div>
       ${hits.length ? `<div class="contacts">${hits.map(contactCard).join('')}</div>` :
       '<div class="empty">Try an employer, ticker, or an expertise area like enterprise software.</div>'}`
     : '<div class="empty">Try a sample query to see why a contact appears and where the match comes from.</div>'}</section>`;
}

function showDialog(title, body, eyebrow = '') {
  modalOpener = document.activeElement;
  dialog.innerHTML = `<div class="dialog-head"><div>${eyebrow ? `<div class="eyebrow">${safe(eyebrow)}</div>` : ''}
    <h2 id="dialog-title">${safe(title)}</h2></div><button id="dismiss" class="icon-button" aria-label="Close" autofocus>${icon('close')}</button></div>
    <div class="dialog-body">${body}</div>`;
  if (!dialog.open) dialog.showModal();
}

function resultTable(event) {
  return `<div class="table-wrap"><table><caption>Q4 FY26 · consolidated, ₹ crore</caption><thead><tr>
  <th scope="col">Metric</th><th scope="col">Mar ’26</th><th scope="col">QoQ</th><th scope="col">YoY</th></tr></thead><tbody>
  ${event.results.map(([name,current,prior,year]) => `<tr><th scope="row">${safe(name)}</th><td>${number(current)}</td>
    <td>${signed(engine.percentage(current,prior))}<small>${number(prior)}</small></td>
    <td>${signed(engine.percentage(current,year))}<small>${number(year)}</small></td></tr>`).join('')}
  </tbody></table></div><small>${safe(event.note)}</small>`;
}

function openEvent(id) {
  const event = feed().events.find(event => event.id === id);
  if (!event) return;
  const contact = getEventContext(event);
  showDialog(event.title,`
    <p>${safe(event.summary)}</p>
    ${event.results ? resultTable(event) : ''}
    ${event.bio ? `<div class="panel pair"><h3>Career background</h3><p>${safe(event.bio)}</p>${source(event.bioSource,'Issuer biography')}</div>` : ''}
    ${event.question ? `<section class="panel ask-panel"><h3>Question to test</h3><p>${safe(event.question)}</p></section>` : ''}
    ${contact ? `<div class="section-head"><h2>Who can help</h2></div><div class="contacts">${contactCard(contact)}</div>` : ''}
    <div class="dialog-actions">${source(event.source,event.sourceName)}
      <button class="button secondary" data-research="${safe(event.ticker)}">Research ${safe(event.ticker)} ${icon('arrow')}</button></div>`,
    `${event.ticker} · ${event.kind} · ${date(event.date)}`);
}

function openMarket(symbol) {
  const current = feed();
  const alert = engine.alerts(current.market,state.rules).find(item => item.ticker === symbol);
  if (!alert) return;
  showDialog(symbol + ' · market tripwire',`
    <div class="metrics"><div class="metric"><span>Close</span><b>₹${number(alert.close)}</b><small>Prior ₹${number(alert.previous)}</small></div>
     <div class="metric"><span>Price move</span><b>${signed(alert.move)}</b><small>Threshold ±${number(state.rules.price)}%</small></div>
     <div class="metric"><span>Relative volume</span><b>${alert.ratio == null ? '—' : volumeRatio(alert.ratio)}</b><small>Threshold ${number(state.rules.volume)}×</small></div></div>
    <p class="muted">Daily close versus the prior session. Volume versus the previous 20 complete trading sessions.</p>
    <div class="dialog-actions">${source('https://archives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_' + alert.date.replaceAll('-','') + '_F_0000.csv.zip','NSE daily archive')}
     <button class="button secondary" data-research="${safe(symbol)}">Research ${safe(symbol)} ${icon('arrow')}</button></div>`,
    `${date(alert.date)} · ${'NSE close'}`);
}

function openRules() {
  showDialog('Market tripwires',`<p class="muted">Flag a market row when either threshold is reached. Rules are stored in this browser.</p>
    <form id="rules-form"><div class="settings-grid">
      <label class="field">Absolute close move (%)<input name="price" type="number" min="0.1" max="100" step="0.1" value="${state.rules.price}" required></label>
      <label class="field">Volume vs. 20 sessions (×)<input name="volume" type="number" min="1" max="100" step="0.1" value="${state.rules.volume}" required></label>
      <button class="button primary">Save thresholds</button></div></form>`);
}
function openPortfolio() {
  showDialog('Portfolio watchlist', `<div class="portfolio">${data.portfolio.map(([symbol, name, sector]) =>
    `<button class="chip" data-research="${symbol}"><b>${symbol}</b><small>${safe(name)}</small><small>${safe(sector)}</small></button>`).join('')}</div>`, '17 NSE equities');
}
function openMode() {
  showDialog('Data sources', `<p><b>Historical replay.</b> Selected April 2026 issuer disclosures, official NSE closing data and synthetic network contacts.</p>
    <p><b>Live sources.</b> The optional local server requests NSE filings and cash-market archives. Source coverage appears in the brief.</p>
    ${state.feed?.errors && Object.keys(state.feed.errors).length ?
     `<p class="muted">${safe(Object.values(state.feed.errors).join(' '))}</p>` : ''}
    <p id="live-message" class="muted" aria-live="polite"></p>
    <div class="dialog-actions"><button class="button secondary" data-live="replay">Historical replay</button>
    <button class="button primary" data-live="load">${state.live ? 'Refresh live sources' : 'Load live sources'}</button></div>`);
}

async function api(path, options = {}) {
  const response = await fetch(path, {...options, headers:{Accept:'application/json',...options.headers},
    signal:AbortSignal.timeout(35000)});
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('Start the repository’s Python server to use live sources.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The source could not be reached.');
  return result;
}
async function loadLive(button) {
  const message = document.querySelector('#live-message');
  if (location.protocol === 'file:') {
    message.textContent = 'Start the repository’s Python server to use live sources.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Checking exchange and market sources…';
  try {
    const result = await api('/api/feed');
    if (!result.market.length && result.errors?.filings) {
      throw new Error(Object.values(result.errors).join(' '));
    }
    state.feed = result;
    state.live = true;
    state.category = 'All';
    if (message.isConnected) dialog.close();
    navigate('brief');
    announce('Live sources loaded');
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function renderRoute(focus = true) {
  let [route,query = ''] = location.hash.slice(1).split('/');
  state.route = ['brief','research','network'].includes(route) ? route : 'brief';
  try { query = decodeURIComponent(query); } catch { query = ''; }
  updateNav();
  if (state.route === 'research') renderResearch(engine.ticker(query));
  else if (state.route === 'network') renderNetwork(query.slice(0,110));
  else renderBrief();
  if (focus) {
    window.scrollTo(0,0);
    app.focus({preventScroll:true});
  }
}
function navigate(route, text = '') {
  const target = '#' + route + (text ? '/' + encodeURIComponent(text) : '');
  if (location.hash === target || (route === 'brief' && !location.hash)) renderRoute();
  else location.hash = target;
}
window.addEventListener('hashchange', () => renderRoute());
dialog.addEventListener('close', () => { if (modalOpener?.isConnected) modalOpener.focus(); });
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const d = button.dataset;
  if (button.id === 'dismiss') dialog.close();
  else if (button.id === 'settings' || d.dialog === 'rules') openRules();
  else if (d.dialog === 'portfolio') openPortfolio();
  else if (button === mode) openMode();
  else if (d.event) openEvent(d.event);
  else if (d.market) openMarket(d.market);
  else if (d.days || d.category) {
    if (d.days) {state.days = Number(d.days); state.category = 'All';}
    if (d.category) state.category = d.category;
    renderBrief();
    const group = d.days ? 'days' : 'category';
    [...app.querySelectorAll('[data-' + group + ']')].find(item => item.dataset[group] === d[group])?.focus();
    announce('Brief updated');
  } else if (d.research || d.network) {
    if (dialog.open) dialog.close();
    navigate(d.research ? 'research' : 'network', d.research || d.network);
  } else if (d.live === 'load') loadLive(button);
  else if (d.live === 'replay') {
    state.live = false;
    state.category = 'All';
    dialog.close();
    navigate('brief');
  }
});
document.addEventListener('submit', event => {
  const form = event.target;
  const values = new FormData(form);
  event.preventDefault();
  if (form.id === 'research-form') navigate('research',engine.ticker(values.get('ticker')));
  else if (form.id === 'network-form') navigate('network',values.get('query').trim());
  else if (form.id === 'document-form') importDocuments(form,values);
  else if (form.id === 'rules-form') {
    state.rules = {price:Number(values.get('price')),volume:Number(values.get('volume'))};
    try { localStorage.setItem('finn.alerts',JSON.stringify(state.rules)); } catch {}
    dialog.close();
    if (state.route === 'brief') renderBrief();
    announce('Thresholds saved');
  }
});
renderRoute(false);
