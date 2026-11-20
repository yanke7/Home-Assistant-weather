const themes = [
  ['original','Original','#101923','#17232e','#eac68b'],
  ['steel','Brushed Steel','#24272c','#363b43','#c8b8ff'],
  ['relay','Amber Relay','#1b211b','#33382b','#ffbd5d'],
  ['neon','Neon Grid','#04091b','#111b3a','#fd86e6'],
  ['abyss','Midnight Drift','#080c1e','#171f44','#77f1ff'],
  ['tide','Aqua Current','#082838','#125063','#7dffde'],
  ['trek','Star Trek','#080706','#231a12','#ffcc66'],
  ['appearance','Follow Appearance','var(--yanke-bg,var(--primary-background-color,#111827))',
    'var(--yanke-surface,var(--ha-card-background,#1f2937))','var(--yanke-accent,var(--primary-color,#80c7ff))'],
];
const trekFont = new URL('./trek-oswald.woff2', import.meta.url).href;
let trekFontPromise;
function loadTrekFont() {
  trekFontPromise ??= new FontFace('Atmosphere Console', 'url(' + trekFont + ')', {weight:'600'})
    .load().then(font => document.fonts.add(font)).catch(() => {});
}
const trekLogo = new URL('./trek-logo.jpg?v=0.1.3', import.meta.url).href;
const icons = {sunny:'☀','clear-night':'☾',partlycloudy:'⛅',cloudy:'☁',rainy:'☂',pouring:'☂',
  snowy:'❄','snowy-rainy':'❄',fog:'≋','lightning-rainy':'ϟ'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

const moonNames = ['New moon','Waxing crescent','First quarter','Waxing gibbous',
  'Full moon','Waning gibbous','Last quarter','Waning crescent'];

function lunarPhase(now) {
  // Approximate geocentric elongation from the same solar and lunar terms as Almanac.
  const days = now / 86400000 - 10957.5;
  const rad = Math.PI / 180;
  const anomaly = (357.5291 + .98560028 * days) * rad;
  const sun = anomaly + (102.9372 + 180 + 1.9148 * Math.sin(anomaly)
    + .02 * Math.sin(2 * anomaly) + .0003 * Math.sin(3 * anomaly)) * rad;
  const moon = (218.316 + 13.176396 * days
    + 6.289 * Math.sin((134.963 + 13.064993 * days) * rad)) * rad;
  const turn = 2 * Math.PI;
  const angle = ((moon - sun) % turn + turn) % turn;
  const phase = angle / turn;
  const quarter = Math.round(phase * 4);
  const index = Math.abs(phase - quarter / 4) < .018 ? (quarter * 2) % 8 : Math.floor(phase * 4) * 2 + 1;
  return {angle, fraction:(1 - Math.cos(angle)) / 2, name:moonNames[index]};
}

// An illustrated lunar surface, kept fixed as the phase boundary moves.
const lunarPlains = [
  [-43,-35,32,50,-.5],[-18,-62,29,24,-.3],[21,-47,24,19,.4],
  [42,-15,39,28,.55],[28,24,24,37,-.48],[-29,30,19,28,.72],
  [72,18,17,15,.4],[-67,14,20,32,.25],
];

function lunarSurface(ctx, reflected, lit) {
  ctx.save();
  if (reflected) ctx.scale(-1,1);
  ctx.fillStyle = lit ? '#40516b55' : '#0c152363';
  for (const [x,y,rx,ry,rotation] of lunarPlains) {
    ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,rotation,0,2*Math.PI);
    ctx.fill();
  }
  let seed = 174;
  const random = () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 2**32);
  const craters = [[-22,79,15],[47,64,12],[-71,-6,10],[76,-46,10],[3,43,7]];
  for (let i=0; i<42; i++) {
    const angle = random() * 2 * Math.PI;
    const distance = Math.sqrt(random()) * 118;
    craters.push([Math.cos(angle)*distance,Math.sin(angle)*distance,2+random()*5]);
  }
  for (const [x,y,r] of craters) {
    ctx.beginPath();
    ctx.arc(x,y,r,0,2*Math.PI);
    ctx.fillStyle = lit ? '#47597549' : '#121c2b80';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI);
    ctx.strokeStyle = lit ? '#f7fcffb0' : '#819ac33c';
    ctx.lineWidth = r > 8 ? 2.3 : 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x,y,r,Math.PI,2*Math.PI);
    ctx.strokeStyle = lit ? '#313e5880' : '#080e1990';
    ctx.stroke();
  }
  ctx.restore();
}

