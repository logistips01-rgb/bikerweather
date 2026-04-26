/**
 * BikerWeather — Bundle único sin módulos ES6
 * Todo el código en un solo archivo para máxima compatibilidad móvil
 */

'use strict';

/* ═══════════════════════════════════════
   WINDCHILL
═══════════════════════════════════════ */
const WindChill = {
  calculate(tempC, speedKmh) {
    if (tempC > 10 || speedKmh < 5) return Math.round(tempC * 10) / 10;
    const wc = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(speedKmh, 0.16) + 0.3965 * tempC * Math.pow(speedKmh, 0.16);
    return Math.round(wc * 10) / 10;
  },
  effectiveSpeed(bikeKmh, windKmh, windDir, heading) {
    const diff = ((windDir - heading + 360) % 360);
    const headwind = windKmh * Math.cos(diff * Math.PI / 180);
    return Math.max(0, bikeKmh + headwind);
  },
  classify(wc) {
    if (wc >= 30)  return { label:'Calor extremo',  cssClass:'hot',     emoji:'🔥' };
    if (wc >= 20)  return { label:'Cálido',          cssClass:'warm',    emoji:'☀️' };
    if (wc >= 10)  return { label:'Agradable',       cssClass:'cool',    emoji:'🌤' };
    if (wc >= 0)   return { label:'Frío',            cssClass:'cold',    emoji:'🧥' };
    if (wc >= -10) return { label:'Muy frío',        cssClass:'freeze',  emoji:'🥶' };
    if (wc >= -20) return { label:'Gélido',          cssClass:'extreme', emoji:'❄️' };
    return               { label:'Extremo',          cssClass:'extreme', emoji:'🧊' };
  },
  comfortPercent(wc) {
    return Math.min(100, Math.max(0, ((wc + 30) / 65) * 100));
  },
  gearRecommendation(wc) {
    if (wc >= 25) return 'Ropa ligera — Hidratación frecuente';
    if (wc >= 15) return 'Chaqueta ligera — Sin guantes';
    if (wc >= 5)  return 'Chaqueta técnica — Guantes finos';
    if (wc >= -5) return 'Ropa térmica — Guantes de invierno';
    if (wc >= -15)return 'Traje completo de invierno — Heated gear';
    return              '⚠ PELIGRO: Riesgo de hipotermia';
  }
};

/* ═══════════════════════════════════════
   WEATHER API (Open-Meteo)
═══════════════════════════════════════ */
const WMO = {
  0:{d:'Despejado',emoji:'☀️'}, 1:{d:'Mayormente despejado',emoji:'🌤'}, 2:{d:'Parcialmente nublado',emoji:'⛅'},
  3:{d:'Nublado',emoji:'☁️'}, 45:{d:'Niebla',emoji:'🌫'}, 48:{d:'Niebla con escarcha',emoji:'🌫'},
  51:{d:'Llovizna ligera',emoji:'🌦'}, 53:{d:'Llovizna',emoji:'🌦'}, 55:{d:'Llovizna intensa',emoji:'🌧'},
  61:{d:'Lluvia ligera',emoji:'🌧'}, 63:{d:'Lluvia',emoji:'🌧'}, 65:{d:'Lluvia intensa',emoji:'🌧'},
  71:{d:'Nieve ligera',emoji:'🌨'}, 73:{d:'Nieve',emoji:'❄️'}, 75:{d:'Nevada fuerte',emoji:'❄️'},
  80:{d:'Chubascos',emoji:'🌦'}, 81:{d:'Chubascos fuertes',emoji:'🌧'}, 82:{d:'Chubascos muy fuertes',emoji:'⛈'},
  95:{d:'Tormenta',emoji:'⛈'}, 96:{d:'Tormenta con granizo',emoji:'⛈'}, 99:{d:'Tormenta severa',emoji:'⛈'}
};

async function fetchWeatherData(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,surface_pressure',
    wind_speed_unit: 'kmh', timezone: 'auto'
  });
  const res  = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
  const data = await res.json();
  const c    = data.current;
  const wmo  = WMO[c.weather_code] || { d:'Desconocido', emoji:'🌡' };
  return {
    temp:        Math.round(c.temperature_2m * 10) / 10,
    humidity:    c.relative_humidity_2m,
    windSpeed:   Math.round(c.wind_speed_10m),
    windDir:     c.wind_direction_10m,
    windGust:    Math.round(c.wind_gusts_10m),
    weatherCode: c.weather_code,
    condition:   wmo.d,
    emoji:       wmo.emoji,
    pressure:    Math.round(c.surface_pressure)
  };
}

function windDirLabel(deg) {
  return ['N','NE','E','SE','S','SO','O','NO'][Math.round(deg / 45) % 8];
}

function weatherHazards(w) {
  const h = [];
  if ([51,53,55,61,63,65,80,81,82,95,96,99].includes(w.weatherCode)) h.push('lluvia');
  if ([71,73,75].includes(w.weatherCode)) h.push('nieve');
  if (w.temp <= 2) h.push('posible hielo');
  if (w.windGust > 60) h.push('ráfagas fuertes');
  return h;
}

/* ═══════════════════════════════════════
   GEOCODING (Nominatim)
═══════════════════════════════════════ */
async function reverseGeocode(lat, lon) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`, { headers:{'User-Agent':'BikerWeather/1.0'} });
    const data = await res.json();
    const a    = data.address || {};
    return a.city || a.town || a.village || a.municipality || a.county || data.display_name?.split(',')[0] || 'Ubicación';
  } catch { return 'Sin conexión'; }
}

async function geocode(query) {
  const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=es`, { headers:{'User-Agent':'BikerWeather/1.0'} });
  const data = await res.json();
  if (!data.length) throw new Error('Lugar no encontrado');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
}

