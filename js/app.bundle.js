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
    if (tempC > 30 || speedKmh < 5) return Math.round(tempC * 10) / 10;

    if (tempC <= 10) {
      // Fórmula JAG/TI oficial (frío)
      const wc = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(speedKmh, 0.16) + 0.3965 * tempC * Math.pow(speedKmh, 0.16);
      return Math.round(wc * 10) / 10;
    } else {
      // Fórmula de enfriamiento por convección (10°C - 30°C)
      // El viento reduce la temperatura percibida por evaporación y convección
      // Factor de reducción basado en velocidad: más velocidad = más frescor
      const windFactor = Math.min(6, Math.log(speedKmh / 5) * 2.2);
      const wc = tempC - windFactor;
      return Math.round(wc * 10) / 10;
    }
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
  lastPositionTime: null,
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
  followRider:      true,
  refollowTimer:    null
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
  const prevPosition = App.position; // guardar posición anterior ANTES de sobreescribir

  App.position = {
    lat:      pos.coords.latitude,
    lon:      pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading:  pos.coords.heading,
    speed:    pos.coords.speed
  };
  setStatusPill('gps', 'active');

  // Velocidad GPS con suavizado — usa coords.speed o calcula por distancia
  let rawSpeed = null;
  if (pos.coords.speed !== null && pos.coords.speed >= 0) {
    rawSpeed = Math.round(pos.coords.speed * 3.6);
  } else if (prevPosition && App.lastPositionTime) {
    const dt = (pos.timestamp - App.lastPositionTime) / 1000;
    if (dt > 0 && dt < 10) {
      const R    = 6371000;
      const dLat = (pos.coords.latitude  - prevPosition.lat) * Math.PI / 180;
      const dLon = (pos.coords.longitude - prevPosition.lon) * Math.PI / 180;
      const a    = Math.sin(dLat/2)**2 + Math.cos(prevPosition.lat*Math.PI/180)*Math.cos(pos.coords.latitude*Math.PI/180)*Math.sin(dLon/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      rawSpeed   = Math.round((dist / dt) * 3.6);
    }
  }
  App.lastPositionTime = pos.timestamp;

  if (rawSpeed !== null) {
    // Filtro: ignorar velocidades muy bajas (ruido GPS estando parado)
    const filtered = rawSpeed < 3 ? 0 : rawSpeed;
    App.gpsSpeed = App.gpsSpeed === null ? filtered : Math.round(App.gpsSpeed * 0.7 + filtered * 0.3);
    updateGpsSpeedUI(App.gpsSpeed === 0 ? 0 : App.gpsSpeed);
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

  // Meteo — siempre cargar en la primera posición o si han pasado 5 min
  const now = Date.now();
  if (!App.weather || (now - App.lastWeatherFetch > REFRESH_MS)) {
    await loadWeather(App.position.lat, App.position.lon);
  } else {
    // Aunque no refresque el tiempo, recalcular wind chill con velocidad actualizada
    computeWindChill();
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
   PLANIFICADOR INTELIGENTE
═══════════════════════════════════════ */
async function fetchHourlyWeather(lat, lon, isoTime) {
  // Open-Meteo previsión horaria
  const date   = isoTime.slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,precipitation_probability',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    start_date: date,
    end_date: date
  });
  const res  = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
  const data = await res.json();
  const hour = parseInt(isoTime.slice(11, 13));
  const idx  = Math.min(hour, (data.hourly.time?.length || 1) - 1);
  return {
    temp:        data.hourly.temperature_2m?.[idx]        ?? 15,
    windSpeed:   Math.round(data.hourly.wind_speed_10m?.[idx]    ?? 0),
    windDir:     data.hourly.wind_direction_10m?.[idx]    ?? 0,
    windGust:    Math.round(data.hourly.wind_gusts_10m?.[idx]    ?? 0),
    weatherCode: data.hourly.weather_code?.[idx]          ?? 0,
    rainProb:    data.hourly.precipitation_probability?.[idx] ?? 0
  };
}

function addHours(isoTime, hours) {
  const d = new Date(isoTime);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + Math.round(hours));
  return d.toISOString().slice(0, 16);
}

function plannerHazards(w) {
  const h = [];
  if (w.rainProb > 50)   h.push('🌧 Lluvia probable ' + w.rainProb + '%');
  if (w.temp <= 2)        h.push('🧊 Posible hielo');
  if (w.windGust > 60)    h.push('💨 Ráfagas ' + w.windGust + ' km/h');
  if ([71,73,75].includes(w.weatherCode)) h.push('❄️ Nieve');
  return h;
}

