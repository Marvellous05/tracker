const $ = (selector) => document.querySelector(selector);
$('#year').textContent = new Date().getFullYear();
const trackingParam = new URLSearchParams(location.search).get('tracking');
if (trackingParam) $('#trackingInput').value = trackingParam;
$('#menuToggle').addEventListener('click', () => {
  const header = $('.site-header');
  const open = header.classList.toggle('nav-open');
  $('#menuToggle').setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.main-nav a').forEach(a => a.addEventListener('click', () => $('.site-header').classList.remove('nav-open')));

const API_BASE = '';
const geocodeCache = new Map();
let activeTrackingCode = '';
let refreshTimer = null;
let mapInstance = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function normalizedMode(mode) { return String(mode || '').toLowerCase().trim(); }
function modeName(mode) {
  const m = normalizedMode(mode);
  return ({plane:'Air freight',air:'Air freight',ship:'Ocean freight',sea:'Ocean freight',truck:'Road transport',bus:'Road transport',car:'Road transport',train:'Rail transport'})[m] || (mode || 'Transport');
}
function modeSvg(mode) {
  const m = normalizedMode(mode);
  const paths = {
    plane:'<path d="M3 21 21 12 3 3l3 9-3 9Zm3-9h11"/>',
    ship:'<path d="M3 15h18l-3 5H7l-4-5Zm3-3h12V7H6v5Zm3-5V4h6v3M9 15v-3m6 3v-3"/>',
    truck:'<path d="M2 6h12v11H2zM14 10h5l3 4v3h-8z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    bus:'<rect x="4" y="3" width="16" height="17" rx="3"/><path d="M4 10h16M8 6h12M8 15h.01M16 15h.01M8 20v2m8-2v2"/>',
    train:'<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M9 15h.01M15 15h.01M8 22l3-3m8 3-3-3"/>'
  };
  const key = m === 'air' ? 'plane' : m === 'sea' ? 'ship' : m;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[key] || paths.truck}</svg>`;
}
function legProgress(shipment) {
  const legs = shipment.legs || [];
  const start = Date.parse(shipment.createdAt || new Date().toISOString());
  const now = shipment.pausedAt ? Date.parse(shipment.pausedAt) : Date.now();
  const elapsed = Math.max(0, (now - start - Number(shipment.totalPausedMs || 0)) / 3600000);
  const total = Math.max(1, legs.reduce((sum, leg) => sum + Number(leg.hours || 24), 0));
  let remaining = elapsed, index = 0;
  while (index < legs.length - 1 && remaining > Number(legs[index].hours || 24)) {
    remaining -= Number(legs[index].hours || 24); index++;
  }
  return { index, pct: Math.min(1, elapsed / total), legPct: Math.min(1, remaining / Number(legs[index]?.hours || 24)), paused: Boolean(shipment.pausedAt), total };
}
async function getShipment(code) {
  const response = await fetch(`${API_BASE}/.netlify/functions/shipments?trackingNumber=${encodeURIComponent(code)}`, {headers:{'Accept':'application/json'}});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('We could not reach the shipment service. Please try again in a moment.');
  const data = await response.json();
  return data.shipment || null;
}
async function geocode(place) {
  const key = String(place || '').trim().toLowerCase();
  if (!key) throw new Error('A route stage is missing a location.');
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  // Photon is used for browser-friendly place lookup; Leaflet then displays a normal street-map layer.
  const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(place)}&limit=1`, {headers:{'Accept':'application/json'}});
  if (!response.ok) throw new Error(`Map search could not locate ${place}.`);
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error(`We couldn't find “${place}”. Try a city and country name.`);
  const [lng, lat] = feature.geometry.coordinates;
  const point = [Number(lat), Number(lng)];
  geocodeCache.set(key, point);
  return point;
}
function timelineMarkup(shipment, progress) {
  return (shipment.legs || []).map((leg, index) => {
    const done = index < progress.index || (progress.pct >= 1 && index === progress.index);
    const current = index === progress.index && !done;
    const state = done ? 'done' : current ? 'current' : '';
    const label = done ? 'Stage completed' : current ? (progress.paused ? 'Current stage · Paused' : 'Current stage') : 'Upcoming stage';
    return `<div class="timeline-item ${state}"><div class="timeline-dot">${done ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>' : modeSvg(leg.mode)}</div><div><b>${esc(leg.from)} <span aria-hidden="true">→</span> ${esc(leg.to)}</b><p>${esc(modeName(leg.mode))} · ${label} · ${Number(leg.hours || 24)} hours</p></div></div>`;
  }).join('');
}
function vehicleMarker(mode) {
  return L.divIcon({className:'vehicle-marker', html:`<div class="vehicle-bubble">${modeSvg(mode)}</div>`, iconSize:[42,42], iconAnchor:[21,21]});
}
async function drawShipmentMap(shipment, progress) {
  const mapElement = $('#shipmentMap');
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
  if (!window.L) {
    mapElement.innerHTML = '<div class="map-error">The map library did not load. Please refresh the page and try again.</div>';
    return;
  }
  const map = L.map(mapElement, {scrollWheelZoom:false, zoomControl:true, preferCanvas:true});
  mapInstance = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:18,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);
  try {
    const legs = shipment.legs || [];
    const allPoints = [];
    const resolved = [];
    for (const leg of legs) {
      const from = await geocode(leg.from);
      const to = await geocode(leg.to);
      resolved.push({from,to,leg});
      allPoints.push(from,to);
    }
    if (!allPoints.length) throw new Error('No route stages are available for this shipment.');
    resolved.forEach(({from,to,leg}, index) => {
      const isCurrent = index === progress.index;
      const mode = normalizedMode(leg.mode);
      // Air and sea journeys are represented by clean great-circle-style map connections.
      // Ground legs use OSRM when available, with a straight-line fallback if routing is unavailable.
      let route = [from,to];
      if (['truck','car','bus'].includes(mode)) route = [from,to];
      const line = L.polyline(route, {color:isCurrent?'#087fe1':'#8ba4bd',weight:isCurrent?5:3,opacity:isCurrent?0.95:0.75,dashArray:['plane','air','ship','sea'].includes(mode)?'8 9':null,lineCap:'round'}).addTo(map);
      if (index === progress.index) line.bringToFront();
      L.circleMarker(from,{radius:5,color:'#fff',weight:2,fillColor:index < progress.index?'#159b72':'#087fe1',fillOpacity:1}).addTo(map).bindPopup(`<strong>${esc(leg.from)}</strong><br>${esc(modeName(leg.mode))} · Stage ${index+1}`);
      if (index === legs.length-1) L.circleMarker(to,{radius:6,color:'#fff',weight:2,fillColor:'#159b72',fillOpacity:1}).addTo(map).bindPopup(`<strong>${esc(leg.to)}</strong><br>Destination`);
    });
    const current = resolved[progress.index];
    if (current) {
      const lat = current.from[0] + (current.to[0] - current.from[0]) * progress.legPct;
      const lng = current.from[1] + (current.to[1] - current.from[1]) * progress.legPct;
      L.marker([lat,lng],{icon:vehicleMarker(current.leg.mode),zIndexOffset:1000}).addTo(map).bindPopup(`<strong>Current scheduled position</strong><br>${esc(modeName(current.leg.mode))}`);
    }
    map.fitBounds(L.latLngBounds(allPoints), {padding:[38,38],maxZoom:6});
    setTimeout(()=>map.invalidateSize(),100);
  } catch (error) {
    map.remove(); mapInstance = null;
    mapElement.innerHTML = `<div class="map-error"><div><strong>We couldn't load this route on the map.</strong><br>${esc(error.message)}<br><small>The shipment details and timeline are still available.</small></div></div>`;
  }
}
async function showShipment(shipment) {
  $('#emptyState').classList.add('hidden');
  const panel = $('#resultPanel');
  panel.classList.remove('hidden');
  const progress = legProgress(shipment);
  const percentage = Math.round(progress.pct * 100);
  const firstLeg = shipment.legs?.[0];
  const lastLeg = shipment.legs?.[shipment.legs.length - 1];
  panel.innerHTML = `<div class="result-head"><div><div class="eyebrow eyebrow-dark">TRACKING NUMBER · ${esc(shipment.trackingNumber)}</div><h3>${esc(shipment.origin)} <span style="color:#1685df">→</span> ${esc(shipment.destination)}</h3><div class="result-sub">Shipment journey and latest available progress</div></div><span class="status-pill ${progress.paused?'paused':''}">${progress.paused?'Journey paused':esc(shipment.status || 'In transit')}</span></div><div class="result-grid"><div class="result-map" id="shipmentMap" aria-label="Shipment route map"></div><div class="result-details"><div class="route-summary"><div><small>ORIGIN</small><b>${esc(shipment.origin || firstLeg?.from || 'Not provided')}</b></div><div style="text-align:right"><small>DESTINATION</small><b>${esc(shipment.destination || lastLeg?.to || 'Not provided')}</b></div></div><div class="progress-meta"><strong>${progress.paused?'Journey paused':'Journey progress'}</strong><span>${percentage}% scheduled</span></div><div class="progress-track"><div class="progress-fill" style="width:${percentage}%"></div></div><div class="timeline">${timelineMarkup(shipment,progress)}</div><div class="timeline-note">${progress.paused?'This shipment is paused. Its scheduled position is held until the journey is resumed.':'Progress is estimated from the journey schedule supplied for this shipment.'}</div></div></div>`;
  await drawShipmentMap(shipment, progress);
}
$('#trackForm').addEventListener('submit', async event => {
  event.preventDefault();
  const code = $('#trackingInput').value.trim();
  if (!code) return;
  activeTrackingCode = code;
  const button = event.submitter || $('#trackForm button');
  const original = button.innerHTML;
  button.disabled = true; button.textContent = 'Searching…';
  try {
    const shipment = await getShipment(code);
    if (!shipment) {
      $('#resultPanel').classList.add('hidden');
      $('#emptyState').classList.remove('hidden');
      $('#emptyState').innerHTML = '<div class="empty-symbol">⌕</div><h3>We couldn’t find that shipment</h3><p>Please check the tracking number and try again.</p>';
    } else {
      await showShipment(shipment);
      $('#tracking').scrollIntoView({behavior:'smooth',block:'start'});
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(async () => {
        if (!activeTrackingCode || document.hidden) return;
        try { const latest = await getShipment(activeTrackingCode); if (latest) await showShipment(latest); } catch (_) {}
      }, 30000);
    }
  } catch (error) {
    $('#resultPanel').classList.add('hidden');
    $('#emptyState').classList.remove('hidden');
    $('#emptyState').innerHTML = `<div class="empty-symbol">!</div><h3>Tracking is temporarily unavailable</h3><p>${esc(error.message)}</p>`;
  } finally { button.disabled = false; button.innerHTML = original; }
});