function interpolatePoints(from, to, n) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    pts.push({ lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + (to.lon - from.lon) * t, index: i });
  }
  return pts;
}

/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
const App = {
  position:         null,
  gpsSpeed:         null,
  routeSpeed:       80,
  weather:          null,
  windChill:        null,
  lastWeatherFetch: 0,
  weatherInterval:  null,
  lastGeocodedPos:  null,
  wakeLock:         null,
  wakeLockEnabled:  false,
  gyroData:         { alpha:0, beta:0, gamma:0 },
  sessionActive:    false,
  sessionStart:     null,
  sessionSamples:   [],
  sessionCurves:    [],
  sessionTimer:     null,
  curveState:       { inCurve:false, startTime:null, startPos:null, maxAngle:0, dir:null },
  curveCountL:      0,
  curveCountR:      0,
  rideMode:         'free',
  rideDestination:  null,
  sessionReport:    null,
  mapInitialized:   false,
  leafletMap:       null,
  riderMarker:      null,
  routeLine:        null,
  routePoints:      [],
  waypointMarkers:  [],
  followRider:      true
};

const REFRESH_MS     = 5 * 60 * 1000;
const CURVE_THRESH   = 8;
const CURVE_MIN_MS   = 600;

/* ═══════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════ */
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'info') {
  const c  = $('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className   = 'toast ' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function setStatusPill(id, state) {
  const el = $('status-' + id);
  if (!el) return;
  el.className = 'status-pill' + (state === 'active' ? ' active' : state === 'error' ? ' error' : state === 'warn' ? ' warn' : '');
}

function setEl(id, val) { const e = $(id); if (e) e.textContent = val; }

function updateWindChillUI(wc, cls) {
  const el = $('wc-value');
  if (el) { el.textContent = (wc > 0 ? '+' : '') + wc; el.className = 'temp-giant ' + cls.cssClass; }
  setEl('wc-emoji', cls.emoji);
  setEl('wc-class', cls.label);
  const needle = $('comfort-needle');
  if (needle) needle.style.left = WindChill.comfortPercent(wc) + '%';
  setEl('gear-rec', WindChill.gearRecommendation(wc));
  // HUD
  const hudWc = $('hud-wc');
  if (hudWc) { hudWc.textContent = (wc > 0 ? '+' : '') + wc + '°'; hudWc.className = 'hud-wc-val ' + cls.cssClass; }
  setEl('hud-wc-class', cls.label);
}

function updateWeatherUI(w) {
  setEl('w-temp',     w.temp + '°C');
  setEl('w-humidity', w.humidity + '%');
  setEl('w-wind',     w.windSpeed + ' km/h');
  setEl('w-wind-hero',w.windSpeed + ' km/h');
  setEl('w-gust',     w.windGust + ' km/h');
  setEl('w-pressure', w.pressure + '');
  setEl('w-winddir',  windDirLabel(w.windDir));
  setEl('w-condition',w.condition);
  const em = $('w-condition-emoji'); if (em) em.textContent = w.emoji;
  const sub = $('w-condition-sub'); if (sub) sub.textContent = 'Viento ' + w.windSpeed + ' km/h · Dir ' + windDirLabel(w.windDir);
  setEl('last-update', new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }));
}

function updateHazardsUI(hazards) {
  const el = $('hazards-list');
  if (!el) return;
  el.innerHTML = hazards.length
    ? hazards.map(h => '<span class="hazard-tag">⚠ ' + h + '</span>').join('')
    : '<span class="hazard-ok">Sin alertas de conducción</span>';
}

function updateLocationUI(name, lat, lon) {
  setEl('loc-name',   name);
  setEl('loc-coords', lat.toFixed(4) + ', ' + lon.toFixed(4));
}

function updateGpsSpeedUI(speed) {
  setEl('gps-speed-value', speed != null ? speed : '--');
  setEl('hud-speed', speed != null ? speed : '0');
}

function updateRouteSpeedUI(speed) {
  setEl('speed-value', Math.round(speed));
  setEl('route-speed-lbl', Math.round(speed));
  document.querySelectorAll('.speed-preset').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.speed) === Math.round(speed));
  });
  const sl = $('speed-slider');
  if (sl) {
    sl.value = speed;
    const pct = ((speed - sl.min) / (sl.max - sl.min)) * 100;
    sl.style.background = 'linear-gradient(to right, var(--orange) 0%, var(--orange) ' + pct + '%, var(--bg4) ' + pct + '%)';
  }
}

function updateGyroUI(roll, pitch, alpha) {
  // Pestaña inclinación
  const horizon = $('bike-horizon');
  if (horizon) horizon.style.transform = 'rotate(' + (-roll) + 'deg)';
  setEl('gyro-roll',  (roll  > 0 ? '+' : '') + Math.round(roll)  + '°');
  setEl('gyro-pitch', (pitch > 0 ? '+' : '') + Math.round(pitch) + '°');
  setEl('gyro-head',  Math.round(alpha) + '°');
  updateAxisBar('bar-roll',  roll,  45);
  updateAxisBar('bar-pitch', pitch, 45);
  setEl('axis-roll-num',  (roll  > 0 ? '+' : '') + Math.round(roll)  + '°');
  setEl('axis-pitch-num', (pitch > 0 ? '+' : '') + Math.round(pitch) + '°');
  // HUD
  const hudBar = $('hud-horizon-bar');
  if (hudBar) hudBar.style.transform = 'rotate(' + (-roll) + 'deg)';
  setEl('hud-roll-val', Math.abs(Math.round(roll)) + '°');
  const hudDir = $('hud-roll-dir');
  if (hudDir) {
    if (Math.abs(roll) < 5)  { hudDir.textContent = '—';      hudDir.style.color = 'var(--text-dim)'; }
    else if (roll < 0) { hudDir.textContent = '↰ IZQ'; hudDir.style.color = 'var(--ice)'; }
    else               { hudDir.textContent = '↱ DER'; hudDir.style.color = 'var(--orange)'; }
  }
}