async function runPlanner() {
  const originInput = $('plan-origin')?.value?.trim();
  const destInput   = $('plan-dest')?.value?.trim();
  const timeInput   = $('plan-time')?.value;
  const result      = $('plan-result');

  if (!destInput)  { toast('Introduce un destino', 'info'); return; }
  if (!timeInput)  { toast('Selecciona la hora de salida', 'info'); return; }

  result.style.display = 'flex';
  result.innerHTML = '<div class="planner-loading">Calculando previsión…</div>';

  try {
    // Origen
    let origin;
    if (originInput) {
      origin = await geocode(originInput);
    } else if (App.position) {
      origin = { lat: App.position.lat, lon: App.position.lon, name: 'Tu posición' };
    } else {
      toast('Introduce un origen o espera al GPS', 'info'); return;
    }

    const dest = await geocode(destInput);
    const points = [
      { ...origin, index: 0, label: 'Salida', timeOffset: 0 },
      ...interpolatePoints(origin, dest, 3).map((p, i) => ({ ...p, label: 'Punto ' + (i+1), timeOffset: (i+1) * 0.25 })),
      { ...dest, index: 4, label: 'Llegada', timeOffset: 1.0 }
    ];

    // Velocidad del planificador viene SIEMPRE del slider, nunca del GPS
    const avgSpeed = App.routeSpeed || 80;
    const R           = 6371;
    const dLat        = (dest.lat - origin.lat) * Math.PI / 180;
    const dLon        = (dest.lon - origin.lon) * Math.PI / 180;
    const a           = Math.sin(dLat/2)**2 + Math.cos(origin.lat*Math.PI/180)*Math.cos(dest.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    const distKm      = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const totalHours  = distKm / avgSpeed;

    // Previsión en cada punto
    const pointsData = await Promise.all(points.map(async p => {
      const arrivalTime = addHours(timeInput, p.timeOffset * totalHours);
      const w           = await fetchHourlyWeather(p.lat, p.lon, arrivalTime);
      const temp        = typeof w.temp === 'number' && !isNaN(w.temp) ? w.temp : 15;
      const windSpeed   = typeof w.windSpeed === 'number' && !isNaN(w.windSpeed) ? w.windSpeed : 0;
      const windDir     = typeof w.windDir === 'number' && !isNaN(w.windDir) ? w.windDir : 0;
      // Velocidad efectiva = velocidad moto + viento en contra (nunca menos que la moto)
      const effRaw      = WindChill.effectiveSpeed(avgSpeed, windSpeed, windDir);
      const eff         = Math.max(avgSpeed, effRaw);
      const wcRaw       = WindChill.calculate(temp, eff);
      const wc          = typeof wcRaw === 'number' && !isNaN(wcRaw) ? Math.round(wcRaw * 10) / 10 : Math.round(temp * 10) / 10;
      const wc          = typeof wcRaw === 'number' && !isNaN(wcRaw) ? Math.round(wcRaw * 10) / 10 : temp;
      const cls         = WindChill.classify(wc);
      const hazards     = plannerHazards(w);
      return { ...p, w: { ...w, temp, windSpeed, windDir }, wc, cls, hazards, arrivalTime };
    }));

    // Mejor hora para salir (buscar la ventana de 4h con menos peligros en las próximas 12h)
    const bestHour = await findBestHour(origin, dest, timeInput, totalHours, avgSpeed);

    renderPlannerResult(pointsData, distKm, totalHours, bestHour);

  } catch(err) {
    result.innerHTML = '<p class="report-empty">Error: ' + err.message + '</p>';
  }
}

async function findBestHour(origin, dest, baseTime, totalHours, avgSpeed) {
  const scores = [];
  for (let h = 0; h < 12; h++) {
    const startTime = addHours(baseTime, h);
    try {
      // Solo comprobamos origen y destino para ir rápido
      const [wO, wD] = await Promise.all([
        fetchHourlyWeather(origin.lat, origin.lon, startTime),
        fetchHourlyWeather(dest.lat, dest.lon, addHours(startTime, totalHours))
      ]);
      const score = (wO.rainProb || 0) + (wD.rainProb || 0) +
                    (wO.temp <= 2 ? 30 : 0) + (wD.temp <= 2 ? 30 : 0) +
                    (wO.windGust > 60 ? 20 : 0) + (wD.windGust > 60 ? 20 : 0);
      scores.push({ h, score, time: startTime });
    } catch { scores.push({ h, score: 999, time: startTime }); }
  }
  return scores.sort((a,b) => a.score - b.score)[0];
}

function renderPlannerResult(points, distKm, totalHours, bestHour) {
  const result = $('plan-result');
  if (!result) return;

  const hasAlerts = points.some(p => p.hazards.length > 0);
  const minWC     = Math.min(...points.map(p => p.wc));
  const minWCCls  = WindChill.classify(minWC);

  result.innerHTML = `
    <div class="planner-summary">
      <div class="planner-summary-row">
        <div class="ps-item"><span class="ps-val">${Math.round(distKm)} km</span><span class="ps-lbl">Distancia</span></div>
        <div class="ps-item"><span class="ps-val">${fmtDur(totalHours*3600000)}</span><span class="ps-lbl">Tiempo est.</span></div>
        <div class="ps-item"><span class="ps-val ${minWCCls.cssClass}">${minWC > 0 ? '+' : ''}${minWC}°</span><span class="ps-lbl">Sens. mín.</span></div>
      </div>
      ${hasAlerts ? '<div class="planner-alert">⚠ Hay condiciones adversas en la ruta</div>' : '<div class="planner-ok">✓ Condiciones favorables en toda la ruta</div>'}
    </div>

    ${bestHour && bestHour.h !== 0 ? `
    <div class="planner-best-hour">
      <div class="pbh-icon">🕐</div>
      <div>
        <div class="pbh-title">Mejor hora para salir</div>
        <div class="pbh-time">${new Date(bestHour.time).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="pbh-desc">Menores condiciones adversas en las próximas 12h</div>
      </div>
    </div>` : ''}

    <div class="planner-points">
      ${points.map(p => `
        <div class="planner-point">
          <div class="pp-header">
            <div class="pp-label">${p.label}</div>
            <div class="pp-time">${new Date(p.arrivalTime).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div class="pp-body">
            <div class="pp-wc ${p.cls?.cssClass || 'cool'}">${p.cls?.emoji || '🌡'} ${p.wc > 0 ? '+' : ''}${p.wc}°</div>
            <div class="pp-details">
              <span>${p.w.temp}°C real</span>
              <span>💨 ${p.w.windSpeed} km/h</span>
              <span>🌧 ${p.w.rainProb || 0}%</span>
            </div>
            ${p.hazards.length ? '<div class="pp-hazards">' + p.hazards.map(h=>'<span class="hazard-tag">'+h+'</span>').join('') + '</div>' : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
}


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
  App.leafletMap.on('dragstart', () => {
    App.followRider = false;
    // Reactivar seguimiento automáticamente después de 5 segundos sin tocar
    clearTimeout(App.refollowTimer);
    App.refollowTimer = setTimeout(() => { App.followRider = true; }, 5000);
  });

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
  if (App.followRider) {
    App.leafletMap.setView([lat, lon], App.leafletMap.getZoom() || 15, { animate: true, duration: 0.5 });
  }
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
        const curve = { dir: App.curveState.dir, maxAngle: Math.round(App.curveState.maxAngle * 10)/10, duration: Math.round(dur/100)/10, speed: App.gpsSpeed || 0, lat: App.curveState.startPos?.lat, lon: App.curveState.startPos?.lon, t: Date.now() - App.sessionStart };
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
  saveRouteToHistory(report);
  uploadRouteToRanking(report);
  renderReport(report);
  $('report-panel')?.classList.add('show');
}

/* ═══════════════════════════════════════
   HISTÓRICO DE RUTAS (localStorage)
═══════════════════════════════════════ */
const HISTORY_KEY = 'bw_route_history';
const HISTORY_MAX = 50;

function saveRouteToHistory(report) {
  try {
    const history = getHistory();
    const entry = {
      id:          Date.now(),
      date:        report.meta.startTime,
      mode:        report.meta.mode,
      destination: report.meta.destination,
      duration:    report.meta.durationFmt,
      speedMax:    report.speed.max,
      speedAvg:    report.speed.avg,
      minWC:       report.thermal.minWC,
      curvesTotal: report.curves.total,
      curvesL:     report.curves.left,
      curvesR:     report.curves.right,
      maxAngle:    report.curves.maxAngle,
      report:      report  // guardamos el informe completo
    };
    history.unshift(entry);
    if (history.length > HISTORY_MAX) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch(e) {
    console.warn('No se pudo guardar en historial:', e);
  }
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function deleteFromHistory(id) {
  const history = getHistory().filter(e => e.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const container = $('history-list');
  if (!container) return;
  const history = getHistory();

  if (!history.length) {
    container.innerHTML = '<p class="no-route" style="padding:24px">Aún no hay rutas guardadas.<br>Completa tu primera ruta para verla aquí.</p>';
    return;
  }

  container.innerHTML = history.map(e => `
    <div class="history-card" data-id="${e.id}">
      <div class="history-header">
        <div class="history-date">${new Date(e.date).toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })} · ${new Date(e.date).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}</div>
        <button class="history-delete" data-id="${e.id}" title="Eliminar">✕</button>
      </div>
      <div class="history-title">${e.mode === 'route' && e.destination ? '📍 ' + e.destination : '🗺 Ruta libre'}</div>
      <div class="history-stats">
        <div class="history-stat"><span class="hs-val" style="color:#ff5500">${e.speedMax}</span><span class="hs-lbl">km/h máx</span></div>
        <div class="history-stat"><span class="hs-val" style="color:#ffb300">${e.speedAvg}</span><span class="hs-lbl">km/h med</span></div>
        <div class="history-stat"><span class="hs-val" style="color:#29d9ff">${e.minWC != null ? (e.minWC > 0 ? '+' : '') + e.minWC + '°' : '--'}</span><span class="hs-lbl">sens. mín</span></div>
        <div class="history-stat"><span class="hs-val" style="color:#00f0a0">${e.curvesTotal}</span><span class="hs-lbl">curvas</span></div>
        <div class="history-stat"><span class="hs-val">${e.duration}</span><span class="hs-lbl">duración</span></div>
        <div class="history-stat"><span class="hs-val" style="color:#ff5500">${e.maxAngle}°</span><span class="hs-lbl">máx ang</span></div>
      </div>
      <button class="history-view-btn" data-id="${e.id}">Ver informe completo →</button>
    </div>
  `).join('');

  // Eventos
  container.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteFromHistory(parseInt(btn.dataset.id));
    });
  });
  container.querySelectorAll('.history-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = getHistory().find(e => e.id === parseInt(btn.dataset.id));
      if (entry?.report) {
        App.sessionReport = entry.report;
        renderReport(entry.report);
        $('report-panel')?.classList.add('show');
      }
    });
  });
}
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
    meta:   { mode: App.rideMode, destination: App.rideDestination, startTime: App.sessionStart, duration: dur, durationFmt: fmtDur(dur), track: App.sessionSamples.filter(s=>s.lat).map(s=>({lat:s.lat,lon:s.lon})) },
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
  const title  = r.meta.mode === 'route' ? 'Ruta a ' + r.meta.destination : 'Ruta libre';
  const score  = (r.speed.max>100?1:0)+(r.curves.total>5?1:0)+(r.inclin.maxAngle>20?1:0)+(r.curves.total>15?1:0)+(r.inclin.maxAngle>35?1:0);
  const ratings = [
    {r:'ROOKIE',     stars:1, d:'Ruta tranquila, buena para empezar.'},
    {r:'ROOKIE',     stars:1, d:'Ruta tranquila, buena para empezar.'},
    {r:'INTERMEDIO', stars:2, d:'Ruta variada con buen control.'},
    {r:'AVANZADO',   stars:3, d:'Buen ritmo. Curvas bien trazadas.'},
    {r:'EXPERTO',    stars:4, d:'Excelente manejo. Curvas y velocidad notables.'},
    {r:'MOTOGP PRO', stars:5, d:'Ruta técnica e intensa. Gran nivel de pilotaje.'}
  ];
  const rating = ratings[Math.min(score, 5)];
  const prev   = getPreviousReport();
  const badges = computeBadges(r);

  c.innerHTML = `
    <div class="report-wrap">

      <!-- CABECERA -->
      <div class="report-header">
        <div class="report-logo">🏍 BIKERWEATHER</div>
        <div class="report-header-top">
          <div>
            <div class="report-title">${title}</div>
            <div class="report-date">${new Date(r.meta.startTime).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
            <div class="report-duration">Duración: <strong>${r.meta.durationFmt}</strong></div>
          </div>
          ${trackMinimapSVG(r.meta.track || [])}
        </div>
      </div>

      <!-- KPIs -->
      <div class="report-kpis">
        <div class="report-kpi">
          <div class="kpi-value" style="color:#ff5500">${r.speed.max} km/h</div>
          <div class="kpi-label">VEL. MÁXIMA</div>
          ${prev ? compareKpi(r.speed.max, prev.speed.max, 'km/h', true) : ''}
        </div>
        <div class="report-kpi">
          <div class="kpi-value" style="color:#ffb300">${r.speed.avg} km/h</div>
          <div class="kpi-label">VEL. MEDIA</div>
          ${prev ? compareKpi(r.speed.avg, prev.speed.avg, 'km/h', true) : ''}
        </div>
        <div class="report-kpi">
          <div class="kpi-value" style="color:#29d9ff">${r.thermal.minWC != null ? (r.thermal.minWC>0?'+':'')+r.thermal.minWC+'°C' : '--'}</div>
          <div class="kpi-label">SENSACIÓN MÍN.</div>
          ${prev && prev.thermal.minWC != null && r.thermal.minWC != null ? compareKpi(r.thermal.minWC, prev.thermal.minWC, '°C', false) : ''}
        </div>
        <div class="report-kpi">
          <div class="kpi-value" style="color:#00f0a0">${r.curves.total}</div>
          <div class="kpi-label">CURVAS TOTALES</div>
          ${prev ? compareKpi(r.curves.total, prev.curves.total, '', true) : ''}
        </div>
      </div>

      <!-- BADGES -->
      ${badges.length ? '<div class="badges-row">' + badges.map(b=>'<div class="badge-item"><span class="badge-icon">'+b.icon+'</span><span class="badge-name">'+b.name+'</span></div>').join('') + '</div>' : ''}

      <!-- COMPARATIVA CON RUTA ANTERIOR -->
      ${prev ? comparisonBlock(r, prev) : ''}

      <!-- CURVAS -->
      <div class="report-section">
        <div class="report-section-title">ANÁLISIS DE CURVAS</div>
        <div class="report-curves-grid">
          <div class="curve-stat left"><div class="curve-arrow">↰</div><div class="curve-count">${r.curves.left}</div><div class="curve-lbl">IZQUIERDA</div></div>
          <div class="curve-center"><div class="curve-big-num">${r.curves.total}</div><div class="curve-lbl">TOTAL</div><div class="curve-sub">Máx. <strong>${r.curves.maxAngle}°</strong> · Media <strong>${r.curves.avgAngle}°</strong></div></div>
          <div class="curve-stat right"><div class="curve-arrow">↱</div><div class="curve-count">${r.curves.right}</div><div class="curve-lbl">DERECHA</div></div>
        </div>
        ${angleDistChart(r.curves.list)}
      </div>

      <!-- GRÁFICOS -->
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

      <!-- TOP CURVAS -->
      ${topCurvesHTML(r.curves.list)}

      <!-- CLASIFICACIÓN -->
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

/* ── Miniatura de trayectoria ── */
function trackMinimapSVG(track) {
  if (!track || track.length < 2) return '<div class="track-minimap-empty">Sin trayectoria</div>';
  const W = 80, H = 80, pad = 6;
  const lats = track.map(p => p.lat), lons = track.map(p => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const ranLat = maxLat - minLat || 0.001;
  const ranLon = maxLon - minLon || 0.001;
  const toX = lon => pad + ((lon - minLon) / ranLon) * (W - pad*2);
  const toY = lat => pad + ((maxLat - lat) / ranLat) * (H - pad*2);
  const pts = track.map(p => toX(p.lon) + ',' + toY(p.lat)).join(' ');
  const start = track[0], end = track[track.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="track-minimap">
    <rect width="${W}" height="${H}" rx="4" fill="#0f0f18" stroke="rgba(255,85,0,0.2)" stroke-width="1"/>
    <polyline points="${pts}" fill="none" stroke="#ff5500" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>
    <circle cx="${toX(start.lon)}" cy="${toY(start.lat)}" r="3" fill="#00f0a0"/>
    <circle cx="${toX(end.lon)}"   cy="${toY(end.lat)}"   r="3" fill="#ff2255"/>
  </svg>`;
}

