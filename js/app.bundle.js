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
      const wc = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(speedKmh, 0.16) + 0.3965 * tempC * Math.pow(speedKmh, 0.16);
      return Math.round(wc * 10) / 10;
    } else {
      const windFactor = Math.min(6, Math.log(speedKmh / 5) * 2.2);
      return Math.round((tempC - windFactor) * 10) / 10;
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
  try {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,surface_pressure',
      wind_speed_unit: 'kmh', timezone: 'auto'
    });
    const res  = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
    if (!res.ok) throw new Error('open-meteo ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.reason || 'open-meteo error');
    const c   = data.current;
    const wmo = WMO[c.weather_code] || { d:'Desconocido', emoji:'🌡' };
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
  } catch(_) {
    const w = await fetchWeatherDataMET(lat, lon);
    w._source = 'MET';
    return w;
  }
}

async function fetchWeatherDataMET(lat, lon) {
  const res  = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('MET ' + res.status);
  const data = await res.json();
  const d    = data.properties.timeseries[0].data;
  const det  = d.instant.details;
  const sym  = d.next_1_hours?.summary?.symbol_code || d.next_6_hours?.summary?.symbol_code || '';
  const MET_MAP = {
    clearsky:      { d:'Despejado',           emoji:'☀️',  wmo:0  },
    fair:          { d:'Poco nublado',         emoji:'🌤️', wmo:1  },
    partlycloudy:  { d:'Parcialmente nublado', emoji:'⛅', wmo:2  },
    cloudy:        { d:'Nublado',              emoji:'☁️', wmo:3  },
    fog:           { d:'Niebla',               emoji:'🌫️', wmo:45 },
    lightrain:     { d:'Lluvia débil',         emoji:'🌦️', wmo:51 },
    rain:          { d:'Lluvia',               emoji:'🌧️', wmo:61 },
    heavyrain:     { d:'Lluvia fuerte',        emoji:'🌧️', wmo:65 },
    sleet:         { d:'Aguanieve',            emoji:'🌨️', wmo:71 },
    snow:          { d:'Nieve',                emoji:'❄️', wmo:71 },
    heavysnow:     { d:'Nevada fuerte',        emoji:'❄️', wmo:75 },
    thunder:       { d:'Tormenta',             emoji:'⛈️', wmo:95 },
  };
  const key  = Object.keys(MET_MAP).find(k => sym.startsWith(k)) || 'fair';
  const wmo  = MET_MAP[key];
  const wspd = Math.round((det.wind_speed || 0) * 3.6);
  return {
    temp:        Math.round((det.air_temperature || 0) * 10) / 10,
    humidity:    Math.round(det.relative_humidity || 0),
    windSpeed:   wspd,
    windDir:     det.wind_from_direction || 0,
    windGust:    Math.round(wspd * 1.3),
    weatherCode: wmo.wmo,
    condition:   wmo.d,
    emoji:       wmo.emoji,
    pressure:    Math.round(det.air_pressure_at_sea_level || 1013)
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
    const res  = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json&accept-language=es', { headers:{'User-Agent':'BikerWeather/1.0'} });
    const data = await res.json();
    const a    = data.address || {};
    return a.city || a.town || a.village || a.municipality || a.county || data.display_name?.split(',')[0] || 'Ubicación';
  } catch { return 'Sin conexión'; }
}

async function geocode(query) {
  const res  = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=1&accept-language=es', { headers:{'User-Agent':'BikerWeather/1.0'} });
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
  gyroData:         { alpha:0, beta:0, gamma:0, _rawRoll:0, _rawPitch:0 },
  tiltFilter:       { roll:0, pitch:0, lastTime:null, gyroReady:false, rollOffset:0, pitchOffset:0,
                      lastGpsHeading:null, lastGpsHeadingTime:null, gpsLean:null },
  gForce:           { long:0, lat:0, peakBrake:0, peakAccel:0, peakLat:0,
                      prevSpeedMs:null, prevSpeedTime:null },
  landscapeMode:    false,
  circuitMode:      false,
  circuitAlt:       null,
  rollFlip:         false,
  pitchFlip:        false,
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
  refollowTimer:    null,
  fbUserId:         null,
  obdConnected: false,
  obd2Rpm:      null,
  obd2Gear:     null,
  obd2Temp:     null,
  obd2Volt:     null,
  obd2Speed:    null,
  obd2OilTemp:  null,
  obd2Load:     null,
  obd2Throttle: null,
  _fb:              null
};

const REFRESH_MS   = 5 * 60 * 1000;
const CURVE_THRESH = 8;
const CURVE_MIN_MS = 600;

/* ═══════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════ */
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'info') {
  const c = $('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
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
  const hudWc = $('hud-wc');
  if (hudWc) { hudWc.textContent = (wc > 0 ? '+' : '') + wc + '°'; hudWc.className = 'hud-wc-val ' + cls.cssClass; }
  setEl('hud-wc-class', cls.label);
}

function updateWeatherUI(w) {
  setEl('w-temp',      w.temp + '°C');
  setEl('w-humidity',  w.humidity + '%');
  setEl('w-wind',      w.windSpeed + ' km/h');
  setEl('w-wind-hero', w.windSpeed + ' km/h');
  setEl('w-gust',      w.windGust + ' km/h');
  setEl('w-pressure',  w.pressure + '');
  setEl('w-winddir',   windDirLabel(w.windDir));
  setEl('w-condition', w.condition);
  const em  = $('w-condition-emoji'); if (em)  em.textContent  = w.emoji;
  const sub = $('w-condition-sub');   if (sub) sub.textContent = 'Viento ' + w.windSpeed + ' km/h · Dir ' + windDirLabel(w.windDir);
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
  setEl('speed-value',     Math.round(speed));
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
  const dr = roll  * (App.rollFlip  ? -1 : 1);
  const dp = pitch * (App.pitchFlip ? -1 : 1);
  const horizon = $('bike-horizon');
  if (horizon) horizon.style.transform = 'rotate(' + (-dr) + 'deg)';
  setEl('gyro-roll',      (dr > 0 ? '+' : '') + Math.round(dr) + '°');
  setEl('gyro-pitch',     (dp > 0 ? '+' : '') + Math.round(dp) + '°');
  setEl('gyro-head',      Math.round(alpha) + '°');
  updateAxisBar('bar-roll',  dr, 45);
  updateAxisBar('bar-pitch', dp, 45);
  setEl('axis-roll-num',  (dr > 0 ? '+' : '') + Math.round(dr) + '°');
  setEl('axis-pitch-num', (dp > 0 ? '+' : '') + Math.round(dp) + '°');
  const hudBar = $('hud-horizon-bar');
  if (hudBar) hudBar.style.transform = 'rotate(' + (-dr) + 'deg)';
  setEl('hud-roll-val', Math.abs(Math.round(dr)) + '°');
  const hudDir = $('hud-roll-dir');
  if (hudDir) {
    if (Math.abs(dr) < 5)  { hudDir.textContent = '—';      hudDir.style.color = 'var(--text-dim)'; }
    else if (dr < 0)       { hudDir.textContent = '↰ IZQ'; hudDir.style.color = 'var(--ice)'; }
    else                   { hudDir.textContent = '↱ DER'; hudDir.style.color = 'var(--orange)'; }
  }
  updateRollOverlay(dr);
}

function updateAxisBar(id, value, max) {
  const bar = $(id);
  if (!bar) return;
  const pct = Math.min(100, Math.abs(value) / max * 100);
  bar.style.width      = pct + '%';
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
  if (!navigator.geolocation) { toast('GPS no disponible', 'error'); setStatusPill('gps', 'error'); return; }
  setStatusPill('gps', 'warn');
  navigator.geolocation.getCurrentPosition(
    pos => onGPSPosition(pos),
    err => console.warn('Quick GPS failed:', err.message),
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
  );
  navigator.geolocation.watchPosition(
    pos => onGPSPosition(pos),
    err => { setStatusPill('gps', 'error'); toast('GPS: ' + (err.code === 1 ? 'Permiso denegado' : err.code === 2 ? 'Sin señal' : 'Timeout'), 'error'); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}

async function onGPSPosition(pos) {
  const prevPosition = App.position;
  App.position = {
    lat: pos.coords.latitude, lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy, heading: pos.coords.heading, speed: pos.coords.speed
  };
  if (pos.coords.altitude !== null) App.circuitAlt = Math.round(pos.coords.altitude);
  setStatusPill('gps', 'active');

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
    const filtered = rawSpeed < 3 ? 0 : rawSpeed;
    App.gpsSpeed   = App.gpsSpeed === null ? filtered : Math.round(App.gpsSpeed * 0.7 + filtered * 0.3);
    updateGpsSpeedUI(App.gpsSpeed);
    computeWindChill();
    computeGForce(pos.timestamp);
  }

  if (App.mapInitialized) mapUpdatePosition(App.position.lat, App.position.lon);

  if (App.tiltFilter.gyroReady) applyGpsLeanCorrection();

  if (shouldGeocode(App.position)) {
    App.lastGeocodedPos = App.position;
    const name = await reverseGeocode(App.position.lat, App.position.lon);
    updateLocationUI(name, App.position.lat, App.position.lon);
  }

  const now = Date.now();
  const retryWait = App.weather ? REFRESH_MS : 30_000;
  if (now - App.lastWeatherFetch > retryWait) {
    await loadWeather(App.position.lat, App.position.lon);
  } else {
    computeWindChill();
  }
}

function shouldGeocode(pos) {
  if (!App.lastGeocodedPos) return true;
  const R    = 6371000;
  const dLat = (pos.lat - App.lastGeocodedPos.lat) * Math.PI / 180;
  const dLon = (pos.lon - App.lastGeocodedPos.lon) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(pos.lat*Math.PI/180)*Math.cos(App.lastGeocodedPos.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) > 200;
}

/* ═══════════════════════════════════════
   METEO
═══════════════════════════════════════ */
async function loadWeather(lat, lon) {
  setStatusPill('weather', 'warn');
  try {
    const w = await fetchWeatherData(lat, lon);
    App.weather          = w;
    App.lastWeatherFetch = Date.now();
    try { localStorage.setItem('bw_weather', JSON.stringify({ w, ts: Date.now(), lat, lon })); } catch(_) {}
    updateWeatherUI(w);
    updateHazardsUI(weatherHazards(w));
    if (w._source === 'MET') setStatusPill('weather', 'warn'); else setStatusPill('weather', 'active');
    console.info('[meteo] fuente:', w._source === 'MET' ? 'MET Norway (fallback)' : 'open-meteo');
    computeWindChill();
    if (!App.weatherInterval) {
      App.weatherInterval = setInterval(() => { if (App.position) loadWeather(App.position.lat, App.position.lon); }, REFRESH_MS);
    }
  } catch(err) {
    App.lastWeatherFetch = Date.now();
    // Intentar usar datos cacheados recientes (< 2 horas)
    if (!App.weather) {
      try {
        const cached = JSON.parse(localStorage.getItem('bw_weather') || 'null');
        if (cached && (Date.now() - cached.ts) < 7_200_000) {
          App.weather = cached.w;
          updateWeatherUI(cached.w);
          updateHazardsUI(weatherHazards(cached.w));
          computeWindChill();
          setStatusPill('weather', 'warn');
          toast('Meteo: usando datos cacheados', 'info');
          return;
        }
      } catch(_) {}
    }
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
   FUERZAS G
   Longitudinal: delta velocidad GPS / (dt × 9.81)
   Lateral:      tan(roll CF) — física centrípeta
═══════════════════════════════════════ */
function computeGForce(posTimestamp) {
  const now     = posTimestamp || Date.now();
  const speedMs = (App.gpsSpeed || 0) / 3.6;

  if (App.gForce.prevSpeedMs !== null && App.gForce.prevSpeedTime !== null) {
    const dt = (now - App.gForce.prevSpeedTime) / 1000;
    if (dt > 0.1 && dt < 5) {
      const rawLong = (speedMs - App.gForce.prevSpeedMs) / (dt * 9.81);
      App.gForce.long = App.gForce.long * 0.5 + rawLong * 0.5;
      if (App.sessionActive) {
        if (App.gForce.long < -0.05) App.gForce.peakBrake = Math.min(App.gForce.peakBrake, App.gForce.long);
        if (App.gForce.long >  0.05) App.gForce.peakAccel = Math.max(App.gForce.peakAccel, App.gForce.long);
      }
    }
  }
  App.gForce.prevSpeedMs   = speedMs;
  App.gForce.prevSpeedTime = now;

  // G lateral: tan(ángulo de inclinación) — sin necesidad de acelerómetro extra
  const roll = App.gyroData.gamma || 0;
  App.gForce.lat = Math.tan(roll * Math.PI / 180);
  if (App.sessionActive && Math.abs(App.gForce.lat) > Math.abs(App.gForce.peakLat)) {
    App.gForce.peakLat = App.gForce.lat;
  }

  updateGForceHUD();
}

function updateGForceHUD() {
  const gL = App.gForce.long;
  const gT = App.gForce.lat;

  // Frenada (negativo) y aceleración (positivo) se muestran siempre en absoluto con signo visual
  const brakeG = Math.max(0, -gL);
  const accelG = Math.max(0,  gL);
  const latG   = Math.abs(gT);

  const brakeEl = $('hud-g-brake'); const accelEl = $('hud-g-accel'); const latEl = $('hud-g-lat');
  if (!brakeEl) return;

  brakeEl.textContent = brakeG.toFixed(2) + 'G';
  accelEl.textContent = accelG.toFixed(2) + 'G';
  latEl.textContent   = latG.toFixed(2)   + 'G';

  brakeEl.style.color = brakeG > 0.5 ? '#ff2255' : brakeG > 0.25 ? '#ffb300' : 'rgba(255,34,85,0.3)';
  accelEl.style.color = accelG > 0.4 ? '#00f0a0' : accelG > 0.15 ? '#29d9ff' : 'rgba(0,240,160,0.3)';
  latEl.style.color   = latG   > 0.5 ? '#ffb300' : latG   > 0.25 ? '#ff5500' : 'rgba(41,217,255,0.3)';
}

/* ═══════════════════════════════════════
   GIROSCOPIO
═══════════════════════════════════════ */
function startGyro() {
  if (!window.DeviceOrientationEvent) { setStatusPill('gyro', 'error'); return; }
  const startListening = () => {
    window.addEventListener('deviceorientation', e => {
      const alpha = e.alpha || 0, beta = e.beta || 0, gamma = e.gamma || 0;
      App.gyroData.alpha     = alpha;
      // En landscape el eje de lean físico es beta en lugar de gamma
      App.gyroData._rawRoll  = App.landscapeMode ? beta   : -gamma;
      App.gyroData._rawPitch = App.landscapeMode ? -gamma : beta;
      // Fallback directo cuando DeviceMotion no está disponible
      if (!App.tiltFilter.gyroReady) {
        const roll  = App.gyroData._rawRoll  - App.tiltFilter.rollOffset;
        const pitch = App.gyroData._rawPitch - App.tiltFilter.pitchOffset;
        App.gyroData.gamma = roll;
        App.gyroData.beta  = pitch;
        updateGyroUI(roll, pitch, alpha);
        if (App.sessionActive) detectCurve(roll, App.position);
      }
    }, true);
    // Filtro Complementario: rotationRate via DeviceMotion
    if (window.DeviceMotionEvent) {
      const startMotion = () => window.addEventListener('devicemotion', onMotionTilt, true);
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(r => { if (r === 'granted') startMotion(); }).catch(() => {});
      } else {
        startMotion();
      }
    }
    setStatusPill('gyro', 'active');
  };
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') startListening(); }).catch(() => setStatusPill('gyro', 'error'));
  } else {
    startListening();
  }
}

/* ═══════════════════════════════════════
   FILTRO COMPLEMENTARIO DE INCLINACIÓN
   Gyro (rotationRate 60 Hz) + Orientación (referencia absoluta) + GPS (corrección lean)
═══════════════════════════════════════ */
function onMotionTilt(e) {
  const rr  = e.rotationRate;
  const now = Date.now();

  // hasRealGyro: rotationRate disponible con valores reales (no todos los navegadores lo proveen)
  const hasRealGyro = !!(rr && rr.gamma !== null && rr.beta !== null);
  // En landscape los ejes de roll y pitch se invierten (beta↔gamma)
  const gyroRollRate  = hasRealGyro ? (App.landscapeMode ?  (rr.beta  || 0) : -(rr.gamma || 0)) : 0;
  const gyroPitchRate = hasRealGyro ? (App.landscapeMode ? -(rr.gamma || 0) :  (rr.beta  || 0)) : 0;

  if (!App.tiltFilter.gyroReady) {
    App.tiltFilter.gyroReady = true;
    App.tiltFilter.roll      = App.gyroData._rawRoll  || 0;
    App.tiltFilter.pitch     = App.gyroData._rawPitch || 0;
    App.tiltFilter.lastTime  = now;
    const label = hasRealGyro ? 'CF Completo' : 'CF Orientación';
    const cfEl  = $('cf-status');
    if (cfEl) { cfEl.textContent = label; cfEl.className = 'sensor-val ok'; }
    const badge = $('cf-mode-badge');
    if (badge) { badge.textContent = 'CF'; badge.style.color = 'var(--green)'; badge.style.borderColor = 'rgba(0,240,160,0.35)'; badge.style.background = 'rgba(0,240,160,0.08)'; }
    return;
  }

  const dt = Math.min((now - App.tiltFilter.lastTime) / 1000, 0.1);
  App.tiltFilter.lastTime = now;

  const refRoll  = App.gyroData._rawRoll  || 0;
  const refPitch = App.gyroData._rawPitch || 0;

  // Con giróscopo real: alta confianza en tasa angular (0.97)
  // Sin giróscopo real: más peso a la referencia de orientación (0.85)
  const CF_ALPHA = hasRealGyro ? 0.97 : 0.85;
  App.tiltFilter.roll  = CF_ALPHA * (App.tiltFilter.roll  + gyroRollRate  * dt) + (1 - CF_ALPHA) * refRoll;
  App.tiltFilter.pitch = CF_ALPHA * (App.tiltFilter.pitch + gyroPitchRate * dt) + (1 - CF_ALPHA) * refPitch;

  const filteredRoll  = Math.round((App.tiltFilter.roll  - App.tiltFilter.rollOffset)  * 10) / 10;
  const filteredPitch = Math.round((App.tiltFilter.pitch - App.tiltFilter.pitchOffset) * 10) / 10;

  App.gyroData.gamma = filteredRoll;
  App.gyroData.beta  = filteredPitch;

  updateGyroUI(filteredRoll, filteredPitch, App.gyroData.alpha);
  if (App.sessionActive) detectCurve(filteredRoll, App.position);
}

// Corrección física del lean angle usando cambio de rumbo GPS (física centrípeta)
// Solo aplica cuando la velocidad > 15 km/h y hay heading disponible
function applyGpsLeanCorrection() {
  const pos = App.position;
  if (!pos?.heading || !App.gpsSpeed || App.gpsSpeed < 15) return;

  const now = Date.now();
  if (!App.tiltFilter.lastGpsHeading) {
    App.tiltFilter.lastGpsHeading     = pos.heading;
    App.tiltFilter.lastGpsHeadingTime = now;
    return;
  }

  const dtGps = (now - App.tiltFilter.lastGpsHeadingTime) / 1000;
  if (dtGps < 1 || dtGps > 5) {
    App.tiltFilter.lastGpsHeading     = pos.heading;
    App.tiltFilter.lastGpsHeadingTime = now;
    return;
  }

  let dHeading = pos.heading - App.tiltFilter.lastGpsHeading;
  if (dHeading > 180)  dHeading -= 360;
  if (dHeading < -180) dHeading += 360;
  const headingRate = dHeading / dtGps; // grados/s

  // tan(lean) = v² × ω / g  →  lean = atan2(v²·|ω|, g) · sign(ω)
  const v     = App.gpsSpeed / 3.6;
  const omega = headingRate * Math.PI / 180;
  const gpsLean = Math.atan2(v * v * Math.abs(omega), 9.81) * 180 / Math.PI * Math.sign(omega);
  App.tiltFilter.gpsLean = Math.round(gpsLean * 10) / 10;

  // Corrección suave (5%) solo si la discrepancia es entre 5° y 30°
  const diff = gpsLean - App.tiltFilter.roll;
  if (Math.abs(diff) > 5 && Math.abs(diff) < 30) {
    App.tiltFilter.roll += diff * 0.05;
  }

  App.tiltFilter.lastGpsHeading     = pos.heading;
  App.tiltFilter.lastGpsHeadingTime = now;
}

/* ═══════════════════════════════════════
   OVERLAY DE INCLINACIÓN (CABINA DE CAZA)
   Línea de roll + glow ambiental lateral
═══════════════════════════════════════ */
function updateRollOverlay(roll) {
  const overlay = $('roll-overlay');
  const line    = $('roll-line');
  const label   = $('roll-angle-label');
  if (!overlay || !line) return;

  const abs = Math.abs(roll);

  // Paleta de color según ángulo — mismos umbrales que detección de curvas
  let r, g, b;
  if      (abs < 8)  { r=255; g= 85; b=  0; }  // naranja tenue
  else if (abs < 15) { r=  0; g=240; b=160; }  // verde
  else if (abs < 25) { r=255; g=179; b=  0; }  // amarillo
  else if (abs < 35) { r=255; g= 85; b=  0; }  // naranja
  else               { r=255; g= 34; b= 85; }  // rojo

  const alpha = abs < 8 ? 0.4 : 0.92;
  const css   = `rgba(${r},${g},${b},${alpha})`;
  const dim   = `rgba(${r},${g},${b},0.12)`;

  // Rotar línea
  line.style.transform = `rotate(${-roll}deg)`;
  line.style.height     = abs > 30 ? '4px' : abs > 15 ? '3px' : '2px';
  line.style.background = `linear-gradient(to right,transparent 0%,${dim} 6%,${css} 28%,${css} 72%,${dim} 94%,transparent 100%)`;
  line.style.filter = abs > 8 ? `drop-shadow(0 0 ${Math.min(abs * 0.35, 14)}px ${css})` : 'none';

  // Etiqueta de ángulo
  if (label) {
    label.textContent   = abs < 1 ? '0°' : Math.abs(Math.round(roll)) + '°';
    label.style.color   = css;
    label.style.opacity = abs < 3 ? '0' : '1';
    label.style.textShadow = abs > 8 ? `0 0 10px ${css}` : 'none';
  }

  // Glow ambiental direccional — solo en modo landscape
  if (!App.landscapeMode || abs < 8) { overlay.style.boxShadow = ''; return; }

  const t   = Math.min(1, (abs - 8) / 30);        // 0→1 entre 8° y 38°
  const op  = (t * 0.50).toFixed(2);
  const opD = (t * 0.15).toFixed(2);
  const rad = Math.round(80 + abs * 3);
  const gc  = `rgba(${r},${g},${b},${op})`;
  const gd  = `rgba(${r},${g},${b},${opD})`;

  // Más intenso en el lado hacia el que se inclina, tenue en el opuesto
  const strongX = roll > 0 ? `-${rad}px` : `${rad}px`;
  const weakX   = roll > 0 ? `${Math.round(rad*0.35)}px` : `-${Math.round(rad*0.35)}px`;
  overlay.style.boxShadow =
    `inset ${strongX} 0 ${rad*2}px 0 ${gc},` +
    `inset ${weakX} 0 ${rad}px 0 ${gd}`;
}


function toggleLandscapeMode() {
  App.landscapeMode = !App.landscapeMode;
  document.body.classList.toggle('landscape-mode', App.landscapeMode);

  // Sync both landscape toggle buttons (pre-ride + in-session)
  const on = App.landscapeMode;
  const chk = document.getElementById('toggle-landscape');
  if (chk) chk.checked = on;
  const btnMap = $('btn-map-landscape');
  if (btnMap) { btnMap.textContent = on ? '⊡' : '⊞'; btnMap.classList.toggle('active', on); btnMap.title = on ? 'Salir modo horizontal' : 'Modo horizontal'; }

  // Re-bootstrap del CF con los ejes correctos para la nueva orientación
  App.tiltFilter.gyroReady = false;
  App.tiltFilter.roll      = 0;
  App.tiltFilter.pitch     = 0;
  App.tiltFilter.lastTime  = null;

  // Resize circuit canvases when orientation changes
  if (App.circuitMode) setTimeout(resizeCircuitCanvases, 150);

  // Leaflet necesita saber el nuevo tamaño tras la rotación
  if (App.mapInitialized) {
    setTimeout(() => App.leafletMap.invalidateSize(), 100);
    setTimeout(() => App.leafletMap.invalidateSize(), 400);
  }

  updateRollOverlay((App.gyroData.gamma || 0) * (App.rollFlip ? -1 : 1));
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
   Usa SIEMPRE App.routeSpeed (slider)
   Independiente del GPS
═══════════════════════════════════════ */
async function fetchHourlyWeather(lat, lon, isoTime) {
  const date   = isoTime.slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,precipitation_probability',
    wind_speed_unit: 'kmh', timezone: 'auto',
    start_date: date, end_date: date
  });
  const res  = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
  const data = await res.json();
  const hour = parseInt(isoTime.slice(11, 13));
  const idx  = Math.min(hour, (data.hourly.time?.length || 1) - 1);
  return {
    temp:        data.hourly.temperature_2m?.[idx]             ?? 15,
    windSpeed:   Math.round(data.hourly.wind_speed_10m?.[idx]  ?? 0),
    windDir:     data.hourly.wind_direction_10m?.[idx]         ?? 0,
    windGust:    Math.round(data.hourly.wind_gusts_10m?.[idx]  ?? 0),
    weatherCode: data.hourly.weather_code?.[idx]               ?? 0,
    rainProb:    data.hourly.precipitation_probability?.[idx]  ?? 0
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
  if (w.rainProb > 50)                        h.push('🌧 Lluvia probable ' + w.rainProb + '%');
  if (w.temp <= 2)                             h.push('🧊 Posible hielo');
  if (w.windGust > 60)                         h.push('💨 Ráfagas ' + w.windGust + ' km/h');
  if ([71,73,75].includes(w.weatherCode))      h.push('❄️ Nieve');
  return h;
}

async function runPlanner() {
  const originInput = $('plan-origin')?.value?.trim();
  const destInput   = $('plan-dest')?.value?.trim();
  const timeInput   = $('plan-time')?.value;
  const result      = $('plan-result');

  if (!destInput) { toast('Introduce un destino', 'info'); return; }
  if (!timeInput) { toast('Selecciona la hora de salida', 'info'); return; }

  result.style.display = 'flex';
  result.innerHTML = '<div class="planner-loading">Calculando previsión…</div>';

  try {
    let origin;
    if (originInput) {
      origin = await geocode(originInput);
    } else if (App.position) {
      origin = { lat: App.position.lat, lon: App.position.lon, name: 'Tu posición' };
    } else {
      toast('Introduce un origen o espera al GPS', 'info');
      result.style.display = 'none';
      return;
    }

    const dest = await geocode(destInput);

    // Velocidad SIEMPRE del slider — independiente del GPS
    const sliderSpeed = App.routeSpeed || 80;

    // Distancia y tiempo estimado
    const R          = 6371;
    const dLat       = (dest.lat - origin.lat) * Math.PI / 180;
    const dLon       = (dest.lon - origin.lon) * Math.PI / 180;
    const aVal       = Math.sin(dLat/2)**2 + Math.cos(origin.lat*Math.PI/180)*Math.cos(dest.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    const distKm     = R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1-aVal));
    const totalHours = distKm / sliderSpeed;

    const points = [
      { ...origin, label: 'Salida',   timeOffset: 0    },
      ...interpolatePoints(origin, dest, 3).map((p, i) => ({ ...p, label: 'Punto ' + (i+1), timeOffset: (i+1) * 0.25 })),
      { ...dest,   label: 'Llegada',  timeOffset: 1.0  }
    ];

    // Previsión en cada punto — wind chill calculado con sliderSpeed
    const pointsData = await Promise.all(points.map(async p => {
      const arrivalTime = addHours(timeInput, p.timeOffset * totalHours);
      const w           = await fetchHourlyWeather(p.lat, p.lon, arrivalTime);
      // Usar sliderSpeed directamente — no efectiveSpeed para evitar que viento anule la velocidad
      const wc          = WindChill.calculate(w.temp, sliderSpeed);
      const cls         = WindChill.classify(wc);
      const hazards     = plannerHazards(w);
      return { ...p, w, wc, cls, hazards, arrivalTime };
    }));

    const bestHour = await findBestHour(origin, dest, timeInput, totalHours);
    renderPlannerResult(pointsData, distKm, totalHours, bestHour, sliderSpeed);

  } catch(err) {
    result.innerHTML = '<p class="report-empty">Error: ' + err.message + '</p>';
  }
}

async function findBestHour(origin, dest, baseTime, totalHours) {
  const scores = [];
  for (let h = 0; h < 12; h++) {
    const startTime = addHours(baseTime, h);
    try {
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

function renderPlannerResult(points, distKm, totalHours, bestHour, sliderSpeed) {
  const result = $('plan-result');
  if (!result) return;

  const hasAlerts = points.some(p => p.hazards.length > 0);
  const minWC     = Math.min(...points.map(p => p.wc));
  const minWCCls  = WindChill.classify(minWC);

  result.innerHTML =
    '<div class="planner-summary">' +
      '<div class="planner-summary-row">' +
        '<div class="ps-item"><span class="ps-val">' + Math.round(distKm) + ' km</span><span class="ps-lbl">Distancia</span></div>' +
        '<div class="ps-item"><span class="ps-val">' + fmtDur(totalHours*3600000) + '</span><span class="ps-lbl">Tiempo est.</span></div>' +
        '<div class="ps-item"><span class="ps-val ' + minWCCls.cssClass + '">' + (minWC > 0 ? '+' : '') + minWC + '°</span><span class="ps-lbl">Sens. mín.</span></div>' +
        '<div class="ps-item"><span class="ps-val" style="color:var(--orange)">' + sliderSpeed + ' km/h</span><span class="ps-lbl">Velocidad</span></div>' +
      '</div>' +
      (hasAlerts ? '<div class="planner-alert">⚠ Hay condiciones adversas en la ruta</div>' : '<div class="planner-ok">✓ Condiciones favorables en toda la ruta</div>') +
    '</div>' +
    (bestHour && bestHour.h !== 0 ?
      '<div class="planner-best-hour"><div class="pbh-icon">🕐</div><div>' +
        '<div class="pbh-title">Mejor hora para salir</div>' +
        '<div class="pbh-time">' + new Date(bestHour.time).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) + '</div>' +
        '<div class="pbh-desc">Menores condiciones adversas en las próximas 12h</div>' +
      '</div></div>' : '') +
    '<div class="planner-points">' +
    points.map(p =>
      '<div class="planner-point">' +
        '<div class="pp-header">' +
          '<div class="pp-label">' + p.label + '</div>' +
          '<div class="pp-time">' + new Date(p.arrivalTime).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) + '</div>' +
        '</div>' +
        '<div class="pp-body">' +
          '<div class="pp-wc ' + (p.cls ? p.cls.cssClass : 'cool') + '">' + (p.cls ? p.cls.emoji : '🌡') + ' ' + (p.wc > 0 ? '+' : '') + p.wc + '°</div>' +
          '<div class="pp-details">' +
            '<span>' + p.w.temp + '°C real</span>' +
            '<span>💨 ' + p.w.windSpeed + ' km/h viento</span>' +
            '<span>🌧 ' + (p.w.rainProb || 0) + '%</span>' +
          '</div>' +
          (p.hazards.length ? '<div class="pp-hazards">' + p.hazards.map(h=>'<span class="hazard-tag">'+h+'</span>').join('') + '</div>' : '') +
        '</div>' +
      '</div>'
    ).join('') +
    '</div>';
}

/* ═══════════════════════════════════════
   CALCULATE ROUTE (En Ruta)
═══════════════════════════════════════ */
async function calculateRoute(destQuery, speed) {
  if (!App.position) { toast('Esperando GPS…', 'info'); return; }
  try {
    const dest    = await geocode(destQuery);
    const pts     = interpolatePoints(App.position, dest, 3);
    renderWaypoints(pts.map(p => ({ ...p, loading: true })));
    const results = await Promise.all(pts.map(async p => {
      const name    = await reverseGeocode(p.lat, p.lon);
      const weather = await fetchWeatherData(p.lat, p.lon);
      const eff     = WindChill.effectiveSpeed(speed, weather.windSpeed, weather.windDir);
      const wc      = WindChill.calculate(weather.temp, eff);
      return { ...p, name, weather, windChill: wc, classification: WindChill.classify(wc), loading: false };
    }));
    renderWaypoints(results);
    if (App.mapInitialized) results.forEach(p => mapAddWaypoint(p.lat, p.lon, p.index));
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
  App.routeLine  = L.polyline([], { color:'#ff5500', weight:4, opacity:0.85 }).addTo(App.leafletMap);
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
  if (App.followRider) App.leafletMap.setView([lat, lon], App.leafletMap.getZoom() || 15, { animate: true, duration: 0.5 });
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
        const curve = {
          dir:      App.curveState.dir,
          maxAngle: Math.round(App.curveState.maxAngle * 10) / 10,
          duration: Math.round(dur / 100) / 10,
          speed:    App.gpsSpeed || 0,
          lat:      App.curveState.startPos?.lat,
          lon:      App.curveState.startPos?.lon,
          t:        Date.now() - App.sessionStart
        };
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
  // Pulso de brillo en la línea de roll al detectar curva
  const line = $('roll-line');
  if (line) { line.classList.add('roll-line-pulse'); setTimeout(() => line.classList.remove('roll-line-pulse'), 400); }
  const flash = $('curve-flash');
  if (flash) {
    flash.textContent = curve.dir === 'L' ? '↰ ' + curve.maxAngle + '°' : '↱ ' + curve.maxAngle + '°';
    flash.className   = 'curve-flash show ' + (curve.dir === 'L' ? 'left' : 'right');
    setTimeout(() => flash.classList.remove('show'), 1500);
  }
  // Kirk coaching: brief AI feedback on this curve (async, fire-and-forget)
  setTimeout(() => kirkCurveCoach(curve), 800);
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
  App.gForce.peakBrake = 0;
  App.gForce.peakAccel = 0;
  App.gForce.peakLat   = 0;
  _kirkHistory   = [];
  _telBuffer     = [];
  _telLastTs     = 0;
  _kirkAutoListen = true;
  setEl('hud-curves-l', '0');
  setEl('hud-curves-r', '0');
  $('session-timer')?.classList.add('show');
  // Init Kirk voice if not already done (route mode — circuit mode handles it in openCircuit)
  if (!App.circuitMode) {
    initKirkVoice();
    setTimeout(() => { kirkSpeak('Kirk activo.'); }, 400);
  }
  App.sessionTimer = setInterval(() => {
    const elapsed = Date.now() - App.sessionStart;
    const s = Math.floor(elapsed/1000)%60, m = Math.floor(elapsed/60000)%60, h = Math.floor(elapsed/3600000);
    const timeStr = (h>0?pad(h)+':':'') + pad(m) + ':' + pad(s);
    setEl('session-time', timeStr);
    setEl('hud-ls-time',  timeStr);
    if (App.circuitMode) setEl('cir-time', timeStr);
    App.sessionSamples.push({
      t: elapsed, lat: App.position?.lat, lon: App.position?.lon,
      speed: App.gpsSpeed, roll: App.gyroData.gamma, wc: App.windChill, temp: App.weather?.temp,
      gLong: Math.round(App.gForce.long * 100) / 100,
      gLat:  Math.round(App.gForce.lat  * 100) / 100
    });
    // Route mode: update telemetry buffer + run Kirk alerts every 2s
    if (!App.circuitMode) {
      const now = Date.now();
      if (now - _telLastTs >= 2000) {
        _telLastTs = now;
        _telBuffer.push({ spd: Math.round(App.gpsSpeed||0), roll: Math.round(Math.abs(App.gyroData.gamma||0)), hdg: Math.round(App.gyroData.alpha||0), alt: App.circuitAlt||0 });
        if (_telBuffer.length > 30) _telBuffer.shift();
        kirkCheckAlerts();
      }
    }
  }, 1000);
}

function pad(n) { return String(n).padStart(2,'0'); }

function stopSession() {
  App.sessionActive = false;
  _kirkAutoListen   = false;
  _kirkStopListening();
  clearInterval(App.sessionTimer);
  $('session-timer')?.classList.remove('show');
  const report = buildReport();
  App.sessionReport = report;
  saveRouteToHistory(report);
  uploadRouteToRanking(report);
  renderReport(report);
  $('report-panel')?.classList.add('show');
  setTimeout(() => kirkSessionSummary(report), 600);
}

/* ═══════════════════════════════════════
   HISTÓRICO (localStorage)
═══════════════════════════════════════ */
const HISTORY_KEY = 'bw_route_history';
const HISTORY_MAX = 50;

function saveRouteToHistory(report) {
  try {
    const history = getHistory();
    const entry   = {
      id: Date.now(), date: report.meta.startTime, mode: report.meta.mode,
      destination: report.meta.destination, duration: report.meta.durationFmt,
      speedMax: report.speed.max, speedAvg: report.speed.avg,
      minWC: report.thermal.minWC, curvesTotal: report.curves.total,
      curvesL: report.curves.left, curvesR: report.curves.right,
      maxAngle: report.curves.maxAngle, report
    };
    history.unshift(entry);
    if (history.length > HISTORY_MAX) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch(e) { console.warn('Historial:', e); }
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
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
  container.innerHTML = history.map(e =>
    '<div class="history-card" data-id="' + e.id + '">' +
      '<div class="history-header">' +
        '<div class="history-date">' + new Date(e.date).toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'}) + ' · ' + new Date(e.date).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) + '</div>' +
        '<button class="history-delete" data-id="' + e.id + '" title="Eliminar">✕</button>' +
      '</div>' +
      '<div class="history-title">' + (e.mode === 'route' && e.destination ? '📍 ' + e.destination : '🗺 Ruta libre') + '</div>' +
      '<div class="history-stats">' +
        '<div class="history-stat"><span class="hs-val" style="color:#ff5500">' + e.speedMax + '</span><span class="hs-lbl">km/h máx</span></div>' +
        '<div class="history-stat"><span class="hs-val" style="color:#ffb300">' + e.speedAvg + '</span><span class="hs-lbl">km/h med</span></div>' +
        '<div class="history-stat"><span class="hs-val" style="color:#29d9ff">' + (e.minWC != null ? (e.minWC > 0 ? '+' : '') + e.minWC + '°' : '--') + '</span><span class="hs-lbl">sens. mín</span></div>' +
        '<div class="history-stat"><span class="hs-val" style="color:#00f0a0">' + e.curvesTotal + '</span><span class="hs-lbl">curvas</span></div>' +
        '<div class="history-stat"><span class="hs-val">' + e.duration + '</span><span class="hs-lbl">duración</span></div>' +
        '<div class="history-stat"><span class="hs-val" style="color:#ff5500">' + e.maxAngle + '°</span><span class="hs-lbl">máx ang</span></div>' +
      '</div>' +
      '<button class="history-view-btn" data-id="' + e.id + '">Ver informe completo →</button>' +
    '</div>'
  ).join('');

  container.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); deleteFromHistory(parseInt(btn.dataset.id)); });
  });
  container.querySelectorAll('.history-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = getHistory().find(e => e.id === parseInt(btn.dataset.id));
      if (entry?.report) { App.sessionReport = entry.report; renderReport(entry.report); $('report-panel')?.classList.add('show'); }
    });
  });
}