function updateAxisBar(id, value, max) {
  const bar = $(id);
  if (!bar) return;
  const pct = Math.min(100, Math.abs(value) / max * 100);
  bar.style.width = pct + '%';
  bar.style.background = pct > 70 ? 'var(--red)' : pct > 40 ? 'var(--amber)' : 'var(--orange)';
}

function updateWakeLockUI(active) {
  const btn = $('wakelock-badge');
  if (!btn) return;
  btn.classList.toggle('active', active);
  const t = btn.querySelector('.wl-text');
  if (t) t.textContent = active ? 'SCREEN ON' : 'SCREEN';
}

function renderWaypoints(waypoints) {
  const c = $('waypoints-list');
  if (!c) return;
  if (!waypoints.length) { c.innerHTML = '<p class="no-route">Introduce un destino para ver la ruta</p>'; return; }
  c.innerHTML = waypoints.map(p => {
    if (p.loading) return '<div class="wp-card"><div class="wp-num">' + p.index + '</div><div class="wp-info"><div class="skeleton" style="height:13px;width:120px;margin-bottom:5px"></div><div class="skeleton" style="height:10px;width:80px"></div></div><div class="wp-temp"><div class="skeleton" style="height:22px;width:44px"></div></div></div>';
    const wc  = p.windChill;
    const cls = p.classification ? p.classification.cssClass : 'cool';
    const em  = p.classification ? p.classification.emoji : '';
    return '<div class="wp-card loaded"><div class="wp-num">' + p.index + '</div><div class="wp-info"><div class="wp-name">' + p.name + '</div><div class="wp-meta">' + (p.weather ? p.weather.temp : '--') + '°C · ' + (p.weather ? p.weather.condition : '') + '</div></div><div class="wp-temp"><div class="wp-wc ' + cls + '">' + em + ' ' + (wc > 0 ? '+' : '') + wc + '°</div><div class="wp-wc-lbl">sensación</div></div></div>';
  }).join('');
}