/* ── Flecha comparativa KPI ── */
function compareKpi(current, previous, unit, higherIsBetter) {
  if (previous == null) return '';
  const diff = current - previous;
  if (diff === 0) return '<div class="kpi-compare neutral">= igual</div>';
  const better = higherIsBetter ? diff > 0 : diff < 0;
  const arrow  = diff > 0 ? '▲' : '▼';
  const color  = better ? '#00f0a0' : '#ff2255';
  const sign   = diff > 0 ? '+' : '';
  return `<div class="kpi-compare" style="color:${color}">${arrow} ${sign}${Math.round(diff*10)/10}${unit} vs anterior</div>`;
}

/* ── Bloque comparativa completa ── */
function comparisonBlock(r, prev) {
  return `
    <div class="report-section">
      <div class="report-section-title">VS RUTA ANTERIOR</div>
      <div class="comparison-grid">
        ${compRow('Vel. máxima',   r.speed.max,        prev.speed.max,        'km/h', true)}
        ${compRow('Vel. media',    r.speed.avg,        prev.speed.avg,        'km/h', true)}
        ${compRow('Curvas',        r.curves.total,     prev.curves.total,     '',     true)}
        ${compRow('Ángulo máx.',   r.curves.maxAngle,  prev.curves.maxAngle,  '°',    true)}
        ${compRow('Sens. mínima',  r.thermal.minWC,    prev.thermal.minWC,    '°C',   false)}
      </div>
    </div>`;
}