/* ═══════════════════════════════════════
   INFORME
═══════════════════════════════════════ */
function buildReport() {
  const dur     = Date.now() - App.sessionStart;
  const speeds  = App.sessionSamples.map(s => s.speed).filter(v => v != null);
  const wcs     = App.sessionSamples.map(s => s.wc).filter(v => v != null);
  const rolls   = App.sessionSamples.map(s => s.roll).filter(v => v != null);
  const gLongs  = App.sessionSamples.map(s => s.gLong).filter(v => v != null);
  const gLats   = App.sessionSamples.map(s => s.gLat).filter(v => v != null);
  const cL      = App.sessionCurves.filter(c => c.dir === 'L');
  const cR      = App.sessionCurves.filter(c => c.dir === 'R');
  const maxAng  = App.sessionCurves.length ? Math.max(...App.sessionCurves.map(c => c.maxAngle)) : 0;
  const avgAng  = App.sessionCurves.length ? Math.round(App.sessionCurves.reduce((a,c)=>a+c.maxAngle,0)/App.sessionCurves.length*10)/10 : 0;
  const peakBrk = gLongs.length ? Math.round(Math.abs(Math.min(0, ...gLongs)) * 100) / 100 : 0;
  const peakAcc = gLongs.length ? Math.round(Math.max(0, ...gLongs) * 100) / 100 : 0;
  const peakLat = gLats.length  ? Math.round(Math.max(...gLats.map(Math.abs)) * 100) / 100 : 0;
  return {
    meta:     { mode: App.rideMode, destination: App.rideDestination, startTime: App.sessionStart, duration: dur, durationFmt: fmtDur(dur), track: App.sessionSamples.filter(s=>s.lat).map(s=>({lat:s.lat,lon:s.lon})) },
    speed:    { max: speeds.length?Math.max(...speeds):0, avg: speeds.length?Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length):0, history: speeds },
    thermal:  { minWC: wcs.length?Math.min(...wcs):null, avgWC: wcs.length?Math.round(wcs.reduce((a,b)=>a+b,0)/wcs.length*10)/10:null, history: wcs },
    inclin:   { maxAngle: Math.max(...(rolls.length?rolls.map(Math.abs):[0])), history: rolls },
    curves:   { total: App.sessionCurves.length, left: cL.length, right: cR.length, list: App.sessionCurves, maxAngle: maxAng, avgAngle: avgAng },
    gForces:  { peakBraking: peakBrk, peakAccel: peakAcc, peakLateral: peakLat, historyLong: gLongs, historyLat: gLats }
  };
}

function fmtDur(ms) {
  const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60);
  return h>0?h+'h '+m%60+'m':m>0?m+'m '+s%60+'s':s+'s';
}

function doCalibrate() {
  if (App.tiltFilter.gyroReady) {
    App.tiltFilter.rollOffset  = App.tiltFilter.roll;
    App.tiltFilter.pitchOffset = App.tiltFilter.pitch;
  } else {
    App.tiltFilter.rollOffset  = App.gyroData._rawRoll  || 0;
    App.tiltFilter.pitchOffset = App.gyroData._rawPitch || 0;
  }
  if (App.circuitMode) kirkSpeak('Calibrado.'); else toast('Calibrado ✓ — Horizonte a cero', 'ok');
}

/* ═══════════════════════════════════════
   MODO CIRCUITO
═══════════════════════════════════════ */
let _cirRaf    = null;
let _cirMaxSpd = 0;
let _cirMaxAng = 0;
let _cirHue    = 20;
let _lsSegsRpm = [];
let _lsSegsSpd = [];
let _cirBrand  = 'sport-ls'; // 'sport-ls' | 'sport-pt' | 'triumph' | 'e4'
let _triNeedle = null, _triNeedleGlow = null, _triGlowArc = null;
let _e4Needle  = null, _e4Arc = null, _e4Map = null, _e4Marker = null;
let _e5SpdNeedle = null, _e5SpdArc = null, _e5RpmNeedle = null, _e5RpmArc = null;
let _e5Map = null, _e5Marker = null;

/* ── Kirk state ── */
let _kirkSpeaking  = false;
let _kirkListening = false;
let _kirkAutoListen = true;
let _kirkMuted     = false;
let _kirkKittPos   = 0;
let _kirkKittDir   = 1;
let _kirkLastCheck = 0;
let _kirkCooldowns = {};
let _kirkRec       = null;
let _kirkHistory   = [];
let _telBuffer     = [];
let _telLastTs     = 0;
let _kirkLocation  = null;
let _kirkLocTs     = 0;
let _kirkVoice     = null;

function _pickKirkVoice() {
  if (_kirkVoice) return _kirkVoice;
  const voices = window.speechSynthesis?.getVoices() || [];
  const saved  = localStorage.getItem('bw_kirk_voice');
  if (saved) { const v = voices.find(v => v.name === saved); if (v) { _kirkVoice = v; return v; } }
  return null;
}

function _kirkShowMsg(text) {
  [$('cir-kirk-msg'), $('hud-kirk-msg')].forEach(el => {
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
  });
}

function _kirkHideMsg() {
  const cirMsg = $('cir-kirk-msg');
  if (cirMsg) cirMsg.textContent = 'RIDING ASSISTANT READY';
  const hudMsg = $('hud-kirk-msg');
  if (hudMsg) hudMsg.classList.remove('show');
}

function _kirkStartListening() {
  if (!_kirkRec || _kirkListening || _kirkSpeaking) return;
  try { _kirkRec.start(); _kirkListening = true; $('btn-hud-mic')?.classList.add('active'); } catch(e) {}
}

function _kirkStopListening() {
  if (!_kirkRec || !_kirkListening) return;
  try { _kirkRec.stop(); } catch(e) {}
  _kirkListening = false;
  $('btn-hud-mic')?.classList.remove('active');
  $('btn-cir-mic')?.classList.remove('active');
}

function _radioDuck() {
  if (_Radio.audio && _Radio.playing) _Radio.audio.volume = 0.07;
}
function _radioUnduck() {
  if (_Radio.audio) {
    _Radio.audio.volume = parseFloat(localStorage.getItem('bw_radio_vol') || '0.8');
  }
}

function kirkSpeak(text) {
  if (!text || !window.speechSynthesis || _kirkMuted) return;
  _kirkStopListening();
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = 'es-ES';
  const voice = _pickKirkVoice();
  if (voice) utt.voice = voice;
  _kirkSpeaking = true;
  _kirkShowMsg(text);
  _radioDuck();
  const _onKirkDone = () => {
    _kirkSpeaking = false;
    _radioUnduck();
    setTimeout(_kirkHideMsg, 2000);
    if ((App.circuitMode || App.sessionActive) && _kirkAutoListen) setTimeout(_kirkStartListening, 400);
  };
  utt.onend  = _onKirkDone;
  utt.onerror = _onKirkDone;
  window.speechSynthesis.speak(utt);
}

function _kirkCanAlert(key, ms) {
  const now = Date.now();
  if (!_kirkCooldowns[key] || now - _kirkCooldowns[key] > ms) {
    _kirkCooldowns[key] = now;
    return true;
  }
  return false;
}

function kirkCheckAlerts() {
  if (!App.sessionActive) return;
  const spd  = App.gpsSpeed || 0;
  const roll = Math.abs(App.gyroData.gamma || 0);
  const totG = Math.sqrt((App.gForce?.long||0)**2 + (App.gForce?.lat||0)**2);
  const ws   = App.weather?.windSpeed || 0;
  if      (spd  > 140 && _kirkCanAlert('spd',  30000)) kirkSpeak('Velocidad ' + spd + '.');
  else if (roll > 43  && _kirkCanAlert('roll', 10000)) kirkSpeak('Inclinación crítica.');
  else if (totG > 0.85 && _kirkCanAlert('g',   15000)) kirkSpeak('Fuerzas G elevadas.');
  else if (ws   > 50  && _kirkCanAlert('wind', 60000)) kirkSpeak('Viento fuerte, ' + ws + ' kilómetros.');
}

function _drawKitt(cv) {
  if (!cv || cv.width < 2) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#050000'; ctx.fillRect(0, 0, W, H);
  const spd = _kirkSpeaking ? 5 : 2.5;
  _kirkKittPos += _kirkKittDir * spd;
  if (_kirkKittPos >= W - 8) _kirkKittDir = -1;
  if (_kirkKittPos <= 8)     _kirkKittDir = 1;
  const x = _kirkKittPos, cy = H / 2;
  const gW = _kirkSpeaking ? 110 : 70;
  const outer = ctx.createRadialGradient(x, cy, 0, x, cy, gW);
  outer.addColorStop(0, 'rgba(255,30,0,0.3)'); outer.addColorStop(1, 'rgba(255,30,0,0)');
  ctx.fillStyle = outer; ctx.fillRect(x - gW, 0, gW * 2, H);
  const core = ctx.createLinearGradient(x - 36, 0, x + 36, 0);
  core.addColorStop(0, 'rgba(255,30,0,0)');
  core.addColorStop(0.35, 'rgba(255,60,0,0.7)');
  core.addColorStop(0.5, 'rgba(255,90,30,1)');
  core.addColorStop(0.65, 'rgba(255,60,0,0.7)');
  core.addColorStop(1, 'rgba(255,30,0,0)');
  ctx.fillStyle = core; ctx.fillRect(x - 36, cy - 4, 72, 8);
  const ctr = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
  ctr.addColorStop(0, 'rgba(255,100,0,0)');
  ctr.addColorStop(0.5, 'rgba(255,210,160,1)');
  ctr.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = ctr; ctx.fillRect(x - 10, cy - 2, 20, 4);
}

function initKirkVoice() {
  if (_kirkRec) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  _kirkRec = new SR();
  _kirkRec.lang           = 'es-ES';
  _kirkRec.continuous     = false;
  _kirkRec.interimResults = false;
  _kirkRec.onresult = e => {
    const t = e.results[0][0].transcript.toLowerCase().trim();
    handleKirkCommand(t);
  };
  _kirkRec.onend = () => {
    _kirkListening = false;
    $('btn-cir-mic')?.classList.remove('active');
    $('btn-hud-mic')?.classList.remove('active');
    // Solo reinicia si Kirk acaba de hablar (modo conversacional), no en bucle continuo
  };
  _kirkRec.onerror = e => {
    _kirkListening = false;
    // No reiniciar automáticamente — evita el pitido de micrófono cada 5s
  };
}