/* ═══════════════════════════════════════
   GPS
═══════════════════════════════════════ */
function startGPS() {
  if (!navigator.geolocation) {
    toast('GPS no disponible', 'error');
    setStatusPill('gps', 'error');
    return;
  }
  setStatusPill('gps', 'warn');

  // Posición rápida primero
  navigator.geolocation.getCurrentPosition(
    pos => onGPSPosition(pos),
    err => console.warn('Quick GPS failed:', err.message),
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
  );

  // Watch continuo
  navigator.geolocation.watchPosition(
    pos => onGPSPosition(pos),
    err => {
      console.error('GPS watch error:', err.code, err.message);
      setStatusPill('gps', 'error');
      toast('GPS: ' + (err.code === 1 ? 'Permiso denegado' : err.code === 2 ? 'Sin señal' : 'Timeout'), 'error');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}

async function onGPSPosition(pos) {
  App.position = {
    lat:      pos.coords.latitude,
    lon:      pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading:  pos.coords.heading,
    speed:    pos.coords.speed
  };
  setStatusPill('gps', 'active');

  // Velocidad GPS con suavizado
  if (pos.coords.speed !== null && pos.coords.speed >= 0) {
    const raw = Math.round(pos.coords.speed * 3.6);
    App.gpsSpeed = App.gpsSpeed === null ? raw : Math.round(App.gpsSpeed * 0.7 + raw * 0.3);
    updateGpsSpeedUI(App.gpsSpeed);
    computeWindChill();
  }

  // Mapa
  if (App.mapInitialized) mapUpdatePosition(App.position.lat, App.position.lon);

  // Geocoding
  if (shouldGeocode(App.position)) {
    App.lastGeocodedPos = App.position;
    const name = await reverseGeocode(App.position.lat, App.position.lon);
    updateLocationUI(name, App.position.lat, App.position.lon);
  }

  // Meteo
  const now = Date.now();
  if (!App.weather || (now - App.lastWeatherFetch > REFRESH_MS)) {
    await loadWeather(App.position.lat, App.position.lon);
  }
}

function shouldGeocode(pos) {
  if (!App.lastGeocodedPos) return true;
  const R = 6371000;
  const dLat = (pos.lat - App.lastGeocodedPos.lat) * Math.PI / 180;
  const dLon = (pos.lon - App.lastGeocodedPos.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(pos.lat*Math.PI/180)*Math.cos(App.lastGeocodedPos.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) > 200;
}

/* ═══════════════════════════════════════
   METEO
═══════════════════════════════════════ */
async function loadWeather(lat, lon) {
  setStatusPill('weather', 'warn');
  try {
    const w = await fetchWeatherData(lat, lon);
    App.weather = w;
    App.lastWeatherFetch = Date.now();
    updateWeatherUI(w);
    updateHazardsUI(weatherHazards(w));
    setStatusPill('weather', 'active');
    computeWindChill();
    if (!App.weatherInterval) {
      App.weatherInterval = setInterval(() => { if (App.position) loadWeather(App.position.lat, App.position.lon); }, REFRESH_MS);
    }
  } catch(err) {
    setStatusPill('weather', 'error');
    toast('Error meteo: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════
   WIND CHILL
═══════════════════════════════════════ */
function computeWindChill() {
  if (!App.weather) return;
  const speed = App.gpsSpeed || 0;
  const eff   = WindChill.effectiveSpeed(speed, App.weather.windSpeed, App.weather.windDir, App.position?.heading || 0);
  const wc    = WindChill.calculate(App.weather.temp, eff);
  const cls   = WindChill.classify(wc);
  App.windChill = wc;
  updateWindChillUI(wc, cls);
  setEl('real-temp', (App.weather.temp > 0 ? '+' : '') + App.weather.temp + '°');
  setEl('eff-speed', Math.round(eff) + ' km/h');
}

/* ═══════════════════════════════════════
   GIROSCOPIO
═══════════════════════════════════════ */
function startGyro() {
  if (!window.DeviceOrientationEvent) { setStatusPill('gyro', 'error'); return; }
  const startListening = () => {
    window.addEventListener('deviceorientation', e => {
      const alpha = e.alpha || 0, beta = e.beta || 0, gamma = e.gamma || 0;
      const roll  = -gamma; // invertir signo: gamma negativo = izquierda real
      App.gyroData = { alpha, beta, gamma: roll };
      updateGyroUI(roll, beta, alpha);
      if (App.sessionActive) detectCurve(roll, App.position);
    }, true);
    setStatusPill('gyro', 'active');
  };
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') startListening(); }).catch(() => setStatusPill('gyro', 'error'));
  } else {
    startListening();
  }
}

/* ═══════════════════════════════════════
   WAKE LOCK
═══════════════════════════════════════ */
async function enableWakeLock() {
  if (!('wakeLock' in navigator)) { updateWakeLockUI(false); return; }
  try {
    App.wakeLock = await navigator.wakeLock.request('screen');
    App.wakeLockEnabled = true;
    updateWakeLockUI(true);
    App.wakeLock.addEventListener('release', () => { if (App.wakeLockEnabled) setTimeout(enableWakeLock, 1000); });
  } catch(e) { updateWakeLockUI(false); }
}

async function disableWakeLock() {
  App.wakeLockEnabled = false;
  if (App.wakeLock) { await App.wakeLock.release(); App.wakeLock = null; }
  updateWakeLockUI(false);
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && App.wakeLockEnabled) enableWakeLock(); });

/* ═══════════════════════════════════════
   ROUTE (waypoints)
═══════════════════════════════════════ */
async function calculateRoute(destQuery, speed) {
  if (!App.position) { toast('Esperando GPS…', 'info'); return; }
  try {
    const dest = await geocode(destQuery);
    const pts  = interpolatePoints(App.position, dest, 3);
    renderWaypoints(pts.map(p => ({ ...p, loading: true })));
    const results = await Promise.all(pts.map(async p => {
      const name    = await reverseGeocode(p.lat, p.lon);
      const weather = await fetchWeatherData(p.lat, p.lon);
      const eff     = WindChill.effectiveSpeed(speed, weather.windSpeed, weather.windDir);
      const wc      = WindChill.calculate(weather.temp, eff);
      return { ...p, name, weather, windChill: wc, classification: WindChill.classify(wc), loading: false };
    }));
    renderWaypoints(results);
    if (App.mapInitialized) {
      results.forEach(p => mapAddWaypoint(p.lat, p.lon, p.index));
    }
  } catch(err) { toast(err.message, 'error'); }
}

/* ═══════════════════════════════════════
   MAPA (Leaflet)
═══════════════════════════════════════ */
function initMap() {
  if (App.mapInitialized || typeof L === 'undefined') return;
  App.leafletMap = L.map('leaflet-map', { zoomControl: false, attributionControl: false })
    .setView([App.position?.lat || 40.4, App.position?.lon || -3.7], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(App.leafletMap);
  L.control.zoom({ position: 'bottomright' }).addTo(App.leafletMap);
  App.leafletMap.on('dragstart', () => { App.followRider = false; });

  App.riderMarker = L.marker([App.position?.lat || 40.4, App.position?.lon || -3.7], {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:36px;height:36px;background:#ff5500;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(255,85,0,0.4),0 0 16px rgba(255,85,0,0.6);display:flex;align-items:center;justify-content:center;font-size:16px">🏍</div>',
      iconSize: [36,36], iconAnchor: [18,18]
    }),
    zIndexOffset: 1000
  }).addTo(App.leafletMap);

  App.routeLine = L.polyline([], { color:'#ff5500', weight:4, opacity:0.85 }).addTo(App.leafletMap);
  App.routePoints = [];
  App.mapInitialized = true;
}

function mapUpdatePosition(lat, lon) {
  if (!App.mapInitialized) return;
  App.riderMarker.setLatLng([lat, lon]);
  if (App.sessionActive) {
    App.routePoints.push([lat, lon]);
    App.routeLine.setLatLngs(App.routePoints);
  }
  if (App.followRider) App.leafletMap.setView([lat, lon]);
}

function mapAddWaypoint(lat, lon, index) {
  if (!App.mapInitialized) return;
  const m = L.marker([lat, lon], {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:26px;height:26px;background:#0c0c15;border:2px solid #29d9ff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:11px;font-weight:700;color:#29d9ff">' + index + '</div>',
      iconSize: [26,26], iconAnchor: [13,13]
    })
  }).addTo(App.leafletMap);
  App.waypointMarkers.push(m);
}

function mapMarkCurve(lat, lon, dir) {
  if (!App.mapInitialized || !lat) return;
  L.marker([lat, lon], {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;background:' + (dir==='L'?'rgba(41,217,255,0.2)':'rgba(255,85,0,0.2)') + ';border:1px solid ' + (dir==='L'?'#29d9ff':'#ff5500') + ';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:' + (dir==='L'?'#29d9ff':'#ff5500') + '">' + (dir==='L'?'↰':'↱') + '</div>',
      iconSize:[18,18], iconAnchor:[9,9]
    })
  }).addTo(App.leafletMap);
}

function mapClear() {
  App.routePoints = [];
  if (App.routeLine) App.routeLine.setLatLngs([]);
  App.waypointMarkers.forEach(m => App.leafletMap.removeLayer(m));
  App.waypointMarkers = [];
  App.followRider = true;
}