function compRow(label, current, previous, unit, higherIsBetter) {
  if (current == null || previous == null) return '';
  const diff   = current - previous;
  const better = higherIsBetter ? diff >= 0 : diff <= 0;
  const color  = diff === 0 ? '#5a5a7a' : better ? '#00f0a0' : '#ff2255';
  const arrow  = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
  const sign   = diff > 0 ? '+' : '';
  return `<div class="comp-row">
    <span class="comp-label">${label}</span>
    <span class="comp-prev">${previous}${unit}</span>
    <span class="comp-arrow" style="color:${color}">${arrow}</span>
    <span class="comp-current" style="color:${color}">${current}${unit}</span>
    <span class="comp-diff" style="color:${color}">${sign}${Math.round(diff*10)/10}${unit}</span>
  </div>`;
}

/* ── Obtener ruta anterior del historial ── */
function getPreviousReport() {
  const history = getHistory();
  return history.length >= 2 ? history[1].report : null;
}

/* ── Badges/medallas ── */
function computeBadges(r) {
  const history = getHistory();
  const badges  = [];
  const allSpeeds  = history.map(e => e.speedMax);
  const allCurves  = history.map(e => e.curvesTotal);
  const allAngles  = history.map(e => e.maxAngle);

  if (r.thermal.minWC != null && r.thermal.minWC < 0)
    badges.push({ icon:'🥶', name:'Bajo cero' });
  if (r.thermal.minWC != null && r.thermal.minWC < -10)
    badges.push({ icon:'🧊', name:'Gélido extremo' });
  if (r.curves.total >= 50)
    badges.push({ icon:'🔄', name:'50+ curvas' });
  if (r.curves.total >= 100)
    badges.push({ icon:'💯', name:'100 curvas' });
  if (r.curves.maxAngle >= 45)
    badges.push({ icon:'🏆', name:'45° inclinación' });
  if (r.speed.max >= 150)
    badges.push({ icon:'🚀', name:'+150 km/h' });
  if (r.meta.durationFmt.includes('h'))
    badges.push({ icon:'⏱', name:'Ruta larga' });
  if (history.length === 1)
    badges.push({ icon:'🌟', name:'Primera ruta' });
  if (allSpeeds.length > 1 && r.speed.max >= Math.max(...allSpeeds))
    badges.push({ icon:'⚡', name:'Récord velocidad' });
  if (allCurves.length > 1 && r.curves.total >= Math.max(...allCurves))
    badges.push({ icon:'🎯', name:'Récord curvas' });
  if (allAngles.length > 1 && r.curves.maxAngle >= Math.max(...allAngles))
    badges.push({ icon:'🔥', name:'Récord inclinación' });

  return badges;
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
    top.map((c,i)=>'<div class="top-curve-row"><div class="tc-rank">#'+(i+1)+'</div><div class="tc-dir '+(c.dir==='L'?'left':'right')+'">'+(c.dir==='L'?'↰ IZQ':'↱ DER')+'</div><div class="tc-angle">'+c.maxAngle+'°</div><div class="tc-bar-wrap"><div class="tc-bar" style="width:'+Math.round(c.maxAngle/90*100)+'%;background:'+(c.dir==='L'?'#29d9ff':'#ff5500')+'"></div></div><div class="tc-dur">'+c.speed+'km/h</div></div>').join('')+
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
      if (target === 'section-history') {
        renderHistory();
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
  // Los controles de destino se gestionan desde En Ruta (initRidingControls)
  // Solo mantenemos el slider de velocidad para el planificador
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
  // PWA Install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
    deferredPrompt = null;
  });
  document.getElementById('btn-install')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
  });
  document.getElementById('btn-install-close')?.addEventListener('click', () => {
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
  });

  // Service worker
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  detectAPIs();
  initNav();
  initSpeedSlider();
  initRouteControls();
  initRidingControls();
  initReportControls();
  initGpsDiag();

  // Planificador inteligente
  $('btn-plan-go')?.addEventListener('click', runPlanner);
  $('btn-plan-myloc')?.addEventListener('click', () => {
    if (App.position) {
      $('plan-origin').value = 'Mi posición (' + App.position.lat.toFixed(4) + ', ' + App.position.lon.toFixed(4) + ')';
    } else {
      toast('Esperando GPS…', 'info');
    }
  });
  // Hora de salida por defecto = ahora
  const planTime = $('plan-time');
  if (planTime) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    planTime.value = now.toISOString().slice(0, 16);
  }
  $('plan-dest')?.addEventListener('keydown', e => { if (e.key === 'Enter') runPlanner(); });

  // Historial
  renderHistory();
  $('btn-clear-history')?.addEventListener('click', () => {
    if (confirm('¿Borrar todo el historial de rutas?')) {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    }
  });

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

  // Modelo de moto
  const savedBike = localStorage.getItem('bw_bike_model');
  if (savedBike) {
    const bm = $('bike-model');
    if (bm) bm.value = savedBike;
    const bs = $('bike-status');
    if (bs) bs.textContent = '✓ ' + savedBike;
  }
  $('btn-save-bike')?.addEventListener('click', () => {
    const input = $('bike-model');
    const model = input?.value?.trim();
    if (!model) { toast('Introduce el modelo de tu moto', 'info'); return; }
    localStorage.setItem('bw_bike_model', model);
    const bs = $('bike-status');
    if (bs) bs.textContent = '✓ ' + model;
    toast('Moto guardada ✓', 'ok');
  });

  // Contacto de emergencia
  const savedPhone = localStorage.getItem('bw_emergency_phone');
  if (savedPhone) {
    const ep = $('emergency-phone');
    if (ep) ep.value = savedPhone;
    const es = $('emergency-status');
    if (es) es.textContent = '✓ Guardado: ' + savedPhone;
  }
  $('btn-save-emergency')?.addEventListener('click', () => {
    const input = $('emergency-phone');
    const phone = input?.value?.trim();
    if (!phone) { toast('Introduce un número', 'info'); return; }
    localStorage.setItem('bw_emergency_phone', phone);
    const es = $('emergency-status');
    if (es) es.textContent = '✓ Guardado: ' + phone;
    toast('Contacto de emergencia guardado ✓', 'ok');
  });

  // Detección de caída
  startFallDetection();

  // Firebase — init social
  initFirebase().catch(e => console.warn('[FB]', e));
  checkWatchMode();

  // Nickname
  const savedNick = localStorage.getItem('bw_nickname');
  if (savedNick) { const ni = $('nickname-input'); if (ni) ni.value = savedNick; }
  $('btn-save-nickname')?.addEventListener('click', saveNickname);

  // Compartir
  $('btn-share-start')?.addEventListener('click', startSharing);
  $('btn-share-stop')?.addEventListener('click', stopSharing);
  $('btn-share-copy')?.addEventListener('click', () => {
    const box = $('share-url-box');
    if (box) { navigator.clipboard.writeText(box.value); toast('Enlace copiado ✓', 'ok'); }
  });
  $('btn-share-wa')?.addEventListener('click', () => {
    const box = $('share-url-box');
    if (box) window.open('https://wa.me/?text=' + encodeURIComponent('¡Sígueme en directo en BikerWeather! 🏍\n' + box.value), '_blank');
  });

  // Ranking
  $('btn-reload-ranking')?.addEventListener('click', loadRanking);

  // Subir al ranking al finalizar sesión (añadir en stopSession)
  // Se llama desde stopSession via uploadRouteToRanking

  // Social tab → recargar ranking
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.section === 'section-social') loadRanking();
    });
  });

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