async function _updateKirkLocation() {
  const pos = App.position;
  if (!pos) return;
  const now = Date.now();
  if (now - _kirkLocTs < 30000) return;
  _kirkLocTs = now;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lon}&format=json&accept-language=es`, { headers: { 'User-Agent': 'BikerWeather/1.0' } });
    const d = await r.json();
    const a = d.address || {};
    _kirkLocation = [a.road || a.pedestrian, a.town || a.city || a.village || a.municipality, a.state].filter(Boolean).join(', ');
  } catch(e) { /* sin red, mantener último valor */ }
}

async function askKirk(userText) {
  const key = localStorage.getItem('bw_groq_key');
  _kirkShowMsg('🎤 ' + userText);
  if (!key) { kirkSpeak('Necesito una API key de Groq. Configúrala en ajustes.'); return; }
  _kirkShowMsg('⏳');
  _kirkHistory.push({ role: 'user', content: userText });
  if (_kirkHistory.length > 12) _kirkHistory = _kirkHistory.slice(-12);
  await _updateKirkLocation();
  const spd   = Math.round(App.gpsSpeed || 0);
  const roll  = Math.round(Math.abs(App.gyroData.gamma || 0));
  const hdg   = Math.round(App.gyroData.alpha || 0);
  const alt   = App.circuitAlt || 0;
  const pos   = App.position;
  const locLine = _kirkLocation ? `Ubicación: ${_kirkLocation}.` : pos ? `Coords: ${pos.lat.toFixed(4)},${pos.lon.toFixed(4)}.` : '';
  const gLong = App.gForce?.long ? App.gForce.long.toFixed(2) : '0.00';
  const wea   = App.weather;
  const weaLine = wea ? `Temp: ${wea.temp}°C, viento: ${Math.round(wea.windSpeed)}km/h, sensación: ${App.windChill ?? wea.temp}°C.` : '';
  const telemetry = `${locLine} ${spd}km/h, inclinación ${roll}°, G longitudinal ${gLong}g, rumbo ${hdg}°, altitud ${alt}m. ${weaLine}`;
  let histLine = '';
  if (_telBuffer.length >= 3) {
    const spds  = _telBuffer.map(p => p.spd);
    const rolls = _telBuffer.map(p => p.roll);
    histLine = ` Últimos ${_telBuffer.length*2}s: vel media ${Math.round(spds.reduce((a,b)=>a+b,0)/spds.length)}km/h (pico ${Math.max(...spds)}), incl media ${Math.round(rolls.reduce((a,b)=>a+b,0)/rolls.length)}° (pico ${Math.max(...rolls)}°).`;
  }
  const system = `Eres Kirk, copiloto IA de BikerWeather para motociclistas. Respondes en español, en 1-2 frases cortas y directas. Profesional, alerta, ocasionalmente irónico como copiloto de rally. Telemetría actual: ${telemetry}${histLine}`;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role:'system', content:system }, ..._kirkHistory], max_tokens: 80, temperature: 0.7 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) { _kirkHistory.push({ role:'assistant', content:reply }); kirkSpeak(reply); }
    else { _kirkShowMsg('❌ ' + (data.error?.message || 'Sin respuesta')); setTimeout(_kirkStartListening, 500); }
  } catch(e) {
    _kirkShowMsg('❌ Sin conexión');
    setTimeout(_kirkStartListening, 1000);
  }
}

async function kirkCurveCoach(curve) {
  if (!App.sessionActive) return;
  if (curve.maxAngle < 15) return;
  if (!_kirkCanAlert('curveCoach', 20000)) return;
  const key = localStorage.getItem('bw_groq_key');
  if (!key) return;
  const dir = curve.dir === 'L' ? 'izquierda' : 'derecha';
  const spd = Math.round(curve.speed || 0);
  const system = `Eres Kirk, copiloto IA de BikerWeather para motociclistas. Respondes siempre en español. Das feedback técnico sobre la última curva en exactamente 1 frase muy corta y directa, como un copiloto de rally.`;
  const prompt = `Curva a la ${dir}, inclinación máxima ${curve.maxAngle}°, velocidad ${spd}km/h, duración ${curve.duration}s. Curva número ${App.sessionCurves.length} de la sesión. Feedback técnico en 1 frase.`;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role:'system', content:system },{ role:'user', content:prompt }], max_tokens: 50, temperature: 0.7 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) kirkSpeak(reply);
  } catch(e) { /* silent */ }
}

async function kirkSessionSummary(report) {
  if (!report) return;
  const dur    = report.meta.durationFmt;
  const maxSpd = Math.round(report.speed.max);
  const avgSpd = Math.round(report.speed.avg);
  const curves = report.curves.total;
  const maxAng = report.curves.maxAngle;
  const avgAng = report.curves.avgAngle;
  const peakBrk = report.gForces.peakBraking;
  const peakAcc = report.gForces.peakAccel;
  const peakLat = report.gForces.peakLateral;
  const key = localStorage.getItem('bw_groq_key');
  if (!key) {
    kirkSpeak(`Sesión de ${dur}. ${curves} curvas, pico ${maxSpd} kilómetros por hora, inclinación máxima ${maxAng} grados.`);
    return;
  }
  const system = `Eres Kirk, copiloto IA de BikerWeather para motociclistas. Respondes en español en 2 frases cortas. Eres profesional, directo, con un toque de ironía como un copiloto de rally. Haz el resumen valorativo de la sesión.`;
  const prompt = `Sesión completada. Duración: ${dur}. Velocidad máxima: ${maxSpd}km/h, media: ${avgSpd}km/h. Curvas: ${curves} (máx inclinación ${maxAng}°, media ${avgAng}°). G frenada pico: ${peakBrk}g, aceleración pico: ${peakAcc}g, lateral pico: ${peakLat}g. Resumen en 2 frases.`;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role:'system', content:system },{ role:'user', content:prompt }], max_tokens: 120, temperature: 0.75 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) kirkSpeak(reply);
    else kirkSpeak(`Sesión de ${dur}. ${curves} curvas, pico ${maxSpd} kilómetros por hora.`);
  } catch(e) {
    kirkSpeak(`Sesión de ${dur}. ${curves} curvas, pico ${maxSpd} kilómetros por hora.`);
  }
}

function handleKirkCommand(text) {
  const w = text.trim().split(/\s+/);
  const has = (...keys) => w.some(word => keys.some(k => word === k || word.startsWith(k)));
  if (has('calibra', 'calibrar', 'calibr')) { doCalibrate(); return; }
  if (App.circuitMode) {
    if (has('inicio', 'iniciar', 'start', 'arranca', 'arrancar') && !App.sessionActive) { startCircuitSession(); return; }
    if (has('parar', 'para', 'stop', 'fin', 'finalizar', 'terminar') && App.sessionActive && w.length <= 3) { stopCircuitSession(); return; }
    if (has('salir', 'cerrar', 'exit') && w.length <= 3) { closeCircuit(); return; }
  } else if (App.sessionActive) {
    if (has('parar', 'para', 'stop', 'fin', 'finalizar', 'terminar') && w.length <= 3) { stopSession(); return; }
  }
  askKirk(text);
}

function cirColor(v, warn, danger) {
  if (v >= danger) return '#ff3333';
  if (v >= warn)   return '#ff8800';
  return '#00ff88';
}

function _buildLsSegs() {
  const N = 24;
  ['rpm','spd'].forEach(type => {
    const el = $('cir-ls-segs-' + type);
    if (!el) return;
    el.innerHTML = '';
    const arr = [];
    for (let i = 0; i < N; i++) {
      const s = document.createElement('div');
      s.className = 'cir-ls-seg';
      el.appendChild(s);
      arr.push(s);
    }
    if (type === 'rpm') _lsSegsRpm = arr;
    else                _lsSegsSpd = arr;
  });
}

function _updateLsSegs(rpm, roll) {
  const N = 24;
  // RPM segments
  _lsSegsRpm.forEach((s, i) => {
    const on  = rpm > (i / N * 12000);
    const red = i >= 20, warm = i >= 16;
    if (on) {
      if (red)       { s.style.background = i >= 22 ? '#ff0022' : '#ff2200'; s.style.boxShadow = '0 0 4px rgba(255,0,30,0.8)'; }
      else if (warm) { s.style.background = '#ff5500'; s.style.boxShadow = '0 0 3px rgba(255,85,0,0.6)'; }
      else { const t=i/(N*0.67); const h=120-t*120; s.style.background=`hsl(${h},100%,52%)`; s.style.boxShadow=`0 0 3px hsla(${h},100%,55%,0.5)`; }
    } else {
      s.style.background = red ? 'rgba(255,30,30,0.18)' : 'rgba(255,255,255,0.07)';
      s.style.boxShadow  = 'none';
    }
  });
  // Lean angle (roll) segments — green→amber→orange→red at 55° max
  const lean = Math.abs(roll);
  _lsSegsSpd.forEach((s, i) => {
    const on = lean > (i / N * 55);
    if (on) {
      const t = i / N;
      const h = 120 - t * 120; // green at 0° → red at 55°
      s.style.background = `hsl(${h},100%,52%)`;
      s.style.boxShadow  = `0 0 3px hsla(${h},100%,55%,0.5)`;
    } else {
      s.style.background = 'rgba(255,255,255,0.07)';
      s.style.boxShadow  = 'none';
    }
  });
  // Bar labels
  const rv = $('cir-ls-rpm-bar'); if (rv) rv.textContent = rpm > 0 ? (rpm/1000).toFixed(1)+'k' : '--';
  const sv = $('cir-ls-spd-bar'); if (sv) sv.textContent = lean > 0.5 ? Math.round(lean)+'°' : '--';
}

function _updateLsLayout(roll, spd) {
  const rpm  = App.obd2Rpm  || 0;
  const gear = App.obd2Gear || '—';
  const motor = App.obd2Temp != null ? Math.round(App.obd2Temp)+'°' : '--°';
  const now  = new Date();
  const hora = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');

  _updateLsSegs(rpm, roll);

  // Info strip
  const rn = $('cir-ls-rpm-num'); if (rn) rn.textContent = rpm > 0 ? (rpm/1000).toFixed(1)+'k' : '--k';
  const tn = $('cir-ls-temp');    if (tn) tn.textContent = motor;
  const vn = $('cir-ls-volt');    if (vn) vn.textContent = App.obd2Volt != null ? App.obd2Volt.toFixed(1)+'v' : '--v';
  const gn = $('cir-ls-gear');     if (gn) gn.textContent = gear;
  const gc = $('cir-ls-gear-ctr'); if (gc) gc.textContent = gear;
  const hn = $('cir-ls-hora');    if (hn) hn.textContent = hora;

  // Stats
  if (App.sessionActive) {
    const el = App.sessionStart ? Date.now() - App.sessionStart : 0;
    const s = Math.floor(el/1000)%60, m = Math.floor(el/60000);
    const ss = $('cir-ls-sess'); if (ss) ss.textContent = pad(m)+':'+pad(s);
  }
  const lc = $('cir-ls-curves'); if (lc) lc.textContent = App.sessionCurves?.length || 0;
  const lv = $('cir-ls-vmax');   if (lv) lv.textContent = _cirMaxSpd;
  const la = $('cir-ls-amax');   if (la) la.textContent = Math.round(_cirMaxAng)+'°';
  const wcTemp = App.windChill ?? App.weather?.temp;
  const lt = $('cir-ls-tamb');   if (lt) lt.textContent = wcTemp != null ? Math.round(wcTemp)+'°' : '--°';
  const lo = $('cir-ls-oil');    if (lo) lo.textContent = App.obd2OilTemp  != null ? App.obd2OilTemp+'°'  : '--°';
  const ll = $('cir-ls-load');   if (ll) ll.textContent = App.obd2Load     != null ? App.obd2Load+'%'     : '--%';
  const lh = $('cir-ls-thr');    if (lh) lh.textContent = App.obd2Throttle != null ? App.obd2Throttle+'%' : '--%';

  // Speed
  const ls = $('cir-ls-spd'); if (ls) ls.textContent = Math.round(spd) || 0;

  // Lean bars
  const ar = Math.abs(roll);
  const leanL = roll < 0 ? ar : 0, leanR = roll > 0 ? ar : 0;
  const maxA  = 55;
  const al = $('cir-ls-al'); if (al) al.textContent = Math.round(leanL)+'°';
  const ar2= $('cir-ls-ar'); if (ar2) ar2.textContent = Math.round(leanR)+'°';
  const fl = $('cir-ls-fl'); if (fl) fl.style.height = Math.min(leanL/maxA*100,100)+'%';
  const fr = $('cir-ls-fr'); if (fr) fr.style.height = Math.min(leanR/maxA*100,100)+'%';

  // G-forces
  const longG = App.gForce?.long || 0, latG = App.gForce?.lat || 0;
  const glo = $('cir-ls-glon'); if (glo) glo.textContent = Math.abs(longG).toFixed(2);
  const gla = $('cir-ls-glat'); if (gla) gla.textContent = Math.abs(latG).toFixed(2);
}

/* ══════════════════════════════
   TRIUMPH brand mode
══════════════════════════════ */
function _buildTriumphSvg() {
  const svg = $('cir-tri-svg');
  if (!svg || svg.children.length) return;  // already built
  const ns = 'http://www.w3.org/2000/svg';
  const CX = 169, CY = 169;
  const START = 210, ARC = 300, END = START + ARC;  // 510° → 150°
  const R_OUT = 148, R_IN = 133;

  function rad(d) { return d * Math.PI / 180; }
  function pt(r, a) { return [CX + r * Math.sin(rad(a)), CY - r * Math.cos(rad(a))]; }
  function mkEl(tag, attrs) {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  }
  function arcPt(r, startA, endA) {
    const span = ((endA - startA) + 360) % 360;
    const [sx, sy] = pt(r, startA), [ex, ey] = pt(r, endA);
    return `M${sx},${sy} A${r},${r} 0 ${span > 180 ? 1 : 0},1 ${ex},${ey}`;
  }

  // Background track ring
  const [s1x,s1y]=pt(R_OUT,START), [e1x,e1y]=pt(R_OUT,END);
  const [s2x,s2y]=pt(R_IN, START), [e2x,e2y]=pt(R_IN, END);
  svg.appendChild(mkEl('path', {
    d: `M${s1x},${s1y} A${R_OUT},${R_OUT} 0 1,1 ${e1x},${e1y}L${e2x},${e2y} A${R_IN},${R_IN} 0 1,0 ${s2x},${s2y} Z`,
    fill: 'rgba(255,255,255,0.025)'
  }));

  // Redline zone (≥83%)
  const redStart = START + ARC * 0.833;
  const [rs1x,rs1y]=pt(R_OUT,redStart),[re1x,re1y]=pt(R_OUT,END);
  const [rs2x,rs2y]=pt(R_IN, redStart),[re2x,re2y]=pt(R_IN, END);
  const rdSpan = ((END - redStart) + 360) % 360;
  svg.appendChild(mkEl('path', {
    d: `M${rs1x},${rs1y} A${R_OUT},${R_OUT} 0 ${rdSpan>180?1:0},1 ${re1x},${re1y}L${re2x},${re2y} A${R_IN},${R_IN} 0 ${rdSpan>180?1:0},0 ${rs2x},${rs2y} Z`,
    fill: 'rgba(255,20,20,0.18)'
  }));

  // RPM progress glow (dynamic — stored ref)
  _triGlowArc = mkEl('path', { d: '', fill: 'rgba(200,220,255,0.07)' });
  svg.appendChild(_triGlowArc);

  // Outer arc border
  svg.appendChild(mkEl('path', {
    d: arcPt(R_OUT + 2, START, END), fill: 'none',
    stroke: 'rgba(255,255,255,0.15)', 'stroke-width': '1'
  }));

  // Major ticks + labels (0–11)
  for (let i = 0; i <= 12; i++) {
    const a = START + (i / 12) * ARC;
    const isRed = i >= 10;
    const col = isRed ? 'rgba(255,55,55,0.95)' : 'rgba(255,255,255,0.82)';
    const [ox,oy]=pt(R_OUT+4,a), [ix,iy]=pt(R_IN-8,a);
    svg.appendChild(mkEl('line', { x1:ox,y1:oy,x2:ix,y2:iy, stroke:col, 'stroke-width':'2', 'stroke-linecap':'round' }));
    const [tx,ty]=pt(R_IN-22,a);
    const lbl = mkEl('text', { x:tx, y:ty, 'text-anchor':'middle', 'dominant-baseline':'middle',
      fill: isRed?'rgba(255,65,65,0.8)':'rgba(255,255,255,0.55)',
      'font-size':'9.5', 'font-family':'JetBrains Mono,monospace' });
    lbl.textContent = i;
    svg.appendChild(lbl);
  }

  // Minor ticks
  for (let i = 0; i < 48; i++) {
    if (i % 4 === 0) continue;
    const a = START + (i / 48) * ARC;
    const isMid = i % 2 === 0;
    const [ox,oy]=pt(R_OUT+3,a), [ix,iy]=pt(isMid?R_OUT-3:R_OUT-1,a);
    svg.appendChild(mkEl('line', { x1:ox,y1:oy,x2:ix,y2:iy, stroke:'rgba(255,255,255,0.25)', 'stroke-width':'0.8' }));
  }

  // Needle glow (dynamic)
  const [ntx0,nty0] = pt(R_OUT-4, START);
  _triNeedleGlow = mkEl('line', { x1:CX,y1:CY,x2:ntx0,y2:nty0,
    stroke:'rgba(255,255,255,0.12)', 'stroke-width':'8', 'stroke-linecap':'round' });
  svg.appendChild(_triNeedleGlow);
  // Needle (dynamic)
  _triNeedle = mkEl('line', { x1:CX,y1:CY,x2:ntx0,y2:nty0,
    stroke:'#dde4f0', 'stroke-width':'2', 'stroke-linecap':'round' });
  svg.appendChild(_triNeedle);

  // Center hub
  svg.appendChild(mkEl('circle', { cx:CX,cy:CY,r:'7', fill:'#b8bfc8', stroke:'#6a707a', 'stroke-width':'1.5' }));

  // Branding
  const brand = mkEl('text', { x:CX,y:28,'text-anchor':'middle',
    fill:'rgba(255,255,255,0.2)','font-size':'10','font-family':'Rajdhani,sans-serif',
    'font-weight':'700','letter-spacing':'5' });
  brand.textContent = 'TRIUMPH';
  svg.appendChild(brand);

  const rpmLbl = mkEl('text', { x:CX,y:48,'text-anchor':'middle',
    fill:'rgba(255,255,255,0.16)','font-size':'7','font-family':'JetBrains Mono,monospace',
    'letter-spacing':'1' });
  rpmLbl.textContent = '×1000 RPM';
  svg.appendChild(rpmLbl);

  const vLogo = mkEl('text', { x:CX,y:226,'text-anchor':'middle',
    fill:'rgba(255,255,255,0.22)','font-size':'13','font-family':'Rajdhani,sans-serif',
    'font-weight':'700','letter-spacing':'2' });
  vLogo.textContent = '───V───';
  svg.appendChild(vLogo);
}

/* ── ESTILO 4: BMW Motorrad TFT ── */
function _buildE4Tach() {
  const svg = document.getElementById('cir-e4-svg');
  if (!svg || svg.dataset.built) return;
  svg.dataset.built = '1';
  const ns = 'http://www.w3.org/2000/svg';
  const CX = 169, CY = 169, R = 148, SA = 210, SWEEP = 300;
  const pt = (r, deg) => { const rad = (deg - 90) * Math.PI / 180; return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]; };
  const arc = (r, s, e) => { const lg = (e - s) > 180 ? 1 : 0; const [x1,y1]=pt(r,s); const [x2,y2]=pt(r,e); return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)}`; };

  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = '<filter id="e4Glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  svg.appendChild(defs);

  // Outer track ring
  const ring = document.createElementNS(ns, 'path');
  ring.setAttribute('d', arc(R, SA, SA + SWEEP));
  ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'rgba(255,255,255,0.2)'); ring.setAttribute('stroke-width', '4');
  svg.appendChild(ring);

  // Red zone 10k–12k
  const rz = document.createElementNS(ns, 'path');
  rz.setAttribute('d', arc(R - 1, SA + SWEEP * (10/12), SA + SWEEP));
  rz.setAttribute('fill', 'none'); rz.setAttribute('stroke', '#bb0000'); rz.setAttribute('stroke-width', '9'); rz.setAttribute('opacity', '0.7');
  svg.appendChild(rz);

  // Glow arc (dynamic)
  const ga = document.createElementNS(ns, 'path');
  ga.setAttribute('d', arc(R, SA, SA + 0.1));
  ga.setAttribute('fill', 'none'); ga.setAttribute('stroke', 'rgba(41,217,255,0.8)'); ga.setAttribute('stroke-width', '5');
  ga.setAttribute('filter', 'url(#e4Glow)'); ga.style.display = 'none';
  svg.appendChild(ga); _e4Arc = ga;

  // Tick marks + labels
  for (let k = 0; k <= 12; k++) {
    const deg = SA + SWEEP * (k / 12);
    const isMaj = Number.isInteger(k);
    const [x1,y1] = pt(R - 1, deg); const [x2,y2] = pt(R - (isMaj ? 22 : 11), deg);
    const tick = document.createElementNS(ns, 'line');
    tick.setAttribute('x1', x1.toFixed(2)); tick.setAttribute('y1', y1.toFixed(2));
    tick.setAttribute('x2', x2.toFixed(2)); tick.setAttribute('y2', y2.toFixed(2));
    tick.setAttribute('stroke', k >= 10 ? 'rgba(255,70,70,0.9)' : 'rgba(255,255,255,0.75)');
    tick.setAttribute('stroke-width', isMaj ? '3' : '1.5');
    svg.appendChild(tick);
    if (isMaj && k > 0 && k < 12) {
      const [lx, ly] = pt(R - 38, deg);
      const lbl = document.createElementNS(ns, 'text');
      lbl.setAttribute('x', lx.toFixed(2)); lbl.setAttribute('y', (ly + 5).toFixed(2));
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('font-size', '16'); lbl.setAttribute('font-family', 'JetBrains Mono,monospace');
      lbl.setAttribute('fill', k >= 10 ? 'rgba(255,90,90,0.95)' : 'rgba(255,255,255,0.9)');
      lbl.textContent = String(k); svg.appendChild(lbl);
    }
  }
  // Half-tick marks
  for (let i = 0; i <= 23; i++) {
    const deg = SA + SWEEP * (i / 24);
    if (i % 2 === 0) continue; // skip major positions
    const [x1,y1] = pt(R - 1, deg); const [x2,y2] = pt(R - 10, deg);
    const tick = document.createElementNS(ns, 'line');
    tick.setAttribute('x1', x1.toFixed(2)); tick.setAttribute('y1', y1.toFixed(2));
    tick.setAttribute('x2', x2.toFixed(2)); tick.setAttribute('y2', y2.toFixed(2));
    tick.setAttribute('stroke', 'rgba(255,255,255,0.45)'); tick.setAttribute('stroke-width', '1');
    svg.appendChild(tick);
  }

  // RPM label
  const rpmLbl = document.createElementNS(ns, 'text');
  rpmLbl.setAttribute('x', CX); rpmLbl.setAttribute('y', '26'); rpmLbl.setAttribute('text-anchor', 'middle');
  rpmLbl.setAttribute('font-size', '11'); rpmLbl.setAttribute('font-family', 'JetBrains Mono,monospace');
  rpmLbl.setAttribute('fill', 'rgba(255,255,255,0.5)'); rpmLbl.setAttribute('letter-spacing', '1');
  rpmLbl.textContent = 'RPM ×1000'; svg.appendChild(rpmLbl);

  // Center hub
  const hub = document.createElementNS(ns, 'circle');
  hub.setAttribute('cx', CX); hub.setAttribute('cy', CY); hub.setAttribute('r', '5'); hub.setAttribute('fill', '#ccc');
  svg.appendChild(hub);

  // Needle
  const [nx, ny] = pt(R * 0.79, SA);
  const needle = document.createElementNS(ns, 'line');
  needle.setAttribute('x1', CX); needle.setAttribute('y1', CY);
  needle.setAttribute('x2', nx.toFixed(2)); needle.setAttribute('y2', ny.toFixed(2));
  needle.setAttribute('stroke', 'white'); needle.setAttribute('stroke-width', '2.5'); needle.setAttribute('stroke-linecap', 'round');
  svg.appendChild(needle); _e4Needle = needle;
}

function _initE4Map() {
  if (_e4Map) { setTimeout(() => _e4Map.invalidateSize(), 50); return; }
  const container = document.getElementById('cir-e4-map');
  if (!container || typeof L === 'undefined') return;
  const lat = App.position?.lat || 40.4168, lon = App.position?.lon || -3.7038;
  _e4Map = L.map(container, {
    zoomControl: false, attributionControl: false,
    dragging: false, touchZoom: false, doubleClickZoom: false,
    scrollWheelZoom: false, keyboard: false
  }).setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(_e4Map);
  const icon = L.divIcon({
    html: '<div style="width:14px;height:14px;background:#29d9ff;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(41,217,255,0.9)"></div>',
    iconSize: [14,14], iconAnchor: [7,7], className: ''
  });
  _e4Marker = L.marker([lat, lon], { icon }).addTo(_e4Map);
  if (App.routePoints?.length > 1) {
    L.polyline(App.routePoints.map(p => [p.lat, p.lng ?? p.lon]), { color: '#29d9ff', weight: 3, opacity: 0.85 }).addTo(_e4Map);
  }
  setTimeout(() => _e4Map.invalidateSize(), 100);
}