/* ═══════════════════════════════════════
   DETECCIÓN DE CURVAS
═══════════════════════════════════════ */
function detectCurve(roll, pos) {
  const abs = Math.abs(roll);
  if (!App.curveState.inCurve) {
    if (abs >= CURVE_THRESH) {
      App.curveState = { inCurve:true, startTime:Date.now(), startPos:pos, maxAngle:abs, dir: roll < 0 ? 'L' : 'R' };
    }
  } else {
    if (abs >= CURVE_THRESH) {
      if (abs > App.curveState.maxAngle) App.curveState.maxAngle = abs;
      App.curveState.dir = roll < 0 ? 'L' : 'R';
    } else {
      const dur = Date.now() - App.curveState.startTime;
      if (dur >= CURVE_MIN_MS) {
        const curve = { dir: App.curveState.dir, maxAngle: Math.round(App.curveState.maxAngle * 10)/10, duration: Math.round(dur/100)/10, lat: App.curveState.startPos?.lat, lon: App.curveState.startPos?.lon, t: Date.now() - App.sessionStart };
        App.sessionCurves.push(curve);
        onCurveDetected(curve);
      }
      App.curveState = { inCurve:false, startTime:null, startPos:null, maxAngle:0, dir:null };
    }
  }
}

function onCurveDetected(curve) {
  if (curve.dir === 'L') { App.curveCountL++; setEl('hud-curves-l', App.curveCountL); }
  else                   { App.curveCountR++; setEl('hud-curves-r', App.curveCountR); }
  mapMarkCurve(curve.lat, curve.lon, curve.dir);
  const flash = $('curve-flash');
  if (flash) {
    flash.textContent = curve.dir === 'L' ? '↰ ' + curve.maxAngle + '°' : '↱ ' + curve.maxAngle + '°';
    flash.className   = 'curve-flash show ' + (curve.dir === 'L' ? 'left' : 'right');
    setTimeout(() => flash.classList.remove('show'), 1500);
  }
}

/* ═══════════════════════════════════════
   SESIÓN
═══════════════════════════════════════ */
function startSession() {
  App.sessionActive  = true;
  App.sessionStart   = Date.now();
  App.sessionSamples = [];
  App.sessionCurves  = [];
  App.curveCountL    = 0;
  App.curveCountR    = 0;
  App.curveState     = { inCurve:false, startTime:null, startPos:null, maxAngle:0, dir:null };
  setEl('hud-curves-l', '0');
  setEl('hud-curves-r', '0');

  // Muestra timer
  $('session-timer')?.classList.add('show');
  App.sessionTimer = setInterval(() => {
    const el = Date.now() - App.sessionStart;
    const s  = Math.floor(el/1000)%60, m = Math.floor(el/60000)%60, h = Math.floor(el/3600000);
    setEl('session-time', (h>0?pad(h)+':':'') + pad(m) + ':' + pad(s));
    // Muestra sample cada 1s
    App.sessionSamples.push({ t: el, lat: App.position?.lat, lon: App.position?.lon, speed: App.gpsSpeed, roll: App.gyroData.gamma, wc: App.windChill, temp: App.weather?.temp });
  }, 1000);
}

function pad(n) { return String(n).padStart(2,'0'); }

function stopSession() {
  App.sessionActive = false;
  clearInterval(App.sessionTimer);
  $('session-timer')?.classList.remove('show');
  const report = buildReport();
  App.sessionReport = report;
  renderReport(report);
  $('report-panel')?.classList.add('show');
}

/* ═══════════════════════════════════════
   INFORME
═══════════════════════════════════════ */
function buildReport() {
  const dur    = Date.now() - App.sessionStart;
  const speeds = App.sessionSamples.map(s => s.speed).filter(v => v != null);
  const wcs    = App.sessionSamples.map(s => s.wc).filter(v => v != null);
  const rolls  = App.sessionSamples.map(s => s.roll).filter(v => v != null);
  const cL     = App.sessionCurves.filter(c => c.dir === 'L');
  const cR     = App.sessionCurves.filter(c => c.dir === 'R');
  const maxAng = App.sessionCurves.length ? Math.max(...App.sessionCurves.map(c => c.maxAngle)) : 0;
  const avgAng = App.sessionCurves.length ? Math.round(App.sessionCurves.reduce((a,c)=>a+c.maxAngle,0)/App.sessionCurves.length*10)/10 : 0;
  return {
    meta:   { mode: App.rideMode, destination: App.rideDestination, startTime: App.sessionStart, duration: dur, durationFmt: fmtDur(dur) },
    speed:  { max: speeds.length?Math.max(...speeds):0, avg: speeds.length?Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length):0, history: speeds },
    thermal:{ minWC: wcs.length?Math.min(...wcs):null, avgWC: wcs.length?Math.round(wcs.reduce((a,b)=>a+b,0)/wcs.length*10)/10:null, history: wcs },
    inclin: { maxAngle: Math.max(...rolls.map(Math.abs), 0), history: rolls },
    curves: { total: App.sessionCurves.length, left: cL.length, right: cR.length, list: App.sessionCurves, maxAngle: maxAng, avgAngle: avgAng }
  };
}

function fmtDur(ms) {
  const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60);
  return h>0?h+'h '+m%60+'m':m>0?m+'m '+s%60+'s':s+'s';
}