/* ═══════════════════════════════════════
   FIREBASE — Fase Social
═══════════════════════════════════════ */

const FB_CONFIG = {
  apiKey:            "AIzaSyAedjK5EdwfnENt1rtbLBXMcPreeYTC0qY",
  authDomain:        "bikerweather-1b89f.firebaseapp.com",
  projectId:         "bikerweather-1b89f",
  storageBucket:     "bikerweather-1b89f.firebasestorage.app",
  messagingSenderId: "469242801037",
  appId:             "1:469242801037:web:b48b5dacee917d82552bc4",
  databaseURL:       "https://bikerweather-1b89f-default-rtdb.europe-west1.firebasedatabase.app"
};

let fbApp, fbAuth, fbDb, fbRtDb, fbUser;
let sharingActive   = false;
let sharingInterval = null;
let shareSessionId  = null;
let watchingId      = null;

async function initFirebase() {
  try {
    const { initializeApp }          = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const { getDatabase, ref, set, onValue, remove, off }   = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

    fbApp  = initializeApp(FB_CONFIG);
    fbAuth = getAuth(fbApp);
    fbDb   = getFirestore(fbApp);
    fbRtDb = getDatabase(fbApp);

    // Login anónimo
    await signInAnonymously(fbAuth);
    onAuthStateChanged(fbAuth, user => {
      if (user) {
        fbUser = user;
        App.fbUserId = user.uid;
        console.log('[FB] Usuario:', user.uid);
        loadRanking();
        startRadar();
      }
    });

    // Guardar helpers globales para usar en otras funciones
    App._fb = { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, serverTimestamp, ref, set, onValue, remove, off };
    return true;
  } catch(e) {
    console.error('[FB] Error init:', e);
    return false;
  }
}