function _updateE4Layout(roll, spd) {
  const rpm   = App.obd2Rpm  || 0;
  const gear  = App.obd2Gear || '—';
  const motor = App.obd2Temp != null ? Math.round(App.obd2Temp)+'°' : '--°';
  const now   = new Date();
  const hora  = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const lean  = Math.abs(roll);
  const CX = 169, CY = 169, R = 148, SA = 210, SWEEP = 300;

  // Needle + glow arc
  if (_e4Needle) {
    const frac = Math.min(rpm / 12000, 1);
    const deg  = SA + SWEEP * frac;
    const rad  = (deg - 90) * Math.PI / 180;
    _e4Needle.setAttribute('x2', (CX + R * 0.79 * Math.cos(rad)).toFixed(2));
    _e4Needle.setAttribute('y2', (CY + R * 0.79 * Math.sin(rad)).toFixed(2));
  }
  if (_e4Arc) {
    if (rpm > 200) {
      const frac = Math.min(rpm / 12000, 1);
      const endDeg = SA + SWEEP * frac;
      const lg = (endDeg - SA) > 180 ? 1 : 0;
      const pt = (r, d) => { const rad = (d - 90) * Math.PI / 180; return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]; };
      const [x1,y1] = pt(R, SA); const [x2,y2] = pt(R, endDeg);
      _e4Arc.setAttribute('d', `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)}`);
      _e4Arc.style.display = '';
    } else { _e4Arc.style.display = 'none'; }
  }

  // TFT
  const es = $('cir-e4-spd');  if (es) es.textContent = Math.round(spd) || 0;
  const el = $('cir-e4-lean'); if (el) {
    el.textContent = (roll < -1 ? '◄ ' : roll > 1 ? '► ' : '') + Math.round(lean) + '°';
    el.style.color = lean > 45 ? '#ffffff' : lean > 30 ? '#29d9ff' : 'rgba(255,255,255,0.7)';
  }
  $('cir-e4-gear') && ($('cir-e4-gear').textContent = gear);
  $('cir-e4-rpm')  && ($('cir-e4-rpm').textContent  = rpm > 0 ? (rpm/1000).toFixed(1)+'k RPM' : '-- RPM');

  // Data strip
  $('cir-e4-motor') && ($('cir-e4-motor').textContent = motor);
  $('cir-e4-volt')  && ($('cir-e4-volt').textContent  = App.obd2Volt != null ? App.obd2Volt.toFixed(1)+'v' : '--v');
  const _wc4 = App.windChill ?? App.weather?.temp;
  $('cir-e4-tamb')  && ($('cir-e4-tamb').textContent  = _wc4 != null ? Math.round(_wc4)+'°' : '--°');
  $('cir-e4-hora')  && ($('cir-e4-hora').textContent  = hora);

  // Nav strip
  const hasRoute = App.routePoints?.length > 1 && App.sessionActive;
  const navArr  = $('cir-e4-nav-arr');
  const navDist = $('cir-e4-nav-dist');
  const navSt   = $('cir-e4-nav-st');
  const navEta  = $('cir-e4-nav-eta');
  if (hasRoute && App.position) {
    let best = Infinity, nearIdx = 0;
    App.routePoints.forEach((p, i) => { const d = Math.hypot(p.lat - App.position.lat, (p.lng ?? p.lon) - App.position.lon); if (d < best) { best = d; nearIdx = i; } });
    const nxt = App.routePoints[Math.min(nearIdx + 5, App.routePoints.length - 1)];
    const distM = Math.round(Math.hypot((nxt.lat - App.position.lat) * 111320, ((nxt.lng ?? nxt.lon) - App.position.lon) * 111320 * Math.cos(App.position.lat * Math.PI / 180)));
    if (navDist) navDist.textContent = distM < 1000 ? distM + ' m' : (distM/1000).toFixed(1) + ' km';
    if (navSt)   navSt.textContent   = App.rideDestination || 'Ruta activa';
    if (navArr)  { navArr.textContent = '↑'; navArr.style.color = '#29d9ff'; }
    if (navEta)  { const eta = new Date(Date.now() + (distM / Math.max(spd/3.6, 5)) * 1000); navEta.textContent = eta.getHours().toString().padStart(2,'0')+':'+eta.getMinutes().toString().padStart(2,'0'); }
  } else {
    if (navArr)  navArr.textContent  = '↑';
    if (navDist) navDist.textContent = 'SIN RUTA';
    if (navSt)   navSt.textContent   = 'Modo libre';
    if (navEta)  navEta.textContent  = '--:--';
  }

  // Map
  if (_e4Map && App.position) {
    _e4Marker?.setLatLng([App.position.lat, App.position.lon]);
    _e4Map.setView([App.position.lat, App.position.lon], 15, { animate: false });
  }
}

function _updateTriumphLayout(roll, spd) {
  const rpm  = App.obd2Rpm  || 0;
  const gear = App.obd2Gear || '—';
  const temp = App.obd2Temp != null ? Math.round(App.obd2Temp)+'°' : '--°';
  const lean = Math.abs(roll);
  const CX = 169, CY = 169;
  const START = 210, ARC = 300;
  const R_OUT = 148, R_IN = 133;
  const maxRpm = 12000;
  const frac = Math.min(rpm / maxRpm, 1);

  function rad(d) { return d * Math.PI / 180; }
  function pt(r, a) { return [CX + r * Math.sin(rad(a)), CY - r * Math.cos(rad(a))]; }

  // Update needle
  const nClock = START + frac * ARC;
  const [nx, ny] = pt(R_OUT - 4, nClock);
  if (_triNeedle)     { _triNeedle.setAttribute('x2', nx);     _triNeedle.setAttribute('y2', ny); }
  if (_triNeedleGlow) { _triNeedleGlow.setAttribute('x2', nx); _triNeedleGlow.setAttribute('y2', ny); }

  // Update glow arc
  if (_triGlowArc) {
    if (frac > 0.005) {
      const rC = START + frac * ARC;
      const [pg1x,pg1y]=pt(R_OUT-1,START), [pgx,pgy]=pt(R_OUT-1,rC);
      const [pg2x,pg2y]=pt(R_IN+1,START),  [pgx2,pgy2]=pt(R_IN+1,rC);
      const sp = ((rC - START) + 360) % 360;
      _triGlowArc.setAttribute('d',
        `M${pg1x},${pg1y} A${R_OUT},${R_OUT} 0 ${sp>180?1:0},1 ${pgx},${pgy}` +
        `L${pgx2},${pgy2} A${R_IN},${R_IN} 0 ${sp>180?1:0},0 ${pg2x},${pg2y} Z`);
    } else {
      _triGlowArc.setAttribute('d', '');
    }
  }

  // TFT
  const ts = $('cir-tri-spd');  if (ts)  ts.textContent  = Math.round(spd) || 0;
  const tl = $('cir-tri-lean'); if (tl)  tl.textContent  = lean > 0.5 ? Math.round(lean)+'°' : '0°';
  const tg = $('cir-tri-gear'); if (tg)  tg.textContent  = 'MARCHA '+(gear === '—' ? '—' : gear);
  const tr = $('cir-tri-rpm');  if (tr)  tr.textContent  = rpm > 0 ? (rpm/1000).toFixed(1)+'k RPM' : '-- RPM';

  // Side left: session stats
  if (App.sessionActive) {
    const el = App.sessionStart ? Date.now() - App.sessionStart : 0;
    const s = Math.floor(el/1000)%60, m = Math.floor(el/60000);
    const ses = $('cir-tri-sess'); if (ses) ses.textContent = pad(m)+':'+pad(s);
  }
  const tc = $('cir-tri-curves'); if (tc) tc.textContent = App.sessionCurves?.length || 0;
  const tv = $('cir-tri-vmax');   if (tv) tv.textContent = _cirMaxSpd;
  const ta = $('cir-tri-amax');   if (ta) ta.textContent = Math.round(_cirMaxAng)+'°';

  // Side right
  const tt  = $('cir-tri-temp');  if (tt)  tt.textContent  = temp;
  const tvo = $('cir-tri-volt');  if (tvo) tvo.textContent = App.obd2Volt ? App.obd2Volt.toFixed(1)+'v' : '--v';
  const ti  = $('cir-tri-incl');  if (ti)  {
    const pitch = App.gyroData?.beta || 0;
    ti.textContent = Math.round(Math.abs(pitch))+'° '+(pitch >= 0 ? 'F' : 'B');
  }
}

function openCircuit(style) {
  // style: 'estilo1'=triumph, 'estilo2-4'=próximamente, undefined=último usado
  if      (style === 'estilo1') _cirBrand = 'sport-ls';
  else if (style === 'estilo2') _cirBrand = 'sport-pt';
  else if (style === 'estilo3') _cirBrand = 'triumph';
  else if (style === 'estilo4') _cirBrand = 'e4';
  else if (style === 'estilo5') _cirBrand = 'e5';

  // Highlight active style button
  document.querySelectorAll('.btn-style').forEach(b => b.classList.remove('active'));
  if (style) $('btn-style-' + style.replace('estilo',''))?.classList.add('active');

  App.circuitMode  = true;
  _kirkKittPos     = 0; _kirkKittDir = 1; _kirkCooldowns = {};
  _kirkHistory     = []; _telBuffer = []; _telLastTs = 0;
  _kirkAutoListen  = true; _kirkListening = false;
  document.body.classList.add('circuit-active');
  const ov = $('circuit-overlay');
  if (ov) ov.classList.add('active');
  $('btn-cir-ls')?.classList.toggle('active', App.landscapeMode);
  $('btn-cir-inv-r')?.classList.toggle('active', App.rollFlip);
  $('btn-cir-inv-p')?.classList.toggle('active', App.pitchFlip);
  initKirkVoice();
  _buildLsSegs();
  _buildTriumphSvg();
  _buildE4Tach();
  if (_cirBrand === 'e5') _buildE5Gauges();
  const ov2 = $('circuit-overlay');
  if (ov2) ov2.dataset.brand = _cirBrand;
  if (_cirBrand === 'e4') setTimeout(_initE4Map, 120);
  if (_cirBrand === 'e5') setTimeout(_initE5Map, 150);
  setTimeout(() => {
    resizeCircuitCanvases();
    _cirLoop();
    kirkSpeak('Kirk activo. Listo.');
  }, 80);
}

function closeCircuit() {
  _kirkAutoListen = false;
  _kirkStopListening();
  if (App.sessionActive) stopSession();
  App.circuitMode = false;
  document.body.classList.remove('circuit-active');
  $('circuit-overlay')?.classList.remove('active');
  if (_cirRaf) { cancelAnimationFrame(_cirRaf); _cirRaf = null; }
  if (_e4Map) { _e4Map.remove(); _e4Map = null; _e4Marker = null; }
  _e4Needle = null; _e4Arc = null;
  const e4svg = document.getElementById('cir-e4-svg'); if (e4svg) delete e4svg.dataset.built;
  if (_e5Map) { _e5Map.remove(); _e5Map = null; _e5Marker = null; }
  _e5SpdNeedle = null; _e5SpdArc = null; _e5RpmNeedle = null; _e5RpmArc = null;
  if (_cirBrand === 'e5') {
    ['cir-e5-spd','cir-e5-rpm'].forEach(id => { const s = document.getElementById(id); if (s) delete s.dataset.built; });
  }
  window.speechSynthesis?.cancel();
  _kirkRec = null; _kirkListening = false;
}

/* ── ESTILO 5: Dual Gauge + Mapa landscape ── */
function _buildE5Gauge(svgId, maxVal, isRpm) {
  const svg = document.getElementById(svgId);
  if (!svg || svg.dataset.built) return;
  svg.dataset.built = '1';
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = 'http://www.w3.org/2000/svg';
  const CX = 110, CY = 110, R = 90, SA = 210, SWEEP = 300;
  const pt  = (r, d) => { const rad = (d - 90) * Math.PI / 180; return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]; };
  const arc = (r, s, e) => { const lg = (e - s) > 180 ? 1 : 0; const [x1,y1]=pt(r,s); const [x2,y2]=pt(r,e); return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)}`; };
  const fid = 'e5g_' + svgId;

  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = `<filter id="${fid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  svg.appendChild(defs);

  // Outer glow ring (blue neon)
  const glowR = document.createElementNS(ns, 'circle');
  glowR.setAttribute('cx', CX); glowR.setAttribute('cy', CY); glowR.setAttribute('r', String(R + 10));
  glowR.setAttribute('fill', 'none'); glowR.setAttribute('stroke', '#29d9ff');
  glowR.setAttribute('stroke-width', '7'); glowR.setAttribute('opacity', '0.55');
  glowR.setAttribute('filter', `url(#${fid})`);
  svg.appendChild(glowR);
  // Bright white core ring
  const coreR = document.createElementNS(ns, 'circle');
  coreR.setAttribute('cx', CX); coreR.setAttribute('cy', CY); coreR.setAttribute('r', String(R + 8));
  coreR.setAttribute('fill', 'none'); coreR.setAttribute('stroke', 'rgba(210,245,255,0.75)');
  coreR.setAttribute('stroke-width', '2');
  svg.appendChild(coreR);

  // Track arc
  const track = document.createElementNS(ns, 'path');
  track.setAttribute('d', arc(R, SA, SA + SWEEP));
  track.setAttribute('fill', 'none'); track.setAttribute('stroke', 'rgba(255,255,255,0.12)'); track.setAttribute('stroke-width', '3');
  svg.appendChild(track);

  // Red zone
  const redFrac = isRpm ? 6 / maxVal : 160 / maxVal;
  const rz = document.createElementNS(ns, 'path');
  rz.setAttribute('d', arc(R, SA + SWEEP * redFrac, SA + SWEEP));
  rz.setAttribute('fill', 'none'); rz.setAttribute('stroke', '#cc1010'); rz.setAttribute('stroke-width', '7'); rz.setAttribute('opacity', '0.75');
  svg.appendChild(rz);

  // Glow arc (dynamic progress)
  const ga = document.createElementNS(ns, 'path');
  ga.setAttribute('d', arc(R, SA, SA + 0.1));
  ga.setAttribute('fill', 'none'); ga.setAttribute('stroke', 'rgba(41,217,255,0.75)');
  ga.setAttribute('stroke-width', '4'); ga.setAttribute('filter', `url(#${fid})`); ga.style.display = 'none';
  svg.appendChild(ga);
  if (isRpm) _e5RpmArc = ga; else _e5SpdArc = ga;

  // Tick marks + labels
  const steps  = isRpm ? maxVal : maxVal / 20;
  const step   = isRpm ? 1 : 20;
  for (let i = 0; i <= steps; i++) {
    const deg  = SA + SWEEP * (i / steps);
    const val  = i * step;
    const isRed = isRpm ? val >= 6 : val >= 160;
    const [x1,y1] = pt(R - 1, deg); const [x2,y2] = pt(R - 19, deg);
    const tick = document.createElementNS(ns, 'line');
    tick.setAttribute('x1', x1.toFixed(2)); tick.setAttribute('y1', y1.toFixed(2));
    tick.setAttribute('x2', x2.toFixed(2)); tick.setAttribute('y2', y2.toFixed(2));
    tick.setAttribute('stroke', isRed ? 'rgba(255,70,70,0.95)' : 'rgba(255,255,255,0.82)');
    tick.setAttribute('stroke-width', '2.5');
    svg.appendChild(tick);
    // Half-tick
    if (i < steps) {
      const md = SA + SWEEP * ((i + 0.5) / steps);
      const [mx1,my1] = pt(R - 1, md); const [mx2,my2] = pt(R - 10, md);
      const mt = document.createElementNS(ns, 'line');
      mt.setAttribute('x1', mx1.toFixed(2)); mt.setAttribute('y1', my1.toFixed(2));
      mt.setAttribute('x2', mx2.toFixed(2)); mt.setAttribute('y2', my2.toFixed(2));
      mt.setAttribute('stroke', 'rgba(255,255,255,0.42)'); mt.setAttribute('stroke-width', '1');
      svg.appendChild(mt);
    }
    // Label
    const [lx,ly] = pt(R - 34, deg);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', lx.toFixed(2)); lbl.setAttribute('y', (ly + 4.5).toFixed(2));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', isRpm ? '13' : '10');
    lbl.setAttribute('font-family', 'JetBrains Mono,monospace');
    lbl.setAttribute('fill', isRed ? 'rgba(255,90,90,0.95)' : 'rgba(255,255,255,0.88)');
    lbl.textContent = isRpm ? String(val) : (val > 0 ? String(val) : '0');
    svg.appendChild(lbl);
  }

  // Center hub + needle
  const hub = document.createElementNS(ns, 'circle');
  hub.setAttribute('cx', CX); hub.setAttribute('cy', CY); hub.setAttribute('r', '6'); hub.setAttribute('fill', '#ddd');
  svg.appendChild(hub);
  const [nx,ny] = pt(R * 0.82, SA);
  const needle = document.createElementNS(ns, 'line');
  needle.setAttribute('x1', CX); needle.setAttribute('y1', CY);
  needle.setAttribute('x2', nx.toFixed(2)); needle.setAttribute('y2', ny.toFixed(2));
  needle.setAttribute('stroke', 'white'); needle.setAttribute('stroke-width', '2.5'); needle.setAttribute('stroke-linecap', 'round');
  svg.appendChild(needle);
  if (isRpm) _e5RpmNeedle = needle; else _e5SpdNeedle = needle;
}

function _buildE5Gauges() {
  _buildE5Gauge('cir-e5-spd', 200, false);
  _buildE5Gauge('cir-e5-rpm', 8,   true);
}

function _initE5Map() {
  if (typeof L === 'undefined') return;
  if (_e5Map) { setTimeout(() => _e5Map.invalidateSize(), 50); return; }
  const container = document.getElementById('cir-e5-map');
  if (!container) return;
  const lat = App.position?.lat ?? 40.4168;
  const lon = App.position?.lon ?? -3.7038;
  _e5Map = L.map(container, { zoomControl: false, attributionControl: false }).setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(_e5Map);
  const icon = L.divIcon({
    html: '<div style="width:12px;height:12px;background:#29d9ff;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(41,217,255,0.9)"></div>',
    iconSize: [12,12], iconAnchor: [6,6], className: ''
  });
  _e5Marker = L.marker([lat, lon], { icon }).addTo(_e5Map);
  if (App.routePoints?.length > 1) {
    L.polyline(App.routePoints.map(p => [p.lat, p.lng ?? p.lon]), { color: '#29d9ff', weight: 3, opacity: 0.85 }).addTo(_e5Map);
  }
  setTimeout(() => _e5Map.invalidateSize(), 100);
}

function _updateE5Layout(roll, spd) {
  const rpm  = App.obd2Rpm  || 0;
  const lean = Math.abs(roll);
  const now  = new Date();
  const hora = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const CX = 110, CY = 110, R = 90, SA = 210, SWEEP = 300;
  const pt = (r, d) => { const rad = (d - 90) * Math.PI / 180; return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]; };

  // Speedometer needle + arc
  if (_e5SpdNeedle) {
    const deg = SA + SWEEP * Math.min(spd / 200, 1);
    const rad = (deg - 90) * Math.PI / 180;
    _e5SpdNeedle.setAttribute('x2', (CX + R * 0.82 * Math.cos(rad)).toFixed(2));
    _e5SpdNeedle.setAttribute('y2', (CY + R * 0.82 * Math.sin(rad)).toFixed(2));
  }
  if (_e5SpdArc) {
    if (spd > 2) {
      const endDeg = SA + SWEEP * Math.min(spd / 200, 1);
      const lg = (endDeg - SA) > 180 ? 1 : 0;
      const [x1,y1] = pt(R, SA); const [x2,y2] = pt(R, endDeg);
      _e5SpdArc.setAttribute('d', `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)}`);
      _e5SpdArc.style.display = '';
    } else { _e5SpdArc.style.display = 'none'; }
  }

  // Tachometer needle + arc
  if (_e5RpmNeedle) {
    const deg = SA + SWEEP * Math.min(rpm / 8000, 1);
    const rad = (deg - 90) * Math.PI / 180;
    _e5RpmNeedle.setAttribute('x2', (CX + R * 0.82 * Math.cos(rad)).toFixed(2));
    _e5RpmNeedle.setAttribute('y2', (CY + R * 0.82 * Math.sin(rad)).toFixed(2));
  }
  if (_e5RpmArc) {
    if (rpm > 200) {
      const endDeg = SA + SWEEP * Math.min(rpm / 8000, 1);
      const lg = (endDeg - SA) > 180 ? 1 : 0;
      const [x1,y1] = pt(R, SA); const [x2,y2] = pt(R, endDeg);
      _e5RpmArc.setAttribute('d', `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)}`);
      _e5RpmArc.style.display = '';
    } else { _e5RpmArc.style.display = 'none'; }
  }

  // Digital readouts under gauges
  const spdEl = document.getElementById('cir-e5-spd-v'); if (spdEl) spdEl.textContent = Math.round(spd) || 0;
  const rpmEl = document.getElementById('cir-e5-rpm-v'); if (rpmEl) rpmEl.textContent = (rpm / 1000).toFixed(1);

  // HUD
  const leanEl = document.getElementById('cir-e5-lean');
  if (leanEl) {
    leanEl.textContent = (roll < -1 ? '◄ ' : roll > 1 ? '► ' : '') + Math.round(lean) + '°';
    leanEl.style.color = lean > 45 ? '#ffffff' : lean > 30 ? '#29d9ff' : 'rgba(255,255,255,0.7)';
  }
  const gearEl = document.getElementById('cir-e5-gear'); if (gearEl) gearEl.textContent = App.obd2Gear === 'N' ? 'N' : App.obd2Gear ? 'M' + App.obd2Gear : '—';
  const horaEl = document.getElementById('cir-e5-hora'); if (horaEl) horaEl.textContent = hora;
  const _wc5 = App.windChill ?? App.weather?.temp;
  const tambEl = document.getElementById('cir-e5-tamb'); if (tambEl) tambEl.textContent = _wc5 != null ? Math.round(_wc5) + '°' : '--°';

  // Map update
  if (_e5Map && App.position?.lat) {
    _e5Map.setView([App.position.lat, App.position.lon], undefined, { animate: false });
    if (_e5Marker) _e5Marker.setLatLng([App.position.lat, App.position.lon]);
  }

  // Nav strip
  const hasRoute = App.routePoints?.length > 1 && App.sessionActive;
  const navArr = document.getElementById('cir-e5-arr');
  const navDist = document.getElementById('cir-e5-dist');
  const navEta  = document.getElementById('cir-e5-eta');
  if (hasRoute && App.position) {
    let best = Infinity, nearIdx = 0;
    App.routePoints.forEach((p, i) => { const d = Math.hypot(p.lat - App.position.lat, (p.lng ?? p.lon) - App.position.lon); if (d < best) { best = d; nearIdx = i; } });
    const nxt = App.routePoints[Math.min(nearIdx + 5, App.routePoints.length - 1)];
    const distM = Math.round(Math.hypot((nxt.lat - App.position.lat) * 111320, ((nxt.lng ?? nxt.lon) - App.position.lon) * 111320 * Math.cos(App.position.lat * Math.PI / 180)));
    if (navDist) navDist.textContent = distM < 1000 ? distM + ' m' : (distM / 1000).toFixed(1) + ' km';
    if (navArr)  { navArr.textContent = '↑'; navArr.style.color = '#29d9ff'; }
    if (navEta)  { const eta = new Date(Date.now() + (distM / Math.max(spd / 3.6, 5)) * 1000); navEta.textContent = eta.getHours().toString().padStart(2,'0') + ':' + eta.getMinutes().toString().padStart(2,'0'); }
  } else {
    if (navArr)  navArr.textContent  = '↑';
    if (navDist) navDist.textContent = 'SIN RUTA';
    if (navEta)  navEta.textContent  = '--:--';
  }
}

function startCircuitSession() {
  App.rideMode = 'circuit';
  if (!App.rideDestination) App.rideDestination = 'Sesión BikerWeather';
  _cirMaxSpd = 0; _cirMaxAng = 0;
  startSession();
  $('btn-cir-start').style.display = 'none';
  $('btn-cir-stop').style.display  = 'flex';
  if (App.rideDestination && App.rideDestination !== 'Sesión BikerWeather')
    calculateRoute(App.rideDestination, App.routeSpeed).catch(e => toast(e.message, 'error'));
  kirkSpeak('Sesión iniciada.');
}

function stopCircuitSession() {
  $('btn-cir-start').style.display = 'flex';
  $('btn-cir-stop').style.display  = 'none';
  stopSession();
}