function renderReport(r) {
  const c = $('report-content');
  if (!c) return;
  const title = r.meta.mode === 'route' ? 'Ruta a ' + r.meta.destination : 'Ruta libre';
  const score = (r.speed.max>100?1:0)+(r.curves.total>5?1:0)+(r.inclin.maxAngle>20?1:0)+(r.curves.total>15?1:0)+(r.inclin.maxAngle>35?1:0);
  const ratings = [
    {s:0, r:'ROOKIE',     stars:1, d:'Ruta tranquila, buena para empezar.'},
    {s:1, r:'ROOKIE',     stars:1, d:'Ruta tranquila, buena para empezar.'},
    {s:2, r:'INTERMEDIO', stars:2, d:'Ruta variada con buen control.'},
    {s:3, r:'AVANZADO',   stars:3, d:'Buen ritmo. Curvas bien trazadas.'},
    {s:4, r:'EXPERTO',    stars:4, d:'Excelente manejo. Curvas y velocidad notables.'},
    {s:5, r:'MOTOGP PRO', stars:5, d:'Ruta técnica e intensa. Gran nivel de pilotaje.'}
  ];
  const rating = ratings[Math.min(score, 5)];

  c.innerHTML = `
    <div class="report-wrap">
      <div class="report-header">
        <div class="report-logo">🏍 BIKERWEATHER</div>
        <div class="report-title">${title}</div>
        <div class="report-date">${new Date(r.meta.startTime).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        <div class="report-duration">Duración: <strong>${r.meta.durationFmt}</strong></div>
      </div>
      <div class="report-kpis">
        <div class="report-kpi"><div class="kpi-value" style="color:#ff5500">${r.speed.max} km/h</div><div class="kpi-label">VEL. MÁXIMA</div></div>
        <div class="report-kpi"><div class="kpi-value" style="color:#ffb300">${r.speed.avg} km/h</div><div class="kpi-label">VEL. MEDIA</div></div>
        <div class="report-kpi"><div class="kpi-value" style="color:#29d9ff">${r.thermal.minWC != null ? (r.thermal.minWC>0?'+':'')+r.thermal.minWC+'°C' : '--'}</div><div class="kpi-label">SENSACIÓN MÍN.</div></div>
        <div class="report-kpi"><div class="kpi-value" style="color:#00f0a0">${r.curves.total}</div><div class="kpi-label">CURVAS TOTALES</div></div>
      </div>
      <div class="report-section">
        <div class="report-section-title">ANÁLISIS DE CURVAS</div>
        <div class="report-curves-grid">
          <div class="curve-stat left"><div class="curve-arrow">↰</div><div class="curve-count">${r.curves.left}</div><div class="curve-lbl">IZQUIERDA</div></div>
          <div class="curve-center"><div class="curve-big-num">${r.curves.total}</div><div class="curve-lbl">TOTAL</div><div class="curve-sub">Máx. <strong>${r.curves.maxAngle}°</strong> · Media <strong>${r.curves.avgAngle}°</strong></div></div>
          <div class="curve-stat right"><div class="curve-arrow">↱</div><div class="curve-count">${r.curves.right}</div><div class="curve-lbl">DERECHA</div></div>
        </div>
        ${angleDistChart(r.curves.list)}
      </div>
      <div class="report-section">
        <div class="report-section-title">PERFIL DE VELOCIDAD</div>
        ${lineChartSVG(r.speed.history, '#ff5500', 0, Math.max(r.speed.max,20), 'km/h')}
      </div>
      <div class="report-section">
        <div class="report-section-title">PERFIL DE INCLINACIÓN</div>
        ${inclinChartSVG(r.inclin.history, r.curves.list)}
      </div>
      <div class="report-section">
        <div class="report-section-title">SENSACIÓN TÉRMICA EN RUTA</div>
        ${lineChartSVG(r.thermal.history, '#29d9ff', r.thermal.minWC != null ? r.thermal.minWC-2 : 0, r.thermal.avgWC != null ? r.thermal.avgWC+5 : 20, '°C')}
      </div>
      ${topCurvesHTML(r.curves.list)}
      <div class="report-section report-rating">
        <div class="report-section-title">CLASIFICACIÓN DE PILOTO</div>
        <div class="rating-content">
          <div class="rating-stars">${'★'.repeat(rating.stars)}${'☆'.repeat(5-rating.stars)}</div>
          <div class="rating-title">${rating.r}</div>
          <div class="rating-desc">${rating.d}</div>
        </div>
      </div>
      <div class="report-footer">Generado por BikerWeather · ${new Date().toLocaleString('es-ES')}</div>
    </div>`;
}