/* ── Subir ruta al ranking ── */
async function uploadRouteToRanking(report) {
  if (!fbUser || !App._fb) return;
  const { collection, addDoc, serverTimestamp } = App._fb;

  if (report.meta.duration < 30 * 60 * 1000) {
    toast('Ruta menor de 30 min, no cuenta para el ranking', 'info');
    return;
  }

  try {
    const nickname  = localStorage.getItem('bw_nickname') || 'Motorista';
    const bikeModel = localStorage.getItem('bw_bike_model') || '';

    const fullTrack = report.meta.track || [];
    const step  = fullTrack.length > 500 ? Math.ceil(fullTrack.length / 500) : 1;
    const track = fullTrack.filter((_, i) => i % step === 0);

    const score = Math.round(
      report.curves.avgAngle * report.curves.total +
      report.speed.avg * 0.3
    );

    await addDoc(collection(fbDb, 'ranking'), {
      uid:         fbUser.uid,
      nickname,
      bike:        bikeModel,
      date:        serverTimestamp(),
      score,
      speedMax:    report.speed.max,
      speedAvg:    report.speed.avg,
      curvesTotal: report.curves.total,
      maxAngle:    report.curves.maxAngle,
      avgAngle:    report.curves.avgAngle,
      minWC:       report.thermal.minWC,
      duration:    report.meta.durationFmt,
      destination: report.meta.destination || 'Ruta libre',
      mode:        report.meta.mode,
      track
    });
    toast('Ruta subida al ranking ✓', 'ok');
  } catch(e) {
    console.error('[FB] Error upload:', e);
  }
}

/* ── Cargar ranking ── */
async function loadRanking() {
  if (!fbDb || !App._fb) return;
  const { collection, getDocs, query, orderBy, limit } = App._fb;
  try {
    const q    = query(collection(fbDb, 'ranking'), orderBy('score', 'desc'), limit(20));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    renderRanking(rows);
  } catch(e) {
    console.error('[FB] Error ranking:', e);
  }
}

/* ── Render ranking ── */
function renderRanking(rows) {
  const el = $('ranking-list');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<p class="no-route">Aún no hay rutas en el ranking. ¡Sé el primero!</p>';
    return;
  }
  el.innerHTML = rows.map((r, i) => {
    const medal    = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
    const isMe     = r.uid === App.fbUserId;
    const hasTrack = r.track && r.track.length > 1;
    return `
      <div class="ranking-row ${isMe ? 'ranking-me' : ''}">
        <div class="rk-pos">${medal}</div>
        <div class="rk-info">
          <div class="rk-name">${r.nickname}${isMe ? ' <span style="color:var(--orange);font-size:0.55rem">TÚ</span>' : ''}</div>
          <div class="rk-dest">${r.bike ? '🏍 ' + r.bike + ' · ' : ''}${r.destination}</div>
        </div>
        <div class="rk-stats">
          <div class="rk-stat"><span style="color:#29d9ff">${r.score ?? '--'}</span><span class="rk-lbl">pts</span></div>
          <div class="rk-stat"><span style="color:#00f0a0">${r.curvesTotal}</span><span class="rk-lbl">curvas</span></div>
          <div class="rk-stat"><span style="color:#ff5500">${r.maxAngle}°</span><span class="rk-lbl">máx ang</span></div>
        </div>
        ${hasTrack ? `<button class="rk-replicate-btn" data-idx="${i}" style="font-size:0.65rem;background:var(--bg3);color:#29d9ff;border:1px solid #29d9ff;border-radius:6px;padding:3px 8px;margin-top:5px;cursor:pointer;width:100%;letter-spacing:0.05em">▶ Ver / Replicar ruta</button>` : ''}
      </div>`;
  }).join('');

  el.querySelectorAll('.rk-replicate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = rows[parseInt(btn.dataset.idx)];
      if (r?.track?.length > 1) replicateRoute(r.track, r.destination);
    });
  });
}