function drawMoon(orb, latitude, now) {
  const {angle, fraction, name} = lunarPhase(now);
  const label = name + ' · ' + Math.round(fraction * 100) + '% illuminated';
  orb.classList.add('lunar-orb');
  orb.setAttribute('role','img');
  orb.setAttribute('aria-label',label);
  orb.removeAttribute('aria-hidden');
  orb.title = label;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  canvas.setAttribute('aria-hidden','true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.translate(128,128);
  if ((angle > Math.PI) !== (latitude < 0)) ctx.scale(-1,1);
  const radius = 126;
  const terminator = Math.cos(angle) * radius;
  ctx.beginPath();
  ctx.arc(0,0,radius,0,2*Math.PI);
  ctx.fillStyle = '#263244';
  ctx.fill();
  ctx.save();
  ctx.clip();
  lunarSurface(ctx,angle > Math.PI,false);
  ctx.restore();

  // Trace the right limb and return along the projected day/night boundary.
  ctx.beginPath();
  ctx.arc(0,0,radius,-Math.PI/2,Math.PI/2);
  if (Math.abs(terminator) < .01) ctx.lineTo(0,-radius);
  else ctx.ellipse(0,0,Math.abs(terminator),radius,0,Math.PI/2,-Math.PI/2,terminator > 0);
  ctx.closePath();
  const light = ctx.createRadialGradient(-35,-30,2,0,0,radius);
  light.addColorStop(0,'#f3f7fa');
  light.addColorStop(1,'#b8cde1');
  ctx.fillStyle = light;
  if (fraction > .0001) {
    ctx.fill();
    ctx.save();
    ctx.clip();
    lunarSurface(ctx,angle > Math.PI,true);
    ctx.restore();
  }
  orb.append(canvas);
}

class AtmosphereWeatherCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.tab = 'hourly';
    this.frames = [];
    this.request = 0;
    this.selection = null;
  }

  static getStubConfig() { return {}; }
  setConfig(config) {
    this.config = config;
    this.key = 'atmosphere.' + (config.storage_key || config.location || 'default');
    this.selection = this.read('location') || config.location;
    this.theme = themes.find(item => item[0] === this.read('theme'))?.[0] || 'original';
    this.imperial = this.read('units') === 'imperial';
  }
  read(key) { try { return localStorage.getItem(this.key + '.' + key); } catch { return null; } }
  write(key,value) { try { localStorage.setItem(this.key + '.' + key,value); } catch { /* Optional preference. */ } }
  getCardSize() { return 9; }
  set hass(value) {
    const changed = this._hass?.user?.id !== value.user?.id;
    this._hass = value;
    if (changed) this.refresh();
  }
  connectedCallback() {
    this.build();
    this.fitViewport = () => {
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
      const top = this.getBoundingClientRect().top;
      if (this.getClientRects().length && bottom > top) {
        this.style.setProperty('--atmosphere-available-height', Math.floor(bottom - top) + 'px');
      }
    };
    window.addEventListener('resize', this.fitViewport);
    window.visualViewport?.addEventListener('resize', this.fitViewport);
    this.viewportFrame = requestAnimationFrame(this.fitViewport);
    this.radarLayoutObserver = new ResizeObserver(() => {
      const mobile = this.$('shell').clientWidth <= 700;
      const target = this.$(mobile ? 'mobile-radar-slot' : 'desktop-radar-slot');
      const radar = this.$('radar');
      if (radar.parentElement === target) return;
      target.append(radar);
      if (!mobile && this.tab === 'radar') {
        this.tab = 'hourly';
        this.render();
      }
      this.loadRadar();
    });
    this.radarLayoutObserver.observe(this.$('shell'));
    this.startSky();
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 60000);
  }
  disconnectedCallback() {
    clearInterval(this.timer);
    cancelAnimationFrame(this.viewportFrame);
    this.radarLayoutObserver?.disconnect();
    window.removeEventListener('resize', this.fitViewport);
    window.visualViewport?.removeEventListener('resize', this.fitViewport);
    this.request++;
    this.sky?.dispose();
    this.sky = null;
  }

  async startSky() {
    try {
      const {mountSky} = await import('./sky.js?v=0.1.2');
      if (!this.isConnected || this.sky) return;
      this.sky = mountSky(this.$('hero'));
      this.updateSky();
    } catch {
      // The CSS sky remains visible if the bundle or WebGL is unavailable.
    }
  }

  updateSky() {
    const current = this.data?.weather?.current;
    this.sky?.update(current?.condition, current?.is_day === 0);
  }
  call(action, data = {}) {
    return this._hass.callWS({type:'atmosphere_weather/' + action,...data});
  }

  async refresh(retries = 0) {
    if (!this.isConnected || !this._hass) return;
    const request = ++this.request;
    try {
      const data = await this.call('snapshot',this.selection ? {location:this.selection} : {});
      if (request !== this.request) return;
      if (this.selection !== data.selected?.id) {
        this.frames = [];
        this.radarKey = null;
      }
      this.data = data;
      this.selection = data.selected?.id;
      this.error = '';
      this.render();
      this.loadRadar();
    } catch (error) {
      if (request !== this.request) return;
      if (retries > 0 && error.code === 'not_loaded') {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (request === this.request) return this.refresh(retries - 1);
        return;
      }
      this.error = error.message || 'Weather unavailable';
      this.data = null;
      this.render();
    }
  }

  build() {
    if (this.$('shell')) return;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><main id="shell">
      <header><div class="brand"><span aria-hidden="true">◒</span><strong>Atmosphere</strong></div>
        <div class="actions"><select id="location" aria-label="Weather location"></select>
          <button id="settings" aria-label="Settings" title="Settings"><span class="gear">⚙</span><span class="trek-settings">Settings</span></button><div id="trek-time"></div></div></header>
      <section id="hero" class="hero"><div id="sky-content"></div></section>
      <dialog id="weather-details" class="reading-dialog" aria-labelledby="reading-title">
        <div class="heading"><h2 id="reading-title"></h2><div class="actions">
          <button id="reading-gear" aria-label="Customize weather readings" title="Customize weather readings">⚙</button>
          <button id="reading-close" aria-label="Close weather details">✕</button>
        </div></div>
        <p id="reading-context"></p><dl id="reading-list"></dl>
      </dialog>
      <section class="metrics" id="metrics" aria-label="Weather details"></section>
      <div class="outlook">
        <section class="panel forecast"><div class="heading"><h2 id="forecast-title">Forecast</h2>
          <div class="tabs"><button data-tab="hourly">Hourly</button><button data-tab="daily">Daily</button>
          <button data-tab="radar" class="mobile-tab">Radar</button></div></div>
          <div id="periods"></div><div id="mobile-radar-slot"></div></section>
        <section class="panel radar"><div class="heading"><h2>Precipitation radar</h2></div><div id="desktop-radar-slot"><div id="radar"></div></div></section>
      </div>
      <footer><a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather by Open-Meteo</a><span id="status" role="status"></span></footer>
      <dialog id="dialog" aria-labelledby="settings-title">
       <div class="heading"><h2 id="settings-title">Settings</h2><button id="close" aria-label="Close settings">✕</button></div>
       <div class="tabs settings-tabs"><button data-settings="locations">Locations</button><button data-settings="appearance">Appearance</button><button data-settings="data">Data</button></div>
       <div id="settings-content"></div><p id="notice" role="status"></p>
      </dialog>
      <dialog id="reading-settings" class="reading-dialog" aria-labelledby="reading-settings-title">
        <div class="heading"><h2 id="reading-settings-title">Choose readings</h2>
          <button id="reading-settings-close" aria-label="Back to weather details">✕</button></div>
        <p>Choose what to show in this type of forecast.</p>
        <div id="reading-choices"></div><button id="reading-reset">Show all readings</button>
      </dialog></main>`;
    this.$('settings').onclick = () => {
      this.settingsPanel('locations');
      this.$('dialog').showModal();
    };
    this.$('weather-details').addEventListener('keydown', event => {
      if (event.key === 'Escape') this.$('weather-details').close();
    });
    this.$('reading-close').onclick = () => this.$('weather-details').close();
    this.$('reading-gear').onclick = () => this.openReadingSettings();
    this.$('reading-settings-close').onclick = () => this.$('reading-settings').close();
    this.$('reading-reset').onclick = () => {
      this.write('readings.' + this.reading.kind,'[]');
      this.renderReadings();
      this.openReadingSettings();
    };
    this.$('close').onclick = () => this.$('dialog').close();
    this.$('location').onchange = event => {
      this.$('weather-details').close();
      this.selection = event.target.value;
      this.write('location', this.selection);
      this.data.selected = this.data.locations.find(item => item.id === this.selection);
      this.data.weather = null;
      this.frames = [];
      this.radarKey = null;
      this.render();
      this.refresh();
    };
    this.shadowRoot.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button?.dataset.tab) {
        this.tab = button.dataset.tab;
        this.render();
        this.loadRadar();
      }
      if (button?.dataset.reading) this.openReadings(button.dataset.reading,Number(button.dataset.period));
      else if (!button && event.target.closest('.hero') && !event.target.closest('dialog')) this.openReadings('current');
      if (button?.dataset.settings) this.settingsPanel(button.dataset.settings);
    });
    this.render();
  }
  $(id) { return this.shadowRoot.getElementById(id); }
  temp(value) { return value == null ? '—' : Math.round(this.imperial ? value * 1.8 + 32 : value) + '°'; }
  measure(value, unit, factor = 1, decimals = 0) {
    return value == null ? '—' : Number((value * factor).toFixed(decimals)) + ' ' + unit;
  }
  date(value, options) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(this._hass?.locale?.language || undefined,
      {timeZone:this.data?.selected?.timezone, ...options}).format(new Date(value));
  }
  time(value) { return this.date(value,{hour:'numeric',minute:'2-digit'}); }
  wind(value) { return this.measure(value,this.imperial ? 'mph' : 'km/h',this.imperial ? 0.621371 : 1); }

  compass(bearing, speed) {
    if (!Number.isFinite(bearing) || !Number.isFinite(speed) || speed <= 0) return '';
    const directions = ['N','NE','E','SE','S','SW','W','NW'];
    return directions[Math.round(((bearing % 360 + 360) % 360) / 45) % 8];
  }

  accumulation(item) {
    const snow = item.snowfall_cm > 0;
    const amount = snow ? item.snowfall_cm : item.native_precipitation;
    if (!Number.isFinite(amount) || amount <= 0) return '';
    const value = this.imperial ? amount / (snow ? 2.54 : 25.4) : amount;
    const digits = this.imperial ? 2 : 1;
    const formatted = value.toFixed(digits);
    const unit = this.imperial ? 'in' : snow ? 'cm' : 'mm';
    return (+formatted === 0 ? '<' + (this.imperial ? '0.01' : '0.1') : +formatted)
      + ' ' + unit + (snow ? ' snow' : '');
  }

  briefing(hourly) {
    const periods = (hourly || []).slice(0,8);
    if (!periods.length) return '';
    const wet = periods.find(item => item.precipitation_probability >= 50 && item.datetime);
    if (wet) {
      const kind = wet.condition === 'snowy' ? 'Snow'
        : ['rainy','pouring','lightning-rainy'].includes(wet.condition) ? 'Rain' : 'Precipitation';
      return kind + ' likely around ' + this.time(wet.datetime) + '.';
    }
    const temps = periods.map(item => item.native_temperature).filter(Number.isFinite);
    if (temps.length < 2) return '';
    const start = temps[0], end = temps.at(-1);
    if (Math.abs(end-start) >= 2) {
      return 'Temperatures ' + (end > start ? 'rise' : 'fall') + ' from '
        + this.temp(start) + ' to ' + this.temp(end) + ' over the next few hours.';
    }
    if (Math.max(...temps) - Math.min(...temps) <= 2) {
      return 'Temperatures stay near ' + this.temp(start) + ' over the next few hours.';
    }
    return 'Temperatures range from ' + this.temp(Math.min(...temps)) + ' to '
      + this.temp(Math.max(...temps)) + ' over the next few hours.';
  }

  render() {
    const shell = this.$('shell');
    if (!shell) return;
    const {locations = [], selected, weather, fresh} = this.data || {};
    const current = weather?.current || {};
    const [, , background, surface, accent] = themes.find(item => item[0] === this.theme) || themes[0];
    shell.dataset.theme = this.theme;
    const brand = shell.querySelector('.brand');
    if (this.theme === 'trek' && !brand.querySelector('img')) {
      loadTrekFont();
      const logo = document.createElement('img');
      logo.src = trekLogo;
      logo.alt = 'Atmosphere & Weather Scan emblem';
      brand.prepend(logo);
    } else if (this.theme !== 'trek') {
      brand.querySelector('img')?.remove();
    }
    this.$('forecast-title').textContent = this.tab === 'radar' ? 'Precipitation radar' : this.theme === 'trek'
      ? (this.tab === 'daily' ? 'Daily forecast' : 'Hourly forecast') : 'Forecast';
    shell.dataset.tab = this.tab;
    shell.style.setProperty('--bg',background);
    shell.style.setProperty('--surface',surface);
    shell.style.setProperty('--accent',accent);
    const selector = this.$('location');
    const options = locations.map(location => `<option value="${escape(location.id)}">${escape(location.name)}</option>`).join('');
    if (selector.dataset.options !== options) {
      selector.innerHTML = options || '<option>No locations</option>';
      selector.dataset.options = options;
    }
    selector.disabled = !locations.length;
    if (selected) selector.value = selected.id;
    const label = current.condition === 'partlycloudy' ? 'Partly cloudy' : current.condition?.replaceAll('-', ' ');
    const briefing = fresh ? this.briefing(weather?.hourly) : '';
    this.$('hero').classList.toggle('has-briefing',Boolean(briefing));
    this.$('hero').dataset.sky = current.sky_period || (current.is_day === 0 ? 'night' : 'day');
    this.updateSky();
    this.$('sky-content').innerHTML = selected ? `<div class="current"><div class="kicker">${escape(selected.name)}</div>
       <button class="temperature current-reading" data-reading="current" aria-label="Current weather details">${this.temp(current.temperature_2m)}<sup>${this.imperial ? 'F' : 'C'}</sup></button>
       <span class="trek-feels">Feels like ${this.temp(current.apparent_temperature)}</span><div class="condition">${escape(label || 'Waiting for weather')}</div></div>
       ${briefing ? `<p class="weather-briefing">${escape(briefing)}</p>` : ''}
       <div class="orb" aria-hidden="true"></div><div class="summary">
       <div>${this.date(new Date(),{weekday:'long',month:'short',day:'numeric'})}</div>
       <strong>H ${this.temp(current.temperature_high)} · L ${this.temp(current.temperature_low)}</strong>
       <div class="summary-feels">Feels like ${this.temp(current.apparent_temperature)}</div></div>`
      : `<div class="current"><h2>${this.error ? 'Weather unavailable' : this.data ? 'Add a location in Settings' : 'Loading weather…'}</h2><p>${escape(this.error)}</p></div>`;
    if (selected && current.is_day === 0) {
      drawMoon(this.$('hero').querySelector('.orb'), selected.latitude, Date.now());
    }
    const direction = this.compass(current.wind_direction_10m,current.wind_speed_10m);
    const metrics = [
      [direction ? 'Wind · ' + direction : 'Wind',this.wind(current.wind_speed_10m)],
      ['Humidity',this.measure(current.relative_humidity_2m,'%')],
      ['Precipitation chance',this.measure(current.next_precipitation,'%')],
      [current.is_day === 0 ? 'Next sunrise' : 'Next sunset',this.time(current.is_day === 0 ? current.sunrise : current.sunset)],
    ];
    this.$('metrics').innerHTML = metrics.map(([name,value]) =>
      `<div><span>${name}</span><strong>${value}</strong></div>`).join('');
    this.shadowRoot.querySelectorAll('[data-tab]').forEach(button =>
      button.setAttribute('aria-pressed',String(button.dataset.tab === this.tab)));
    const mode = this.tab === 'daily' ? 'daily' : 'hourly';
    const periods = (weather?.[mode] || []).slice(0,mode === 'daily' ? 7 : 8);
    this.$('periods').innerHTML = periods.length ? `<div class="periods ${mode}">${periods.map((item,index) => `
      <button type="button" class="period period-reading" data-reading="${mode}" data-period="${index}" aria-label="${escape(this.date(item.datetime,{weekday:'long',month:'short',day:'numeric',...(mode === 'hourly' ? {hour:'numeric',minute:'2-digit'} : {})}))} weather details"><small>${this.date(item.datetime,mode === 'daily' ? {weekday:'short'} : {hour:'numeric'})}</small>
      <span class="icon" role="img" aria-label="${escape(item.condition || 'Unknown condition')}"><i aria-hidden="true">${icons[item.condition] || '◌'}</i></span>
      <strong>${this.temp(item.native_temperature)}</strong>
      <span>${mode === 'daily' ? 'Low ' + this.temp(item.native_templow) : this.wind(item.native_wind_speed) + ' ' + this.compass(item.wind_bearing,item.native_wind_speed)}</span>
      <span class="chance"> ${this.measure(item.precipitation_probability,'%')}${this.accumulation(item) ? `<span class="accumulation">${escape(this.accumulation(item))}</span>` : ''}</span></button>`).join('')}</div>`
      : '<p class="empty">Forecast unavailable</p>';
    this.$('status').textContent = current.updated_at ? (fresh ? 'Updated ' : 'Stale · last update ') + this.time(current.updated_at) : '';
    this.$('trek-time').textContent = selected
      ? this.date(new Date(), {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
        + (current.updated_at ? ' · ' + this.$('status').textContent : '') : '';
    this.renderRadar();
  }

  openReadings(kind,index) {
    const weather = this.data?.weather;
    const record = kind === 'current' ? weather?.current : weather?.[kind]?.[index];
    if (!record) return;
    this.reading = {kind,record,location:this.data.selected?.name,fresh:this.data.fresh};
    this.$('reading-title').textContent = {current:'Current conditions',hourly:'Hourly forecast',daily:'Daily forecast'}[kind];
    const timestamp = kind === 'current' ? record.observed_at : record.datetime;
    const date = timestamp ? this.date(timestamp,{weekday:'long',month:'short',day:'numeric',
      ...(kind === 'daily' ? {} : {hour:'numeric',minute:'2-digit',timeZoneName:'short'})}) : '';
    this.$('reading-context').textContent = [this.reading.location,date,this.reading.fresh ? '' : 'Last available data'].filter(Boolean).join(' · ');
    this.renderReadings();
    const panel = this.$('weather-details');
    if (!panel.open) {
      const trigger = this.shadowRoot.activeElement;
      panel.show();
      trigger?.focus({preventScroll:true});
    }
  }

  readingRows() {
    const {kind,record:r} = this.reading;
    const current = kind === 'current';
    const temp = value => value == null ? null : this.temp(value) + (this.imperial ? 'F' : 'C');
    const measure = (value,unit,factor = 1,digits = 0) =>
      Number.isFinite(value) ? this.measure(value,unit,factor,digits) : null;
    const amount = (value,snow = false) => measure(value,this.imperial ? 'in' : snow ? 'cm' : 'mm',
      this.imperial ? 1/(snow ? 2.54 : 25.4) : 1,this.imperial ? 2 : 1);
    const wind = current ? r.wind_speed_10m : r.native_wind_speed;
    const bearing = current ? r.wind_direction_10m : r.wind_bearing;
    const direction = this.compass(bearing,wind);
    const timestamp = value => value ? this.date(value,{weekday:'short',hour:'numeric',minute:'2-digit'}) : null;
    return [
      ['condition','Conditions',r.condition === 'partlycloudy' ? 'Partly cloudy' : r.condition?.replaceAll('-',' ')],
      ['temp',kind === 'daily' ? 'High temperature' : 'Temperature',temp(current ? r.temperature_2m : r.native_temperature)],
      ['feels','Feels like',temp(r.apparent_temperature)],
      ['high','Forecast high',temp(r.temperature_high)],
      ['low',current ? 'Forecast low' : 'Low temperature',temp(current ? r.temperature_low : r.native_templow)],
      ['humidity','Humidity',measure(r.relative_humidity_2m,'%')],
      ['pressure','Pressure',measure(r.pressure_msl,this.imperial ? 'inHg' : 'hPa',this.imperial ? .02953 : 1,this.imperial ? 2 : 1)],
      ['wind','Wind speed',wind == null ? null : this.wind(wind)],
      ['gusts','Wind gusts',r.wind_gusts_10m == null ? null : this.wind(r.wind_gusts_10m)],
      ['direction','Wind direction',direction ? direction + ' · ' + Math.round(bearing) + '°' : null],
      ['precipChance',current ? 'Next hour precipitation chance' : kind === 'daily' ? 'Peak precipitation chance' : 'Precipitation chance',
        measure(current ? r.next_precipitation : r.precipitation_probability,'%')],
      ['precipAmount',current ? 'Precipitation in current interval' : 'Precipitation accumulation',amount(current ? r.precipitation : r.native_precipitation)],
      ['snow','Snowfall depth',amount(r.snowfall_cm,true)],
      ['cloud','Cloud cover',measure(r.cloud_cover,'%')],
      ['uv',current ? 'Next hour UV index' : 'UV index',Number.isFinite(r.uv_index) ? r.uv_index : null],
      ['visibility',current ? 'Next hour visibility' : 'Visibility',measure(r.visibility,this.imperial ? 'mi' : 'km',this.imperial ? 1/1609.344 : .001,1)],
      ['daylight','Daylight',r.is_day == null ? null : r.is_day ? 'Yes' : 'No'],
      ['freezing','At or below freezing',current && Number.isFinite(r.temperature_2m) ? (r.temperature_2m <= 0 ? 'Yes' : 'No') : null],
      ['expected','Precipitation expected next hour',current && Number.isFinite(r.next_precipitation) ? (r.next_precipitation >= 50 ? 'Yes' : 'No') : null],
      ['sunrise',current ? 'Next sunrise' : 'Sunrise',timestamp(r.sunrise)],
      ['sunset',current ? 'Next sunset' : 'Sunset',timestamp(r.sunset)],
      ['interval','Precipitation observation interval',measure(r.interval,'min',1/60,1)],
      ['updated','Last successful update',timestamp(r.updated_at)],
    ];
  }

  hiddenReadings() {
    try {
      const value = JSON.parse(this.read('readings.' + this.reading.kind));
      return new Set(Array.isArray(value) ? value : []);
    } catch { return new Set(); }
  }

  renderReadings() {
    const hidden = this.hiddenReadings();
    const visible = this.readingRows().filter(([key,,value]) => value != null && !hidden.has(key));
    const list = this.$('reading-list');
    list.innerHTML = visible.map(([,label,value]) =>
      `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');
    if (!visible.length) list.innerHTML = '<div><dt>No readings to show</dt><dd>⚙</dd></div>';
  }

  openReadingSettings() {
    const hidden = this.hiddenReadings();
    const choices = this.$('reading-choices');
    choices.innerHTML = this.readingRows().filter(([, ,value]) => value != null).map(([key,label]) =>
      `<label><input type="checkbox" value="${key}" ${hidden.has(key) ? '' : 'checked'}> ${escape(label)}</label>`).join('');
    choices.onchange = event => {
      const {checked,value} = event.target;
      if (checked) hidden.delete(value); else hidden.add(value);
      this.write('readings.' + this.reading.kind,JSON.stringify([...hidden]));
      this.renderReadings();
    };
    const dialog = this.$('reading-settings');
    if (!dialog.open) dialog.showModal();
  }

  async loadRadar() {
    const location = this.data?.selected;
    const mobile = this.$('shell')?.clientWidth <= 700;
    if (!location || !this.data.radar || (mobile && this.tab !== 'radar')) return;
    const key = location.id + ':' + Math.floor(Date.now() / 300000);
    if (this.radarKey === key) return;
    this.radarKey = key;
    try {
      const [frames, baseMap] = await Promise.all([
        this.call('radar',{location:location.id}),
        this._hass.callWS({type:'map_tiles/access_token'}).catch(() => null),
      ]);
      if (this.radarKey !== key) return;
      this.frames = frames;
      this.mapTileToken = baseMap?.token || null;
      this.frameIndex = Math.max(0,frames.length - 1);
    } catch {
      if (this.radarKey !== key) return;
      this.frames = [];
    }
    this.renderRadar();
  }

  renderRadar() {
    const host = this.$('radar');
    const location = this.data?.selected;
    const frame = this.frames[this.frameIndex];
    if (!location || !this.data.radar || !frame) {
      host.innerHTML = `<p class="empty">${this.data && !this.data.radar ? 'Radar disabled in integration settings' : 'Recent radar unavailable'}</p>`;
      return;
    }
    const signature = `${location.id}:${frame.time}:${this.frames.length}`;
    if (host.firstElementChild?.dataset.signature === signature) return;
    const zoom = 6;
    const size = 2 ** zoom;
    const latitude = Math.max(-85,Math.min(85,location.latitude)) * Math.PI / 180;
    const x = (location.longitude + 180) / 360 * size;
    const y = (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * size;
    const tiles = [];
    for (let column = Math.floor(x)-1; column <= Math.floor(x)+1; column++) {
      for (let row = Math.max(0,Math.floor(y)-1); row <= Math.min(size-1,Math.floor(y)+1); row++) {
        const wrapped = (column + size) % size;
        const style = `left:calc(50% + ${Math.round((column-x)*256)}px);top:calc(50% + ${Math.round((row-y)*256)}px)`;
        const base = `/api/map_tiles/raster/${zoom}/${wrapped}/${row}.png?token=${encodeURIComponent(this.mapTileToken || '')}`;
        const url = `https://tilecache.rainviewer.com${frame.path}/256/${zoom}/${wrapped}/${row}/2/1_1.png`;
        const background = this.mapTileToken ? `<img class="base-tile" alt="" src="${base}" style="${style}">` : '';
        tiles.push(`${background}<img class="overlay" referrerpolicy="no-referrer" alt="" src="${escape(url)}" style="${style}">`);
      }
    }
    host.innerHTML = `<div class="radar-content" data-signature="${signature}">
      <div class="map" role="img" aria-label="Recent observed precipitation near ${escape(location.name)}">${tiles.join('')}<span class="pin"></span></div>
      <div class="radar-controls"><input type="range" id="radar-time" min="0" max="${this.frames.length - 1}" value="${this.frameIndex}" aria-label="Observed radar time">
      <span>${this.time(frame.time * 1000)}</span></div>
      <small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> ·
      <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a> <span class="radar-tile-status" role="status"></span></small></div>`;
    const status = host.querySelector('.radar-tile-status');
    const failures = new Set(this.mapTileToken ? [] : ['Base map unavailable']);
    const updateStatus = () => { status.textContent = [...failures].join(' · '); };
    updateStatus();
    host.querySelectorAll('.base-tile,.overlay').forEach(tile => {
      const handleFailure = () => {
        failures.add(tile.classList.contains('overlay') ? 'Radar tiles incomplete' : 'Base map tiles incomplete');
        tile.remove();
        updateStatus();
      };
      tile.onerror = handleFailure;
      if (tile.complete && !tile.naturalWidth) handleFailure();
    });
    this.$('radar-time').onchange = event => {
      this.frameIndex = Number(event.target.value);
      this.renderRadar();
      this.$('radar-time').focus();
    };
  }

  settingsPanel(panel) {
    this.$('notice').textContent = '';
    this.shadowRoot.querySelectorAll('[data-settings]').forEach(button =>
      button.setAttribute('aria-pressed',String(button.dataset.settings === panel)));
    const content = this.$('settings-content');
    if (panel === 'appearance') {
      content.innerHTML = `<div class="themes">${themes.map(([id,name,bg,,accent]) =>
        `<button data-theme-choice="${id}" aria-pressed="${this.theme === id}"><i style="background:${bg};border-color:${accent}"></i>${name}</button>`).join('')}</div>
        <label class="units">Units <select id="units"><option value="metric">Metric</option><option value="imperial">Imperial</option></select></label>`;
      content.querySelectorAll('[data-theme-choice]').forEach(button => button.onclick = () => {
        this.theme = button.dataset.themeChoice;
        this.write('theme',this.theme);
        this.render();
        content.querySelectorAll('[data-theme-choice]').forEach(item =>
          item.setAttribute('aria-pressed',String(item === button)));
      });
      this.$('units').value = this.imperial ? 'imperial' : 'metric';
      this.$('units').onchange = event => {
        this.imperial = event.target.value === 'imperial';
        this.write('units',event.target.value);
        this.render();
      };
      return;
    }
    if (panel === 'data') {
      content.innerHTML = '<p>Open-Meteo receives saved coordinates to fetch weather and city or postal search terms. The radar view loads map tiles from OpenStreetMap and RainViewer. Provider and radar controls are under Devices &amp; services → Atmosphere Weather → Configure.</p>';
      return;
    }
    const locations = this.data?.locations || [];
    const admin = this._hass?.user?.is_admin;
    content.innerHTML = `<ul class="locations">${locations.map(location => `<li><span>${escape(location.name)}</span>
      ${admin ? `<button data-edit="${escape(location.id)}">Edit</button>` : ''}</li>`).join('')}</ul>
      ${admin ? '<button id="add">Add location</button><div id="editor"></div>' : '<p>Ask a Home Assistant administrator to manage locations.</p>'}`;
    if (!admin) return;
    this.$('add').onclick = () => this.locationForm();
    content.querySelectorAll('[data-edit]').forEach(button => button.onclick = () =>
      this.locationForm(locations.find(item => item.id === button.dataset.edit)));
    if (!locations.length) this.locationForm();
  }

  locationForm(location) {
    const box = this.$('editor');
    box.innerHTML = `
      ${location ? '' : '<form id="search"><label>City or postal code <input name="query" required minlength="2" maxlength="100"></label><button>Search</button></form><div id="results"></div>'}
      <form id="save" class="location-form">
        <label>Name <input name="name" maxlength="80" required value="${escape(location?.name)}"></label>
        <div class="coordinates">
        <label>Latitude <input name="latitude" type="number" step="any" min="-90" max="90" required value="${escape(location?.latitude)}"></label>
        <label>Longitude <input name="longitude" type="number" step="any" min="-180" max="180" required value="${escape(location?.longitude)}"></label>
        </div>
        <label>Time zone <input name="timezone" required placeholder="Europe/Paris" value="${escape(location?.timezone || this._hass?.config?.time_zone)}"></label>
        <div class="actions"><button>Save location</button>${location ? '<button id="remove" type="button">Remove</button>' : ''}</div>
      </form>`;
    const form = this.$('save');
    const notice = this.$('notice');
    if (!location) this.$('search').onsubmit = async event => {
      event.preventDefault();
      const search = event.target;
      const results = this.$('results');
      notice.textContent = 'Searching…';
      try {
        const matches = await this.call('search',{query:new FormData(search).get('query')});
        if (!search.isConnected) return;
        notice.textContent = matches.length ? '' : 'No places found. Enter coordinates manually.';
        results.replaceChildren(...matches.map(result => {
          const button = document.createElement('button');
          button.textContent = result.name;
          button.onclick = () => {
            for (const key of ['name','latitude','longitude','timezone']) form.elements[key].value = result[key];
            form.elements.name.focus();
          };
          return button;
        }));
      } catch (error) { notice.textContent = error.message || 'Search unavailable'; }
    };
    const mutate = async (action,data) => {
      form.querySelectorAll('button').forEach(button => button.disabled = true);
      notice.textContent = 'Saving…';
      try {
        const changed = await this.call(action,data);
        if (changed?.location) {
          this.selection = changed.location;
          this.write('location',this.selection);
        }
        this.frames = [];
        this.radarKey = null;
        await this.refresh(8);
        this.settingsPanel('locations');
        notice.textContent = action === 'remove_location' ? 'Location removed' : 'Location saved';
      } catch (error) { notice.textContent = error.message || 'Unable to save'; }
      finally { form.querySelectorAll('button').forEach(button => button.disabled = false); }
    };
    form.onsubmit = event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      if (location) values.location = location.id;
      mutate('save_location',values);
    };
    if (location) this.$('remove').onclick = event => {
      const button = event.currentTarget;
      if (button.dataset.confirm) return mutate('remove_location',{location:location.id});
      button.dataset.confirm = 'true';
      button.textContent = 'Confirm removal';
      notice.textContent = 'Automations using this location’s entities will lose their source.';
    };
  }
}