function resizeCircuitCanvases() {
  const ov  = $('circuit-overlay');
  if (!ov) return;
  const dpr = window.devicePixelRatio || 1;
  const arc = $('cir-arc-cv');
  if (arc) {
    const cw = ov.offsetWidth || 1, ch = ov.offsetHeight || 1;
    arc.width = cw * dpr; arc.height = ch * dpr;
    arc.style.width = cw + 'px'; arc.style.height = ch + 'px';
  }
  const map = $('cir-map-cv');
  if (map) {
    const mw = map.offsetWidth || 1, mh = map.offsetHeight || 1;
    map.width = mw * dpr; map.height = mh * dpr;
    map.style.width = mw + 'px'; map.style.height = mh + 'px';
  }
}

function _cirLoop() {
  if (!App.circuitMode) return;
  const roll = (App.gyroData.gamma || 0) * (App.rollFlip  ? -1 : 1);
  const spd  = App.gpsSpeed || 0;
  if (_cirBrand === 'triumph') {
    _updateTriumphLayout(roll, spd);
  } else if (_cirBrand === 'e4') {
    _updateE4Layout(roll, spd);
  } else if (_cirBrand === 'e5') {
    _updateE5Layout(roll, spd);
  } else if (_cirBrand === 'sport-ls') {
    _updateLsLayout(roll, spd);
  } else { // sport-pt
    _drawSpeedArc($('cir-arc-cv'), spd);
    _drawMiniMap($('cir-map-cv'));
    _updateCirData(roll, spd);
  }
  const now = Date.now();
  if (now - _kirkLastCheck > 2000) { _kirkLastCheck = now; kirkCheckAlerts(); }
  _cirRaf = requestAnimationFrame(_cirLoop);
}

function _drawSpeedArc(cv, spd) {
  if (!cv || cv.width < 10) return;
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cv.width / dpr, H = cv.height / dpr;
  ctx.clearRect(0, 0, W, H);

  // Shared arc geometry
  const ARC_H  = Math.min(115, H * 0.15);
  const TOP_Y  = ARC_H * 0.15;
  const END_Y  = ARC_H;
  const MARGIN = W * 0.035;
  const CX     = W / 2;
  const dh     = END_Y - TOP_Y;
  const halfW  = CX - MARGIN;
  const CY     = (TOP_Y + END_Y) / 2 + halfW * halfW / (2 * dh);
  const R_OUT  = CY - TOP_Y;
  const R_IN   = R_OUT - 26;
  const SA     = Math.atan2(END_Y - CY, MARGIN - CX);
  const EA     = Math.atan2(END_Y - CY, (W - MARGIN) - CX);
  let sweep    = EA - SA; if (sweep < 0) sweep += 2 * Math.PI;

  // ── OUTER ARC: RPM segmented (0–12000) ──────────────────────────────────
  const MAX_RPM  = 12000;
  const rpm      = App.obd2Rpm || 0;
  const N_SEGS   = 24;
  const SEG_SPAN = sweep / N_SEGS;
  const SEG_GAP  = SEG_SPAN * 0.20;
  const SEG_ARC  = SEG_SPAN - SEG_GAP;

  for (let i = 0; i < N_SEGS; i++) {
    const segA0  = SA + i * SEG_SPAN + SEG_GAP / 2;
    const segA1  = segA0 + SEG_ARC;
    const active = rpm >= (i / N_SEGS * MAX_RPM);
    const red    = i >= 20;   // 10000+ RPM
    const warm   = i >= 16;   // 8000+ RPM

    ctx.beginPath(); ctx.arc(CX, CY, R_OUT, segA0, segA1);
    ctx.lineWidth = 14; ctx.lineCap = 'butt';

    if (active) {
      const t = i / 20;
      if (red) {
        ctx.strokeStyle = i >= 22 ? '#ff0022' : '#ff2200';
        ctx.shadowColor = 'rgba(255,0,30,0.9)'; ctx.shadowBlur = 12;
      } else if (warm) {
        ctx.strokeStyle = '#ff5500';
        ctx.shadowColor = 'rgba(255,85,0,0.7)'; ctx.shadowBlur = 9;
      } else {
        const hue = t < 0.55 ? 120 - (t / 0.55) * 90
                              : 30  - ((t - 0.55) / 0.45) * 30;
        ctx.strokeStyle = `hsl(${hue},100%,52%)`;
        ctx.shadowColor = `hsla(${hue},100%,55%,0.5)`; ctx.shadowBlur = 7;
      }
    } else {
      ctx.strokeStyle = red ? 'rgba(255,30,30,0.20)' : 'rgba(255,255,255,0.07)';
      ctx.shadowBlur = 0;
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  }

  // RPM numbers 1–12 at major positions
  for (let i = 1; i <= 12; i++) {
    const a      = SA + sweep * (i / 12);
    const red    = i >= 10;
    const rt     = R_OUT - 38;
    ctx.fillStyle   = red ? 'rgba(255,80,80,0.95)' : 'rgba(255,255,255,0.88)';
    ctx.font        = 'bold 16px Rajdhani,Arial,sans-serif';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = red ? 'rgba(255,60,60,0.7)' : 'rgba(255,255,255,0.45)';
    ctx.shadowBlur  = 7;
    ctx.fillText(i.toString(), CX + rt * Math.cos(a), CY + rt * Math.sin(a));
    ctx.shadowBlur  = 0;
  }

  // ── GAP separator between arcs ───────────────────────────────────────────
  ctx.beginPath(); ctx.arc(CX, CY, R_IN + 5, SA, EA);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 4; ctx.lineCap = 'butt'; ctx.stroke();

  // ── INNER ARC: Speed GPS (0–220) ─────────────────────────────────────────
  const MAX_SPD = 220;
  const spdFrac = Math.min(Math.max(spd, 0) / MAX_SPD, 1);
  const h = _cirHue;

  // Background track
  ctx.beginPath(); ctx.arc(CX, CY, R_IN, SA, EA);
  ctx.strokeStyle = `hsla(${h},80%,50%,0.08)`; ctx.lineWidth = 14; ctx.lineCap = 'butt'; ctx.stroke();

  // Speed ticks — 11 intervals (0, 20, 40 … 220)
  const NS = 11;
  for (let i = 0; i <= NS; i++) {
    const a   = SA + sweep * (i / NS);
    const maj = i % 1 === 0;
    const r1  = R_IN - (i % 2 === 0 ? 14 : 8);
    const r2  = R_IN - 5;
    const c = Math.cos(a), s = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(CX + r1*c, CY + r1*s); ctx.lineTo(CX + r2*c, CY + r2*s);
    ctx.strokeStyle = i % 2 === 0 ? `hsla(${h},90%,62%,0.6)` : `hsla(${h},80%,55%,0.22)`;
    ctx.lineWidth = i % 2 === 0 ? 1.5 : 1; ctx.lineCap = 'butt'; ctx.stroke();
  }

  // Speed fill
  if (spdFrac > 0) {
    const fillEnd = SA + sweep * spdFrac;
    const h2 = (h + 28) % 360;
    const spdGrad = ctx.createLinearGradient(MARGIN, 0, W - MARGIN, 0);
    spdGrad.addColorStop(0,   `hsl(${h},100%,50%)`);
    spdGrad.addColorStop(0.5, `hsl(${(h + 14) % 360},100%,58%)`);
    spdGrad.addColorStop(1,   `hsl(${h2},100%,64%)`);
    ctx.beginPath(); ctx.arc(CX, CY, R_IN, SA, fillEnd);
    ctx.strokeStyle = `hsla(${h},100%,55%,0.2)`; ctx.lineWidth = 24; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(CX, CY, R_IN, SA, fillEnd);
    ctx.strokeStyle = spdGrad; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke();
    const tipX = CX + R_IN * Math.cos(fillEnd), tipY = CY + R_IN * Math.sin(fillEnd);
    ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.shadowColor = `hsl(${h},100%,60%)`; ctx.shadowBlur = 8; ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function _drawMiniMap(cv) {
  if (!cv || cv.width < 4) return;
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cv.width / dpr, H = cv.height / dpr;
  ctx.clearRect(0, 0, W, H);
  const pts = (App.sessionSamples || []).filter(s => s.lat && s.lon);
  if (pts.length < 3) {
    // Placeholder: circuit outline hint
    ctx.strokeStyle = 'rgba(255,85,0,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(3, 3, W - 6, H - 6, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,85,0,0.12)'; ctx.font = '8px Rajdhani,Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GPS', W/2, H/2);
    return;
  }
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const pad = 5;
  const scX = (maxLon > minLon) ? (W - pad*2) / (maxLon - minLon) : 1;
  const scY = (maxLat > minLat) ? (H - pad*2) / (maxLat - minLat) : 1;
  const sc  = Math.min(scX, scY);
  const oX  = pad + ((W - pad*2) - (maxLon - minLon) * sc) / 2;
  const oY  = pad + ((H - pad*2) - (maxLat - minLat) * sc) / 2;
  const tx  = lon => oX + (lon - minLon) * sc;
  const ty  = lat => H - (oY + (lat - minLat) * sc);
  // Track line
  ctx.beginPath(); ctx.moveTo(tx(pts[0].lon), ty(pts[0].lat));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].lon), ty(pts[i].lat));
  ctx.strokeStyle = 'rgba(255,85,0,0.55)'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
  // Current position dot
  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(tx(last.lon), ty(last.lat), 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ff5500'; ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
}

function _updateCirData(roll, spd) {
  const ar = Math.abs(roll);
  if (App.sessionActive) {
    if (spd > _cirMaxSpd) _cirMaxSpd = Math.round(spd);
    if (ar  > _cirMaxAng) _cirMaxAng = ar;
    const el = App.sessionStart ? Date.now() - App.sessionStart : 0;
    const st = $('cir-sess-time');
    if (st) { const s=Math.floor(el/1000)%60, m=Math.floor(el/60000); st.textContent=pad(m)+':'+pad(s); }
  }
  // Gear (placeholder until Carber connected)
  const gv = $('cir-gear'); if (gv && !App.obd2Gear) { gv.textContent = '—'; }
  const cc = $('cir-curve-cnt'); if (cc) cc.textContent = App.sessionCurves?.length || 0;
  const sm = $('cir-spd-max');   if (sm) sm.textContent = _cirMaxSpd;
  const am = $('cir-ang-max');   if (am) am.textContent = Math.round(_cirMaxAng) + '°';
  const _wcPt = App.windChill ?? App.weather?.temp;
  const tv = $('cir-temp-val');  if (tv) tv.textContent = _wcPt != null ? Math.round(_wcPt) + '°' : '--°';

  // Big speed
  const sv = $('cir-spd-val');
  if (sv) { sv.textContent = Math.round(spd); sv.style.color = cirColor(spd, 120, 160); sv.style.textShadow = spd > 120 ? '0 0 40px rgba(255,80,0,0.7),0 0 80px rgba(255,50,0,0.3)' : '0 0 40px rgba(255,100,0,0.55)'; }

  // G-forces
  const longG = App.gForce?.long || 0, latG = App.gForce?.lat || 0;
  const gl = $('cir-g-lon'); if (gl) { gl.textContent = Math.abs(longG).toFixed(2); gl.style.color = longG < -0.2 ? '#ff2255' : longG > 0.2 ? '#00f0a0' : '#ffb300'; }
  const gt = $('cir-g-lat'); if (gt) { gt.textContent = Math.abs(latG).toFixed(2); gt.style.color = cirColor(Math.abs(latG), 0.4, 0.7); }

  // Lean angle bars
  const leanL = roll < 0 ? ar : 0, leanR = roll > 0 ? ar : 0;
  const maxL = 55;
  const ll = $('cir-lean-l'); if (ll) { ll.textContent = Math.round(leanL) + '°'; ll.style.color = cirColor(leanL, 30, 45); }
  const lr = $('cir-lean-r'); if (lr) { lr.textContent = Math.round(leanR) + '°'; lr.style.color = cirColor(leanR, 30, 45); }
  const bl = $('cir-bar-l');  if (bl) bl.style.height = Math.min(leanL / maxL * 100, 100) + '%';
  const br = $('cir-bar-r');  if (br) br.style.height = Math.min(leanR / maxL * 100, 100) + '%';

  // Wind
  const ws = App.weather?.windSpeed || 0, wd = App.weather?.windDir || 0;
  const rw = ((wd - (App.gyroData.alpha || 0) + 360) % 360);
  const wv = $('cir-wind-val'); if (wv) { wv.textContent = ws || '--'; wv.style.color = ws ? cirColor(ws, 30, 50) : 'rgba(41,217,255,0.4)'; }
  const wp = $('cir-wind-poly'); if (wp) wp.setAttribute('transform', 'rotate(' + rw + ',12,12)');
}

function _drawHdgTape(cv, hdg) {
  if (!cv || cv.width < 2) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const DIRS = {0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SO',270:'O',315:'NO'};
  ctx.clearRect(0,0,W,H);
  // Background
  const bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'rgba(8,6,12,0.98)'); bg.addColorStop(1,'rgba(5,4,8,0.95)');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  // Subtle center glow
  const cx = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.4);
  cx.addColorStop(0,'rgba(255,179,0,0.06)'); cx.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=cx; ctx.fillRect(0,0,W,H);
  const PPD = W / 60;
  for (let d=-32; d<=32; d+=5) {
    const deg=((Math.round(hdg)+d)%360+360)%360;
    const x=W/2+d*PPD;
    const maj=deg%10===0, card=DIRS[deg];
    const col = card?'#ff5500': maj?'rgba(255,179,0,0.8)':'rgba(255,179,0,0.2)';
    ctx.strokeStyle=col; ctx.lineWidth=maj?1.5:1;
    const th=maj?14:7;
    ctx.beginPath(); ctx.moveTo(x,H-th-3); ctx.lineTo(x,H-3); ctx.stroke();
    if (maj) {
      const lbl=card||deg;
      ctx.fillStyle=card?'#ff5500':'rgba(255,179,0,0.75)';
      ctx.font=(card?'bold ':'')+'10px Rajdhani,Arial,sans-serif';
      ctx.textAlign='center'; ctx.fillText(lbl,x,H-th-6);
    }
  }
  // Center marker
  ctx.fillStyle='rgba(255,179,0,0.9)';
  ctx.beginPath(); ctx.moveTo(W/2,H-1); ctx.lineTo(W/2-5,H-10); ctx.lineTo(W/2+5,H-10); ctx.closePath(); ctx.fill();
  // Heading box
  const bw=46,bh=22,bx=W/2-bw/2,by=2;
  ctx.fillStyle='rgba(5,4,8,0.95)'; ctx.fillRect(bx,by,bw,bh);
  ctx.strokeStyle='rgba(255,179,0,0.6)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
  ctx.fillStyle='#ffb300'; ctx.font='bold 13px Rajdhani,Arial,sans-serif'; ctx.textAlign='center';
  ctx.fillText(Math.round(hdg)+'°',W/2,by+16);
}

function _drawVTape(cv, val, minV, maxV, majStep, minStep, unit, right) {
  if (!cv || cv.height < 2) return;
  const ctx = cv.getContext('2d');
  const W=cv.width, H=cv.height;
  // right=true → altitude (ice blue), right=false → speed (orange)
  const COL  = right ? '#29d9ff' : '#ff5500';
  const DIM  = right ? 'rgba(41,217,255,0.2)' : 'rgba(255,85,0,0.2)';
  const GDIM = right ? 'rgba(41,217,255,0.08)' : 'rgba(255,85,0,0.08)';
  const PPU=H/80;
  ctx.clearRect(0,0,W,H);
  // Background
  const bg=ctx.createLinearGradient(right?W:0,0,right?0:W,0);
  bg.addColorStop(0,'rgba(5,4,8,0.97)'); bg.addColorStop(1,'rgba(8,7,14,0.85)');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  // Edge highlight
  ctx.strokeStyle=right?'rgba(41,217,255,0.12)':'rgba(255,85,0,0.12)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(right?W-1:0,0); ctx.lineTo(right?W-1:0,H); ctx.stroke();
  // Center zone gradient
  const cg=ctx.createLinearGradient(0,H/2-30,0,H/2+30);
  cg.addColorStop(0,'rgba(0,0,0,0)'); cg.addColorStop(0.5,GDIM); cg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=cg; ctx.fillRect(0,0,W,H);
  // Ticks
  const lo=val-40, hi=val+40;
  for (let v=Math.floor(lo/minStep)*minStep; v<=hi+minStep; v+=minStep) {
    const y=H/2-(v-val)*PPU;
    if (y<-5||y>H+5) continue;
    const maj=v%majStep===0;
    const tl=maj?15:7;
    ctx.strokeStyle=maj?COL:DIM; ctx.lineWidth=maj?1.5:0.8;
    if (right) { ctx.beginPath(); ctx.moveTo(2,y); ctx.lineTo(tl,y); ctx.stroke(); }
    else       { ctx.beginPath(); ctx.moveTo(W-tl,y); ctx.lineTo(W-2,y); ctx.stroke(); }
    if (maj&&v>=minV) {
      ctx.fillStyle=maj?COL:DIM; ctx.font='bold 9px Rajdhani,Arial,sans-serif';
      ctx.textAlign=right?'left':'right';
      ctx.fillText(v, right?tl+4:W-tl-4, y+3);
    }
  }
  // Center readout box
  const bh=24;
  ctx.fillStyle='rgba(5,4,8,0.95)'; ctx.fillRect(1,H/2-bh/2,W-2,bh);
  ctx.strokeStyle=COL; ctx.lineWidth=1.5; ctx.strokeRect(1,H/2-bh/2,W-2,bh);
  ctx.fillStyle=COL; ctx.font='bold 14px Rajdhani,Arial,sans-serif'; ctx.textAlign='center';
  ctx.shadowColor=COL; ctx.shadowBlur=6;
  ctx.fillText(Math.round(val),W/2,H/2+6);
  ctx.shadowBlur=0;
  // Unit label
  ctx.fillStyle=right?'rgba(41,217,255,0.35)':'rgba(255,85,0,0.35)';
  ctx.font='7px Rajdhani,Arial,sans-serif'; ctx.textAlign='center';
  ctx.fillText(unit,W/2,H-4);
}

function _drawAHI(cv, roll, pitch) {
  if (!cv || cv.width < 2) return;
  const ctx = cv.getContext('2d');
  const W=cv.width, H=cv.height;
  ctx.clearRect(0,0,W,H);

  // ── Sky / ground ──
  ctx.save();
  ctx.translate(W/2,H/2);
  ctx.rotate(roll*Math.PI/180);
  const PS=H/60, po=pitch*PS, bH=H*2.5;

  const skyG=ctx.createLinearGradient(0,-bH/2+po,0,po);
  skyG.addColorStop(0,'#020d1a'); skyG.addColorStop(0.6,'#03183a'); skyG.addColorStop(1,'#041f4a');
  ctx.fillStyle=skyG; ctx.fillRect(-W*1.5,-bH/2+po,W*3,bH/2);

  const gndG=ctx.createLinearGradient(0,po,0,bH/2+po);
  gndG.addColorStop(0,'#2a1200'); gndG.addColorStop(0.5,'#1c0c00'); gndG.addColorStop(1,'#0f0600');
  ctx.fillStyle=gndG; ctx.fillRect(-W*1.5,po,W*3,bH/2);

  // ── Horizon line with glow ──
  ctx.shadowColor='rgba(255,85,0,0.7)'; ctx.shadowBlur=10;
  ctx.strokeStyle='#ff5500'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(-W*1.5,po); ctx.lineTo(W*1.5,po); ctx.stroke();
  ctx.shadowBlur=0;

  // ── Pitch ladder ──
  ctx.font='bold 9px Rajdhani,Arial,sans-serif';
  for (let p=-40; p<=40; p+=5) {
    if (p===0) continue;
    const y=po-p*PS, maj=p%10===0;
    const len=maj?Math.min(W*0.3,60):Math.min(W*0.16,34);
    const alpha=maj?0.55:0.22;
    ctx.strokeStyle=`rgba(255,255,255,${alpha})`; ctx.lineWidth=maj?1.5:0.8;
    ctx.beginPath(); ctx.moveTo(-len/2,y); ctx.lineTo(len/2,y); ctx.stroke();
    if (maj) {
      ctx.fillStyle=`rgba(255,255,255,${alpha+0.1})`;
      ctx.textAlign='right'; ctx.fillText(Math.abs(p),-len/2-4,y+4);
      ctx.textAlign='left';  ctx.fillText(Math.abs(p), len/2+4,y+4);
    }
  }
  ctx.restore();

  // ── Roll arc ──
  const aR=Math.min(W,H)*0.32, aCX=W/2, aCY=H-16;
  ctx.strokeStyle='rgba(255,179,0,0.18)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(aCX,aCY,aR,Math.PI+0.35,-0.35,false); ctx.stroke();
  for (const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]) {
    const maj=a%30===0||a===0, card=a===0;
    const rad=(a-90)*Math.PI/180;
    ctx.strokeStyle=card?'rgba(255,85,0,0.9)':maj?'rgba(255,179,0,0.55)':'rgba(255,179,0,0.2)';
    ctx.lineWidth=card?2:maj?1.5:0.8;
    ctx.beginPath();
    ctx.moveTo(aCX+Math.cos(rad)*(aR+2),aCY+Math.sin(rad)*(aR+2));
    ctx.lineTo(aCX+Math.cos(rad)*(aR-(maj?11:5)),aCY+Math.sin(rad)*(aR-(maj?11:5)));
    ctx.stroke();
  }
  // Roll pointer
  const rrad=(roll-90)*Math.PI/180;
  const px=aCX+Math.cos(rrad)*(aR+2), py=aCY+Math.sin(rrad)*(aR+2);
  const tx=-Math.sin(rrad), ty=Math.cos(rrad);
  ctx.shadowColor='rgba(255,179,0,0.6)'; ctx.shadowBlur=6;
  ctx.fillStyle='#ffb300';
  ctx.beginPath();
  ctx.moveTo(px,py);
  ctx.lineTo(px+tx*6-Math.cos(rrad)*11, py+ty*6-Math.sin(rrad)*11);
  ctx.lineTo(px-tx*6-Math.cos(rrad)*11, py-ty*6-Math.sin(rrad)*11);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur=0;

  // ── Fixed aircraft symbol ──
  const wL=Math.min(W*0.14,42), rY=H/2, rCX=W/2;
  ctx.shadowColor='rgba(255,230,0,0.5)'; ctx.shadowBlur=5;
  ctx.strokeStyle='#ffe566'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(rCX-9-wL,rY); ctx.lineTo(rCX-9,rY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rCX+9,rY); ctx.lineTo(rCX+9+wL,rY); ctx.stroke();
  ctx.strokeStyle='#ffe566'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(rCX,rY,5,0,Math.PI*2); ctx.stroke();
  ctx.shadowBlur=0;

  // ── Session timer (if active) ──
  if (App.sessionActive) {
    const el=Date.now()-App.sessionStart;
    const ss=Math.floor(el/1000)%60, mm=Math.floor(el/60000)%60, hh=Math.floor(el/3600000);
    const ts=(hh>0?pad(hh)+':':'')+pad(mm)+':'+pad(ss);
    const bw=86,bh=22,bx=W/2-bw/2,by=8;
    ctx.fillStyle='rgba(4,3,7,0.88)'; ctx.fillRect(bx,by,bw,bh);
    ctx.strokeStyle='rgba(0,240,160,0.4)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
    if (Math.floor(Date.now()/600)%2===0) {
      ctx.fillStyle='#00f0a0';
      ctx.beginPath(); ctx.arc(bx+10,by+bh/2,3.5,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='#00f0a0'; ctx.font='bold 12px Rajdhani,Arial,sans-serif';
    ctx.textAlign='center'; ctx.fillText(ts,W/2,by+16);
  }
}


function renderReport(r) {
  const c = $('report-content');
  if (!c) return;
  const title   = r.meta.mode === 'route' ? 'Ruta a ' + r.meta.destination : 'Ruta libre';
  const score   = (r.speed.max>100?1:0)+(r.curves.total>5?1:0)+(r.inclin.maxAngle>20?1:0)+(r.curves.total>15?1:0)+(r.inclin.maxAngle>35?1:0);
  const ratings = [
    {r:'ROOKIE',stars:1,d:'Ruta tranquila, buena para empezar.'},
    {r:'ROOKIE',stars:1,d:'Ruta tranquila, buena para empezar.'},
    {r:'INTERMEDIO',stars:2,d:'Ruta variada con buen control.'},
    {r:'AVANZADO',stars:3,d:'Buen ritmo. Curvas bien trazadas.'},
    {r:'EXPERTO',stars:4,d:'Excelente manejo. Curvas y velocidad notables.'},
    {r:'MOTOGP PRO',stars:5,d:'Ruta técnica e intensa. Gran nivel de pilotaje.'}
  ];
  const rating = ratings[Math.min(score, 5)];
  const prev   = getPreviousReport();
  const badges = computeBadges(r);

  c.innerHTML = '<div class="report-wrap">' +
    '<div class="report-header"><div class="report-logo">🏍 BIKERWEATHER</div>' +
    '<div class="report-header-top"><div>' +
      '<div class="report-title">' + title + '</div>' +
      '<div class="report-date">' + new Date(r.meta.startTime).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) + '</div>' +
      '<div class="report-duration">Duración: <strong>' + r.meta.durationFmt + '</strong></div>' +
    '</div>' + trackMinimapSVG(r.meta.track || []) + '</div></div>' +

    '<div class="report-kpis">' +
      '<div class="report-kpi"><div class="kpi-value" style="color:#ff5500">' + r.speed.max + ' km/h</div><div class="kpi-label">VEL. MÁXIMA</div>' + (prev ? compareKpi(r.speed.max, prev.speed.max, 'km/h', true) : '') + '</div>' +
      '<div class="report-kpi"><div class="kpi-value" style="color:#ffb300">' + r.speed.avg + ' km/h</div><div class="kpi-label">VEL. MEDIA</div>' + (prev ? compareKpi(r.speed.avg, prev.speed.avg, 'km/h', true) : '') + '</div>' +
      '<div class="report-kpi"><div class="kpi-value" style="color:#29d9ff">' + (r.thermal.minWC != null ? (r.thermal.minWC>0?'+':'')+r.thermal.minWC+'°C' : '--') + '</div><div class="kpi-label">SENSACIÓN MÍN.</div>' + (prev && prev.thermal.minWC != null && r.thermal.minWC != null ? compareKpi(r.thermal.minWC, prev.thermal.minWC, '°C', false) : '') + '</div>' +
      '<div class="report-kpi"><div class="kpi-value" style="color:#00f0a0">' + r.curves.total + '</div><div class="kpi-label">CURVAS TOTALES</div>' + (prev ? compareKpi(r.curves.total, prev.curves.total, '', true) : '') + '</div>' +
    '</div>' +

    (badges.length ? '<div class="badges-row">' + badges.map(b=>'<div class="badge-item"><span class="badge-icon">'+b.icon+'</span><span class="badge-name">'+b.name+'</span></div>').join('') + '</div>' : '') +
    (prev ? comparisonBlock(r, prev) : '') +

    '<div class="report-section"><div class="report-section-title">ANÁLISIS DE CURVAS</div>' +
      '<div class="report-curves-grid">' +
        '<div class="curve-stat left"><div class="curve-arrow">↰</div><div class="curve-count">' + r.curves.left + '</div><div class="curve-lbl">IZQUIERDA</div></div>' +
        '<div class="curve-center"><div class="curve-big-num">' + r.curves.total + '</div><div class="curve-lbl">TOTAL</div><div class="curve-sub">Máx. <strong>' + r.curves.maxAngle + '°</strong> · Media <strong>' + r.curves.avgAngle + '°</strong></div></div>' +
        '<div class="curve-stat right"><div class="curve-arrow">↱</div><div class="curve-count">' + r.curves.right + '</div><div class="curve-lbl">DERECHA</div></div>' +
      '</div>' + angleDistChart(r.curves.list) + '</div>' +

    (r.gForces ? '<div class="report-kpis" style="margin-top:0;border-top:1px solid rgba(255,85,0,0.08);padding-top:10px">' +
      '<div class="report-kpi"><div class="kpi-value" style="color:#ff2255">' + (r.gForces.peakBraking || 0).toFixed(2) + 'G</div><div class="kpi-label">G FRENADA</div></div>' +
      '<div class="report-kpi"><div class="kpi-value" style="color:#00f0a0">' + (r.gForces.peakAccel   || 0).toFixed(2) + 'G</div><div class="kpi-label">G ACELERACIÓN</div></div>' +
      '<div class="report-kpi"><div class="kpi-value" style="color:#ffb300">' + (r.gForces.peakLateral || 0).toFixed(2) + 'G</div><div class="kpi-label">G LATERAL</div></div>' +
    '</div>' : '') +

    '<div class="report-section"><div class="report-section-title">PERFIL DE VELOCIDAD</div>' + lineChartSVG(r.speed.history, '#ff5500', 0, Math.max(r.speed.max,20), 'km/h') + '</div>' +
    (r.gForces?.historyLong?.length > 2 ? '<div class="report-section"><div class="report-section-title">FUERZAS G LONGITUDINALES</div>' + gForceLongChartSVG(r.gForces.historyLong) + '</div>' : '') +
    '<div class="report-section"><div class="report-section-title">PERFIL DE INCLINACIÓN</div>' + inclinChartSVG(r.inclin.history, r.curves.list) + '</div>' +
    '<div class="report-section"><div class="report-section-title">SENSACIÓN TÉRMICA EN RUTA</div>' + lineChartSVG(r.thermal.history, '#29d9ff', r.thermal.minWC != null ? r.thermal.minWC-2 : 0, r.thermal.avgWC != null ? r.thermal.avgWC+5 : 20, '°C') + '</div>' +
    topCurvesHTML(r.curves.list) +

    '<div class="report-section report-rating"><div class="report-section-title">CLASIFICACIÓN DE PILOTO</div>' +
      '<div class="rating-content">' +
        '<div class="rating-stars">' + '★'.repeat(rating.stars) + '☆'.repeat(5-rating.stars) + '</div>' +
        '<div class="rating-title">' + rating.r + '</div>' +
        '<div class="rating-desc">' + rating.d + '</div>' +
      '</div></div>' +
    '<div class="report-footer">Generado por BikerWeather · ' + new Date().toLocaleString('es-ES') + '</div>' +
  '</div>';
}