function lineChartSVG(data, color, min, max, unit) {
  if (!data || data.length < 2) return '<p class="report-empty">Sin datos</p>';
  const W=320,H=80,pl=32,pr=10,pt=10,pb=20,iW=W-pl-pr,iH=H-pt-pb,range=max-min||1;
  const pts = data.map((v,i)=>[(pl+(i/(data.length-1))*iW),(pt+iH-((v-min)/range)*iH)]);
  const linePath = 'M'+pts.map(p=>p.join(',')).join(' L');
  const areaPath = 'M'+pl+','+(pt+iH)+' L'+pts.map(p=>p.join(',')).join(' L')+' L'+(pl+iW)+','+(pt+iH)+' Z';
  const gid = 'g'+Math.random().toString(36).slice(2);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.3"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>
    <line x1="${pl}" y1="${pt}" x2="${pl+iW}" y2="${pt}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    <line x1="${pl}" y1="${pt+iH/2}" x2="${pl+iW}" y2="${pt+iH/2}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    <text x="${pl-4}" y="${pt+4}" font-size="8" fill="#5a5a7a" text-anchor="end">${Math.round(max)}</text>
    <text x="${pl-4}" y="${pt+iH+4}" font-size="8" fill="#5a5a7a" text-anchor="end">${Math.round(min)}</text>
    <path d="${areaPath}" fill="url(#${gid})"/>
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    <text x="${pl+iW}" y="${pt-2}" font-size="8" fill="${color}" text-anchor="end">${Math.max(...data)}${unit}</text>
  </svg>`;
}

function inclinChartSVG(data, curves) {
  if (!data || data.length < 2) return '<p class="report-empty">Sin datos</p>';
  const W=320,H=100,pl=32,pr=10,pt=10,pb=20,iW=W-pl-pr,iH=H-pt-pb;
  const absMax = Math.max(45, ...data.map(Math.abs));
  const midY   = pt+iH/2;
  const pts    = data.map((v,i)=>[(pl+(i/(data.length-1))*iW),(midY-(v/absMax)*(iH/2))]);
  const linePath = 'M'+pts.map(p=>p.join(',')).join(' L');
  const marks  = curves.map(c=>{
    const idx = Math.min(Math.round((c.t/1000)),data.length-1);
    const x   = pl+(idx/(data.length-1))*iW;
    return `<line x1="${x}" y1="${pt}" x2="${x}" y2="${pt+iH}" stroke="${c.dir==='L'?'#29d9ff':'#ff5500'}" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <line x1="${pl}" y1="${midY}" x2="${pl+iW}" y2="${midY}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <text x="${pl-4}" y="${pt+4}" font-size="7" fill="#ff5500" text-anchor="end">+${absMax}°</text>
    <text x="${pl-4}" y="${midY+4}" font-size="7" fill="#5a5a7a" text-anchor="end">0°</text>
    <text x="${pl-4}" y="${pt+iH+4}" font-size="7" fill="#29d9ff" text-anchor="end">-${absMax}°</text>
    ${marks}
    <path d="${linePath}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1" stroke-linejoin="round"/>
  </svg>`;
}

function angleDistChart(list) {
  if (!list.length) return '<p class="report-empty">Sin curvas</p>';
  const bs = [{l:'8-15°',mn:8,mx:15},{l:'15-25°',mn:15,mx:25},{l:'25-35°',mn:25,mx:35},{l:'35-45°',mn:35,mx:45},{l:'>45°',mn:45,mx:999}];
  const counts = bs.map(b=>list.filter(c=>c.maxAngle>=b.mn&&c.maxAngle<b.mx).length);
  const maxC   = Math.max(...counts,1);
  return '<div class="angle-dist">'+bs.map((b,i)=>'<div class="angle-bucket"><div class="angle-bar-wrap"><div class="angle-bar" style="height:'+Math.round((counts[i]/maxC)*60)+'px;background:'+(counts[i]>0?'#ff5500':'#141420')+'"></div></div><div class="angle-count">'+counts[i]+'</div><div class="angle-label">'+b.l+'</div></div>').join('')+'</div>';
}

function topCurvesHTML(list) {
  if (!list.length) return '';
  const top = [...list].sort((a,b)=>b.maxAngle-a.maxAngle).slice(0,5);
  return '<div class="report-section"><div class="report-section-title">TOP CURVAS MÁS PRONUNCIADAS</div><div class="top-curves-list">'+
    top.map((c,i)=>'<div class="top-curve-row"><div class="tc-rank">#'+(i+1)+'</div><div class="tc-dir '+(c.dir==='L'?'left':'right')+'">'+(c.dir==='L'?'↰ IZQ':'↱ DER')+'</div><div class="tc-angle">'+c.maxAngle+'°</div><div class="tc-bar-wrap"><div class="tc-bar" style="width:'+Math.round(c.maxAngle/90*100)+'%;background:'+(c.dir==='L'?'#29d9ff':'#ff5500')+'"></div></div><div class="tc-dur">'+c.duration+'s</div></div>').join('')+
  '</div></div>';
}

function shareWhatsApp(r) {
  const txt = encodeURIComponent([
    '🏍 *BikerWeather — Informe de Ruta*',
    '📍 ' + (r.meta.mode==='route'?'Ruta a '+r.meta.destination:'Ruta libre'),
    '⏱ Duración: ' + r.meta.durationFmt,
    '',
    '🚀 Vel. máxima: ' + r.speed.max + ' km/h · Media: ' + r.speed.avg + ' km/h',
    '🌡 Sensación mínima: ' + (r.thermal.minWC!=null?r.thermal.minWC+'°C':'--'),
    '🔄 Curvas: ' + r.curves.total + ' (↰ '+r.curves.left+' · ↱ '+r.curves.right+')',
    '📐 Ángulo máximo: ' + r.curves.maxAngle + '°',
    '',
    '_Generado con BikerWeather_'
  ].join('\n'));
  window.open('https://wa.me/?text=' + txt, '_blank');
}

/* ═══════════════════════════════════════
   NAV TABS
═══════════════════════════════════════ */
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const sec = $(target); if (sec) sec.classList.add('active');
      btn.classList.add('active');
      if (target === 'section-riding' && App.mapInitialized) {
        setTimeout(() => App.leafletMap.invalidateSize(), 100);
      }
    });
  });
}

/* ═══════════════════════════════════════
   RIDING CONTROLS
═══════════════════════════════════════ */
function initRidingControls() {
  $('mode-free')?.addEventListener('click', () => {
    App.rideMode = 'free';
    $('mode-free').classList.add('active');
    $('mode-dest').classList.remove('active');
    $('ride-dest-wrap').classList.add('hidden');
  });
  $('mode-dest')?.addEventListener('click', () => {
    App.rideMode = 'route';
    $('mode-dest').classList.add('active');
    $('mode-free').classList.remove('active');
    $('ride-dest-wrap').classList.remove('hidden');
  });

  $('btn-start-route')?.addEventListener('click', async () => {
    if (!App.position) { toast('Esperando GPS…', 'info'); return; }
    App.rideDestination = App.rideMode === 'route' ? ($('ride-dest-input')?.value?.trim() || null) : null;
    if (App.rideMode === 'route' && !App.rideDestination) { toast('Introduce un destino', 'info'); return; }

    $('pre-ride-controls').style.display = 'none';
    const mc = $('map-container'); if (mc) mc.style.display = 'block';

    if (!App.mapInitialized) initMap();
    else { mapClear(); }

    if (App.position) mapUpdatePosition(App.position.lat, App.position.lon);
    setTimeout(() => { if (App.leafletMap) { App.leafletMap.invalidateSize(); App.leafletMap.setView([App.position.lat, App.position.lon], 15); } }, 200);

    if (App.rideDestination) calculateRoute(App.rideDestination, App.routeSpeed).catch(e => toast(e.message, 'error'));

    startSession();
    toast('Ruta iniciada ▶', 'ok');
  });

  $('btn-stop-route')?.addEventListener('click', () => stopSession());
  $('btn-recenter')?.addEventListener('click', () => {
    App.followRider = true;
    if (App.position && App.leafletMap) App.leafletMap.setView([App.position.lat, App.position.lon], 15, { animate:true });
  });
}

/* ═══════════════════════════════════════
   SPEED SLIDER (ruta)
═══════════════════════════════════════ */
function initSpeedSlider() {
  const sl = $('speed-slider');
  const apply = kmh => { App.routeSpeed = kmh; updateRouteSpeedUI(kmh); };
  sl?.addEventListener('input', e => apply(parseInt(e.target.value)));
  document.querySelectorAll('.speed-preset').forEach(btn => btn.addEventListener('click', () => apply(parseInt(btn.dataset.speed))));
  updateRouteSpeedUI(App.routeSpeed);
}

/* ═══════════════════════════════════════
   ROUTE TAB CONTROLS
═══════════════════════════════════════ */
function initRouteControls() {
  const input = $('dest-input'), btn = $('btn-route'), clr = $('btn-clear-route');
  btn?.addEventListener('click', async () => {
    const q = input?.value?.trim();
    if (!q)              { toast('Introduce un destino', 'info'); return; }
    if (!App.position)   { toast('Esperando GPS…', 'info'); return; }
    btn.disabled = true;
    await calculateRoute(q, App.routeSpeed).catch(e => toast(e.message,'error'));
    btn.disabled = false;
  });
  input?.addEventListener('keydown', e => { if (e.key==='Enter') btn?.click(); });
  clr?.addEventListener('click', () => { renderWaypoints([]); if (input) input.value=''; });
}

/* ═══════════════════════════════════════
   REPORT CONTROLS
═══════════════════════════════════════ */
function initReportControls() {
  $('btn-close-report')?.addEventListener('click', () => $('report-panel')?.classList.remove('show'));
  $('btn-whatsapp')?.addEventListener('click', () => { if (App.sessionReport) shareWhatsApp(App.sessionReport); });
  $('btn-new-route')?.addEventListener('click', () => {
    $('report-panel')?.classList.remove('show');
    $('pre-ride-controls').style.display = 'flex';
    const mc = $('map-container'); if (mc) mc.style.display = 'none';
    App.sessionReport = null;
  });
}

/* ═══════════════════════════════════════
   SENSOR DETECTION
═══════════════════════════════════════ */
function detectAPIs() {
  const set = (id, ok) => {
    const el = $(id); if (!el) return;
    el.textContent = ok ? '✓ Disponible' : '✗ No disponible';
    el.className   = 'sensor-val ' + (ok ? 'ok' : 'no');
  };
  set('sensor-orient',   'DeviceOrientationEvent' in window);
  set('sensor-motion',   'DeviceMotionEvent' in window);
  set('sensor-wakelock', 'wakeLock' in navigator);
  set('sensor-geo',      'geolocation' in navigator);
}

/* ═══════════════════════════════════════
   GPS DIAGNOSTIC
═══════════════════════════════════════ */
function initGpsDiag() {
  $('btn-gps-test')?.addEventListener('click', () => {
    const log   = $('gps-diag-log'); if (!log) return;
    const lines = [];
    const add   = m => { lines.push(m); log.innerHTML = lines.join('<br>'); };
    add('▶ Iniciando diagnóstico...');
    add('GPS API: ' + ('geolocation' in navigator ? '✓' : '✗'));
    add('HTTPS: ' + (location.protocol === 'https:' ? '✓' : '✗ ' + location.protocol));
    add('Solicitando posición...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        add('✓ OK — ' + pos.coords.latitude.toFixed(5) + ', ' + pos.coords.longitude.toFixed(5));
        add('Precisión: ' + Math.round(pos.coords.accuracy) + 'm');
        add('Velocidad: ' + (pos.coords.speed!=null ? Math.round(pos.coords.speed*3.6)+' km/h' : 'no disponible'));
      },
      err => { add('✗ Error ' + err.code + ': ' + ['','Permiso denegado','Sin señal','Timeout'][err.code]); },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 }
    );
  });
}

/* ═══════════════════════════════════════
   MAIN
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Service worker
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  detectAPIs();
  initNav();
  initSpeedSlider();
  initRouteControls();
  initRidingControls();
  initReportControls();
  initGpsDiag();

  // Calibrar giroscopio
  $('btn-calibrate')?.addEventListener('click', () => { toast('Calibrado ✓', 'ok'); });

  // Wake Lock
  $('wakelock-badge')?.addEventListener('click', async () => {
    if (App.wakeLockEnabled) await disableWakeLock(); else await enableWakeLock();
  });
  await enableWakeLock();

  // Online/offline
  window.addEventListener('online',  () => { const b=$('offline-banner'); if(b) b.classList.remove('show'); });
  window.addEventListener('offline', () => { const b=$('offline-banner'); if(b) b.classList.add('show'); });

  // GPS — arrancar
  startGPS();

  // Giroscopio — arrancar
  startGyro();

  // Slider track
  const sl = $('speed-slider');
  if (sl) {
    const upd = () => { const p=((sl.value-sl.min)/(sl.max-sl.min))*100; sl.style.background=`linear-gradient(to right,var(--orange) 0%,var(--orange) ${p}%,var(--bg4) ${p}%)`; };
    sl.addEventListener('input', upd); upd();
  }
});