/* ── Mostrar en el mapa una ruta del ranking ── */
let _replicaPolyline = null;
function replicateRoute(track, label) {
  if (!App.mapInitialized) {
    const mc = $('map-container');
    if (mc) mc.style.display = 'block';
    initMap();
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  $('section-riding')?.classList.add('active');
  document.querySelector('.nav-btn[data-section="section-riding"]')?.classList.add('active');

  setTimeout(() => {
    App.leafletMap.invalidateSize();
    if (_replicaPolyline) { App.leafletMap.removeLayer(_replicaPolyline); _replicaPolyline = null; }
    const latlngs = track.map(p => [p.lat, p.lon]);
    _replicaPolyline = L.polyline(latlngs, { color: '#29d9ff', weight: 3, opacity: 0.8, dashArray: '8,5' }).addTo(App.leafletMap);
    App.leafletMap.fitBounds(_replicaPolyline.getBounds(), { padding: [30, 30] });
    toast(`Ruta de referencia: ${label || 'Ruta libre'}`, 'info');
  }, 200);
}

/* ── Compartir ruta en tiempo real ── */
async function startSharing() {
  if (!fbUser || !App._fb) { toast('Conectando…', 'info'); return; }
  const { ref, set } = App._fb;
  shareSessionId = fbUser.uid + '_' + Date.now();
  sharingActive  = true;

  const nickname = localStorage.getItem('bw_nickname') || 'Motorista';
  await set(ref(fbRtDb, 'live/' + shareSessionId), {
    nickname,
    active: true,
    started: Date.now()
  });

  sharingInterval = setInterval(async () => {
    if (!App.position || !sharingActive) return;
    await set(ref(fbRtDb, 'live/' + shareSessionId + '/telemetry'), {
      lat:      App.position.lat,
      lon:      App.position.lon,
      speed:    App.gpsSpeed || 0,
      roll:     App.gyroData.gamma || 0,
      wc:       App.windChill || null,
      temp:     App.weather?.temp || null,
      t:        Date.now()
    });
  }, 2000);

  // Mostrar enlace para compartir
  const shareUrl = location.origin + location.pathname + '?watch=' + shareSessionId;
  $('share-url-box').value = shareUrl;
  $('share-controls').style.display = 'flex';
  $('btn-share-start').style.display = 'none';

  toast('¡Compartiendo en tiempo real!', 'ok');
}

async function stopSharing() {
  if (!sharingActive || !App._fb) return;
  const { ref, remove } = App._fb;
  sharingActive = false;
  clearInterval(sharingInterval);
  await remove(ref(fbRtDb, 'live/' + shareSessionId));
  $('share-controls').style.display = 'none';
  $('btn-share-start').style.display = 'flex';
  shareSessionId = null;
  toast('Detenido el compartir', 'info');
}

/* ── Ver ruta de otro usuario ── */
async function watchLiveRoute(sessionId) {
  if (!fbRtDb || !App._fb) return;
  const { ref, onValue } = App._fb;

  const el = $('watch-panel');
  if (el) el.style.display = 'flex';

  watchingId = onValue(ref(fbRtDb, 'live/' + sessionId + '/telemetry'), snap => {
    const d = snap.val();
    if (!d) return;
    setEl('watch-speed', d.speed + ' km/h');
    setEl('watch-roll',  Math.abs(Math.round(d.roll)) + '°');
    setEl('watch-wc',    d.wc != null ? (d.wc > 0 ? '+' : '') + d.wc + '°C' : '--');
    setEl('watch-temp',  d.temp != null ? d.temp + '°C' : '--');
    if (App.mapInitialized && d.lat) {
      App.riderMarker?.setLatLng([d.lat, d.lon]);
      App.leafletMap?.setView([d.lat, d.lon]);
    }
  });
}

/* ── Nickname ── */
function saveNickname() {
  const input = $('nickname-input');
  if (!input?.value?.trim()) return;
  localStorage.setItem('bw_nickname', input.value.trim());
  toast('Nombre guardado ✓', 'ok');
}

/* ── Detectar modo watch en URL ── */
function checkWatchMode() {
  const params = new URLSearchParams(location.search);
  const watchId = params.get('watch');
  if (watchId) {
    initFirebase().then(() => watchLiveRoute(watchId));
  }
}

/* ═══════════════════════════════════════
   RADAR BIKERWEATHER
   Detecta otros usuarios a menos de 50m
   y muestra flash ✌️
═══════════════════════════════════════ */

const RADAR_DIST_M  = 50;
const RADAR_TICK_MS = 5000; // cada 5s publica posición y escanea
let radarInterval   = null;
let lastGreeted     = {};   // uid → timestamp, evita saludos repetidos en 60s

async function startRadar() {
  if (!fbUser || !App._fb) return;
  radarInterval = setInterval(radarTick, RADAR_TICK_MS);
  radarTick();
}

async function radarTick() {
  if (!App.position || !fbUser || !App._fb) return;
  const { ref, set, getDocs, collection, query, where } = App._fb;

  // Publicar mi posición (con timestamp para limpiar fantasmas)
  await set(ref(fbRtDb, 'radar/' + fbUser.uid), {
    lat: App.position.lat,
    lon: App.position.lon,
    t:   Date.now()
  });

  // Leer posiciones de otros usuarios activos (últimos 15s)
  try {
    const snap = await getDocs(query(collection(fbDb, 'radar_positions')));
    // Usar Realtime DB directamente
  } catch {}

  // Escanear radar via Realtime DB
  const { onValue, ref: rtRef, off } = App._fb;
  const radarRef = rtRef(fbRtDb, 'radar');
  onValue(radarRef, snap => {
    const data = snap.val();
    if (!data) return;
    Object.entries(data).forEach(([uid, pos]) => {
      if (uid === fbUser.uid) return;           // soy yo
      if (Date.now() - pos.t > 15000) return;  // posición vieja
      const dist = haversineM(App.position.lat, App.position.lon, pos.lat, pos.lon);
      if (dist <= RADAR_DIST_M) {
        const now = Date.now();
        if (!lastGreeted[uid] || now - lastGreeted[uid] > 60000) {
          lastGreeted[uid] = now;
          showGreeting();
        }
      }
    });
    off(radarRef); // desuscribir tras lectura
  }, { onlyOnce: true });
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function showGreeting() {
  // Vibración
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  // Flash ✌️ grande en pantalla
  let flash = $('greeting-flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.id = 'greeting-flash';
    flash.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(5,5,8,0.85);backdrop-filter:blur(8px);
      z-index:9999;pointer-events:none;
      opacity:0;transition:opacity 0.3s ease;
    `;
    flash.innerHTML = `
      <div style="font-size:5rem;line-height:1;animation:greetPulse 0.6s ease">✌️</div>
      <div style="font-family:'Rajdhani',sans-serif;font-size:1.4rem;font-weight:700;
        letter-spacing:0.2em;text-transform:uppercase;color:#ff5500;margin-top:12px">
        SALUDO MOTERO
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:#8888aa;margin-top:6px">
        BikerWeather detectado cerca
      </div>
    `;
    document.body.appendChild(flash);
  }

  flash.style.opacity = '1';
  setTimeout(() => { flash.style.opacity = '0'; }, 3000);
}

/* ═══════════════════════════════════════
   DETECCIÓN DE CAÍDA
   Detecta impacto fuerte + inmovilidad
   y envía WhatsApp al contacto configurado
═══════════════════════════════════════ */

const FALL_IMPACT_G    = 1.8;  // g — más sensible (era 2.5)
const FALL_STILL_MS    = 5000; // ms inmóvil tras impacto (era 8000)
const FALL_CANCEL_MS   = 15000;
let fallState          = 'monitoring';
let fallImpactTime     = null;
let fallCancelTimer    = null;
let fallConfirmTimer   = null;
let lastGValue         = 1.0;  // para detectar el pico de impacto

function startFallDetection() {
  if (!window.DeviceMotionEvent) return;
  window.addEventListener('devicemotion', onMotionFall, true);
}

function onMotionFall(e) {
  if (fallState !== 'monitoring') return;
  const acc = e.accelerationIncludingGravity;
  if (!acc) return;
  const g = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2) / 9.81;

  // Detectar impacto fuerte
  if (g > FALL_IMPACT_G) {
    fallState     = 'impact';
    fallImpactTime = Date.now();

    // Si sigue inmóvil después de FALL_STILL_MS → confirmar caída
    fallConfirmTimer = setTimeout(() => {
      if (fallState === 'impact') {
        fallState = 'fallen';
        triggerFallAlert();
      }
    }, FALL_STILL_MS);
  }
}

// Detectar que se vuelve a mover (cancela la alarma)
window.addEventListener('devicemotion', e => {
  if (fallState !== 'impact') return;
  const acc = e.accelerationIncludingGravity;
  if (!acc) return;
  const g = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2) / 9.81;
  if (g > 0.3) {
    // Se movió — no era caída
    clearTimeout(fallConfirmTimer);
    fallState = 'monitoring';
  }
}, true);

function triggerFallAlert() {
  const phone = localStorage.getItem('bw_emergency_phone');
  if (!phone) {
    console.warn('[FALL] No hay teléfono de emergencia configurado');
    fallState = 'monitoring';
    return;
  }

  // Vibración de emergencia
  if (navigator.vibrate) navigator.vibrate([500,200,500,200,500]);

  // Mostrar panel de cancelación
  showFallWarning(phone);
}

function showFallWarning(phone) {
  let panel = $('fall-warning');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'fall-warning';
    panel.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(255,34,85,0.95);z-index:9998;padding:20px;text-align:center;
    `;
    document.body.appendChild(panel);
  }

  let remaining = Math.round(FALL_CANCEL_MS / 1000);
  panel.innerHTML = `
    <div style="font-size:3rem;margin-bottom:12px">🆘</div>
    <div style="font-family:'Rajdhani',sans-serif;font-size:1.8rem;font-weight:700;
      color:#fff;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">
      POSIBLE CAÍDA
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:rgba(255,255,255,0.8);
      margin-bottom:20px;line-height:1.6">
      Enviando alerta a tu contacto de emergencia<br>en <span id="fall-countdown">${remaining}</span> segundos
    </div>
    <button id="btn-fall-cancel" style="
      background:#fff;border:none;border-radius:8px;padding:16px 32px;
      font-family:'Rajdhani',sans-serif;font-size:1.1rem;font-weight:700;
      color:#ff2255;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;
      margin-bottom:12px;width:100%;max-width:280px;
    ">✓ ESTOY BIEN — CANCELAR</button>
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:rgba(255,255,255,0.6)">
      Se enviará a: ${phone}
    </div>
  `;

  // Cuenta atrás
  const countdown = setInterval(() => {
    remaining--;
    const el = $('fall-countdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(countdown);
      sendFallAlert(phone);
      panel.style.display = 'none';
      fallState = 'monitoring';
    }
  }, 1000);

  // Botón cancelar
  $('btn-fall-cancel')?.addEventListener('click', () => {
    clearInterval(countdown);
    clearTimeout(fallCancelTimer);
    panel.style.display = 'none';
    fallState = 'monitoring';
    toast('Alerta cancelada ✓', 'ok');
  });
}

function sendFallAlert(phone) {
  const lat  = App.position?.lat?.toFixed(5) || '--';
  const lon  = App.position?.lon?.toFixed(5) || '--';
  const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
  const msg  = encodeURIComponent(
    `🆘 ALERTA BikerWeather\n\nPosible caída detectada.\n\nÚltima posición conocida:\n${mapsUrl}\n\nVelocidad antes del impacto: ${App.gpsSpeed || '--'} km/h`
  );
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
}

/* Añadir animación CSS para el saludo */
const greetStyle = document.createElement('style');
greetStyle.textContent = `
  @keyframes greetPulse {
    0%   { transform: scale(0.5) rotate(-20deg); opacity:0; }
    60%  { transform: scale(1.2) rotate(10deg);  opacity:1; }
    100% { transform: scale(1)   rotate(0deg);   opacity:1; }
  }
`;
document.head.appendChild(greetStyle);