const CSS = `
:host{display:block;container-type:inline-size}
*{box-sizing:border-box}
main{--ink:#edf3f5;--muted:#b3c5d2;--line:#ffffff20;--font:Manrope,"Avenir Next",system-ui,sans-serif;
 color-scheme:dark;color:var(--ink);background:var(--bg,#101923);font:14px var(--font);font-variant-numeric:tabular-nums;
 display:grid;grid-template-rows:42px minmax(130px,.9fr) 67px minmax(190px,1.1fr) auto;gap:12px;padding:16px 24px;
 min-height:540px;height:calc(100dvh - var(--header-height,56px))}
main[data-theme=appearance]{color-scheme:var(--yanke-scheme,normal);--ink:var(--yanke-text,var(--primary-text-color,#edf3f5));
 --muted:var(--yanke-muted,var(--secondary-text-color,#b3c5d2));--line:var(--yanke-line,var(--divider-color,#ffffff20));
 --font:var(--yanke-font,var(--ha-font-family-body,system-ui));height:auto;min-height:calc(100dvh - var(--header-height,56px));font-size:calc(14px * var(--yanke-scale,1))}
header,.actions,.heading,footer,.radar-controls{display:flex;align-items:center;gap:10px;justify-content:space-between}
.brand{display:flex;gap:8px;align-items:center;font-size:20px}.brand span,.icon,.chance{color:var(--accent)}
button,input,select{font:inherit;color:inherit}button,input,select{border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:8px}
button,select{cursor:pointer}button:disabled{opacity:.5;cursor:default}button[aria-pressed=true]{outline:1px solid var(--accent);background:color-mix(in srgb,var(--surface),var(--accent) 15%)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#location{max-width:min(40cqw,300px);text-overflow:ellipsis}#settings,#close{min-width:38px}
.hero{position:relative;isolation:isolate;overflow:hidden;border-radius:18px;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:10px;
 background:linear-gradient(115deg,#233f55,#627d91);border:1px solid var(--line);color:#f3f6f8}
.hero[data-sky=night]{background:linear-gradient(115deg,#1b293e,#374967)}
.hero[data-sky=twilight]{background:linear-gradient(115deg,#172149,#604569)}
.hero[data-sky=golden]{background:linear-gradient(115deg,#3b3955,#a96d49)}
main:not([data-theme=original]) .hero{background:linear-gradient(115deg,var(--surface),color-mix(in srgb,var(--surface),var(--accent) 26%));color:var(--ink)}
.orb{position:absolute;z-index:-1;right:28%;top:18%;width:clamp(54px,10vw,108px);aspect-ratio:1;border-radius:50%;background:#ffe8b8;box-shadow:0 0 65px #ffe8b850}
.hero[data-sky=night] .orb{background:#dce8f0;box-shadow:0 0 45px #dce8f045}
#sky-content{display:contents}.hero canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1}.hero canvas[hidden]{display:none}
.hero::after{content:'';position:absolute;z-index:-1;top:53%;right:15%;width:54%;height:34px;border-radius:50%;filter:blur(16px);background:#d9e3eb55}
.kicker{font-size:.78em;font-weight:600;overflow-wrap:anywhere}.temperature{font-size:clamp(43px,8vh,85px);font-weight:300;letter-spacing:-.05em;line-height:1.1}
.temperature sup{font-size:.35em;vertical-align:super;letter-spacing:0}.condition{text-transform:capitalize}.summary{display:grid;gap:8px;text-align:right;font-size:.83em}.summary strong{font-size:1.45em;font-weight:600}
.metrics,.outlook{display:grid;gap:12px;min-height:0}.metrics{grid-template-columns:repeat(4,minmax(0,1fr))}
.metrics>div,.panel{background:var(--surface);border:1px solid var(--line);border-radius:13px;min-width:0;padding:12px}
.metrics span,.period span,.period small,footer,.radar-content small,.empty{color:var(--muted);font-size:.78em}
.metrics strong{display:block;margin-top:4px;font-size:1.15em}.metrics span{display:block}
.outlook{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}.panel{display:flex;flex-direction:column;gap:8px;min-height:0}
h2{margin:0;font-size:1.08em}.tabs{display:flex;gap:5px}.tabs button{font-size:.8em}.mobile-tab{display:none}
#periods,#radar{flex:1;min-height:0}.periods{height:100%;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}
.periods.daily{grid-template-columns:repeat(7,minmax(0,1fr))}.period{display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;gap:4px;text-align:center;min-width:0}
.period .icon{color:var(--accent);font-size:1.75em}.period strong{font-size:1.45em}.empty{text-align:center;margin-top:24px}
.radar-content{height:100%;display:grid;grid-template-rows:minmax(55px,1fr) auto auto;gap:4px}.map{position:relative;overflow:hidden;border-radius:8px;background:#263947}
.radar-tile-status:not(:empty)::before{content:" · "}.map img{position:absolute;width:256px;height:256px;max-width:none}.map .overlay{opacity:.8}.pin{position:absolute;top:50%;left:50%;translate:-50% -50%;background:#ffcc66;width:10px;height:10px;border:2px solid #403319;border-radius:50%;box-shadow:0 0 0 4px #ffcc6666}
.radar-controls input{width:75%;padding:0;accent-color:var(--accent)}.radar-controls span{font-size:.75em}
footer a,.radar-content a{color:inherit}footer{gap:8px}
dialog{width:min(570px,calc(100vw - 24px));max-height:calc(100dvh - 28px);overflow:auto;
 color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:18px}
dialog::backdrop{background:#071019aa}.settings-tabs{margin:12px 0}.themes,.coordinates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.themes button{display:flex;gap:8px;align-items:center;text-align:left}.themes i{width:23px;height:23px;flex:none;border:2px solid;border-radius:50%}
.locations{list-style:none;padding:0}.locations li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)}
.location-form,#search{display:grid;gap:8px;margin-top:12px}label{display:grid;gap:4px;font-size:.88em}label input{min-width:0}
#results{display:grid;gap:4px;margin-top:6px}#notice{color:var(--accent);margin-bottom:0}.units{margin-top:12px}
main[data-theme=neon] .panel{box-shadow:inset 0 0 24px #28deef14}
@container(max-width:900px){.hourly .period:nth-child(n+7){display:none}.periods.hourly{grid-template-columns:repeat(6,minmax(0,1fr))}}
@container(max-width:700px){
 main{min-height:510px;padding:8px 12px;gap:8px;grid-template-rows:38px minmax(112px,.8fr) 64px minmax(170px,1fr) auto}
 .brand{font-size:17px}.hero{padding:12px 15px}.metrics{gap:5px}.metrics>div{padding:7px 5px}.metrics span{font-size:.66em}
 .metrics strong{font-size:.9em}.outlook{display:block;position:relative;height:100%}.forecast{height:100%}.radar{display:none}
 .mobile-tab{display:block}
 .period strong{font-size:1.15em}.period span,.period small{font-size:.66em}.period .icon{font-size:1.35em}.tabs button{padding:7px 8px}
}
.trek-settings,#trek-time{display:none}
main[data-theme=trek]{
 --gold:#f3c969;--orange:#ff9955;--blue:#a6bef6;--violet:#9b91dd;--ink:var(--gold);
 --muted:#e2ba75;--font:"Avenir Next Condensed","Roboto Condensed","Arial Narrow",system-ui,sans-serif;
 --rail:clamp(16px,4cqw,66px);background:#050505;padding-inline-start:calc(var(--rail) + 16px);
 position:relative;grid-template-rows:clamp(60px,10vh,100px) minmax(130px,.9fr) 65px minmax(190px,1.1fr) auto;
}
main[data-theme=trek]::before{
 content:"";position:absolute;inset:16px auto 30px 8px;width:var(--rail);border-radius:44px 0 0 44px;
 background:linear-gradient(var(--gold) 0 18%,#050505 18% 18.6%,var(--blue) 18.6% 30%,#050505 30% 30.6%,var(--orange) 30.6% 68%,#050505 68% 68.6%,var(--blue) 68.6% 80%,#050505 80% 80.6%,#dd8a24 80.6%);
}
main[data-theme=trek] header{
 border-bottom:10px solid transparent;border-radius:0 38px 0 24px;padding:0 18px 4px 10px;
 background:linear-gradient(#050505,#050505) padding-box,linear-gradient(90deg,var(--gold) 0 42%,#050505 42% 43%,var(--orange) 43% 55%,#050505 55% 56%,var(--blue) 56% 82%,#050505 82% 83%,var(--gold) 83%) border-box;
}
main[data-theme=trek] .brand{min-width:0;gap:12px;font-size:clamp(22px,4cqw,66px);text-transform:uppercase;line-height:1}
main[data-theme=trek] .brand>span,main[data-theme=trek] .gear{display:none}
main[data-theme=trek] .brand img{width:clamp(42px,7cqh,82px);aspect-ratio:1;object-fit:contain;border-radius:50%;flex:none}
main[data-theme=trek] header>.actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;justify-items:end}
main[data-theme=trek] :is(#settings,.tabs button){border:0;border-radius:999px;background:var(--violet);color:#080612;font-weight:800}
main[data-theme=trek] .tabs button[aria-pressed=true]{background:var(--orange);outline:none}
main[data-theme=trek] .trek-settings,main[data-theme=trek] #trek-time{display:block}
main[data-theme=trek] #trek-time{grid-column:1/-1;font-size:.83em;text-align:right}
main[data-theme=trek] #location{background:#050505;border-color:transparent;color:var(--gold);text-transform:uppercase;font-weight:800}
main[data-theme=trek] :is(.hero,.panel){
 --frame:var(--gold);border:0;border-radius:34px 24px 24px 34px;
 box-shadow:inset 13px 0 var(--frame),inset 0 8px var(--frame),inset -5px 0 var(--frame),inset 0 -6px var(--frame);
 background:#050505;color:var(--ink);padding:17px 16px 13px 25px;
}
main[data-theme=trek] .hero{--frame:var(--orange);box-shadow:inset 14px 0 var(--orange),inset 0 8px var(--orange),inset 0 -7px var(--blue),inset -8px 0 var(--gold)}
main[data-theme=trek] .hero::after{display:none}
main[data-theme=trek] .orb{outline:1px solid #a6bef683;outline-offset:10px;box-shadow:0 0 0 18px #a6bef61c,0 0 48px #a6bef665}
main[data-theme=trek] .temperature{font-weight:800}
main[data-theme=trek] .condition{font-size:clamp(15px,2.8cqw,38px);font-weight:800;text-transform:uppercase}
main[data-theme=trek] .summary strong{border:4px solid var(--orange);border-inline-width:9px;border-radius:14px;padding:4px 8px}
main[data-theme=trek] .metrics>div{
 --meter:var(--gold);background:#050505;color:var(--meter);border:0;border-radius:999px;
 box-shadow:inset 13px 0 var(--meter),inset -13px 0 var(--meter),inset 0 4px var(--meter),inset 0 -4px var(--meter);padding:8px 20px
}
main[data-theme=trek] .metrics>div:nth-child(2){--meter:#79c5e5}
main[data-theme=trek] .metrics>div:nth-child(3){--meter:var(--orange)}
main[data-theme=trek] .metrics>div:nth-child(4){--meter:#eca647}
main[data-theme=trek] .metrics span{color:inherit}
main[data-theme=trek] .radar{--frame:var(--violet);color:var(--violet)}
main[data-theme=trek] h2{text-transform:uppercase;font-weight:800;font-size:clamp(15px,2cqw,29px)}
main[data-theme=trek] .period{
 border-radius:12px 8px 4px 8px;border-left:4px solid var(--orange);border-bottom:4px solid var(--violet);
 background:#0e0b07;overflow:hidden
}
main[data-theme=trek] .period small{background:#352716;color:var(--gold);width:100%;padding:3px 0;font-weight:800}
@container(max-width:700px){
 main[data-theme=trek]{--rail:8px;padding:8px 8px 8px 21px;grid-template-rows:58px minmax(110px,.7fr) 66px minmax(185px,1fr) auto}
 main[data-theme=trek]::before{inset-block:8px 24px;border-radius:8px 0 0 8px}
 main[data-theme=trek] header{border-bottom-width:6px;padding:0 2px 3px;border-radius:0 0 0 12px}
 main[data-theme=trek] .brand{gap:4px;font-size:clamp(15px,4.5cqw,24px)}
 main[data-theme=trek] .brand img{width:30px}
 main[data-theme=trek] #location{max-width:28cqw;padding:4px;font-size:.78em}
 main[data-theme=trek] #settings{font-size:.73em;padding:5px}
 main[data-theme=trek] #trek-time{font-size:.65em}
 main[data-theme=trek] :is(.hero,.panel){border-radius:19px 12px 12px 19px;padding:10px 9px 9px 14px;box-shadow:inset 6px 0 var(--frame),inset 0 4px var(--frame),inset -3px 0 var(--frame),inset 0 -3px var(--frame)}
 main[data-theme=trek] .metrics>div{padding:8px 5px;border-radius:10px;box-shadow:inset 0 3px var(--meter),inset 0 -3px var(--meter)}
 main[data-theme=trek] .period{border-left-width:2px}
 main[data-theme=trek] .tabs button{padding:6px;font-size:.72em}
 main[data-theme=trek] .heading{gap:4px}
 main[data-theme=trek] .summary strong{border-width:2px;padding:3px 4px}
}

.trek-feels{display:none}
main[data-theme=trek]{--font:"Atmosphere Console","Arial Narrow",system-ui,sans-serif;font-weight:600;font-synthesis:none;gap:9px}
main[data-theme=trek] header{border-bottom-width:14px;border-radius:0 36px 0 27px}
main[data-theme=trek] .brand{letter-spacing:.045em}
main[data-theme=trek] .brand img{width:clamp(46px,8vh,88px)}
main[data-theme=trek] #location{font-size:clamp(13px,2.05cqw,32px);max-width:44cqw;padding-block:2px}
main[data-theme=trek] #trek-time{font-size:clamp(11px,1.12cqw,18px)}
main[data-theme=trek] :is(.panel,.hero){position:relative}
main[data-theme=trek] :is(.panel,.hero)::before{
 content:"";position:absolute;left:36px;right:24px;top:0;height:8px;pointer-events:none;
 background:linear-gradient(90deg,var(--frame) 0 39%,#050505 39% 40%,var(--frame) 40% 52%,#050505 52% 53%,var(--segment,var(--frame)) 53% 87%,#050505 87% 89%,var(--frame) 89%);
}
main[data-theme=trek] .forecast{--segment:var(--orange)}
main[data-theme=trek] .radar{--segment:#695bb2}
main[data-theme=trek] .current{display:grid;grid-template-columns:auto auto;align-items:baseline;column-gap:15px}
main[data-theme=trek] .kicker{display:none}
main[data-theme=trek] .condition{grid-column:1/-1;letter-spacing:.025em}
main[data-theme=trek] .trek-feels{display:block;font-size:clamp(12px,1.45cqw,22px)}
main[data-theme=trek] .summary>div{display:none}
main[data-theme=trek] .summary strong{font-size:clamp(16px,2.25cqw,34px);white-space:nowrap}
main[data-theme=trek] .orb{top:50%;right:28%;translate:0 -50%;background:#dce8f0}
main[data-theme=trek] .orb::before{
 content:"";position:absolute;inset:-24%;border:1px dashed #a6bef665;border-radius:50%;
 background:linear-gradient(#a6bef64d,#a6bef64d) center/100% 1px no-repeat,linear-gradient(#a6bef64d,#a6bef64d) center/1px 100% no-repeat;
}
main[data-theme=trek] .metrics>div{display:flex;flex-direction:row-reverse;justify-content:space-between;align-items:center;gap:4px}
main[data-theme=trek] .metrics strong{font-size:clamp(17px,2.35cqw,34px);margin:0;white-space:nowrap}
main[data-theme=trek] .metrics span{text-align:right;font-size:clamp(10px,1.12cqw,18px)}
main[data-theme=trek] .period{background:#050505;border:0;gap:3px}
main[data-theme=trek] .period small{font-size:clamp(11px,1.1cqw,18px);border-radius:10px 10px 0 0}
main[data-theme=trek] .period .icon{width:100%;flex:1;display:grid;place-items:center;
 border:solid var(--orange);border-width:6px 0 5px 5px;border-radius:14px 0 0 8px;font-size:clamp(19px,2.6cqw,36px)}
main[data-theme=trek] .period strong{font-size:clamp(16px,2cqw,30px)}
main[data-theme=trek] .period span:not(.icon){font-size:clamp(9px,.95cqw,15px)}
main[data-theme=trek] .period .chance{width:100%;border-top:4px solid var(--violet);padding-top:2px}
main[data-theme=trek] .map::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:repeating-radial-gradient(circle at center,transparent 0 43px,#41398366 44px 45px,transparent 46px 56px)}
@container(max-width:700px){
 main[data-theme=trek] header{border-bottom-width:6px}
 main[data-theme=trek] .brand img{width:31px}
 main[data-theme=trek] #location{max-width:27cqw;font-size:11px}
 main[data-theme=trek] #trek-time{font-size:9px}
 main[data-theme=trek] :is(.panel,.hero)::before{height:4px}
 main[data-theme=trek] .current{column-gap:6px}
 main[data-theme=trek] .orb{right:27%;width:42px}
 main[data-theme=trek] .orb::before{inset:-15%}
 main[data-theme=trek] .metrics>div{flex-direction:column-reverse;justify-content:center;align-items:flex-start}
 main[data-theme=trek] .metrics span{text-align:left}
 main[data-theme=trek] .metrics strong{font-size:13px}
 main[data-theme=trek] .period .icon{border-width:4px 0 3px 3px}
}

/* Each instrument has separate end caps and interrupted rails. */
main[data-theme=trek] .metrics{gap:clamp(4px,.65cqw,12px)}
main[data-theme=trek] .metrics>div{
 --cap:clamp(14px,2.4cqw,42px);--rail-width:calc(100% - var(--cap) - var(--cap) - 10px);
 position:relative;box-shadow:none;border-radius:0;overflow:hidden;
 padding:10px calc(var(--cap) + 10px);
 background:
  linear-gradient(90deg,var(--meter) 0 64%,#050505 64% 66%,color-mix(in srgb,var(--meter) 40%,#050505) 66% 92%,#050505 92%) center top/var(--rail-width) 5px no-repeat,
  linear-gradient(90deg,var(--meter) 0 72%,#050505 72% 79%,var(--meter) 79% 91%,#050505 91%) center bottom/var(--rail-width) 5px no-repeat,
  #050505;
}
main[data-theme=trek] .metrics>div::before,main[data-theme=trek] .metrics>div::after{
 content:"";position:absolute;inset-block:0;width:var(--cap);pointer-events:none;
 background:linear-gradient(155deg,color-mix(in srgb,var(--meter),white 11%),var(--meter));
}
main[data-theme=trek] .metrics>div::before{left:0;border-radius:999px 0 0 999px}
main[data-theme=trek] .metrics>div::after{right:0;border-radius:0 999px 999px 0}
main[data-theme=trek] .metrics strong{font-size:clamp(15px,2.25cqw,37px);line-height:1}
main[data-theme=trek] .metrics span{font-size:clamp(10px,1.22cqw,19px);line-height:1.05}
@container(max-width:1050px){
 main[data-theme=trek] .metrics>div{flex-direction:column-reverse;align-items:flex-start;justify-content:center;gap:3px}
 main[data-theme=trek] .metrics span{text-align:left}
}
@container(max-width:700px){
 main[data-theme=trek] .metrics>div{--cap:5px;padding:7px 8px;background-size:var(--rail-width) 3px,var(--rail-width) 3px,auto}
 main[data-theme=trek] .metrics strong{font-size:clamp(11px,3.3cqw,16px)}
 main[data-theme=trek] .metrics span{font-size:9px}
}

main[data-theme=trek] header{
 --emblem:clamp(68px,9.2cqw,108px);
 --brand-gap:clamp(5px,.65cqw,10px);
 --header-inset:4px;
 position:relative;border-bottom:0;background:#050505;
 padding:0 14px 12px var(--header-inset);
}
main[data-theme=trek] header::after{
 content:"";position:absolute;left:calc(var(--header-inset) + var(--emblem) + var(--brand-gap));
 right:0;bottom:0;height:10px;pointer-events:none;
 background:linear-gradient(90deg,var(--gold) 0 47%,#050505 47% 48%,var(--orange) 48% 63%,#050505 63% 64%,var(--blue) 64% 86%,#050505 86% 87%,var(--gold) 87%);
}
main[data-theme=trek] .brand{gap:var(--brand-gap)}
main[data-theme=trek] .brand img{width:var(--emblem);position:relative;top:6px;z-index:1}
main[data-theme=trek]{
 grid-template-rows:clamp(87px,13vh,118px) minmax(130px,.9fr) 65px minmax(190px,1.1fr) auto;
}
@container(max-width:700px){
 main[data-theme=trek]{grid-template-rows:61px minmax(110px,.7fr) 66px minmax(185px,1fr) auto}
 main[data-theme=trek] header{--emblem:clamp(36px,10.4cqw,48px);--brand-gap:4px;--header-inset:2px;padding:0 2px 7px}
 main[data-theme=trek] header::after{height:5px}
 main[data-theme=trek] .brand img{top:3px}
}

.hero .orb.lunar-orb{background:#263244;box-shadow:0 0 26px #adc9ee55;z-index:0;pointer-events:auto}
.hero .orb.lunar-orb canvas{display:block;position:static;width:100%;height:100%;border-radius:50%}
.hero :is(.current,.summary){position:relative;z-index:1}

main[data-theme=trek] .hero .orb:not(.lunar-orb){
 background:radial-gradient(circle at 34% 34%,#fff2bc,#ffce69 68%,#f79a40);
 box-shadow:0 0 0 18px #f3c96921,0 0 48px #f3c96970;
}

.weather-briefing{position:absolute;z-index:1;left:33%;right:47%;margin:0;font-size:clamp(11px,1.25cqw,18px);line-height:1.25}
.period .chance .accumulation{display:block;font-size:.95em;color:inherit}
@container(max-width:850px){
 .hero.has-briefing{padding-bottom:36px}
 .weather-briefing{left:20px;right:16px;bottom:10px;font-size:11px}
}
@container(max-width:700px){
 .hero.has-briefing .temperature{font-size:clamp(36px,7.5vh,54px)}
 .period .chance .accumulation{line-height:1.05}
}

/* Keep the framed icon area flexible while giving the symbol its own readable size. */
.period .icon i{display:block;font:normal 400 clamp(32px,4.2cqw,64px)/1 system-ui,sans-serif}
.forecast .tabs button{min-height:43px;padding:8px 16px;font-size:14px;line-height:1.1}
@container(max-width:700px){
 main,main[data-theme=trek],main[data-theme=appearance]{
   height:var(--atmosphere-available-height,calc(100dvh - var(--header-height,56px)));
   min-height:465px;gap:6px;grid-template-rows:auto minmax(104px,.65fr) 63px minmax(194px,1fr) auto;
 }
 main[data-theme=trek] header{min-height:56px}
 main:not([data-theme=trek]) header{min-height:38px}
 .outlook{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);height:auto}
 .forecast{height:auto;gap:5px}
 .forecast .tabs{gap:4px}
 .forecast .tabs button{min-height:40px;padding:6px 9px;font-size:12px}
 .period{gap:3px}
 .period .icon i{font-size:clamp(24px,8cqw,44px)}
}
@container(max-width:360px){
 .forecast .tabs button{padding-inline:7px}
 main[data-theme=trek] .forecast h2{font-size:13px}
}

#desktop-radar-slot,#mobile-radar-slot{flex:1;min-height:0;display:flex;flex-direction:column}
#mobile-radar-slot{display:none}
@container(max-width:700px){
 .forecast .heading{flex-direction:column;align-items:stretch;gap:6px}
 .forecast .tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .forecast .tabs button{width:100%;min-height:42px;font-size:15px;padding:6px 8px}
 main[data-tab=radar] #periods{display:none}
 main[data-tab=radar] #mobile-radar-slot{display:flex}
 main[data-tab=radar]{grid-template-rows:auto minmax(104px,.3fr) 63px minmax(194px,1fr) auto}
}

/* Daily snow totals must not change the height of the framed icon. */
main[data-theme=trek] .daily .period .chance{
 line-height:1.15;
 min-height:calc(2.3em + 6px);
 flex:none;
}
main[data-theme=trek] .daily .period .chance .accumulation{
 white-space:nowrap;
 line-height:1.15;
}

.current-reading,.period-reading{background:none;border:0;color:inherit;padding:0;cursor:pointer}
.current-reading{text-align:left;width:max-content}
.period-reading{width:100%;min-height:0;font:inherit;border-radius:8px}
.forecast .period-reading:focus-visible{outline-offset:-2px}
.period-reading:hover small{text-decoration:underline;text-underline-offset:2px}
.period-reading small{display:block}
.current-reading:hover,.period-reading:hover{color:var(--accent)}
.reading-dialog .heading{gap:8px}
.reading-dialog .heading button{min-width:42px;height:42px}
#reading-context{color:var(--muted);margin:8px 0 16px}
#reading-list{margin:0}
#reading-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}
#reading-list dd{margin:0;text-align:right;font-weight:600}
#reading-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:16px}
#reading-choices label{display:flex;align-items:center;min-height:34px}
#reading-choices input{accent-color:var(--accent);flex:none}
@container(max-width:400px){#reading-choices{grid-template-columns:1fr}}

#shell{position:relative;grid-template-columns:minmax(0,1fr)}
#weather-details{
 position:absolute;grid-area:2 / 1 / 4 / 2;inset:0;margin:0;width:auto;max-width:none;max-height:none;height:auto;
 z-index:3;padding:8px 12px;border-radius:10px;overscroll-behavior:contain;
}
#weather-details .heading{
 position:sticky;top:-8px;z-index:1;background:var(--bg);padding-block:2px;
}
#weather-details #reading-context{margin:4px 0 6px}
#weather-details #reading-list>div{padding:6px 0}

`;
customElements.define('atmosphere-weather-card', AtmosphereWeatherCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'atmosphere-weather-card',name:'Atmosphere Weather',description:'Weather and radar for your saved locations'});