function trackMinimapSVG(track) {
  if (!track || track.length < 2) return '<div class="track-minimap-empty">Sin trayectoria</div>';
  const W=80, H=80, pad=6;
  const lats=track.map(p=>p.lat), lons=track.map(p=>p.lon);
  const minLat=Math.min(...lats), maxLat=Math.max(...lats), minLon=Math.min(...lons), maxLon=Math.max(...lons);
  const ranLat=maxLat-minLat||0.001, ranLon=maxLon-minLon||0.001;
  const toX=lon=>pad+((lon-minLon)/ranLon)*(W-pad*2);
  const toY=lat=>pad+((maxLat-lat)/ranLat)*(H-pad*2);
  const pts=track.map(p=>toX(p.lon)+','+toY(p.lat)).join(' ');
  const start=track[0], end=track[track.length-1];
  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" class="track-minimap">' +
    '<rect width="'+W+'" height="'+H+'" rx="4" fill="#0f0f18" stroke="rgba(255,85,0,0.2)" stroke-width="1"/>' +
    '<polyline points="'+pts+'" fill="none" stroke="#ff5500" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>' +
    '<circle cx="'+toX(start.lon)+'" cy="'+toY(start.lat)+'" r="3" fill="#00f0a0"/>' +
    '<circle cx="'+toX(end.lon)+'" cy="'+toY(end.lat)+'" r="3" fill="#ff2255"/>' +
  '</svg>';
}

function compareKpi(current, previous, unit, higherIsBetter) {
  if (previous == null) return '';
  const diff   = current - previous;
  if (diff === 0) return '<div class="kpi-compare neutral">= igual</div>';
  const better = higherIsBetter ? diff > 0 : diff < 0;
  const color  = better ? '#00f0a0' : '#ff2255';
  const sign   = diff > 0 ? '+' : '';
  return '<div class="kpi-compare" style="color:' + color + '">' + (diff > 0 ? '▲' : '▼') + ' ' + sign + Math.round(diff*10)/10 + unit + ' vs anterior</div>';
}

function comparisonBlock(r, prev) {
  return '<div class="report-section"><div class="report-section-title">VS RUTA ANTERIOR</div><div class="comparison-grid">' +
    compRow('Vel. máxima',  r.speed.max,       prev.speed.max,       'km/h', true) +
    compRow('Vel. media',   r.speed.avg,       prev.speed.avg,       'km/h', true) +
    compRow('Curvas',       r.curves.total,    prev.curves.total,    '',     true) +
    compRow('Ángulo máx.',  r.curves.maxAngle, prev.curves.maxAngle, '°',    true) +
    compRow('Sens. mínima', r.thermal.minWC,   prev.thermal.minWC,   '°C',   false) +
  '</div></div>';
}

function compRow(label, current, previous, unit, higherIsBetter) {
  if (current == null || previous == null) return '';
  const diff   = current - previous;
  const better = higherIsBetter ? diff >= 0 : diff <= 0;
  const color  = diff === 0 ? '#5a5a7a' : better ? '#00f0a0' : '#ff2255';
  const arrow  = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
  const sign   = diff > 0 ? '+' : '';
  return '<div class="comp-row"><span class="comp-label">' + label + '</span><span class="comp-prev">' + previous + unit + '</span><span class="comp-arrow" style="color:' + color + '">' + arrow + '</span><span class="comp-current" style="color:' + color + '">' + current + unit + '</span><span class="comp-diff" style="color:' + color + '">' + sign + Math.round(diff*10)/10 + unit + '</span></div>';
}

function getPreviousReport() {
  const history = getHistory();
  return history.length >= 2 ? history[1].report : null;
}

function computeBadges(r) {
  const history   = getHistory();
  const badges    = [];
  const allSpeeds = history.map(e => e.speedMax);
  const allCurves = history.map(e => e.curvesTotal);
  const allAngles = history.map(e => e.maxAngle);
  if (r.thermal.minWC != null && r.thermal.minWC < 0)   badges.push({icon:'🥶',name:'Bajo cero'});
  if (r.thermal.minWC != null && r.thermal.minWC < -10)  badges.push({icon:'🧊',name:'Gélido extremo'});
  if (r.curves.total >= 50)                              badges.push({icon:'🔄',name:'50+ curvas'});
  if (r.curves.total >= 100)                             badges.push({icon:'💯',name:'100 curvas'});
  if (r.curves.maxAngle >= 45)                           badges.push({icon:'🏆',name:'45° inclinación'});
  if (r.speed.max >= 150)                                badges.push({icon:'🚀',name:'+150 km/h'});
  if (r.meta.durationFmt.includes('h'))                  badges.push({icon:'⏱',name:'Ruta larga'});
  if (history.length === 1)                              badges.push({icon:'🌟',name:'Primera ruta'});
  if (allSpeeds.length > 1 && r.speed.max >= Math.max(...allSpeeds))       badges.push({icon:'⚡',name:'Récord velocidad'});
  if (allCurves.length > 1 && r.curves.total >= Math.max(...allCurves))    badges.push({icon:'🎯',name:'Récord curvas'});
  if (allAngles.length > 1 && r.curves.maxAngle >= Math.max(...allAngles)) badges.push({icon:'🔥',name:'Récord inclinación'});
  return badges;
}

function lineChartSVG(data, color, min, max, unit) {
  if (!data || data.length < 2) return '<p class="report-empty">Sin datos</p>';
  const W=320,H=80,pl=32,pr=10,pt=10,pb=20,iW=W-pl-pr,iH=H-pt-pb,range=max-min||1;
  const pts = data.map((v,i)=>[(pl+(i/(data.length-1))*iW),(pt+iH-((v-min)/range)*iH)]);
  const linePath = 'M'+pts.map(p=>p.join(',')).join(' L');
  const areaPath = 'M'+pl+','+(pt+iH)+' L'+pts.map(p=>p.join(',')).join(' L')+' L'+(pl+iW)+','+(pt+iH)+' Z';
  const gid = 'g'+Math.random().toString(36).slice(2);
  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">' +
    '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity="0.3"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0.02"/></linearGradient></defs>' +
    '<line x1="'+pl+'" y1="'+pt+'" x2="'+(pl+iW)+'" y2="'+pt+'" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>' +
    '<line x1="'+pl+'" y1="'+(pt+iH/2)+'" x2="'+(pl+iW)+'" y2="'+(pt+iH/2)+'" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>' +
    '<line x1="'+pl+'" y1="'+(pt+iH)+'" x2="'+(pl+iW)+'" y2="'+(pt+iH)+'" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>' +
    '<text x="'+(pl-4)+'" y="'+(pt+4)+'" font-size="8" fill="#5a5a7a" text-anchor="end">'+Math.round(max)+'</text>' +
    '<text x="'+(pl-4)+'" y="'+(pt+iH+4)+'" font-size="8" fill="#5a5a7a" text-anchor="end">'+Math.round(min)+'</text>' +
    '<path d="'+areaPath+'" fill="url(#'+gid+')"/>' +
    '<path d="'+linePath+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<text x="'+(pl+iW)+'" y="'+(pt-2)+'" font-size="8" fill="'+color+'" text-anchor="end">'+Math.max(...data)+unit+'</text>' +
  '</svg>';
}

// Gráfico bicolor G longitudinal: aceleración (verde arriba) / frenada (rojo abajo)
function gForceLongChartSVG(data) {
  if (!data || data.length < 2) return '<p class="report-empty">Sin datos</p>';
  const W=320,H=90,pl=36,pr=10,pt=10,pb=20,iW=W-pl-pr,iH=H-pt-pb;
  const absMax = Math.max(0.1, ...data.map(Math.abs));
  const zero   = pt + iH / 2;
  const scaleY = v => zero - (v / absMax) * (iH / 2);
  // Segmentos coloreados por signo
  let paths = '';
  for (let i = 1; i < data.length; i++) {
    const x1 = pl + ((i-1)/(data.length-1))*iW, x2 = pl + (i/(data.length-1))*iW;
    const y1 = scaleY(data[i-1]), y2 = scaleY(data[i]);
    const col = (data[i-1]+data[i]) >= 0 ? '#00f0a0' : '#ff2255';
    paths += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+col+'" stroke-width="1.5" stroke-linecap="round"/>';
  }
  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">' +
    '<line x1="'+pl+'" y1="'+zero+'" x2="'+(pl+iW)+'" y2="'+zero+'" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>' +
    '<text x="'+(pl-4)+'" y="'+(pt+5)+'"    font-size="8" fill="#00f0a0" text-anchor="end">+'+absMax.toFixed(1)+'G</text>' +
    '<text x="'+(pl-4)+'" y="'+(pt+iH+5)+'" font-size="8" fill="#ff2255" text-anchor="end">-'+absMax.toFixed(1)+'G</text>' +
    '<text x="'+(pl-4)+'" y="'+(zero+3)+'"  font-size="8" fill="#5a5a7a" text-anchor="end">0</text>' +
    paths +
  '</svg>';
}

function inclinChartSVG(data, curves) {
  if (!data || data.length < 2) return '<p class="report-empty">Sin datos</p>';
  const W=320,H=100,pl=32,pr=10,pt=10,pb=20,iW=W-pl-pr,iH=H-pt-pb;
  const absMax = Math.max(45, ...data.map(Math.abs));
  const midY   = pt+iH/2;
  const pts    = data.map((v,i)=>[(pl+(i/(data.length-1))*iW),(midY-(v/absMax)*(iH/2))]);
  const marks  = curves.map(c=>{
    const idx = Math.min(Math.round((c.t/1000)),data.length-1);
    const x   = pl+(idx/(data.length-1))*iW;
    return '<line x1="'+x+'" y1="'+pt+'" x2="'+x+'" y2="'+(pt+iH)+'" stroke="'+(c.dir==='L'?'#29d9ff':'#ff5500')+'" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>';
  }).join('');
  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">' +
    '<line x1="'+pl+'" y1="'+midY+'" x2="'+(pl+iW)+'" y2="'+midY+'" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
    '<text x="'+(pl-4)+'" y="'+(pt+4)+'" font-size="7" fill="#ff5500" text-anchor="end">+'+absMax+'°</text>' +
    '<text x="'+(pl-4)+'" y="'+(midY+4)+'" font-size="7" fill="#5a5a7a" text-anchor="end">0°</text>' +
    '<text x="'+(pl-4)+'" y="'+(pt+iH+4)+'" font-size="7" fill="#29d9ff" text-anchor="end">-'+absMax+'°</text>' +
    marks +
    '<path d="M'+pts.map(p=>p.join(',')).join(' L')+'" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1" stroke-linejoin="round"/>' +
  '</svg>';
}

function angleDistChart(list) {
  if (!list.length) return '<p class="report-empty">Sin curvas</p>';
  const bs     = [{l:'8-15°',mn:8,mx:15},{l:'15-25°',mn:15,mx:25},{l:'25-35°',mn:25,mx:35},{l:'35-45°',mn:35,mx:45},{l:'>45°',mn:45,mx:999}];
  const counts = bs.map(b=>list.filter(c=>c.maxAngle>=b.mn&&c.maxAngle<b.mx).length);
  const maxC   = Math.max(...counts,1);
  return '<div class="angle-dist">' + bs.map((b,i)=>'<div class="angle-bucket"><div class="angle-bar-wrap"><div class="angle-bar" style="height:'+Math.round((counts[i]/maxC)*60)+'px;background:'+(counts[i]>0?'#ff5500':'#141420')+'"></div></div><div class="angle-count">'+counts[i]+'</div><div class="angle-label">'+b.l+'</div></div>').join('') + '</div>';
}

function topCurvesHTML(list) {
  if (!list.length) return '';
  const top = [...list].sort((a,b)=>b.maxAngle-a.maxAngle).slice(0,5);
  return '<div class="report-section"><div class="report-section-title">TOP CURVAS MÁS PRONUNCIADAS</div><div class="top-curves-list">' +
    top.map((c,i)=>'<div class="top-curve-row"><div class="tc-rank">#'+(i+1)+'</div><div class="tc-dir '+(c.dir==='L'?'left':'right')+'">'+(c.dir==='L'?'↰ IZQ':'↱ DER')+'</div><div class="tc-angle">'+c.maxAngle+'°</div><div class="tc-bar-wrap"><div class="tc-bar" style="width:'+Math.round(c.maxAngle/90*100)+'%;background:'+(c.dir==='L'?'#29d9ff':'#ff5500')+'"></div></div><div class="tc-dur">'+c.speed+'km/h</div></div>').join('') +
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
   INTRO SPLASH
═══════════════════════════════════════ */
function initIntroScreen() {
  const screen = $('intro-screen');
  if (!screen) return;
  const MIN_MS = 3000, MAX_MS = 7000;
  const start = Date.now();

  function setChip(id, ok, err) {
    const el = $(id); if (!el) return;
    if (ok)  { el.classList.add('ic-ok');  el.textContent = el.textContent.replace('…','') + ' ✓'; }
    if (err) { el.classList.add('ic-err'); el.textContent = el.textContent.replace('…','') + ' ✗'; }
  }

  const iv = setInterval(() => {
    const elapsed = Date.now() - start;
    setChip('ic-gps', !!App.position, false);
    setChip('ic-met', !!App.weather,  false);
    setChip('ic-gyr', App.tiltFilter?.gyroReady, !('DeviceOrientationEvent' in window));
    if (elapsed >= MIN_MS && (App.position || elapsed >= MAX_MS)) {
      clearInterval(iv);
      screen.classList.add('intro-out');
      setTimeout(() => screen.remove(), 700);
    }
  }, 400);
}

/* ═══════════════════════════════════════
   HOME SCREEN
═══════════════════════════════════════ */
function showHome() {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.body.classList.add('home-active');
  const bh = $('btn-home'); if (bh) bh.style.display = 'none';
  _updateHomeTiles();
}

function showSection(sectionId) {
  document.body.classList.remove('home-active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = $(sectionId); if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === sectionId);
  });
  const bh = $('btn-home'); if (bh) bh.style.display = 'flex';
  if (sectionId === 'section-riding' && App.mapInitialized) setTimeout(() => App.leafletMap.invalidateSize(), 100);
  if (sectionId === 'section-history') renderHistory();
  if (sectionId === 'section-social') loadRanking();
}

function _updateHomeTiles() {
  const now = new Date();
  const tEl = $('hm-time');
  if (tEl) tEl.textContent = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  if (App.weather?.temp !== undefined) {
    const tempEl = $('hm-temp'); if (tempEl) tempEl.textContent = Math.round(App.weather.temp) + '°';
    const dashEl = $('ht-sub-dash'); if (dashEl) {
      const ws = App.weather.windSpeed !== undefined ? Math.round(App.weather.windSpeed * 3.6) + ' km/h' : '--';
      dashEl.textContent = Math.round(App.weather.temp) + '° · ' + ws;
    }
  }
  const gpsEl = $('hm-gps'); if (gpsEl) gpsEl.classList.toggle('hm-dot-on', !!App.position);
  const obdEl = $('hm-obd'); if (obdEl) obdEl.classList.toggle('hm-dot-on', App.obd2Rpm != null);
  const metEl = $('hm-met'); if (metEl) metEl.classList.toggle('hm-dot-on', !!App.weather);
  if (App.sessionActive) {
    const mins = Math.round((Date.now() - (App.sessionStart || Date.now())) / 60000);
    const enEl = $('ht-sub-enruta'); if (enEl) enEl.textContent = 'Sesión · ' + mins + ' min';
  }
  try {
    const hist = JSON.parse(localStorage.getItem('bw_route_history') || '[]');
    const hEl = $('ht-sub-hist');
    if (hEl && hist.length > 0) hEl.textContent = hist.length + ' sesión' + (hist.length !== 1 ? 'es' : '') + ' guardada' + (hist.length !== 1 ? 's' : '');
  } catch(e) {}
}

function initHomeScreen() {
  document.querySelectorAll('.home-tile').forEach(tile => {
    tile.addEventListener('click', () => showSection(tile.dataset.goto));
  });
  $('btn-home')?.addEventListener('click', showHome);
  showHome();
  setInterval(_updateHomeTiles, 30000);
}

/* ═══════════════════════════════════════
   NAV
═══════════════════════════════════════ */
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const sec = $(target); if (sec) sec.classList.add('active');
      btn.classList.add('active');
      if (target === 'section-riding' && App.mapInitialized) setTimeout(() => App.leafletMap.invalidateSize(), 100);
      if (target === 'section-history') renderHistory();
      if (target === 'section-social')  loadRanking();
    });
  });
}

/* ═══════════════════════════════════════
   RIDING CONTROLS
═══════════════════════════════════════ */
function _launchStyle(num) {
  const dest = $('ride-dest-input')?.value?.trim() || null;
  if (App.rideMode === 'route' && !dest) { toast('Introduce un destino', 'info'); return; }
  // Guardamos destino para cuando el usuario pulse ▶ dentro del display
  App.rideDestination = dest;
  document.querySelectorAll('.style-tile').forEach(b => b.classList.remove('active'));
  $('btn-style-' + num)?.classList.add('active');
  if (num === 6) {
    // Ruta libre — muestra mapa, inicio manual con btn-map-start
    $('pre-ride-controls').style.display = 'none';
    const mc = $('map-container'); if (mc) mc.style.display = 'block';
    if (!App.mapInitialized) initMap(); else mapClear();
    if (App.position) mapUpdatePosition(App.position.lat, App.position.lon);
    setTimeout(() => { if (App.leafletMap) { App.leafletMap.invalidateSize(); if (App.position) App.leafletMap.setView([App.position.lat, App.position.lon], 15); } }, 200);
    App.rideMode = dest ? 'route' : 'free';
    const ms = $('btn-map-start'); if (ms) ms.style.display = 'flex';
  } else {
    // Estilos 1-5 — abre display, el usuario inicia desde ▶ INICIO del overlay
    openCircuit('estilo' + num);
  }
}

