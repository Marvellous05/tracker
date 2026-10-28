const API_BASE = ""; // Public site API. Set admin site API base to this site's URL.
const $ = (s)=>document.querySelector(s);
$("#year").textContent = new Date().getFullYear();
const trackingParam = new URLSearchParams(location.search).get("tracking");
if(trackingParam) $("#trackingInput").value = trackingParam;
$("#menuToggle").addEventListener("click",()=>$(".topbar").classList.toggle("nav-open"));
document.querySelectorAll("nav a").forEach(a=>a.addEventListener("click",()=>$(".topbar").classList.remove("nav-open")));
const localDemoRecords = {};
let activeTrackingCode = "";
function modeIcon(mode){return ({plane:"✈",ship:"🚢",truck:"🚚",bus:"🚌",car:"🚗",train:"🚆"})[String(mode||"").toLowerCase()]||"📦"}
function statusFor(s){return s||"In transit"}
function coords(place){return fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`).then(r=>r.json()).then(d=>{if(!d[0])throw Error("We couldn't locate "+place+". Try a city, country, airport or port name.");return [Number(d[0].lat),Number(d[0].lon)]})}
async function getShipment(code){
 try { const r=await fetch(`${API_BASE}/.netlify/functions/shipments?trackingNumber=${encodeURIComponent(code)}`); if(r.ok){const d=await r.json();if(d.shipment)return d.shipment;} } catch(e){}
 return localDemoRecords[code.toUpperCase()]||null;
}
function legProgress(shipment){
 const legs=shipment.legs||[];
 const start=Date.parse(shipment.createdAt||new Date().toISOString());
 // A paused shipment uses its saved pause timestamp as "now", freezing its marker.
 const effectiveNow=shipment.pausedAt ? Date.parse(shipment.pausedAt) : Date.now();
 const pausedMs=Number(shipment.totalPausedMs||0);
 const elapsed=Math.max(0,(effectiveNow-start-pausedMs)/3600000);
 const total=Math.max(1,legs.reduce((a,l)=>a+Number(l.hours||24),0));
 let left=elapsed,idx=0;
 while(idx<legs.length-1&&left>Number(legs[idx].hours||24)){left-=Number(legs[idx].hours||24);idx++}
 const pct=Math.min(1,elapsed/total);
 return {idx,pct,legPct:Math.min(1,left/Number(legs[idx]?.hours||24)),elapsed,total,paused:Boolean(shipment.pausedAt)};
}
function renderTimeline(s,p){return (s.legs||[]).map((l,i)=>`<div class="timeline-item"><div class="timeline-dot">${i<p.idx?"✓":modeIcon(l.mode)}</div><div><b>${esc(l.from)} → ${esc(l.to)}</b><p>${modeIcon(l.mode)} ${esc((l.mode||"transport").toString())} · ${i<p.idx?"Stage completed":i===p.idx?"Current stage":"Upcoming stage"} · ${Number(l.hours||24)} hours</p></div></div>`).join("")}
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function showShipment(s){
 $("#emptyState").classList.add("hidden"); const panel=$("#resultPanel");panel.classList.remove("hidden");panel.innerHTML=`<div class="result-head"><div><div class="eyebrow dark">TRACKING NUMBER · ${esc(s.trackingNumber)}</div><h3>${esc(s.origin)} <span style="color:#14998e">→</span> ${esc(s.destination)}</h3><small style="color:#8291a3;font-size:11px">Journey details and latest available progress</small></div><span class="status-pill">${s.pausedAt?"Journey paused":esc(statusFor(s.status))}</span></div><div class="result-grid"><div class="result-map" id="shipmentMap"></div><div class="result-details"><div class="route-summary"><div><small>ORIGIN</small><b>${esc(s.origin)}</b></div><div style="text-align:right"><small>DESTINATION</small><b>${esc(s.destination)}</b></div></div><div style="display:flex;justify-content:space-between;gap:12px;margin:17px 0 5px;font-size:11px"><b>${legProgress(s).paused?"⏸ Journey paused":"↗ Journey in motion"}</b><span style="color:#159b90;font-weight:800">${Math.round(legProgress(s).pct*100)}% scheduled</span></div><div style="height:6px;background:#e9eff5;border-radius:10px;overflow:hidden"><div style="height:100%;width:${Math.round(legProgress(s).pct*100)}%;background:#159b90;border-radius:10px"></div></div><div class="timeline">${renderTimeline(s,legProgress(s))}</div><div style="font-size:10px;line-height:1.6;color:#8492a4;margin-top:12px">${legProgress(s).paused?"The shipment is paused. Its simulated position is held until the journey is resumed.":"Estimated progress is calculated from the journey schedule provided for this shipment."}</div></div></div>`;
 const map=L.map("shipmentMap",{scrollWheelZoom:false}).setView([20,0],2);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; OpenStreetMap contributors',maxZoom:18}).addTo(map);
 try{
  const legs=s.legs||[];let all=[];const pointList=[];
  for(let i=0;i<legs.length;i++){const a=await coords(legs[i].from),b=await coords(legs[i].to);pointList.push(a,b);let route=[a,b];if(["car","truck","bus"].includes(String(legs[i].mode).toLowerCase())){try{const rr=await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`);const rd=await rr.json();if(rd.routes?.[0])route=rd.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])}catch(e){}}L.polyline(route,{color:i===legProgress(s).idx?"#079b90":"#9aafc3",weight:i===legProgress(s).idx?4:3,dashArray:["plane","ship"].includes(String(legs[i].mode).toLowerCase())?"7 7":null}).addTo(map);all=all.concat(route)}
  legs.forEach(async(l,i)=>{const a=await coords(l.from),b=await coords(l.to);L.marker(a).addTo(map).bindPopup(`<b>${esc(l.from)}</b><br>Stage ${i+1} · ${esc(l.mode)}`);if(i===legs.length-1)L.marker(b).addTo(map).bindPopup(`<b>${esc(l.to)}</b><br>Destination`)});
  const p=legProgress(s),current=legs[p.idx];if(current){const a=await coords(current.from),b=await coords(current.to);const point=[a[0]+(b[0]-a[0])*p.legPct,a[1]+(b[1]-a[1])*p.legPct];const icon=L.divIcon({className:"vehicle-marker",html:`<div style="background:#092542;color:#fff;border:2px solid #73e3ce;border-radius:50%;width:38px;height:38px;display:grid;place-items:center;font-size:19px;box-shadow:0 4px 14px #001b3b55">${modeIcon(current.mode)}</div>`,iconSize:[38,38],iconAnchor:[19,19]});L.marker(point,{icon}).addTo(map).bindPopup(`<b>Scheduled position</b><br>${esc(current.mode)} · ${Math.round(p.pct*100)}% journey progress`)}
  if(all.length)map.fitBounds(L.latLngBounds(all),{padding:[25,25]});
 }catch(e){$("#shipmentMap").innerHTML=`<div style="padding:25px;color:#66798e;font-size:12px">The route map could not load this location: ${esc(e.message)}. Check the place names and try again.</div>`}
}
$("#trackForm").addEventListener("submit",async e=>{e.preventDefault();const code=$("#trackingInput").value.trim();activeTrackingCode=code;const btn=e.submitter;btn.disabled=true;btn.textContent="Searching…";try{const s=await getShipment(code);if(!s){$("#emptyState").classList.remove("hidden");$("#emptyState").innerHTML='<div class="empty-icon">⌕</div><h3>We couldn’t find that shipment</h3><p>Check the tracking number and try again.</p>';$("#resultPanel").classList.add("hidden");$("#tracking").scrollIntoView({behavior:"smooth"});return}await showShipment(s);$("#tracking").scrollIntoView({behavior:"smooth"});}catch(err){alert(err.message||"Unable to load shipment right now.")}finally{btn.disabled=false;btn.innerHTML='Track shipment <span>→</span>'}});

// Refresh an open tracking view periodically so admin pause/resume changes reach customers.
setInterval(async()=>{
 if(!activeTrackingCode || document.hidden) return;
 try{
  const latest=await getShipment(activeTrackingCode);
  if(latest) await showShipment(latest);
 }catch(e){}
},15000);