function initRidingControls() {
  $('dest-tog-free')?.addEventListener('click', () => {
    App.rideMode = 'free';
    $('dest-tog-free').classList.add('active');
    $('dest-tog-dest').classList.remove('active');
    $('ride-dest-wrap').classList.remove('open');
  });
  $('dest-tog-dest')?.addEventListener('click', () => {
    App.rideMode = 'route';
    $('dest-tog-dest').classList.add('active');
    $('dest-tog-free').classList.remove('active');
    $('ride-dest-wrap').classList.add('open');
    setTimeout(() => $('ride-dest-input')?.focus(), 320);
  });
  $('ride-dest-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('btn-stop-route')?.addEventListener('click', () => stopSession());
  $('btn-recenter')?.addEventListener('click', () => {
    App.followRider = true;
    if (App.position && App.leafletMap) App.leafletMap.setView([App.position.lat, App.position.lon], 15, { animate:true });
  });
  $('btn-map-start')?.addEventListener('click', () => {
    const ms = $('btn-map-start'); if (ms) ms.style.display = 'none';
    startSession();
    if (App.rideDestination) calculateRoute(App.rideDestination, App.routeSpeed).catch(e => toast(e.message, 'error'));
    toast('Ruta libre iniciada ▶', 'ok');
  });
}

function initSpeedSlider() {
  const sl = $('speed-slider');
  const apply = kmh => { App.routeSpeed = kmh; updateRouteSpeedUI(kmh); };
  sl?.addEventListener('input', e => apply(parseInt(e.target.value)));
  document.querySelectorAll('.speed-preset').forEach(btn => btn.addEventListener('click', () => apply(parseInt(btn.dataset.speed))));
  updateRouteSpeedUI(App.routeSpeed);
}

function initRouteControls() { /* slider gestionado en initSpeedSlider */ }

function initReportControls() {
  $('btn-close-report')?.addEventListener('click', () => $('report-panel')?.classList.remove('show'));
  $('btn-whatsapp')?.addEventListener('click', () => { if (App.sessionReport) shareWhatsApp(App.sessionReport); });
  $('btn-new-route')?.addEventListener('click', () => {
    $('report-panel')?.classList.remove('show');
    App.sessionReport = null;
    if (App.circuitMode) {
      $('btn-cir-start').style.display = 'flex';
      $('btn-cir-stop').style.display  = 'none';
    } else {
      $('pre-ride-controls').style.display = 'flex';
      const mc = $('map-container'); if (mc) mc.style.display = 'none';
    }
  });
}

function detectAPIs() {
  const set = (id, ok) => { const el=$(id); if(!el) return; el.textContent=ok?'✓ Disponible':'✗ No disponible'; el.className='sensor-val '+(ok?'ok':'no'); };
  set('sensor-orient',   'DeviceOrientationEvent' in window);
  set('sensor-motion',   'DeviceMotionEvent' in window);
  set('sensor-wakelock', 'wakeLock' in navigator);
  set('sensor-geo',      'geolocation' in navigator);
  const cfEl = $('cf-status');
  if (cfEl) {
    const hasMotion = 'DeviceMotionEvent' in window;
    cfEl.textContent = hasMotion ? 'Esperando giróscopo…' : 'No disponible';
    cfEl.className   = 'sensor-val ' + (hasMotion ? '' : 'no');
  }
}

/* ═══════════════════════════════════════
   MAIN
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // PWA install
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e;
    const b = $('install-banner'); if (b) b.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; const b=$('install-banner'); if(b) b.style.display='none'; });
  $('btn-install')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    const b=$('install-banner'); if(b) b.style.display='none';
  });
  $('btn-install-close')?.addEventListener('click', () => { const b=$('install-banner'); if(b) b.style.display='none'; });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  detectAPIs();
  initIntroScreen();
  initHomeScreen();
  initNav();
  initSpeedSlider();
  initRouteControls();
  initRidingControls();
  initReportControls();

  // Planificador
  $('btn-plan-go')?.addEventListener('click', runPlanner);
  $('btn-plan-myloc')?.addEventListener('click', () => {
    if (App.position) $('plan-origin').value = 'Mi posición (' + App.position.lat.toFixed(4) + ', ' + App.position.lon.toFixed(4) + ')';
    else toast('Esperando GPS…', 'info');
  });
  const planTime = $('plan-time');
  if (planTime) { const now = new Date(); now.setMinutes(0,0,0); planTime.value = now.toISOString().slice(0,16); }
  $('plan-dest')?.addEventListener('keydown', e => { if (e.key === 'Enter') runPlanner(); });

  // Historial
  renderHistory();
  $('btn-clear-history')?.addEventListener('click', () => {
    if (confirm('¿Borrar todo el historial de rutas?')) { localStorage.removeItem(HISTORY_KEY); renderHistory(); }
  });

  $('btn-calibrate')?.addEventListener('click',  doCalibrate);
  $('btn-calibrate2')?.addEventListener('click', doCalibrate);
  $('btn-cir-cal')?.addEventListener('click', doCalibrate);
  document.getElementById('toggle-landscape')?.addEventListener('change', toggleLandscapeMode);
  $('btn-map-landscape')?.addEventListener('click', toggleLandscapeMode);
  $('btn-open-circuit')?.addEventListener('click', () => openCircuit());

  // Style tiles — tap = arranca ruta con ese display
  for (let i = 1; i <= 6; i++) $('btn-style-' + i)?.addEventListener('click', () => _launchStyle(i));

  // OBD2 toggle + status pill click → connect/disconnect
  App.obd2Enabled = localStorage.getItem('bw_obd2') !== 'false';
  const obd2Chk = document.getElementById('toggle-obd2');
  if (obd2Chk) {
    obd2Chk.checked = App.obd2Enabled;
    obd2Chk.addEventListener('change', () => {
      App.obd2Enabled = obd2Chk.checked;
      localStorage.setItem('bw_obd2', App.obd2Enabled);
      document.body.classList.toggle('no-obd2', !App.obd2Enabled);
      if (!App.obd2Enabled) disconnectOBD2();
    });
  }
  document.body.classList.toggle('no-obd2', !App.obd2Enabled);
  $('status-obd')?.addEventListener('click', () => {
    if (!App.obd2Enabled) { toast('Activa OBD2 en Configuración', 'info'); return; }
    if (App.obdConnected) disconnectOBD2(); else connectOBD2();
  });
  $('btn-cir-start')?.addEventListener('click', startCircuitSession);
  $('btn-cir-stop')?.addEventListener('click', stopCircuitSession);
  $('btn-cir-exit')?.addEventListener('click', closeCircuit);
  $('btn-cir-ls')?.addEventListener('click', () => { toggleLandscapeMode(); $('btn-cir-ls')?.classList.toggle('active', App.landscapeMode); });
  // Botón T: alterna el slider entre modo color (hue) e intensidad (glow)
  let _sliderMode = 'hue';
  $('btn-cir-brand')?.addEventListener('click', () => {
    _sliderMode = _sliderMode === 'hue' ? 'glow' : 'hue';
    const slider = $('cir-hue');
    const btn = $('btn-cir-brand');
    if (!slider) return;
    if (_sliderMode === 'glow') {
      slider.min = '0'; slider.max = '100';
      const curG = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cir-g').trim()) || 0.8;
      slider.value = Math.round(curG * 100);
      slider.classList.add('mode-glow');
      if (btn) { btn.textContent = 'I'; btn.classList.add('active'); }
    } else {
      slider.min = '0'; slider.max = '360';
      slider.value = _cirHue || 20;
      slider.classList.remove('mode-glow');
      if (btn) { btn.textContent = 'T'; btn.classList.remove('active'); }
    }
  });
  $('btn-cir-mute')?.addEventListener('click', () => {
    _kirkMuted = !_kirkMuted;
    if (_kirkMuted) {
      window.speechSynthesis?.cancel();
      _kirkStopListening();
    }
    $('btn-cir-mute')?.classList.toggle('active', _kirkMuted);
  });
  $('btn-cir-mic')?.addEventListener('click', () => {
    if (!_kirkRec) { toast('Voz no disponible', 'info'); return; }
    $('btn-cir-mic').classList.add('active');
    try { _kirkRec.start(); } catch(e) { $('btn-cir-mic').classList.remove('active'); }
  });
  $('btn-roll-flip')?.addEventListener('click', () => {
    App.rollFlip = !App.rollFlip;
    $('btn-roll-flip')?.classList.toggle('active', App.rollFlip);
    $('btn-cir-inv-r')?.classList.toggle('active', App.rollFlip);
    toast(App.rollFlip ? 'Roll invertido' : 'Roll normal', 'info');
  });
  $('btn-pitch-flip')?.addEventListener('click', () => {
    App.pitchFlip = !App.pitchFlip;
    $('btn-pitch-flip')?.classList.toggle('active', App.pitchFlip);
    $('btn-cir-inv-p')?.classList.toggle('active', App.pitchFlip);
    toast(App.pitchFlip ? 'Pitch invertido' : 'Pitch normal', 'info');
  });
  $('btn-cir-inv-r')?.addEventListener('click', () => {
    App.rollFlip = !App.rollFlip;
    $('btn-cir-inv-r')?.classList.toggle('active', App.rollFlip);
    $('btn-roll-flip')?.classList.toggle('active', App.rollFlip);
    if (App.circuitMode) kirkSpeak(App.rollFlip ? 'Roll invertido.' : 'Roll normal.');
  });
  $('btn-cir-inv-p')?.addEventListener('click', () => {
    App.pitchFlip = !App.pitchFlip;
    $('btn-cir-inv-p')?.classList.toggle('active', App.pitchFlip);
    $('btn-pitch-flip')?.classList.toggle('active', App.pitchFlip);
    if (App.circuitMode) kirkSpeak(App.pitchFlip ? 'Pitch invertido.' : 'Pitch normal.');
  });

  // Wake Lock
  $('wakelock-badge')?.addEventListener('click', async () => {
    if (App.wakeLockEnabled) await disableWakeLock(); else await enableWakeLock();
  });
  await enableWakeLock();

  // Online/offline
  window.addEventListener('online',  () => { const b=$('offline-banner'); if(b) b.classList.remove('show'); });
  window.addEventListener('offline', () => { const b=$('offline-banner'); if(b) b.classList.add('show'); });

  // Kirk / Groq
  const savedGroqKey = localStorage.getItem('bw_groq_key');
  if (savedGroqKey) { const gk=$('groq-api-key'); if(gk) gk.value=savedGroqKey; }
  $('btn-save-groq')?.addEventListener('click', () => {
    const key = $('groq-api-key')?.value?.trim();
    if (!key) { localStorage.removeItem('bw_groq_key'); toast('API key eliminada', 'info'); return; }
    if (!key.startsWith('gsk_')) { toast('La key debe empezar por gsk_', 'error'); return; }
    localStorage.setItem('bw_groq_key', key);
    toast('Groq API key guardada ✓', 'ok');
  });
  const populateVoicePicker = () => {
    const sel = $('kirk-voice-select');
    if (!sel) return;
    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('es'));
    const saved  = localStorage.getItem('bw_kirk_voice');
    sel.innerHTML = '<option value="">— Sistema por defecto —</option>' +
      voices.map(v => `<option value="${v.name}"${v.name===saved?' selected':''}>${v.name}</option>`).join('');
  };
  window.speechSynthesis?.addEventListener('voiceschanged', populateVoicePicker);
  populateVoicePicker();
  $('kirk-voice-select')?.addEventListener('change', e => {
    const val = e.target.value;
    _kirkVoice = null;
    if (val) localStorage.setItem('bw_kirk_voice', val); else localStorage.removeItem('bw_kirk_voice');
  });
  $('btn-test-voice')?.addEventListener('click', () => { _kirkVoice = null; kirkSpeak('Kirk activo. Copiloto listo.'); });

  // Ruta: botón mic Kirk
  $('btn-hud-mic')?.addEventListener('click', () => {
    if (!_kirkRec) { toast('Voz no disponible', 'info'); return; }
    if (_kirkListening) _kirkStopListening(); else _kirkStartListening();
  });

  // Moto
  const savedBike = localStorage.getItem('bw_bike_model');
  if (savedBike) { const bm=$('bike-model'); if(bm) bm.value=savedBike; const bs=$('bike-status'); if(bs) bs.textContent='✓ '+savedBike; }
  $('btn-save-bike')?.addEventListener('click', () => {
    const model = $('bike-model')?.value?.trim();
    if (!model) { toast('Introduce el modelo de tu moto', 'info'); return; }
    localStorage.setItem('bw_bike_model', model);
    const bs=$('bike-status'); if(bs) bs.textContent='✓ '+model;
    toast('Moto guardada ✓', 'ok');
  });

  // Emergencia
  const savedPhone = localStorage.getItem('bw_emergency_phone');
  if (savedPhone) { const ep=$('emergency-phone'); if(ep) ep.value=savedPhone; const es=$('emergency-status'); if(es) es.textContent='✓ Guardado: '+savedPhone; }
  $('btn-save-emergency')?.addEventListener('click', () => {
    const phone = $('emergency-phone')?.value?.trim();
    if (!phone) { toast('Introduce un número', 'info'); return; }
    localStorage.setItem('bw_emergency_phone', phone);
    const es=$('emergency-status'); if(es) es.textContent='✓ Guardado: '+phone;
    toast('Contacto de emergencia guardado ✓', 'ok');
  });

  // Detección de caída
  startFallDetection();

  // Radio
  initRadio();

  // OBD2 diagnóstico — botones del panel
  $('btn-obd-read')?.addEventListener('click',    () => obdReadDTCs('stored'));
  $('btn-obd-pending')?.addEventListener('click', () => obdReadDTCs('pending'));
  $('btn-obd-clear')?.addEventListener('click',   obdClearDTCs);

  // Firebase
  initFirebase().catch(e => console.warn('[FB]', e));
  checkWatchMode();

  // Nickname
  const savedNick = localStorage.getItem('bw_nickname');
  if (savedNick) { const ni=$('nickname-input'); if(ni) ni.value=savedNick; }
  $('btn-save-nickname')?.addEventListener('click', saveNickname);

  // Compartir
  $('btn-share-start')?.addEventListener('click', startSharing);
  $('btn-share-stop')?.addEventListener('click', stopSharing);
  $('btn-share-copy')?.addEventListener('click', () => {
    const box=$('share-url-box');
    if (box) { navigator.clipboard.writeText(box.value); toast('Enlace copiado ✓', 'ok'); }
  });
  $('btn-share-wa')?.addEventListener('click', () => {
    const box=$('share-url-box');
    if (box) window.open('https://wa.me/?text='+encodeURIComponent('¡Sígueme en directo en BikerWeather! 🏍\n'+box.value), '_blank');
  });

  // Ranking
  $('btn-reload-ranking')?.addEventListener('click', loadRanking);

  // Circuit HUD accent hue + glow intensity (slider compartido, alternado por botón T)
  const savedHue = localStorage.getItem('bw_cir_hue') || '20';
  _cirHue = parseInt(savedHue);
  document.documentElement.style.setProperty('--cir-h', savedHue);
  const savedGlow = localStorage.getItem('bw_cir_glow') || '80';
  document.documentElement.style.setProperty('--cir-g', (parseInt(savedGlow) / 100).toFixed(2));
  const hueSlider = $('cir-hue');
  if (hueSlider) {
    hueSlider.value = savedHue;
    hueSlider.addEventListener('input', e => {
      if (_sliderMode === 'glow') {
        document.documentElement.style.setProperty('--cir-g', (parseInt(e.target.value) / 100).toFixed(2));
        localStorage.setItem('bw_cir_glow', e.target.value);
      } else {
        _cirHue = parseInt(e.target.value);
        document.documentElement.style.setProperty('--cir-h', e.target.value);
        localStorage.setItem('bw_cir_hue', e.target.value);
      }
    });
  }

  // GPS + Gyro + Slider
  startGPS();
  startGyro();

  const sl = $('speed-slider');
  if (sl) {
    const upd = () => { const p=((sl.value-sl.min)/(sl.max-sl.min))*100; sl.style.background='linear-gradient(to right,var(--orange) 0%,var(--orange) '+p+'%,var(--bg4) '+p+'%)'; };
    sl.addEventListener('input', upd); upd();
  }
});

/* ═══════════════════════════════════════
   BLE OBD2 — ELM327 / Vgate iCar Pro BLE 4.0
   Perfil: FFF0 / FFF1(write) / FFF2(notify)
   Fallback: Nordic UART Service (NUS)
═══════════════════════════════════════ */

/* Tabla de descripciones DTC (códigos genéricos más comunes) */
const DTC_DESC = {
  P0100:'Sensor flujo aire (MAF) — circuito',        P0101:'Sensor MAF — rendimiento',
  P0105:'Sensor presión múltiple (MAP)',              P0110:'Sensor temperatura admisión',
  P0115:'Sensor temperatura refrigerante',           P0120:'Sensor posición mariposa (TPS)',
  P0121:'Rendimiento TPS',                           P0130:'Sensor O2 banco 1 sonda 1',
  P0133:'O2 banco 1 sonda 1 — respuesta lenta',      P0135:'Calefactor O2 banco 1 sonda 1',
  P0171:'Sistema demasiado pobre banco 1',           P0172:'Sistema demasiado rico banco 1',
  P0201:'Inyector cilindro 1',                       P0202:'Inyector cilindro 2',
  P0203:'Inyector cilindro 3',                       P0204:'Inyector cilindro 4',
  P0300:'Fallo encendido aleatorio/múltiple',        P0301:'Fallo encendido cil. 1',
  P0302:'Fallo encendido cil. 2',                    P0303:'Fallo encendido cil. 3',
  P0304:'Fallo encendido cil. 4',                    P0320:'Sensor velocidad cigüeñal (CKP)',
  P0335:'Sensor posición cigüeñal',                  P0340:'Sensor posición árbol levas',
  P0351:'Bobina de encendido cil. 1',                P0352:'Bobina de encendido cil. 2',
  P0420:'Eficiencia catalizador por debajo umbral',  P0440:'Sistema evaporativo EVAP',
  P0480:'Ventilador refrigeración circuito 1',       P0500:'Sensor velocidad vehículo',
  P0505:'Sistema control ralentí',                   P0560:'Tensión sistema — rango/rendimiento',
  P0601:'Error memoria interna ECU',                 P0605:'Error ROM ECU',
  P0700:'Sistema control transmisión',               P1000:'OBD no completado (ciclo conducción)',
};

function _decodeDTC(b1, b2) {
  const sys = ['P','C','B','U'][(b1 >> 6) & 3];
  const d1 = (b1 >> 4) & 3;
  const d2 = (b1 & 0x0F).toString(16).toUpperCase();
  const d3 = ((b2 >> 4) & 0x0F).toString(16).toUpperCase();
  const d4 = (b2 & 0x0F).toString(16).toUpperCase();
  return `${sys}${d1}${d2}${d3}${d4}`;
}

function _parseDTCBytes(raw, serviceHex) {
  // Remove service response byte (e.g. "43" for mode 03) and parse hex pairs
  const clean = raw.toUpperCase()
    .replace(new RegExp(serviceHex, 'g'), '')
    .replace(/[^0-9A-F]/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(h => h.length === 2);
  const bytes  = tokens.map(h => parseInt(h, 16));
  const dtcs   = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === 0 && bytes[i+1] === 0) continue;
    dtcs.push(_decodeDTC(bytes[i], bytes[i+1]));
  }
  return dtcs;
}

function _renderDTCList(dtcs, type) {
  const list = $('obd-dtc-list');
  if (!list) return;
  if (!dtcs.length) {
    list.innerHTML = `<div class="obd-dtc-row none"><span class="obd-dtc-code">✓</span><span class="obd-dtc-desc">Sin ${type === 'pending' ? 'fallos pendientes' : 'fallos almacenados'}</span></div>`;
    return;
  }
  list.innerHTML = dtcs.map(code => {
    const desc = DTC_DESC[code] || 'Código específico del fabricante';
    const cls  = type === 'pending' ? 'pending' : '';
    return `<div class="obd-dtc-row ${cls}"><span class="obd-dtc-code">${code}</span><span class="obd-dtc-desc">${desc}</span></div>`;
  }).join('');
}

async function obdReadDTCs(mode) {
  if (!App.obdConnected) { toast('OBD2 no conectado', 'warn'); return; }
  const cmd = mode === 'pending' ? '07' : '03';
  const svcResp = mode === 'pending' ? '47' : '43';
  $('obd-dtc-list').innerHTML = '<span class="obd-dtc-hint">Leyendo…</span>';
  try {
    const raw = await _obdCmd(cmd);
    if (!raw || raw === 'TIMEOUT' || raw.includes('NO DATA') || raw.includes('UNABLE')) {
      _renderDTCList([], mode);
      return;
    }
    const dtcs = _parseDTCBytes(raw, svcResp);
    _renderDTCList(dtcs, mode);
    toast(dtcs.length ? `${dtcs.length} fallo(s) encontrado(s)` : 'Sin fallos', dtcs.length ? 'warn' : 'ok');
  } catch(e) {
    $('obd-dtc-list').innerHTML = '<span class="obd-dtc-hint" style="color:#ff3250">Error al leer — comprueba conexión</span>';
  }
}

let _clearConfirmTimer = null;
async function obdClearDTCs() {
  if (!App.obdConnected) { toast('OBD2 no conectado', 'warn'); return; }
  const btn = $('btn-obd-clear');
  if (!btn) return;
  if (!_clearConfirmTimer) {
    // Primera pulsación — pedir confirmación
    btn.textContent = '⚠ CONFIRMAR';
    _clearConfirmTimer = setTimeout(() => {
      btn.textContent = '🗑 BORRAR';
      _clearConfirmTimer = null;
    }, 3500);
    return;
  }
  // Segunda pulsación dentro de 3.5s — ejecutar borrado
  clearTimeout(_clearConfirmTimer);
  _clearConfirmTimer = null;
  btn.textContent = '🗑 BORRAR';
  $('obd-dtc-list').innerHTML = '<span class="obd-dtc-hint">Borrando fallos…</span>';
  try {
    await _obdCmd('04');
    $('obd-dtc-list').innerHTML = '<div class="obd-dtc-row none"><span class="obd-dtc-code">✓</span><span class="obd-dtc-desc">Fallos borrados correctamente</span></div>';
    toast('Fallos OBD2 borrados ✓', 'ok');
  } catch(e) {
    $('obd-dtc-list').innerHTML = '<span class="obd-dtc-hint" style="color:#ff3250">Error al borrar fallos</span>';
  }
}
const _OBD = {
  SVC:    '0000fff0-0000-1000-8000-00805f9b34fb',
  WRITE:  '0000fff1-0000-1000-8000-00805f9b34fb',
  NOTIF:  '0000fff2-0000-1000-8000-00805f9b34fb',
  SVC2:   '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  WRITE2: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  NOTIF2: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  SVC3:   '0000ffe0-0000-1000-8000-00805f9b34fb',
  CHR3:   '0000ffe1-0000-1000-8000-00805f9b34fb',
  SVC4:   '000018f0-0000-1000-8000-00805f9b34fb',  // Vgate iCar Pro BLE 4.0 IOS-VLINK (nRF confirmed)
  NOTIF4: '00002af0-0000-1000-8000-00805f9b34fb',
  WRITE4: '00002af1-0000-1000-8000-00805f9b34fb',
  SVC5:   'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // Vgate proprietary (nRF confirmed, write+notify)
  CHR5:   'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  device: null, writeChr: null, buf: '', resolvers: [],
  pollTimer: null, pollIdx: 0, reconnTimer: null, _busy: false, _firstData: false,
  PIDS: ['010C','010D','0105','0142','0104','0111','015C'],
};

async function connectOBD2() {
  if (!navigator.bluetooth) { toast('Web Bluetooth no disponible — usa Chrome en Android', 'error'); return; }
  if (_OBD._busy) return;
  _OBD._busy = true;
  setStatusPill('obd', 'warn');
  try {
    if (navigator.bluetooth.getDevices) {
      const known = await navigator.bluetooth.getDevices();
      if (known.length) {
        _OBD.device = known[0];
        _OBD.device.addEventListener('gattserverdisconnected', _obdOnDisconnect);
        await _obdInit();
        return;
      }
    }
    _OBD.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [_OBD.SVC4, _OBD.SVC5, _OBD.SVC, _OBD.SVC2, _OBD.SVC3]
    });
    _OBD.device.addEventListener('gattserverdisconnected', _obdOnDisconnect);
    await _obdInit();
  } catch(e) {
    _OBD._busy = false;
    if (e.name === 'NotFoundError')
      toast('No se encontró el dispositivo. Desempareja en Ajustes BT y vuelve a intentarlo.', 'warn');
    else if (e.name !== 'NotAllowedError')
      toast('OBD2: ' + e.message, 'error');
    setStatusPill('obd', '');
  }
}

async function _obdInit() {
  try {
    const server = await _OBD.device.gatt.connect();
    let writeChr, notifyChr;

    const allSvcs = await server.getPrimaryServices().catch(() => []);
    console.log('OBD2 servicios:', allSvcs.map(s => s.uuid).join(', '));

    // Try services in order of likelihood for Vgate iCar Pro BLE 4.0 (IOS-VLINK)
    try {
      // e7810a71 — Vgate proprietary (single chr for write+notify, confirmed via nRF Connect)
      const s = await server.getPrimaryService(_OBD.SVC5);
      const c  = await s.getCharacteristic(_OBD.CHR5);
      writeChr = notifyChr = c;
    } catch {
      try {
        // 18F0 — standard OBD2 BLE (confirmed via nRF Connect)
        const s = await server.getPrimaryService(_OBD.SVC4);
        writeChr  = await s.getCharacteristic(_OBD.WRITE4);
        notifyChr = await s.getCharacteristic(_OBD.NOTIF4);
      } catch {
        try {
          const s = await server.getPrimaryService(_OBD.SVC);
          writeChr  = await s.getCharacteristic(_OBD.WRITE);
          notifyChr = await s.getCharacteristic(_OBD.NOTIF);
        } catch {
          try {
            const s = await server.getPrimaryService(_OBD.SVC3);
            const c  = await s.getCharacteristic(_OBD.CHR3);
            writeChr = notifyChr = c;
          } catch {
            const s = await server.getPrimaryService(_OBD.SVC2);
            writeChr  = await s.getCharacteristic(_OBD.WRITE2);
            notifyChr = await s.getCharacteristic(_OBD.NOTIF2);
          }
        }
      }
    }
    await notifyChr.startNotifications();
    notifyChr.addEventListener('characteristicvaluechanged', _obdOnData);
    _OBD.writeChr = writeChr;
    _OBD.buf = ''; _OBD.resolvers = [];

    await _obdCmd('ATZ');
    await new Promise(r => setTimeout(r, 1500));
    for (const c of ['ATE0','ATH0','ATL0','ATAT1']) await _obdCmd(c);

    // ATSP0 = auto-detect protocol; 0100 forces detection (may take up to 15s on first connect)
    await _obdCmd('ATSP0');
    toast('OBD2 detectando protocolo…', 'info');
    const proto = await _obdCmdLong('0100', 18000);
    console.log('OBD2 0100:', proto);
    if (proto.includes('UNABLE') || proto === 'TIMEOUT') {
      throw new Error('Moto no responde OBD2 — comprueba conector y motor en marcha');
    }

    App.obdConnected = true;
    _OBD._busy = false;
    setStatusPill('obd', 'active');
    const _badge = $('obd-diag-status-badge');
    if (_badge) { _badge.textContent = 'CONECTADO'; _badge.className = 'obd-badge ok'; }
    toast('OBD2 conectado ✓', 'ok');
    _obdStartPoll();
  } catch(e) {
    _OBD._busy = false;
    App.obdConnected = false;
    setStatusPill('obd', 'error');
    toast('OBD2 fallo: ' + e.message, 'error');
  }
}

function _obdOnDisconnect() {
  App.obdConnected = false;
  clearInterval(_OBD.pollTimer);
  setStatusPill('obd', 'error');
  const _badge = $('obd-diag-status-badge');
  if (_badge) { _badge.textContent = 'DESCONECTADO'; _badge.className = 'obd-badge err'; }
  toast('OBD2 desconectado', 'warn');
  if (App.obd2Enabled) {
    clearTimeout(_OBD.reconnTimer);
    _OBD.reconnTimer = setTimeout(() => {
      if (!App.obdConnected && _OBD.device) { _OBD._busy = false; _obdInit(); }
    }, 4000);
  }
}

function _obdOnData(ev) {
  _OBD.buf += new TextDecoder().decode(new Uint8Array(ev.target.value.buffer));
  while (_OBD.buf.includes('>')) {
    const i = _OBD.buf.indexOf('>');
    const line = _OBD.buf.slice(0, i).replace(/[\r\n]+/g, ' ').trim();
    _OBD.buf = _OBD.buf.slice(i + 1);
    if (_OBD.resolvers.length) _OBD.resolvers.shift()(line);
  }
}

function _obdCmd(cmd, ms = 2500) {
  return new Promise(resolve => {
    const tid = setTimeout(() => {
      const ix = _OBD.resolvers.findIndex(r => r === res);
      if (ix !== -1) _OBD.resolvers.splice(ix, 1);
      resolve('TIMEOUT');
    }, ms);
    const res = r => { clearTimeout(tid); resolve(r); };
    _OBD.resolvers.push(res);
    const data = new TextEncoder().encode(cmd + '\r');
    const chr = _OBD.writeChr;
    if (!chr) { resolve('ERR'); return; }
    const writeP = chr.properties?.writeWithoutResponse
      ? chr.writeValueWithoutResponse(data)
      : chr.writeValue(data);
    writeP.catch(() => resolve('ERR'));
  });
}

function _obdCmdLong(cmd, ms) { return _obdCmd(cmd, ms); }

function _obdStartPoll() {
  clearInterval(_OBD.pollTimer);
  _OBD.pollIdx = 0;
  _OBD.pollTimer = setInterval(_obdPoll, 260);
}

async function _obdPoll() {
  if (!App.obdConnected || !_OBD.writeChr) return;
  const pid = _OBD.PIDS[_OBD.pollIdx++ % _OBD.PIDS.length];
  const raw = await _obdCmd(pid);
  console.log('OBD2 PID', pid, '→', raw);
  if (!_OBD._firstData) _OBD._diagLog = (_OBD._diagLog || []).concat(pid + ':' + raw.slice(0,12));
  if (!_OBD._firstData && _OBD._diagLog?.length === 4) {
    toast('OBD diag: ' + _OBD._diagLog.join(' | '), 'info');
    _OBD._diagLog = [];
  }
  _obdParse(pid, raw);
}

function _obdParse(pid, raw) {
  const bytes = raw.replace(/[^0-9A-Fa-f ]/g,' ').trim().split(/\s+/)
    .filter(h => h.length === 2).map(h => parseInt(h, 16));
  const d = bytes.slice(2);
  if (!d.length) return;
  if (!_OBD._firstData) { _OBD._firstData = true; toast('OBD2 datos OK ✓', 'ok'); }
  const A = d[0], B = d[1] ?? 0;
  switch(pid) {
    case '010C': App.obd2Rpm      = ((A*256+B)/4)|0;           break;
    case '010D': App.obd2Speed    = A;                         break;
    case '0105': App.obd2Temp     = A - 40;                    break;
    case '0142': App.obd2Volt     = (A*256+B)/1000;            break;
    case '0104': App.obd2Load     = Math.round(A / 2.55);      break;
    case '0111': App.obd2Throttle = Math.round(A / 2.55);      break;
    case '015C': App.obd2OilTemp  = A - 40;                    break;
  }
  _obdGear();
}

function _obdGear() {
  const rpm = App.obd2Rpm, spd = App.gpsSpeed ?? App.obd2Speed;
  if (!rpm || rpm < 600) { App.obd2Gear = null; return; }
  if (!spd || spd < 5)   { App.obd2Gear = 'N'; return; }
  const r = rpm / spd;
  App.obd2Gear = r>40?1 : r>26?2 : r>19?3 : r>14?4 : r>11?5 : 6;
}

function disconnectOBD2() {
  clearInterval(_OBD.pollTimer); clearTimeout(_OBD.reconnTimer);
  _OBD.writeChr = null;
  if (_OBD.device?.gatt?.connected) _OBD.device.gatt.disconnect();
  App.obdConnected = false;
  App.obd2Rpm = App.obd2Gear = App.obd2Temp = App.obd2Volt = App.obd2Speed = null;
  App.obd2OilTemp = App.obd2Load = App.obd2Throttle = null;
  _OBD._firstData = false; _OBD._diagLog = [];
  setStatusPill('obd', '');
  toast('OBD2 desconectado', 'info');
}

/* ═══════════════════════════════════════
   RADIO — Reproductor emisoras internet
═══════════════════════════════════════ */
const RADIO_STATIONS = [
  { name: 'Los 40',      url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40.mp3' },
  { name: 'Cadena SER',  url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3' },
  { name: 'Europa FM',   url: 'https://radio-atres-live.ondacero.es/api/livestream-redirect/EFMAAC.aac' },
  { name: 'Onda Cero',   url: 'https://radio-atres-live.ondacero.es/api/livestream-redirect/OCAAC.aac' },
  { name: 'KISS FM',     url: 'https://kissfm.kissfmradio.cires21.com/kissfm.mp3' },
  { name: 'M80',         url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/M80RADIO.mp3' },
  { name: '40 Dance',    url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40DANCE.mp3' },
  { name: 'Cadena Dial', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENADIAL.mp3' },
  { name: 'Radiolé',     url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIOLEE.mp3' },
  { name: 'RNE Radio 3', url: 'https://dispatcher.rndfnk.com/rne/rne3/live/mp3/high' },
];

const _Radio = {
  audio: null,
  idx: -1,
  playing: false,
};

function _radioGetAudio() {
  if (!_Radio.audio) {
    _Radio.audio = new Audio();
    _Radio.audio.preload = 'none';
    _Radio.audio.volume = parseFloat(localStorage.getItem('bw_radio_vol') || '0.8');
    _Radio.audio.addEventListener('error', () => {
      toast('Error al cargar emisora', 'error');
      _radioSetPlaying(false);
    });
    _Radio.audio.addEventListener('playing', () => _radioSetPlaying(true));
    _Radio.audio.addEventListener('pause',   () => _radioSetPlaying(false));
  }
  return _Radio.audio;
}

function radioPlay(idx) {
  const station = RADIO_STATIONS[idx];
  if (!station) return;
  const audio = _radioGetAudio();
  _Radio.idx = idx;
  localStorage.setItem('bw_radio_idx', idx);
  audio.src = station.url;
  audio.play().catch(() => toast('No se puede reproducir — comprueba conexión', 'warn'));
  _radioUpdateUI();
}

function radioToggle() {
  if (_Radio.idx < 0) { radioPlay(0); return; }
  const audio = _radioGetAudio();
  if (_Radio.playing) audio.pause(); else audio.play();
}

function radioPrev() { radioPlay((_Radio.idx - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length); }
function radioNext() { radioPlay((_Radio.idx + 1) % RADIO_STATIONS.length); }

function _radioSetPlaying(playing) {
  _Radio.playing = playing;
  _radioUpdateUI();
}

function _radioUpdateUI() {
  const station = _Radio.idx >= 0 ? RADIO_STATIONS[_Radio.idx] : null;
  const name    = station ? station.name : 'Sin reproducción';
  const icon    = _Radio.playing ? '⏸' : '▶';

  // Panel principal
  const np = $('radio-now-playing'); if (np) np.textContent = name;
  const bp = $('btn-radio-play');    if (bp) bp.textContent = icon;
  document.querySelectorAll('.radio-station-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === _Radio.idx && _Radio.playing);
  });

  // Mini-player HUD
  const mini = $('radio-mini');
  if (mini) mini.style.display = _Radio.playing ? 'flex' : 'none';
  const mn = $('radio-mini-name');    if (mn) mn.textContent = name;
  const mp = $('btn-mini-play');      if (mp) mp.textContent = icon;
}

function initRadio() {
  // Renderizar botones de emisoras
  const container = $('radio-stations');
  if (container) {
    container.innerHTML = RADIO_STATIONS.map((s, i) =>
      `<button class="radio-station-btn" data-idx="${i}">${s.name}</button>`
    ).join('');
    container.addEventListener('click', e => {
      const btn = e.target.closest('.radio-station-btn');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      if (_Radio.idx === idx && _Radio.playing) { _radioGetAudio().pause(); }
      else radioPlay(idx);
    });
  }

  // Controles panel
  $('btn-radio-play')?.addEventListener('click', radioToggle);
  $('btn-radio-prev')?.addEventListener('click', radioPrev);
  $('btn-radio-next')?.addEventListener('click', radioNext);

  // Controles mini-player HUD
  $('btn-mini-play')?.addEventListener('click', radioToggle);
  $('btn-mini-prev')?.addEventListener('click', radioPrev);
  $('btn-mini-next')?.addEventListener('click', radioNext);

  // Volumen
  const vol = $('radio-vol');
  if (vol) {
    vol.value = Math.round((_Radio.audio?.volume ?? parseFloat(localStorage.getItem('bw_radio_vol') || '0.8')) * 100);
    vol.addEventListener('input', e => {
      const v = parseInt(e.target.value) / 100;
      if (_Radio.audio) _Radio.audio.volume = v;
      localStorage.setItem('bw_radio_vol', v.toFixed(2));
    });
  }

  // Restaurar última emisora (sin autoplay)
  const saved = localStorage.getItem('bw_radio_idx');
  if (saved !== null) _Radio.idx = parseInt(saved);
}

/* ═══════════════════════════════════════
   FIREBASE
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
let sharingActive=false, sharingInterval=null, shareSessionId=null, watchingId=null;

async function initFirebase() {
  try {
    const { initializeApp }                                  = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const { getDatabase, ref, set, onValue, remove, off }   = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

    fbApp  = initializeApp(FB_CONFIG);
    fbAuth = getAuth(fbApp);
    fbDb   = getFirestore(fbApp);
    fbRtDb = getDatabase(fbApp);

    await signInAnonymously(fbAuth);
    onAuthStateChanged(fbAuth, user => {
      if (user) { fbUser=user; App.fbUserId=user.uid; loadRanking(); startRadar(); }
    });
    App._fb = { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, serverTimestamp, ref, set, onValue, remove, off };
    return true;
  } catch(e) { console.error('[FB]', e); return false; }
}

async function uploadRouteToRanking(report) {
  if (!fbUser || !App._fb) return;
  const { collection, addDoc, serverTimestamp } = App._fb;
  if (report.meta.duration < 30 * 60 * 1000) { toast('Ruta menor de 30 min, no cuenta para el ranking', 'info'); return; }
  try {
    const nickname  = localStorage.getItem('bw_nickname')   || 'Motorista';
    const bikeModel = localStorage.getItem('bw_bike_model') || '';
    const fullTrack = report.meta.track || [];
    const step      = fullTrack.length > 500 ? Math.ceil(fullTrack.length / 500) : 1;
    const track     = fullTrack.filter((_, i) => i % step === 0);
    const score     = Math.round(report.curves.avgAngle * report.curves.total + report.speed.avg * 0.3);
    await addDoc(collection(fbDb, 'ranking'), {
      uid:fbUser.uid, nickname, bike:bikeModel, date:serverTimestamp(), score,
      speedMax:report.speed.max, speedAvg:report.speed.avg,
      curvesTotal:report.curves.total, maxAngle:report.curves.maxAngle, avgAngle:report.curves.avgAngle,
      minWC:report.thermal.minWC, duration:report.meta.durationFmt,
      destination:report.meta.destination||'Ruta libre', mode:report.meta.mode, track
    });
    toast('Ruta subida al ranking ✓', 'ok');
  } catch(e) { console.error('[FB] upload:', e); }
}

async function loadRanking() {
  if (!fbDb || !App._fb) return;
  const { collection, getDocs, query, orderBy, limit } = App._fb;
  try {
    const q    = query(collection(fbDb, 'ranking'), orderBy('score', 'desc'), limit(20));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    renderRanking(rows);
  } catch(e) { console.error('[FB] ranking:', e); }
}

function renderRanking(rows) {
  const el = $('ranking-list');
  if (!el) return;
  if (!rows.length) { el.innerHTML = '<p class="no-route">Aún no hay rutas en el ranking. ¡Sé el primero!</p>'; return; }
  el.innerHTML = rows.map((r, i) => {
    const medal    = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
    const isMe     = r.uid === App.fbUserId;
    const hasTrack = r.track && r.track.length > 1;
    return '<div class="ranking-row '+(isMe?'ranking-me':'')+'">'+
      '<div class="rk-pos">'+medal+'</div>'+
      '<div class="rk-info">'+
        '<div class="rk-name">'+r.nickname+(isMe?' <span style="color:var(--orange);font-size:0.55rem">TÚ</span>':'')+'</div>'+
        '<div class="rk-dest">'+(r.bike?'🏍 '+r.bike+' · ':'')+r.destination+'</div>'+
      '</div>'+
      '<div class="rk-stats">'+
        '<div class="rk-stat"><span style="color:#29d9ff">'+(r.score??'--')+'</span><span class="rk-lbl">pts</span></div>'+
        '<div class="rk-stat"><span style="color:#00f0a0">'+r.curvesTotal+'</span><span class="rk-lbl">curvas</span></div>'+
        '<div class="rk-stat"><span style="color:#ff5500">'+r.maxAngle+'°</span><span class="rk-lbl">máx ang</span></div>'+
      '</div>'+
      (hasTrack?'<button class="rk-replicate-btn" data-idx="'+i+'" style="font-size:0.65rem;background:var(--bg3);color:#29d9ff;border:1px solid #29d9ff;border-radius:6px;padding:3px 8px;margin-top:5px;cursor:pointer;width:100%;letter-spacing:0.05em">▶ Ver / Replicar ruta</button>':'')+
    '</div>';
  }).join('');
  el.querySelectorAll('.rk-replicate-btn').forEach(btn => {
    btn.addEventListener('click', () => { const r=rows[parseInt(btn.dataset.idx)]; if(r?.track?.length>1) replicateRoute(r.track, r.destination); });
  });
}

let _replicaPolyline = null;
function replicateRoute(track, label) {
  if (!App.mapInitialized) { const mc=$('map-container'); if(mc) mc.style.display='block'; initMap(); }
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  $('section-riding')?.classList.add('active');
  document.querySelector('.nav-btn[data-section="section-riding"]')?.classList.add('active');
  setTimeout(() => {
    App.leafletMap.invalidateSize();
    if (_replicaPolyline) { App.leafletMap.removeLayer(_replicaPolyline); _replicaPolyline=null; }
    const latlngs = track.map(p=>[p.lat,p.lon]);
    _replicaPolyline = L.polyline(latlngs,{color:'#29d9ff',weight:3,opacity:0.8,dashArray:'8,5'}).addTo(App.leafletMap);
    App.leafletMap.fitBounds(_replicaPolyline.getBounds(),{padding:[30,30]});
    toast('Ruta de referencia: '+(label||'Ruta libre'), 'info');
  }, 200);
}

async function startSharing() {
  if (!fbUser || !App._fb) { toast('Conectando…', 'info'); return; }
  const { ref, set } = App._fb;
  shareSessionId = fbUser.uid + '_' + Date.now();
  sharingActive  = true;
  await set(ref(fbRtDb, 'live/'+shareSessionId), { nickname: localStorage.getItem('bw_nickname')||'Motorista', active:true, started:Date.now() });
  sharingInterval = setInterval(async () => {
    if (!App.position || !sharingActive) return;
    await set(ref(fbRtDb, 'live/'+shareSessionId+'/telemetry'), { lat:App.position.lat, lon:App.position.lon, speed:App.gpsSpeed||0, roll:App.gyroData.gamma||0, wc:App.windChill||null, temp:App.weather?.temp||null, t:Date.now() });
  }, 2000);
  const shareUrl = location.origin + location.pathname + '?watch=' + shareSessionId;
  const box = $('share-url-box'); if(box) box.value = shareUrl;
  const ctrl = $('share-controls'); if(ctrl) ctrl.style.display='flex';
  const btnS = $('btn-share-start'); if(btnS) btnS.style.display='none';
  toast('¡Compartiendo en tiempo real!', 'ok');
}

async function stopSharing() {
  if (!sharingActive || !App._fb) return;
  const { ref, remove } = App._fb;
  sharingActive = false;
  clearInterval(sharingInterval);
  await remove(ref(fbRtDb, 'live/'+shareSessionId));
  const ctrl=$('share-controls'); if(ctrl) ctrl.style.display='none';
  const btnS=$('btn-share-start'); if(btnS) btnS.style.display='flex';
  shareSessionId = null;
  toast('Detenido el compartir', 'info');
}

async function watchLiveRoute(sessionId) {
  if (!fbRtDb || !App._fb) return;
  const { ref, onValue } = App._fb;
  const el=$('watch-panel'); if(el) el.style.display='flex';
  onValue(ref(fbRtDb, 'live/'+sessionId+'/telemetry'), snap => {
    const d=snap.val(); if(!d) return;
    setEl('watch-speed', d.speed+' km/h');
    setEl('watch-roll',  Math.abs(Math.round(d.roll))+'°');
    setEl('watch-wc',    d.wc!=null?(d.wc>0?'+':'')+d.wc+'°C':'--');
    setEl('watch-temp',  d.temp!=null?d.temp+'°C':'--');
    if (App.mapInitialized && d.lat) { App.riderMarker?.setLatLng([d.lat,d.lon]); App.leafletMap?.setView([d.lat,d.lon]); }
  });
}

function saveNickname() {
  const input=$('nickname-input');
  if (!input?.value?.trim()) return;
  localStorage.setItem('bw_nickname', input.value.trim());
  toast('Nombre guardado ✓', 'ok');
}

function checkWatchMode() {
  const watchId = new URLSearchParams(location.search).get('watch');
  if (watchId) initFirebase().then(() => watchLiveRoute(watchId));
}

/* ═══════════════════════════════════════
   RADAR
═══════════════════════════════════════ */
const RADAR_DIST_M=50, RADAR_TICK_MS=5000;
let radarInterval=null, lastGreeted={};

async function startRadar() {
  if (!fbUser || !App._fb) return;
  radarInterval = setInterval(radarTick, RADAR_TICK_MS);
  radarTick();
}

async function radarTick() {
  if (!App.position || !fbUser || !App._fb) return;
  const { ref, set, onValue, off } = App._fb;
  await set(ref(fbRtDb, 'radar/'+fbUser.uid), { lat:App.position.lat, lon:App.position.lon, t:Date.now() });
  const radarRef = ref(fbRtDb, 'radar');
  onValue(radarRef, snap => {
    const data=snap.val(); if(!data) return;
    Object.entries(data).forEach(([uid, pos]) => {
      if (uid===fbUser.uid) return;
      if (Date.now()-pos.t > 15000) return;
      const dist=haversineM(App.position.lat, App.position.lon, pos.lat, pos.lon);
      if (dist<=RADAR_DIST_M) {
        const now=Date.now();
        if (!lastGreeted[uid] || now-lastGreeted[uid]>60000) { lastGreeted[uid]=now; showGreeting(); }
      }
    });
    off(radarRef);
  }, { onlyOnce: true });
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function showGreeting() {
  if (navigator.vibrate) navigator.vibrate([200,100,200]);
  let flash=$('greeting-flash');
  if (!flash) {
    flash=document.createElement('div');
    flash.id='greeting-flash';
    flash.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,8,0.85);backdrop-filter:blur(8px);z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.3s ease;';
    flash.innerHTML='<div style="font-size:5rem;line-height:1;animation:greetPulse 0.6s ease">✌️</div><div style="font-family:Rajdhani,sans-serif;font-size:1.4rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#ff5500;margin-top:12px">SALUDO MOTERO</div><div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:#8888aa;margin-top:6px">BikerWeather detectado cerca</div>';
    document.body.appendChild(flash);
  }
  flash.style.opacity='1';
  setTimeout(()=>{ flash.style.opacity='0'; }, 3000);
}

/* ═══════════════════════════════════════
   DETECCIÓN DE CAÍDA
═══════════════════════════════════════ */
const FALL_IMPACT_G=1.8, FALL_STILL_MS=5000, FALL_CANCEL_MS=15000;
let fallState='monitoring', fallImpactTime=null, fallCancelTimer=null, fallConfirmTimer=null;

function startFallDetection() {
  if (!window.DeviceMotionEvent) return;
  window.addEventListener('devicemotion', onMotionFall, true);
  window.addEventListener('devicemotion', e => {
    if (fallState !== 'impact') return;
    const acc=e.accelerationIncludingGravity; if(!acc) return;
    const g=Math.sqrt(acc.x**2+acc.y**2+acc.z**2)/9.81;
    if (g > 0.3) { clearTimeout(fallConfirmTimer); fallState='monitoring'; }
  }, true);
}

function onMotionFall(e) {
  if (fallState !== 'monitoring') return;
  const acc=e.accelerationIncludingGravity; if(!acc) return;
  const g=Math.sqrt(acc.x**2+acc.y**2+acc.z**2)/9.81;
  if (g > FALL_IMPACT_G) {
    fallState='impact'; fallImpactTime=Date.now();
    fallConfirmTimer=setTimeout(()=>{ if(fallState==='impact'){fallState='fallen';triggerFallAlert();} }, FALL_STILL_MS);
  }
}

function triggerFallAlert() {
  const phone=localStorage.getItem('bw_emergency_phone');
  if (!phone) { fallState='monitoring'; return; }
  if (navigator.vibrate) navigator.vibrate([500,200,500,200,500]);
  showFallWarning(phone);
}

function showFallWarning(phone) {
  let panel=$('fall-warning');
  if (!panel) {
    panel=document.createElement('div'); panel.id='fall-warning';
    panel.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,34,85,0.95);z-index:9998;padding:20px;text-align:center;';
    document.body.appendChild(panel);
  }
  let remaining=Math.round(FALL_CANCEL_MS/1000);
  panel.innerHTML='<div style="font-size:3rem;margin-bottom:12px">🆘</div>'+
    '<div style="font-family:Rajdhani,sans-serif;font-size:1.8rem;font-weight:700;color:#fff;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">POSIBLE CAÍDA</div>'+
    '<div style="font-family:JetBrains Mono,monospace;font-size:0.8rem;color:rgba(255,255,255,0.8);margin-bottom:20px;line-height:1.6">Enviando alerta en <span id="fall-countdown">'+remaining+'</span> segundos</div>'+
    '<button id="btn-fall-cancel" style="background:#fff;border:none;border-radius:8px;padding:16px 32px;font-family:Rajdhani,sans-serif;font-size:1.1rem;font-weight:700;color:#ff2255;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;margin-bottom:12px;width:100%;max-width:280px;">✓ ESTOY BIEN — CANCELAR</button>'+
    '<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;color:rgba(255,255,255,0.6)">Se enviará a: '+phone+'</div>';
  const countdown=setInterval(()=>{
    remaining--;
    const el=$('fall-countdown'); if(el) el.textContent=remaining;
    if (remaining<=0) { clearInterval(countdown); sendFallAlert(phone); panel.style.display='none'; fallState='monitoring'; }
  }, 1000);
  $('btn-fall-cancel')?.addEventListener('click',()=>{ clearInterval(countdown); panel.style.display='none'; fallState='monitoring'; toast('Alerta cancelada ✓','ok'); });
}

function sendFallAlert(phone) {
  const lat=App.position?.lat?.toFixed(5)||'--', lon=App.position?.lon?.toFixed(5)||'--';
  const msg=encodeURIComponent('🆘 ALERTA BikerWeather\n\nPosible caída detectada.\n\nÚltima posición:\nhttps://maps.google.com/?q='+lat+','+lon+'\n\nVelocidad: '+(App.gpsSpeed||'--')+' km/h');
  window.open('https://wa.me/'+phone.replace(/\D/g,'')+('?text='+msg), '_blank');
}

const greetStyle=document.createElement('style');
greetStyle.textContent='@keyframes greetPulse{0%{transform:scale(0.5) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(10deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}';
document.head.appendChild(greetStyle);
