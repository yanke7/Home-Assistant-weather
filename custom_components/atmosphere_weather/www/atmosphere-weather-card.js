import {ThermostatControls,thermostatCSS,thermostatMarkup} from './thermostat.js?v=0.1.39';
import {languages,translate} from './translations.js?v=0.1.44';

const boxDefaults = ["windSummary","humidity","precipChance","solar","pressure","gusts"];
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
const partlyCloudyNightIcon = `<svg width="1em" height="1em" viewBox="0 0 64 64" focusable="false">
  <path fill="#b6ccf5" d="M40 5a17 17 0 1 0 18 24A18 18 0 0 1 40 5Z"/>
  <path fill="#e0e9f2" d="M16 55a10 10 0 0 1-1-20 14 14 0 0 1 26 3 9 9 0 1 1 3 17Z"/>
</svg>`;
function forecastIcon(item) {
  return item.condition === 'partlycloudy' && item.is_day === 0
    ? partlyCloudyNightIcon
    : icons[item.condition] || '◌';
}
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

function positionSun(orb, days, now) {
  for (const day of days || []) {
    const rise = Date.parse(day.sunrise);
    const set = Date.parse(day.sunset);
    if (!(rise < set && rise <= now && now <= set)) continue;
    const progress = (now - rise) / (set - rise);
    const altitude = Math.sin(Math.PI * progress);
    // Align the disk's lower edge near the horizon and its upper edge at midday.
    orb.style.left = (18 + 64 * progress) + '%';
    orb.style.right = 'auto';
    orb.style.top = (96 - 90 * altitude) + '%';
    orb.style.translate = '-50% ' + (-100 * (1 - altitude)) + '%';
    return;
  }
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
    const language = this.read('language');
    this.languagePreference = Object.hasOwn(languages,language) ? language : 'auto';
    this.imperial = this.read('units') === 'imperial';
  }
  read(key) { try { return localStorage.getItem(this.key + '.' + key); } catch { return null; } }
  write(key,value) { try { localStorage.setItem(this.key + '.' + key,value); } catch { /* Optional preference. */ } }
  getCardSize() { return 9; }
  get language() {
    if (Object.hasOwn(languages,this.languagePreference)) return this.languagePreference;
    const locale = this._hass?.locale?.language || this._hass?.language || '';
    const base = locale.toLowerCase().split(/[-_]/)[0];
    const language = base === 'fil' ? 'tl' : base === 'no' ? 'nb' : base;
    return Object.hasOwn(languages,language) ? language : 'en';
  }
  set hass(value) {
    const previousLanguage = this.language;
    const changed = this._hass?.user?.id !== value.user?.id;
    this._hass = value;
    if (changed) this.refresh();
    if (this.$('shell') && previousLanguage !== this.language) {
      if (this.$('dialog').open) {
        this.renderAppearanceSettings();
        this.renderLocationSettings();
      }
      this.render();
    }
    if (this.$('camera-preview')) this.renderLocationControls();
  }
  connectedCallback() {
    this.build();
    this.popupObserver = new MutationObserver(() => this.schedulePopupFit());
    for (const popup of this.shadowRoot.querySelectorAll('dialog')) {
      this.popupObserver.observe(popup,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    }
    this.fitViewport = () => {
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
      const top = this.getBoundingClientRect().top;
      if (this.getClientRects().length && bottom > top) {
        this.style.setProperty('--atmosphere-available-height', Math.floor(bottom - top) + 'px');
      }
      this.schedulePopupFit();
    };
    window.addEventListener('resize', this.fitViewport);
    window.visualViewport?.addEventListener('resize', this.fitViewport);
    this.viewportFrame = requestAnimationFrame(this.fitViewport);
    this.radarLayoutObserver = new ResizeObserver(() => {
      this.schedulePopupFit();
      this.drawTemperatureTrend();
      const mobile = this.$('shell').clientWidth <= 700;
      const target = this.$(mobile ? 'mobile-radar-slot' : 'desktop-radar-slot');
      const radar = this.$('radar');
      if (radar.parentElement === target) {
        if (radar.clientWidth) this.renderRadar();
        return;
      }
      target.append(radar);
      if (!mobile && this.tab === 'radar') {
        this.tab = 'hourly';
        this.render();
      }
      this.renderRadar();
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
    cancelAnimationFrame(this.popupFrame);
    this.popupObserver?.disconnect();
    this.radarLayoutObserver?.disconnect();
    window.removeEventListener('resize', this.fitViewport);
    window.visualViewport?.removeEventListener('resize', this.fitViewport);
    this.request++;
    this.radarGesture = null;
    this.sky?.dispose();
    this.sky = null;
  }

  schedulePopupFit() {
    cancelAnimationFrame(this.popupFrame);
    this.popupFrame = requestAnimationFrame(() => {
      for (const popup of this.shadowRoot.querySelectorAll('dialog[open]')) {
        popup.style.removeProperty('--popup-fitted-size');
        const preferred = parseFloat(getComputedStyle(popup).fontSize);
        if (popup.scrollHeight <= popup.clientHeight || preferred <= 12) continue;

        // Find the largest readable size that fits, leaving long content scrollable.
        let low = 12;
        let high = preferred;
        popup.style.setProperty('--popup-fitted-size',low + 'px');
        if (popup.scrollHeight > popup.clientHeight) continue;
        for (let attempt = 0; attempt < 6; attempt++) {
          const size = (low + high) / 2;
          popup.style.setProperty('--popup-fitted-size',size + 'px');
          if (popup.scrollHeight <= popup.clientHeight) low = size;
          else high = size;
        }
        popup.style.setProperty('--popup-fitted-size',low + 'px');
      }
    });
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
      this.loadWeatherAlerts(request);
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
    this.shadowRoot.innerHTML = `<style>${CSS}
${thermostatCSS}</style><main id="shell">
      <header><div class="brand"><span aria-hidden="true">◒</span><strong>Atmosphere</strong></div>
        <div class="actions"><select id="location" aria-label="Weather location"></select>
          <button id="settings" aria-label="Settings" title="Settings"><span class="gear">⚙</span><span class="trek-settings" data-label="Settings">Settings</span></button><div id="trek-time"></div></div></header>
      <div id="hero-layout">
        <section id="hero" class="hero"><div id="sky-content"></div>
          <button id="thermostat" type="button" aria-haspopup="dialog" hidden></button>
        </section>
        <button id="camera-preview" type="button" aria-label="Open camera full screen" aria-haspopup="dialog" hidden></button>
      </div>
      ${thermostatMarkup}
      <dialog id="camera-fullscreen" aria-label="Full-screen camera">
        <button id="camera-close" type="button" aria-label="Close full-screen camera"></button>
      </dialog>
      <dialog id="weather-details" class="reading-dialog" aria-labelledby="reading-title">
        <div class="heading"><h2 id="reading-title"></h2><div class="actions">
          <button id="reading-gear" aria-label="Customize weather readings" title="Customize weather readings">⚙</button>
          <button id="reading-close" aria-label="Close weather details">✕</button>
        </div></div>
        <p id="reading-context"></p><dl id="reading-list"></dl>
      </dialog>
      <div class="conditions-strip">
        <button id="fishing-summary" type="button" data-tab="fishing" hidden></button>
        <button id="alert-banner" type="button" hidden aria-haspopup="dialog"></button>
        <section class="metrics" id="metrics" aria-label="Weather details"></section>
      </div>
      <div class="outlook">
        <section class="panel forecast"><div class="heading"><h2 id="forecast-title" data-label="Forecast">Forecast</h2>
          <div class="tabs"><button data-tab="hourly" data-label="Hourly">Hourly</button><button data-tab="daily" data-label="Daily">Daily</button>
          <button id="fishing-tab" data-tab="fishing" data-label="Fishing" hidden>Fishing</button><button data-tab="radar" class="mobile-tab" data-label="Radar">Radar</button></div></div>
          <canvas id="temperature-trend" role="img" hidden></canvas><div id="periods"></div><div id="mobile-radar-slot"></div></section>
        <section class="panel radar"><div id="desktop-radar-slot"><div id="radar"></div></div></section>
      </div>
      <footer><a href="https://open-meteo.com/" target="_blank" rel="noopener" data-label="Weather by Open-Meteo">Weather by Open-Meteo</a><span id="status" role="status"></span></footer>
      <dialog id="dialog" aria-labelledby="settings-title">
       <div class="heading"><h2 id="settings-title" data-label="Settings">Settings</h2><button id="close" aria-label="Close settings">✕</button></div>
       <div id="settings-content">
        <label class="units"><span data-label="Language">Language</span>
          <select id="language"><option value="auto" data-label="Follow Home Assistant">Follow Home Assistant</option>${Object.entries(languages).map(([code,name]) => `<option value="${code}">${name}</option>`).join('')}</select>
        </label>
        <section><h3 data-label="Locations">Locations</h3><div id="location-settings"></div><p id="notice" role="status"></p></section>
        <section><h3 data-label="Appearance">Appearance</h3><div id="appearance-settings"></div></section>
        <section><h3 data-label="Weather boxes">Weather boxes</h3><div id="box-settings"></div></section>
        <section id="fishing-settings"></section>
        <section><h3 data-label="Data">Data</h3><p data-label="Open-Meteo receives saved coordinates and location searches. Home Assistant serves the base map and RainViewer supplies precipitation tiles. Provider and radar controls are under Devices &amp; services → Atmosphere Weather → Configure.">Open-Meteo receives saved coordinates and location searches. Home Assistant serves the base map and RainViewer supplies precipitation tiles. Provider and radar controls are under Devices &amp; services → Atmosphere Weather → Configure.</p></section>
       </div>
      </dialog>
      <dialog id="box-editor" aria-labelledby="box-heading">
        <h2 id="box-heading"></h2><form id="box-form">
          <div class="box-preview" id="box-preview"></div>
          <label><span data-label="Reading">Reading</span><select id="box-reading"></select></label>
          <label><span data-label="Custom title">Custom title</span><input id="box-title" maxlength="40"></label>
          <div class="actions"><button type="button" id="box-cancel" data-label="Cancel">Cancel</button>
          <button type="submit" data-label="Save">Save</button></div>
        </form></dialog>
      <dialog id="fishing-editor" aria-labelledby="fishing-title">
        <h2 id="fishing-title"></h2><form id="fishing-form"></form>
      </dialog>
      <dialog id="alerts-dialog" aria-labelledby="alerts-title">
        <div class="heading"><h2 id="alerts-title" data-label="Active weather alerts">Active weather alerts</h2><button id="alerts-close" aria-label="Close weather alerts">✕</button></div>
        <div id="alerts-list"></div>
      </dialog>
      <dialog id="reading-settings" class="reading-dialog" aria-labelledby="reading-settings-title">
        <div class="heading"><h2 id="reading-settings-title" data-label="Choose readings">Choose readings</h2>
          <button id="reading-settings-close" aria-label="Back to weather details">✕</button></div>
        <p data-label="Choose what to show in this type of forecast.">Choose what to show in this type of forecast.</p>
        <div id="reading-choices"></div><button id="reading-reset" data-label="Show all readings">Show all readings</button>
      </dialog></main>`;
    this.$('box-cancel').onclick = () => this.$('box-editor').close();
    this.$('box-form').oninput = () => this.previewBox();
    this.$('box-form').onsubmit = event => {
      event.preventDefault();
      const boxes = this.weatherBoxes();
      boxes[this.editingBox] = {key:this.$('box-reading').value,title:this.$('box-title').value.trim()};
      this.saveBoxes(boxes);
      this.$('box-editor').close();
    };
    this.$('box-settings').onclick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      const boxes = this.weatherBoxes();
      if (button.dataset.action === 'add' && boxes.length < 6) {
        boxes.push({key:boxDefaults[boxes.length],title:''});
        this.saveBoxes(boxes);
      } else if (button.dataset.action === 'remove') {
        boxes.splice(Number(button.dataset.index),1);
        this.saveBoxes(boxes);
      } else if (button.dataset.action === 'edit') this.editBox(Number(button.dataset.index));
    };
    this.$('language').onchange = event => {
      this.languagePreference = event.target.value;
      this.write('language',this.languagePreference);
      this.renderAppearanceSettings();
      this.renderLocationSettings();
      this.render();
    };
    this.$('settings').onclick = () => {
      this.renderLocationSettings();
      this.renderAppearanceSettings();
      this.$('dialog').showModal();
      this.$('dialog').scrollTop = 0;
    };
    this.$('weather-details').addEventListener('keydown', event => {
      if (event.key === 'Escape') this.$('weather-details').close();
    });
    this.$('alert-banner').onclick = () => this.$('alerts-dialog').showModal();
    this.$('alerts-close').onclick = () => this.$('alerts-dialog').close();
    this.$('reading-close').onclick = () => this.$('weather-details').close();
    this.$('reading-gear').onclick = () => this.openReadingSettings();
    this.$('reading-settings-close').onclick = () => this.$('reading-settings').close();
    this.$('reading-reset').onclick = () => {
      this.write('readings.' + this.reading.kind,'[]');
      this.renderReadings();
      this.openReadingSettings();
    };
    this.$('camera-preview').onclick = () => {
      const dialog = this.$('camera-fullscreen');
      this.$('camera-close').append(this.cameraMedia);
      dialog.showModal();
    };
    this.$('camera-close').onclick = () => this.$('camera-fullscreen').close();
    this.$('camera-fullscreen').onclose = () => {
      if (this.cameraMedia) this.$('camera-preview').append(this.cameraMedia);
    };
    this.thermostatControls = new ThermostatControls(this);
    this.$('thermostat').onclick = () => {
      const location = this.data?.selected;
      if (location?.is_home && location.thermostat_entity) this.thermostatControls.open(location.thermostat_entity);
    };
    this.$('close').onclick = () => this.$('dialog').close();
    this.$('location').onchange = event => {
      this.$('weather-details').close();
      this.$('alerts-dialog').close();
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
    });
    this.render();
  }
  $(id) { return this.shadowRoot.getElementById(id); }
  t(key,values) { return translate(this.language,key,values); }
  conditionLabel(condition) {
    const labels = {partlycloudy:'Partly cloudy',sunny:'Sunny','clear-night':'Clear night',cloudy:'Cloudy',
      rainy:'Rainy',pouring:'Pouring',snowy:'Snowy',fog:'Fog',lightning:'Lightning',
      'lightning-rainy':'Thunderstorms and rain',hail:'Hail','snowy-rainy':'Rain and snow',windy:'Windy','windy-variant':'Windy'};
    return this.t(labels[condition] || 'Unknown condition');
  }
  temp(value) { return value == null ? '—' : Math.round(this.imperial ? value * 1.8 + 32 : value) + '°'; }
  measure(value, unit, factor = 1, decimals = 0) {
    return value == null ? '—' : Number((value * factor).toFixed(decimals)) + ' ' + unit;
  }
  date(value, options) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(this.language,
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
      + ' ' + unit + (snow ? ' ' + this.t('snow') : '');
  }

  briefing(hourly) {
    const periods = (hourly || []).slice(0,8);
    if (!periods.length) return '';
    const wet = periods.find(item => item.precipitation_probability >= 50 && item.datetime);
    if (wet) {
      const kind = wet.condition === 'snowy' ? 'Snow likely around {time}.'
        : ['rainy','pouring','lightning-rainy'].includes(wet.condition) ? 'Rain likely around {time}.' : 'Precipitation likely around {time}.';
      return this.t(kind,{time:this.time(wet.datetime)});
    }
    const temps = periods.map(item => item.native_temperature).filter(Number.isFinite);
    if (temps.length < 2) return '';
    const start = temps[0], end = temps.at(-1);
    if (Math.abs(end-start) >= 2) {
      return this.t(end > start ? 'Temperatures rise from {start} to {end} over the next few hours.'
        : 'Temperatures fall from {start} to {end} over the next few hours.',{start:this.temp(start),end:this.temp(end)});
    }
    if (Math.max(...temps) - Math.min(...temps) <= 2) {
      return this.t('Temperatures stay near {temp} over the next few hours.',{temp:this.temp(start)});
    }
    return this.t('Temperatures range from {low} to {high} over the next few hours.',
      {low:this.temp(Math.min(...temps)),high:this.temp(Math.max(...temps))});
  }

  render() {
    const shell = this.$('shell');
    if (!shell) return;
    const {locations = [], selected, weather, fresh} = this.data || {};
    const current = weather?.current || {};
    const [, , background, surface, accent] = themes.find(item => item[0] === this.theme) || themes[0];
    shell.dataset.theme = this.theme;
    this.$('language').value = this.languagePreference;
    if (shell.lang !== this.language) {
      shell.lang = this.language;
      for (const label of shell.querySelectorAll('[data-label]')) label.textContent = this.t(label.dataset.label);
      this.$('settings').setAttribute('aria-label',this.t('Settings'));
      this.$('settings').title = this.t('Settings');
    }
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
    const fishing = Boolean(this.data?.fishing_enabled && selected?.fishing_enabled);
    if (!fishing && this.tab === 'fishing') this.tab = 'hourly';
    shell.classList.toggle("has-fishing",fishing);
    this.renderFishingSummary(fishing, fresh ? weather?.fishing : null);
    this.$('forecast-title').textContent = this.tab === 'fishing' ? this.t('Fishing') : this.tab === 'radar' ? this.t('Precipitation radar') : this.theme === 'trek'
      ? (this.tab === 'daily' ? this.t('Daily forecast') : this.t('Hourly forecast')) : this.t('Forecast');
    shell.dataset.tab = this.tab;
    shell.style.setProperty('--bg',background);
    shell.style.setProperty('--surface',surface);
    shell.style.setProperty('--accent',accent);
    const selector = this.$('location');
    const options = locations.map(location => `<option value="${escape(location.id)}">${escape(location.name)}</option>`).join('');
    const locationOptions = options || `<option>${escape(this.t('No locations'))}</option>`;
    if (selector.dataset.options !== locationOptions) {
      selector.innerHTML = locationOptions;
      selector.dataset.options = locationOptions;
    }
    selector.disabled = !locations.length;
    if (selected) selector.value = selected.id;
    selector.title = selected?.name || '';
    selector.style.setProperty('--location-length',Math.max(18,selected?.name.length || 0));
    const label = current.condition ? this.conditionLabel(current.condition) : null;
    const briefing = fresh ? this.briefing(weather?.hourly) : '';
    this.$('hero').classList.toggle('has-briefing',Boolean(briefing));
    this.$('hero').dataset.sky = current.sky_period || (current.is_day === 0 ? 'night' : 'day');
    this.updateSky();
    this.$('sky-content').innerHTML = selected ? `<div class="current"><div class="kicker">${escape(selected.name)}</div>
       <button class="temperature current-reading" data-reading="current" aria-label="Current weather details">${this.temp(current.temperature_2m)}<sup>${this.imperial ? 'F' : 'C'}</sup></button>
       <span class="trek-feels">${escape(this.t("Feels like"))} ${this.temp(current.apparent_temperature)}</span><div class="condition">${escape(label || this.t('Waiting for weather'))}</div></div>
       ${briefing ? `<p class="weather-briefing">${escape(briefing)}</p>` : ''}
       <div class="orb" aria-hidden="true"></div><div class="summary">
       <div>${this.date(new Date(),{weekday:'long',month:'short',day:'numeric'})}</div>
       <strong>H ${this.temp(current.temperature_high)} · L ${this.temp(current.temperature_low)}</strong>
       <div class="summary-feels">${escape(this.t("Feels like"))} ${this.temp(current.apparent_temperature)}</div></div>`
      : `<div class="current"><h2>${this.error ? this.t('Weather unavailable') : this.data ? this.t('Add a location in Settings') : this.t('Loading weather…')}</h2><p>${escape(this.error)}</p></div>`;
    this.renderLocationControls();
    if (selected && current.is_day === 0) {
      drawMoon(this.$('hero').querySelector('.orb'), selected.latitude, Date.now());
    } else if (selected && current.is_day === 1) {
      positionSun(this.$('hero').querySelector('.orb'), weather?.daily, Date.now());
    }
    this.renderBoxes();
    this.shadowRoot.querySelectorAll('button[data-tab]').forEach(button =>
      button.setAttribute('aria-pressed',String(button.dataset.tab === this.tab)));
    const mode = this.tab === 'daily' ? 'daily' : 'hourly';
    const periods = (weather?.[mode] || []).slice(0,mode === 'daily' ? 7 : 8);
    if (this.tab !== 'fishing') this.$('periods').innerHTML = periods.length ? `<div class="periods ${mode}">${periods.map((item,index) => `
      <button type="button" class="period period-reading" data-reading="${mode}" data-period="${index}" aria-label="${escape(this.date(item.datetime,{weekday:'long',month:'short',day:'numeric',...(mode === 'hourly' ? {hour:'numeric',minute:'2-digit'} : {})}))} weather details"><small>${this.date(item.datetime,mode === 'daily' ? {weekday:'short'} : {hour:'numeric'})}</small>
      <span class="icon" role="img" aria-label="${escape(this.conditionLabel(item.condition))}"><i aria-hidden="true">${forecastIcon(item)}</i></span>
      <strong>${this.temp(item.native_temperature)}</strong>
      <span>${mode === 'daily' ? this.t('Low') + ' ' + this.temp(item.native_templow) : this.wind(item.native_wind_speed) + ' ' + this.compass(item.wind_bearing,item.native_wind_speed)}</span>
      <span class="chance"> ${this.measure(item.precipitation_probability,'%')}${this.accumulation(item) ? `<span class="accumulation">${escape(this.accumulation(item))}</span>` : ''}</span></button>`).join('')}</div>`
      : `<p class="empty">${escape(this.t("Forecast unavailable"))}</p>`;
    if (this.tab === 'fishing') this.renderFishingForecast(fresh ? weather?.fishing : null);
    this.trendValues = periods.map(item => item.native_temperature);
    const trend = this.$('temperature-trend');
    trend.setAttribute('aria-label',mode === 'daily' ? 'Daily high temperature trend' : 'Hourly temperature trend');
    trend.title = trend.getAttribute('aria-label');
    this.drawTemperatureTrend();
    this.$('status').textContent = current.updated_at ? (fresh ? this.t('Updated') : this.t('Last available data')) + ' ' + this.time(current.updated_at) : '';
    this.$('trek-time').textContent = selected
      ? this.date(new Date(), {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
        + (current.updated_at ? ' · ' + this.$('status').textContent : '') : '';
    this.renderRadar();
    this.renderWeatherAlerts();
  }

  drawTemperatureTrend() {
    const canvas = this.$('temperature-trend');
    if (!canvas) return;
    const columns = [...this.$('periods').querySelectorAll('.period')];
    const visible = columns.map((column,index) => ({box:column.getBoundingClientRect(),value:this.trendValues?.[index]}))
      .filter(point => point.box.width > 0);
    const values = visible.map(point => point.value).filter(Number.isFinite);
    canvas.hidden = this.tab === 'radar' || values.length < 2;
    if (canvas.hidden) return;

    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const scale = Math.min(window.devicePixelRatio || 1,2);
    canvas.width = Math.round(box.width*scale);
    canvas.height = Math.round(box.height*scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale,scale);
    const min = Math.min(...values), max = Math.max(...values);
    const span = Math.max(max-min,4);
    const middle = (min+max)/2;
    const points = visible.map(({box:column,value}) => Number.isFinite(value)
      ? [column.left + column.width/2 - box.left, box.height/2 - (value-middle)*(box.height-8)/span]
      : null);
    ctx.strokeStyle = ctx.fillStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    let connected = false;
    for (const point of points) {
      if (!point) { connected = false; continue; }
      if (connected) ctx.lineTo(...point); else ctx.moveTo(...point);
      connected = true;
    }
    ctx.stroke();
    for (const point of points) {
      if (!point) continue;
      ctx.beginPath();
      ctx.arc(...point,2.5,0,Math.PI*2);
      ctx.fill();
    }
  }

  openReadings(kind,index) {
    const weather = this.data?.weather;
    const record = kind === 'fishing' ? this.fishingDays?.[index] : kind === 'current' ? weather?.current : weather?.[kind]?.[index];
    if (!record) return;
    this.reading = {kind,record,location:this.data.selected?.name,fresh:this.data.fresh};
    this.$('reading-title').textContent = {current:this.t('Current conditions'),hourly:this.t('Hourly forecast'),daily:this.t('Daily forecast'),fishing:this.t('Fishing forecasts')}[kind];
    const timestamp = kind === 'current' ? record.observed_at : kind === 'fishing' ? record.time : record.datetime;
    const date = timestamp ? this.date(timestamp,{weekday:'long',month:'short',day:'numeric',
      ...(['daily','fishing'].includes(kind) ? {} : {hour:'numeric',minute:'2-digit',timeZoneName:'short'})}) : '';
    this.$('reading-context').textContent = [this.reading.location,date,this.reading.fresh ? '' : 'Last available data'].filter(Boolean).join(' · ');
    this.$('reading-gear').hidden = kind === 'fishing';
    this.$('weather-details').dataset.kind = kind;
    this.renderReadings();
    this.$('weather-details').scrollTop = 0;
    const panel = this.$('weather-details');
    if (!panel.open) {
      const trigger = this.shadowRoot.activeElement;
      panel.show();
      trigger?.focus({preventScroll:true});
    }
  }

  readingRows({kind,record:r} = this.reading) {
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
      ['condition',this.t('Conditions'),r.condition ? this.conditionLabel(r.condition) : null],
      ['temp',kind === 'daily' ? this.t('High temperature') : this.t('Temperature'),temp(current ? r.temperature_2m : r.native_temperature)],
      ['feels',this.t('Feels like'),temp(r.apparent_temperature)],
      ['high',this.t('Forecast high'),temp(r.temperature_high)],
      ['low',current ? this.t('Forecast low') : this.t('Low temperature'),temp(current ? r.temperature_low : r.native_templow)],
      ['humidity',this.t('Humidity'),measure(r.relative_humidity_2m,'%')],
      ['pressure',this.t('Pressure'),measure(r.pressure_msl,this.imperial ? 'inHg' : 'hPa',this.imperial ? .02953 : 1,this.imperial ? 2 : 1)],
      ['wind',this.t('Wind speed'),wind == null ? null : this.wind(wind)],
      ['gusts',this.t('Wind gusts'),r.wind_gusts_10m == null ? null : this.wind(r.wind_gusts_10m)],
      ['direction',this.t('Wind direction'),direction ? direction + ' · ' + Math.round(bearing) + '°' : null],
      ['precipChance',current ? this.t('Next hour precipitation chance') : kind === 'daily' ? this.t('Peak precipitation chance') : this.t('Precipitation chance'),
        measure(current ? r.next_precipitation : r.precipitation_probability,'%')],
      ['precipAmount',current ? this.t('Precipitation in current interval') : this.t('Precipitation accumulation'),amount(current ? r.precipitation : r.native_precipitation)],
      ['snow',this.t('Snowfall depth'),amount(r.snowfall_cm,true)],
      ['cloud',this.t('Cloud cover'),measure(r.cloud_cover,'%')],
      ['uv',current ? this.t('Next hour UV index') : this.t('UV index'),Number.isFinite(r.uv_index) ? r.uv_index : null],
      ['visibility',current ? this.t('Next hour visibility') : this.t('Visibility'),measure(r.visibility,this.imperial ? 'mi' : 'km',this.imperial ? 1/1609.344 : .001,1)],
      ['daylight',this.t('Daylight'),r.is_day == null ? null : r.is_day ? this.t('Yes') : this.t('No')],
      ['freezing',this.t('At or below freezing'),current && Number.isFinite(r.temperature_2m) ? (r.temperature_2m <= 0 ? this.t('Yes') : this.t('No')) : null],
      ['expected',this.t('Precipitation expected next hour'),current && Number.isFinite(r.next_precipitation) ? (r.next_precipitation >= 50 ? this.t('Yes') : this.t('No')) : null],
      ['sunrise',current ? this.t('Next sunrise') : this.t('Sunrise'),timestamp(r.sunrise)],
      ['sunset',current ? this.t('Next sunset') : this.t('Sunset'),timestamp(r.sunset)],
      ['interval',this.t('Precipitation observation interval'),measure(r.interval,'min',1/60,1)],
      ['updated',this.t('Last successful update'),timestamp(r.updated_at)],
    ];
  }

  boxChoices() {
    const record = this.data?.weather?.current || {};
    const rows = this.readingRows({kind:'current',record}).filter(([key]) => key !== 'snow');
    const direction = this.compass(record.wind_direction_10m,record.wind_speed_10m);
    const night = record.is_day === 0;
    return [
      ['windSummary',this.t('Wind'),this.wind(record.wind_speed_10m),[this.t('Wind'),direction].filter(Boolean).join(' · ')],
      ['solar',this.t('Sunrise / sunset'),this.time(night ? record.sunrise : record.sunset),this.t(night ? 'Next sunrise' : 'Next sunset')],
      ...rows.map(row => row[0] === 'precipChance' ? [...row,this.t('Precipitation chance')] : row),
    ];
  }

  weatherBoxes() {
    let saved;
    try { saved = JSON.parse(this.read('weatherBoxes')); } catch { /* Use defaults. */ }
    const count = Array.isArray(saved) ? Math.min(6,Math.max(4,saved.length)) : 4;
    return boxDefaults.slice(0,count).map((key,i) => ({
      key:typeof saved?.[i]?.key === 'string' ? saved[i].key : key,
      title:typeof saved?.[i]?.title === 'string' ? saved[i].title : '',
    }));
  }

  boxContents(box,choices,index) {
    const [,label,value,shortLabel] = choices.find(row => row[0] === box.key)
      || choices.find(row => row[0] === boxDefaults[index]);
    return `<span>${escape(box.title || shortLabel || label)}</span><strong>${escape(value ?? '—')}</strong>`;
  }

  renderBoxes() {
    const boxes = this.weatherBoxes();
    const choices = this.boxChoices();
    const metrics = this.$('metrics');
    metrics.style.setProperty('--box-count',boxes.length);
    metrics.innerHTML = boxes.map((box,i) => `<div><div class="metric-content">${this.boxContents(box,choices,i)}</div></div>`).join('');
  }

  saveBoxes(boxes) {
    this.write('weatherBoxes',JSON.stringify(boxes));
    this.renderBoxes();
    this.renderBoxSettings();
  }

  renderBoxSettings() {
    const boxes = this.weatherBoxes();
    const choices = this.boxChoices();
    this.$('box-settings').innerHTML = boxes.map((box,i) => `<div class="box-row">
      <div class="box-preview">${this.boxContents(box,choices,i)}</div>
      <button type="button" data-action="edit" data-index="${i}">${escape(this.t('Edit'))}</button>
      ${i >= 4 ? `<button type="button" data-action="remove" data-index="${i}">${escape(this.t('Remove'))}</button>` : ''}
      </div>`).join('') + (boxes.length < 6 ? `<button type="button" data-action="add">${escape(this.t('Add landscape box'))}</button>` : '');
  }

  editBox(index) {
    this.editingBox = index;
    const box = this.weatherBoxes()[index];
    const choices = this.boxChoices();
    this.$('box-heading').textContent = this.t('Weather boxes') + ' · ' + (index + 1);
    this.$('box-reading').innerHTML = choices.map(([key,label]) =>
      `<option value="${key}">${escape(label)}</option>`).join('');
    this.$('box-reading').value = choices.some(([key]) => key === box.key) ? box.key : boxDefaults[index];
    this.$('box-title').value = box.title;
    this.previewBox();
    this.$('box-editor').showModal();
  }

  previewBox() {
    this.$('box-preview').innerHTML = this.boxContents({
      key:this.$('box-reading').value,title:this.$('box-title').value.trim(),
    },this.boxChoices(),this.editingBox);
  }

  hiddenReadings() {
    try {
      const value = JSON.parse(this.read('readings.' + this.reading.kind));
      return new Set(Array.isArray(value) ? value : []);
    } catch { return new Set(); }
  }

  renderReadings() {
    if (this.reading.kind === 'fishing') {
      this.renderFishingDetails();
      return;
    }
    const hidden = this.hiddenReadings();
    const visible = this.readingRows().filter(([key,,value]) => value != null && !hidden.has(key));
    const list = this.$('reading-list');
    list.innerHTML = visible.map(([,label,value]) =>
      `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');
    if (!visible.length) list.innerHTML = `<div><dt>${escape(this.t('No readings to show'))}</dt><dd>⚙</dd></div>`;
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

  async loadWeatherAlerts(request) {
    const location = this.data?.selected?.id;
    if (!location) return;
    try {
      const items = await this.call('alerts',{location});
      if (request !== this.request || location !== this.data?.selected?.id) return;
      this.weatherAlerts = {location,items};
    } catch {
      if (request !== this.request) return;
    }
    this.renderWeatherAlerts();
  }

  renderWeatherAlerts() {
    const banner = this.$('alert-banner');
    const liveItems = this.weatherAlerts?.location === this.data?.selected?.id
      ? (this.weatherAlerts?.items || []).filter(item => Date.parse(item.expires) > Date.now()) : [];
    const preview = new URLSearchParams(window.location.search).get('atmosphere_alert_preview') === '1';
    const items = preview ? [...liveItems, {
      kind:'warning', title:'Winter storm warning', area:'Sample area',
      description:'This is a simulated alert for previewing the dashboard banner. No action is required.',
      source:'preview',
    }] : liveItems;
    banner.hidden = !items.length;
    this.$('shell').classList.toggle('has-alerts',Boolean(items.length));
    if (!items.length) {
      this.$('alerts-dialog').close();
      return;
    }
    const first = items[0];
    banner.dataset.kind = first.kind;
    const alertKinds = {warning:'Warning',watch:'Watch',advisory:'Advisory'};
    const alertKind = first.source === 'preview' ? this.t('Test warning') : this.t(alertKinds[first.kind] || first.kind);
    banner.innerHTML = `<strong>${escape(alertKind)}</strong><span>${escape(first.title)}</span><b>${items.length > 1 ? '+' + (items.length - 1) : '›'}</b>`;
    const agencies = {ECCC:['Environment and Climate Change Canada','https://weather.gc.ca/warnings/'],
      NWS:['National Weather Service','https://www.weather.gov/alerts']};
    this.$('alerts-list').innerHTML = items.map(item => {
      if (item.source === 'preview') return `<article><h3>Test: Winter storm warning</h3>
        <p class="alert-description">${escape(item.description)}</p></article>`;
      const [name,url] = agencies[item.source] || ['Official weather agency',''];
      return `<article><h3>${escape(item.title)}</h3>
        <p>${escape(item.area)} · ${escape(this.t('Expires'))} ${escape(this.date(item.expires,{weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}))}</p>
        <p class="alert-description">${escape(item.description)}</p>
        <a href="${url}" target="_blank" rel="noopener">${name}</a></article>`;
    }).join('');
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
      host.innerHTML = `<h2 class="radar-title">${escape(this.t("Precipitation radar"))}</h2><p class="empty">${this.data && !this.data.radar ? this.t('Radar disabled in integration settings') : this.t('Recent radar unavailable')}</p>`;
      return;
    }
    if (this.radarGesture?.location === location.id) return;
    const latitude = Math.max(-85,Math.min(85,location.latitude)) * Math.PI / 180;
    const home = {x:(location.longitude + 180)/360,y:(1-Math.asinh(Math.tan(latitude))/Math.PI)/2};
    if (this.radarCenter?.location !== location.id) this.radarCenter = {...home,location:location.id};
    const center = this.radarCenter;
    const zoom = this.radarZoom ?? 6;
    const signature = `${this.language}:${location.id}:${frame.time}:${this.frames.length}:${zoom}:${center.x}:${center.y}:${host.clientWidth}:${host.clientHeight}`;
    if (host.firstElementChild?.dataset.signature === signature) {
      this.drawWindRose();
      return;
    }
    const layers = [];
    const addTiles = (sourceZoom,overlay) => {
      const size = 2 ** sourceZoom;
      // At closer views, scale the existing radar tiles in their native map projection.
      const tileSize = 256 * 2 ** (zoom-sourceZoom);
      const x = center.x*size;
      const y = center.y*size;
      const halfWidth = (host.clientWidth || 512)/(2*tileSize);
      const halfHeight = (host.clientHeight || 384)/(2*tileSize);
      for (let column = Math.floor(x-halfWidth); column <= Math.floor(x+halfWidth); column++) {
        for (let row = Math.max(0,Math.floor(y-halfHeight)); row <= Math.min(size-1,Math.floor(y+halfHeight)); row++) {
          const wrapped = (column % size + size) % size;
          const style = `left:calc(50% + ${Math.round((column-x)*tileSize)}px);top:calc(50% + ${Math.round((row-y)*tileSize)}px);width:${tileSize}px;height:${tileSize}px`;
          const url = overlay
            ? `https://tilecache.rainviewer.com${frame.path}/256/${sourceZoom}/${wrapped}/${row}/2/1_1.png`
            : `/api/map_tiles/raster/${sourceZoom}/${wrapped}/${row}.png?token=${encodeURIComponent(this.mapTileToken)}`;
          layers.push(`<img class="${overlay ? 'overlay' : 'base-tile'}" referrerpolicy="no-referrer" alt="" src="${escape(url)}" style="${style}">`);
        }
      }
    };
    if (this.mapTileToken) addTiles(zoom,false);
    addTiles(Math.min(zoom,7),true);
    const worldPixels = 256 * 2 ** zoom;
    const homeX = ((home.x-center.x+1.5)%1-.5)*worldPixels;
    const homeY = (home.y-center.y)*worldPixels;
    host.innerHTML = `<div class="radar-content" data-signature="${signature}">
      <div class="heading radar-heading"><h2 class="radar-title">${escape(this.t("Precipitation radar"))}</h2>
        <div class="radar-tools" role="group" aria-label="Radar map controls">
          <button type="button" id="wind-rose-toggle" aria-pressed="false">${escape(this.t("Wind rose"))}</button>
          <button type="button" id="radar-out" aria-label="${escape(this.t("Zoom out radar"))}" ${zoom <= 3 ? 'disabled' : ''}>−</button>
          <button type="button" id="radar-in" aria-label="${escape(this.t("Zoom in radar"))}" ${zoom >= 10 ? 'disabled' : ''}>+</button>
          <button type="button" id="radar-center" aria-label="${escape(this.t("Recenter radar"))}" title="${escape(this.t("Recenter radar"))}">⌖</button>
        </div>
      </div>
      <div class="radar-map-area">
        <div class="map" role="img" aria-label="Recent observed precipitation near ${escape(location.name)}"><div class="radar-plane">${layers.join('')}<span class="pin" style="left:calc(50% + ${homeX}px);top:calc(50% + ${homeY}px)"></span></div></div>
        <aside class="wind-rose" hidden><strong>${escape(this.t("Wind · next 24 hours"))}</strong>
          <canvas width="176" height="176" role="img" aria-label="Forecast wind rose"></canvas>
          <small class="wind-rose-key"></small>
        </aside>
      </div>
      <div class="radar-controls"><input type="range" id="radar-time" min="0" max="${this.frames.length - 1}" value="${this.frameIndex}" aria-label="${escape(this.t("Observed radar time"))}">
      <span>${this.time(frame.time * 1000)}</span></div>
      <small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> ·
      <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>${zoom > 7 ? ' · Radar enlarged' : ''} <span class="radar-tile-status" role="status"></span></small></div>`;
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
    const zoomRadar = (change,id) => {
      this.radarZoom = Math.min(10,Math.max(3,zoom + change));
      this.renderRadar();
      const control = this.$(id);
      (control.disabled ? this.$(change > 0 ? 'radar-out' : 'radar-in') : control).focus({preventScroll:true});
    };
    this.bindRadarGestures(host.querySelector('.map'),center,zoom);
    this.$('radar-center').onclick = () => {
      this.radarCenter = {...home,location:location.id};
      this.renderRadar();
      this.$('radar-center').focus({preventScroll:true});
    };
    this.$('radar-out').onclick = () => zoomRadar(-1,'radar-out');
    this.$('radar-in').onclick = () => zoomRadar(1,'radar-in');
    this.$('wind-rose-toggle').onclick = () => {
      this.windRoseEnabled = !(this.windRoseEnabled ?? (this.read('windRose') === '1'));
      this.write('windRose',this.windRoseEnabled ? '1' : '0');
      this.drawWindRose();
    };
    this.drawWindRose();
    this.$('radar-time').onchange = event => {
      this.frameIndex = Number(event.target.value);
      this.renderRadar();
      this.$('radar-time').focus();
    };
  }

  bindRadarGestures(map,center,zoom) {
    const pointers = new Map();
    const plane = map.querySelector('.radar-plane');
    let start, movement;
    const measure = () => {
      const [first,second] = pointers.values();
      if (!second) return {...first,distance:0};
      return {x:(first.x+second.x)/2,y:(first.y+second.y)/2,
        distance:Math.hypot(first.x-second.x,first.y-second.y)};
    };
    map.onpointerdown = event => {
      if (event.button !== 0 || pointers.size >= 2) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      map.setPointerCapture(event.pointerId);
      start = measure();
      movement = null;
      plane.style.transform = '';
      this.radarGesture = {location:center.location};
      map.classList.add('dragging');
    };
    map.onpointermove = event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      const point = measure();
      const dx = point.x-start.x, dy = point.y-start.y;
      const ratio = start.distance > 0 ? Math.max(.25,Math.min(4,point.distance/start.distance)) : 1;
      movement = {dx,dy,ratio};
      const rect = map.getBoundingClientRect();
      plane.style.transformOrigin = `${start.x-rect.left}px ${start.y-rect.top}px`;
      plane.style.transform = `translate(${dx}px,${dy}px) scale(${ratio})`;
    };
    const finish = (event,commit) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.clear();
      plane.style.transform = '';
      map.classList.remove('dragging');
      if (this.radarGesture?.location === center.location) this.radarGesture = null;
      if (!commit || !movement || this.data?.selected?.id !== center.location) return;

      const nextZoom = Math.min(10,Math.max(3,zoom + Math.round(Math.log2(movement.ratio))));
      const bounds = map.getBoundingClientRect();
      const anchorX = start.x-bounds.left-bounds.width/2;
      const anchorY = start.y-bounds.top-bounds.height/2;
      const previousScale = 256*2**zoom;
      const nextScale = 256*2**nextZoom;
      const x = center.x + anchorX/previousScale - (anchorX+movement.dx)/nextScale;
      const y = center.y + anchorY/previousScale - (anchorY+movement.dy)/nextScale;
      this.radarCenter = {location:center.location,x:(x%1+1)%1,y:Math.max(0,Math.min(1,y))};
      this.radarZoom = nextZoom;
      this.renderRadar();
    };
    map.onpointerup = event => finish(event,true);
    map.onpointercancel = map.onlostpointercapture = event => finish(event,false);
  }

  drawWindRose() {
    const host = this.$('radar');
    const rose = host.querySelector('.wind-rose');
    if (!rose) return;
    const enabled = this.windRoseEnabled ?? (this.read('windRose') === '1');
    rose.hidden = !enabled;
    this.$('wind-rose-toggle').setAttribute('aria-pressed',String(enabled));
    if (!enabled) return;

    const sectors = Array.from({length:8},() => [0,0,0]);
    const directions = ['N','NE','E','SE','S','SW','W','NW'];
    let sampleCount = 0, calm = 0;
    for (const hour of (this.data?.weather?.hourly || []).slice(0,24)) {
      const speed = hour.native_wind_speed;
      if (!Number.isFinite(speed) || speed < 0) continue;
      if (speed < 1) { calm++; sampleCount++; continue; }
      const direction = this.compass(hour.wind_bearing,speed);
      const index = directions.indexOf(direction);
      if (index < 0) continue;
      sectors[index][speed < 10 ? 0 : speed < 25 ? 1 : 2]++;
      sampleCount++;
    }
    const canvas = rose.querySelector('canvas');
    const key = rose.querySelector('.wind-rose-key');
    canvas.hidden = !sampleCount;
    if (!sampleCount) {
      key.textContent = this.t('Wind forecast unavailable');
      return;
    }
    const totals = sectors.map(bands => bands.reduce((sum,count) => sum + count,0));
    const maximum = Math.max(1,...totals);
    const colors = ['#8dd7f7','#f9c96c','#ff8a60'];
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0,0,176,176);
    ctx.save();
    ctx.translate(88,88);
    ctx.strokeStyle = '#d4e3f458';
    for (const radius of [20,40,60]) {
      ctx.beginPath();
      ctx.arc(0,0,radius,0,Math.PI*2);
      ctx.stroke();
    }
    directions.forEach((direction,index) => {
      const angle = (index-2)*Math.PI/4;
      let from = 0;
      sectors[index].forEach((count,band) => {
        if (!count) return;
        const to = from + count*60/maximum;
        ctx.beginPath();
        ctx.arc(0,0,to,angle-.29,angle+.29);
        if (from) ctx.arc(0,0,from,angle+.29,angle-.29,true); else ctx.lineTo(0,0);
        ctx.closePath();
        ctx.fillStyle = colors[band];
        ctx.fill();
        from = to;
      });
      ctx.fillStyle = '#eef5fa';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(direction,Math.cos(angle)*74,Math.sin(angle)*74);
    });
    ctx.restore();
    const strongest = totals.indexOf(Math.max(...totals));
    const dominant = totals[strongest] ? directions[strongest] + ' most frequent' : 'Calm';
    canvas.setAttribute('aria-label',`Wind from: ${dominant}, ${sampleCount} forecast hours, ${calm} calm`);
    const labels = this.imperial ? ['<6.2','6.2–15.5','≥15.5 mph'] : ['<10','10–25','≥25 km/h'];
    key.innerHTML = labels.map((label,index) =>
      `<span><i style="background:${colors[index]}"></i>${escape(label)}</span>`).join('');
  }

  renderAppearanceSettings() {
    this.renderBoxSettings();
    const content = this.$('appearance-settings');
    content.innerHTML = `<div class="themes">${themes.map(([id,name,bg,,accent]) =>
      `<button data-theme-choice="${id}" aria-pressed="${this.theme === id}"><i style="background:${bg};border-color:${accent}"></i>${escape(this.t(name))}</button>`).join('')}</div>
      <label class="units">${escape(this.t("Units"))} <select id="units" aria-label="Units"><option value="metric">${escape(this.t("Metric"))}</option><option value="imperial">${escape(this.t("Imperial"))}</option></select></label>`;
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
  }

  fishName(id) {
    return this.t(id.replaceAll('_',' ').replace(/^./, ch => ch.toUpperCase()));
  }

  renderFishingSummary(enabled, forecast) {
    this.$('fishing-tab').hidden = !enabled;
    const summary = this.$('fishing-summary');
    summary.hidden = !enabled;
    const now = Date.now()/1000;
    const scores = (this.data?.selected?.fishing_species || []).flatMap(species => {
      const hour = forecast?.[species]?.flatMap(day => day.hours).find(h => h.time <= now && now < h.time+3600);
      return hour ? [[species,Math.round(hour.score)]] : [];
    });
    const best = Math.max(...scores.map(([,score]) => score));
    const label = !scores.length ? 'Fishing forecast unavailable' : best >= 7 ? 'Good fishing now'
      : best >= 4 ? 'Fair fishing now' : 'Poor fishing now';
    summary.innerHTML = `<strong>${escape(this.t(label))}</strong>` + scores.map(([species,score]) =>
      `<span>${escape(this.fishName(species))} ${score}/10</span>`).join('');
  }

  renderFishingForecast(forecast) {
    const species = (this.data.selected.fishing_species || []).slice(0,4);
    const dates = new Map();
    for (const fish of species) {
      for (const day of forecast?.[fish] || []) {
        if (!day.hours.length) continue;
        if (!dates.has(day.date)) dates.set(day.date,{time:day.hours[0].time*1000,fish:new Map()});
        dates.get(day.date).fish.set(fish,day);
      }
    }
    this.fishingDays = [...dates.keys()].sort().map(date => dates.get(date));
    this.$('periods').innerHTML = `<div class="fishing-forecast periods daily" style="--fishing-days:${Math.max(1,this.fishingDays.length)}">${this.fishingDays.length
      ? this.fishingDays.map((day,index) => `<button class="period fishing-day" type="button" data-reading="fishing" data-period="${index}">
        <small>${escape(this.date(day.time,{weekday:'short'}))}<span>${escape(this.date(day.time,{day:'numeric'}))}</span></small>
        <span class="fishing-scores">${species.map(fish => {
          const hours = day.fish.get(fish)?.hours;
          const peak = hours?.length ? Math.max(...hours.map(hour => hour.score)) : null;
          return `<span><span>${escape(this.fishName(fish))}</span><strong>${peak == null ? '—' : peak+'/10'}</strong></span>`;
        }).join('')}</span></button>`).join('')
      : `<p>${escape(this.t('Fishing forecast unavailable'))}</p>`}</div>`;
  }

  renderFishingDetails() {
    const time = seconds => this.time(seconds*1000);
    const labels = {temp:'Temperature',cloud:'Cloud cover',pressure:'Pressure',
      wind:'Wind',rain:'Precipitation accumulation',twilight:'Sunrise / sunset',moon:'Moon'};
    this.$('reading-list').innerHTML = [...this.reading.record.fish].map(([fish,day]) => {
      const peak = Math.max(...day.hours.map(hour => hour.score));
      const best = day.windows.reduce((a,b) => !a || b.score > a.score ? b : a,null);
      const reasons = best ? [...new Set(day.hours.filter(hour => hour.time >= best.start && hour.time < best.end)
        .flatMap(hour => hour.factors || []))].slice(0,3) : [];
      return `<div class="fishing-detail"><dt>${escape(this.fishName(fish))}</dt><dd>
        <p>${escape(this.t('Daily score'))} ${day.score}/10 · ${escape(this.t('Peak score'))} ${peak}/10</p>
        ${best ? `<p>${escape(this.t('Best fishing window'))} · ${escape(time(best.start))} – ${escape(time(best.end))}</p>` : ''}
        ${reasons.length ? `<p>${reasons.map(key => escape(this.t(labels[key]))).join(' · ')}</p>` : ''}
        <div class="fishing-hours">${day.hours.map(hour => `<span>${escape(time(hour.time))} · ${hour.score}/10</span>`).join('')}</div>
        </dd></div>`;
    }).join('');
  }

  renderFishingSettings() {
    const host = this.$('fishing-settings');
    if (!this._hass?.user?.is_admin || !this.data?.fish_species) {
      host.replaceChildren();
      return;
    }
    const enabled = this.data.fishing_enabled;
    host.innerHTML = `<h3>${escape(this.t('Fishing forecasts'))}</h3>
      <label><input type="checkbox" id="enable-fishing" ${enabled ? 'checked' : ''}> ${escape(this.t('Fishing forecasts'))}</label>
      ${enabled ? this.data.locations.map((location,index) => `<div class="box-row"><span class="box-preview">
        ${escape(location.name)} · ${escape(this.t(location.fishing_enabled ? 'On' : 'Off'))}</span>
        <button type="button" data-fishing-location="${index}">${escape(this.t('Edit'))}</button></div>`).join('') : ''}
      <p id="fishing-status" role="status"></p>`;
    host.querySelector('#enable-fishing').onchange = event => this.saveFishing({enabled:event.target.checked});
    host.querySelectorAll('[data-fishing-location]').forEach(button => {
      button.onclick = () => this.editFishing(this.data.locations[Number(button.dataset.fishingLocation)]);
    });
  }

  async saveFishing(data, editor) {
    const notice = editor?.querySelector('[role=status]') || this.$('fishing-status');
    try {
      await this.call('save_fishing',data);
      if (data.location) {
        const location = this.data.locations.find(item => item.id === data.location);
        Object.assign(location,{fishing_enabled:data.enabled,fishing_water:data.water,fishing_species:data.species});
        if (this.data.selected?.id === location.id) Object.assign(this.data.selected,location);
      } else this.data.fishing_enabled = data.enabled;
      editor?.close();
      this.renderFishingSettings();
      this.render();
      setTimeout(() => this.refresh(10),750);
    } catch (error) {
      notice.textContent = error.message || this.t('Fishing forecast unavailable');
      if (!editor) this.$('enable-fishing').checked = this.data.fishing_enabled;
    }
  }

  editFishing(location) {
    const editor = this.$('fishing-editor');
    const form = this.$('fishing-form');
    this.$('fishing-title').textContent = location.name + ' · ' + this.t('Fishing');
    const option = id => `<option value="${escape(id)}">${escape(this.fishName(id))}</option>`;
    form.innerHTML = `
      <label><input type="checkbox" name="enabled" ${location.fishing_enabled ? 'checked' : ''}> ${escape(this.t('Fishing forecasts'))}</label>
      <label>${escape(this.t('Water type'))}<select name="water">${['lake','river','pond','reservoir'].map(option).join('')}</select></label>
      <fieldset><legend>${escape(this.t('Fish species'))}</legend>
        ${Array.from({length:4},(_,i) => `<label>${escape(this.t('Fish species'))} ${i+1}
          <select name="species"><option value="">—</option>${this.data.fish_species.map(option).join('')}</select></label>`).join('')}
      </fieldset><p role="status"></p>
      <div class="actions"><button type="button" id="fishing-cancel">${escape(this.t('Cancel'))}</button>
      <button type="submit">${escape(this.t('Save'))}</button></div>`;
    form.elements.water.value = location.fishing_water || 'lake';
    const slots = [...form.querySelectorAll('[name=species]')];
    slots.forEach((slot,i) => slot.value = location.fishing_species?.[i] || '');
    form.querySelector('#fishing-cancel').onclick = () => editor.close();
    form.onsubmit = async event => {
      event.preventDefault();
      const species = slots.map(slot => slot.value).filter(Boolean);
      const enabled = form.elements.enabled.checked;
      if ((enabled && !species.length) || new Set(species).size !== species.length) {
        form.querySelector('[role=status]').textContent = this.t('Choose one to four different fish species.');
        return;
      }
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      await this.saveFishing({location:location.id,enabled,water:form.elements.water.value,species},editor);
      submit.disabled = false;
    };
    editor.showModal();
  }

  renderLocationSettings() {
    this.renderFishingSettings();
    this.$('notice').textContent = '';
    const content = this.$('location-settings');
    const locations = this.data?.locations || [];
    const admin = this._hass?.user?.is_admin;
    content.innerHTML = `<ul class="locations">${locations.map(location => `<li><span>${escape(location.name)}</span>
      ${admin ? `<button data-edit="${escape(location.id)}">${escape(this.t("Edit"))}</button>` : ''}</li>`).join('')}</ul>
      ${admin ? `<button id="add">${escape(this.t("Add location"))}</button><div id="editor"></div>` : '<p>Ask a Home Assistant administrator to manage locations.</p>'}`;
    if (!admin) return;
    this.$('add').onclick = () => this.locationForm();
    content.querySelectorAll('[data-edit]').forEach(button => button.onclick = () =>
      this.locationForm(locations.find(item => item.id === button.dataset.edit)));
    if (!locations.length) this.locationForm();
  }

  renderLocationControls() {
    const location = this.data?.selected;
    const states = this._hass?.states;
    this.thermostatControls?.update();
    const thermostat = this.$('thermostat');
    const climate = location?.is_home && states?.[location.thermostat_entity];
    thermostat.hidden = !climate;
    if (climate) {
      const temperature = climate.attributes.current_temperature ?? climate.attributes.temperature;
      const unit = this._hass.config?.unit_system?.temperature || '';
      const label = temperature == null ? this.t('Thermostat') : `${this.t('Thermostat')} · ${temperature}${unit}`;
      if (thermostat.textContent !== label) thermostat.textContent = label;
    }
    const camera = states?.[location?.camera_entity];
    const url = location?.camera_url;
    const preview = this.$('camera-preview');
    const cameraKey = JSON.stringify([location?.id,camera?.entity_id,url,location?.camera_video]);
    if (cameraKey !== this.cameraKey) {
      this.cameraKey = cameraKey;
      this.$('camera-fullscreen').close();
      this.cameraMedia?.remove();
      this.cameraMedia = null;
      preview.hidden = !camera && !url;
      this.$('hero-layout').classList.toggle('with-camera',!preview.hidden);
      if (camera || url) {
        const media = document.createElement('span');
        media.className = 'camera-media';
        preview.append(media);
        this.cameraMedia = media;
        if (camera) this.loadEntityCamera(media,camera);
        else {
          const player = document.createElement(location.camera_video ? 'video' : 'img');
          player.referrerPolicy = 'no-referrer';
          if (location.camera_video) {
            player.autoplay = true;
            player.muted = true;
            player.playsInline = true;
            player.addEventListener('ended', () => {
              if (!player.isConnected || this.cameraMedia !== media) return;
              // Public clip URLs stay the same when the provider replaces the file.
              const latest = new URL(url);
              latest.searchParams.set('_atmosphere_clip', String(Date.now()));
              player.src = latest.href;
            });
          } else player.alt = '';
          player.addEventListener('error',() => { media.textContent = this.t('Camera unavailable'); },{once:true});
          player.src = url;
          media.append(player);
        }
      }
    }
    if (this.cameraCard && this.cameraMedia?.contains(this.cameraCard)) this.cameraCard.hass = this._hass;
  }

  async loadEntityCamera(media,camera) {
    try {
      const helpers = await window.loadCardHelpers();
      if (this.cameraMedia !== media) return;
      const card = helpers.createCardElement({
        type:'picture-entity', entity:camera.entity_id, camera_view:'live',
        show_name:false, show_state:false, tap_action:{action:'none'}, hold_action:{action:'none'},
      });
      this.cameraCard = card;
      card.hass = this._hass;
      media.append(card);
    } catch {
      if (this.cameraMedia !== media) return;
      const image = document.createElement('img');
      image.alt = '';
      const token = camera.attributes.access_token;
      if (!token) {
        media.textContent = this.t('Camera unavailable');
        return;
      }
      image.addEventListener('error',() => { media.textContent = this.t('Camera unavailable'); },{once:true});
      image.src = `/api/camera_proxy_stream/${encodeURIComponent(camera.entity_id)}?token=${encodeURIComponent(token)}`;
      media.append(image);
    }
  }

  entityOptions(domain,selected) {
    const entities = Object.values(this._hass?.states || {}).filter(item => item.entity_id.startsWith(domain + '.'));
    entities.sort((a,b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id));
    return `<option value="">${escape(this.t("None"))}</option>` + entities.map(item =>
      `<option value="${escape(item.entity_id)}" ${item.entity_id === selected ? 'selected' : ''}>${escape(item.attributes.friendly_name || item.entity_id)} (${escape(item.entity_id)})</option>`).join('');
  }

  locationForm(location) {
    const box = this.$('editor');
    box.innerHTML = `
      ${location ? '' : `<form id="search"><label>${escape(this.t("City or postal code"))} <input name="query" required minlength="2" maxlength="100"></label><button>${escape(this.t("Search"))}</button></form><div id="results"></div>`}
      <form id="save" class="location-form">
        <label>${escape(this.t("Name"))} <input name="name" maxlength="80" required value="${escape(location?.name)}"></label>
        <div class="coordinates">
        <label>${escape(this.t("Latitude"))} <input name="latitude" type="number" step="any" min="-90" max="90" required value="${escape(location?.latitude)}"></label>
        <label>${escape(this.t("Longitude"))} <input name="longitude" type="number" step="any" min="-180" max="180" required value="${escape(location?.longitude)}"></label>
        </div>
        <label>${escape(this.t("Time zone"))} <input name="timezone" required placeholder="Europe/Paris" value="${escape(location?.timezone || this._hass?.config?.time_zone)}"></label>
        <label>${escape(this.t("Home Assistant camera"))} <select name="camera_entity">${this.entityOptions('camera',location?.camera_entity)}</select></label>
        <label>${escape(this.t("Or direct camera URL"))} <input name="camera_url" type="url" maxlength="2048" placeholder="https://…" value="${escape(location?.camera_url)}"></label>
        <label>${escape(this.t("Direct camera format"))} <select name="camera_video">
          <option value="false">${escape(this.t("MJPEG or image"))}</option>
          <option value="true" ${location?.camera_video ? 'selected' : ''}>${escape(this.t("Browser video (MP4 or native HLS)"))}</option>
        </select></label>
        ${location?.is_home ? `<label>${escape(this.t("Home thermostat"))} <select name="thermostat_entity">${this.entityOptions('climate',location.thermostat_entity)}</select></label>` : ''}
        <div class="actions"><button>${escape(this.t("Save location"))}</button>${location ? `<button id="remove" type="button">${escape(this.t("Remove"))}</button>` : ''}</div>
      </form>`;
    const form = this.$('save');
    const notice = this.$('notice');
    if (!location) this.$('search').onsubmit = async event => {
      event.preventDefault();
      const search = event.target;
      const results = this.$('results');
      notice.textContent = this.t('Searching…');
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
      notice.textContent = this.t('Saving…');
      try {
        const changed = await this.call(action,data);
        if (changed?.location) {
          this.selection = changed.location;
          this.write('location',this.selection);
        }
        this.frames = [];
        this.radarKey = null;
        await this.refresh(8);
        this.renderLocationSettings();
        notice.textContent = action === 'remove_location' ? this.t('Location removed') : this.t('Location saved');
      } catch (error) { notice.textContent = error.message || 'Unable to save'; }
      finally { form.querySelectorAll('button').forEach(button => button.disabled = false); }
    };
    form.onsubmit = event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      values.camera_video = values.camera_video === 'true';
      if (location) values.location = location.id;
      mutate('save_location',values);
    };
    if (location) this.$('remove').onclick = event => {
      const button = event.currentTarget;
      if (button.dataset.confirm) return mutate('remove_location',{location:location.id});
      button.dataset.confirm = 'true';
      button.textContent = this.t('Confirm removal');
      notice.textContent = 'Automations using this location’s entities will lose their source.';
    };
  }
}

const CSS = `
:host{display:block;container-type:inline-size}
*{box-sizing:border-box}
main{--ink:#edf3f5;--muted:#b3c5d2;--line:#ffffff20;--font:Manrope,"Avenir Next",system-ui,sans-serif;
 color-scheme:dark;color:var(--ink);background:var(--bg,#101923);font:14px var(--font);font-variant-numeric:tabular-nums;
 display:grid;grid-template-rows:42px minmax(130px,.9fr) calc(67px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(190px,1.1fr) auto;gap:12px;padding:16px 24px;
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
@media (orientation:landscape){.metrics{grid-template-columns:repeat(var(--box-count,4),minmax(0,1fr))}}
@media (orientation:portrait){#shell .metrics>div:nth-child(n+5){display:none}}
.metrics>div{overflow:hidden}.metrics>div>*{min-width:0;overflow:hidden;text-overflow:ellipsis}
.box-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.box-preview{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 12px;flex:1;min-width:0;overflow-wrap:anywhere}
.box-preview strong{display:block}
#box-form{display:grid;gap:12px}#box-form label{display:grid;gap:4px}
.metric-content{display:contents}
.metrics>div,.panel{background:var(--surface);border:1px solid var(--line);border-radius:13px;min-width:0;padding:12px}
.metrics span,.period span,.period small,footer,.radar-content small,.empty{color:var(--muted);font-size:.78em}
.metrics strong{display:block;margin-top:4px;font-size:1.15em}.metrics span{display:block}
.outlook{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}.panel{display:flex;flex-direction:column;gap:8px;min-height:0}
h2{margin:0;font-size:1.08em}.tabs{display:flex;gap:5px}.tabs button{font-size:.8em}.mobile-tab{display:none}
#periods,#radar{flex:1;min-height:0}.periods{height:100%;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}
.periods.daily{grid-template-columns:repeat(7,minmax(0,1fr))}.period{display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;gap:4px;text-align:center;min-width:0}
.period .icon{color:var(--accent);font-size:1.75em}.period strong{font-size:1.45em}.empty{text-align:center;margin-top:24px}
.radar-content{height:100%;display:grid;grid-template-rows:auto minmax(55px,1fr) auto auto;gap:4px}.map{position:relative;overflow:hidden;border-radius:8px;background:#263947}
.radar-tile-status:not(:empty)::before{content:" · "}.map img{position:absolute;width:256px;height:256px;max-width:none}.map .overlay{opacity:.8}.pin{position:absolute;top:50%;left:50%;translate:-50% -50%;background:#ffcc66;width:10px;height:10px;border:2px solid #403319;border-radius:50%;box-shadow:0 0 0 4px #ffcc6666}
.radar-controls input{width:75%;padding:0;accent-color:var(--accent)}.radar-controls span{font-size:.75em}
footer a,.radar-content a{color:inherit}footer{gap:8px}
dialog{width:min(570px,calc(100vw - 24px));max-height:calc(100dvh - 28px);overflow:auto;
 color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:18px}
dialog::backdrop{background:#071019aa}.themes,.coordinates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.themes button{display:flex;gap:8px;align-items:center;text-align:left}.themes i{width:23px;height:23px;flex:none;border:2px solid;border-radius:50%}
.locations{list-style:none;padding:0}.locations li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)}
.location-form,#search{display:grid;gap:8px;margin-top:12px}label{display:grid;gap:4px;font-size:.88em}label input{min-width:0}
#results{display:grid;gap:4px;margin-top:6px}#notice{color:var(--accent);margin-bottom:0}.units{margin-top:12px}
main[data-theme=neon] .panel{box-shadow:inset 0 0 24px #28deef14}
@container(max-width:900px){.hourly .period:nth-child(n+7){display:none}.periods.hourly{grid-template-columns:repeat(6,minmax(0,1fr))}}
@container(max-width:700px){
 main{min-height:510px;padding:8px 12px;gap:8px;grid-template-rows:38px minmax(112px,.8fr) calc(64px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(170px,1fr) auto}
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
 position:relative;grid-template-rows:clamp(60px,10vh,100px) minmax(130px,.9fr) calc(65px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(190px,1.1fr) auto;
}
main[data-theme=trek]::before{
 content:"";position:absolute;inset:16px auto 30px 8px;width:var(--rail);border-radius:44px 0 0 44px;
 background:linear-gradient(var(--gold) 0 18%,#050505 18% 18.6%,var(--blue) 18.6% 30%,#050505 30% 30.6%,var(--orange) 30.6% 68%,#050505 68% 68.6%,var(--blue) 68.6% 80%,#050505 80% 80.6%,#dd8a24 80.6%);
}
main[data-theme=trek]>header{
 border-bottom:10px solid transparent;border-radius:0 38px 0 24px;padding:0 18px 4px 10px;
 background:linear-gradient(#050505,#050505) padding-box,linear-gradient(90deg,var(--gold) 0 42%,#050505 42% 43%,var(--orange) 43% 55%,#050505 55% 56%,var(--blue) 56% 82%,#050505 82% 83%,var(--gold) 83%) border-box;
}
main[data-theme=trek] .brand{min-width:0;gap:12px;font-size:clamp(22px,4cqw,66px);text-transform:uppercase;line-height:1}
main[data-theme=trek] .brand>span,main[data-theme=trek] .gear{display:none}
main[data-theme=trek] .brand img{width:clamp(42px,7cqh,82px);aspect-ratio:1;object-fit:contain;border-radius:50%;flex:none}
main[data-theme=trek]>header>.actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;justify-items:end}
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
 main[data-theme=trek]{--rail:8px;padding:8px 8px 8px 21px;grid-template-rows:58px minmax(110px,.7fr) calc(66px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(185px,1fr) auto}
 main[data-theme=trek]::before{inset-block:8px 24px;border-radius:8px 0 0 8px}
 main[data-theme=trek]>header{border-bottom-width:6px;padding:0 2px 3px;border-radius:0 0 0 12px}
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
main[data-theme=trek]>header{border-bottom-width:14px;border-radius:0 36px 0 27px}
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
 main[data-theme=trek]>header{border-bottom-width:6px}
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

/* Size the readout against the space inside its own instrument frame. */
main[data-theme=trek] .metrics>div{container:instrument / inline-size;display:grid;grid-template-columns:minmax(0,1fr);align-content:center;
 --cap:clamp(4px,5%,20px);padding:6px calc(var(--cap) + 4px)}
main[data-theme=trek] .metric-content{display:flex;align-items:center;justify-content:space-between;
 flex-direction:row-reverse;gap:2px 6px;min-width:0}
main[data-theme=trek] .metric-content strong{font-size:clamp(12px,9cqi,26px);line-height:1.12;
 white-space:normal;overflow-wrap:anywhere}
main[data-theme=trek] .metric-content span{font-size:clamp(10px,5cqi,15px);line-height:1.12;
 overflow-wrap:anywhere;text-align:right}
@container instrument (max-width:215px){
 main[data-theme=trek] .metric-content{align-items:flex-start;flex-direction:column-reverse}
 main[data-theme=trek] .metric-content span{text-align:left}
}

main[data-theme=trek]>header{
 --emblem:clamp(68px,9.2cqw,108px);
 --brand-gap:clamp(5px,.65cqw,10px);
 --header-inset:4px;
 position:relative;border-bottom:0;background:#050505;
 padding:0 14px 12px var(--header-inset);
}
main[data-theme=trek]>header::after{
 content:"";position:absolute;left:calc(var(--header-inset) + var(--emblem) + var(--brand-gap));
 right:0;bottom:0;height:10px;pointer-events:none;
 background:linear-gradient(90deg,var(--gold) 0 47%,#050505 47% 48%,var(--orange) 48% 63%,#050505 63% 64%,var(--blue) 64% 86%,#050505 86% 87%,var(--gold) 87%);
}
main[data-theme=trek] .brand{gap:var(--brand-gap)}
main[data-theme=trek] .brand img{width:var(--emblem);position:relative;top:6px;z-index:1}
main[data-theme=trek]{
 --header-row:clamp(87px,13vh,118px);
 grid-template-rows:minmax(var(--header-row),max-content) minmax(130px,.9fr) calc(65px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(190px,1.1fr) auto;
}
@container(max-width:700px){
 main[data-theme=trek]{grid-template-rows:61px minmax(110px,.7fr) calc(66px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(185px,1fr) auto}
 main[data-theme=trek]>header{--emblem:clamp(36px,10.4cqw,48px);--brand-gap:4px;--header-inset:2px;padding:0 2px 7px}
 main[data-theme=trek]>header::after{height:5px}
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
   min-height:465px;gap:6px;grid-template-rows:auto minmax(104px,.65fr) calc(63px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(194px,1fr) auto;
 }
 main[data-theme=trek]>header{min-height:56px}
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

#fishing-tab[hidden],#fishing-summary[hidden]{display:none}
#fishing-summary{display:flex;justify-content:center;gap:4px 12px;flex-wrap:wrap;width:100%;margin-bottom:5px;padding:5px 8px;font-size:clamp(11px,1.3cqw,16px);color:var(--ink)}
#periods .fishing-forecast{grid-template-columns:repeat(var(--fishing-days),minmax(0,1fr));grid-template-rows:minmax(0,1fr);gap:clamp(2px,.55cqw,8px)}
#periods .fishing-day{display:flex;flex-direction:column;justify-content:flex-start;gap:3px;width:100%;padding:4px 1px;overflow:visible}
#periods .fishing-day>small{width:100%;font-size:clamp(10px,2.8cqw,19px);line-height:1.05}
.fishing-day>small span{display:block}
#periods .fishing-scores{width:100%;display:grid;flex:1;grid-template-rows:repeat(4,minmax(min-content,1fr));gap:2px}
#periods .fishing-scores>span{display:grid;align-content:center;min-width:0;padding:2px 0;border-bottom:1px solid var(--line)}
#periods .fishing-scores>span>span{font-size:clamp(8px,2.35cqw,15px);line-height:1.05;overflow-wrap:anywhere}
#periods .fishing-scores strong{display:block;font-size:clamp(10px,2.7cqw,20px);line-height:1.05}
.fishing-forecast>p{grid-column:1/-1}
#weather-details #reading-list>.fishing-detail{display:block;padding:8px 0;min-width:0}
#reading-list .fishing-detail dd{text-align:left;font-weight:400}
.fishing-detail p{margin:4px 0}
#reading-gear[hidden]{display:none}
.fishing-hours,#fishing-form fieldset{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}
#fishing-form{display:grid;gap:10px}
#fishing-form label{display:block;min-width:0}
#fishing-form select{display:block;width:100%;min-width:0}
#fishing-settings>label{display:block;margin-bottom:8px}
#desktop-radar-slot,#mobile-radar-slot{flex:1;min-height:0;display:flex;flex-direction:column}
#mobile-radar-slot{display:none}
@container(max-width:700px){
 .forecast .heading{flex-direction:column;align-items:stretch;gap:6px}
 .forecast .tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .has-fishing .forecast .tabs{grid-template-columns:repeat(4,minmax(0,1fr))}
 .has-fishing .forecast .tabs button{font-size:clamp(10px,3cqw,14px);padding-inline:3px}
 .forecast .tabs button{width:100%;min-height:42px;font-size:15px;padding:6px 8px}
 main[data-tab=radar] #periods{display:none}
 main[data-tab=radar] #mobile-radar-slot{display:flex}
 main[data-tab=radar]{grid-template-rows:auto minmax(104px,.3fr) calc(63px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(194px,1fr) auto}
}

/* Reserve room for precipitation totals across all framed forecast columns. */
main[data-theme=trek] .period .chance{
 line-height:1.15;
 min-height:calc(2.3em + 6px);
 flex:none;
}
main[data-theme=trek] .period .chance .accumulation{
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

#settings .gear{font-size:24px;line-height:1}
#reading-gear,#reading-close,#reading-settings-close,#close{
 min-width:46px;min-height:46px;font:normal 26px/1 system-ui,sans-serif;
 display:grid;place-items:center;padding:4px;
}
#reading-gear{font-size:29px}
#dialog>.heading{position:sticky;top:-18px;z-index:2;padding-block:4px;background:var(--bg)}
#settings-content>section{padding:14px 0;border-bottom:1px solid var(--line)}
#settings-content>section:last-child{border-bottom:0}
#settings-content h3{font-size:1.08em;margin:0 0 9px;color:var(--accent)}
#settings-content p{margin:8px 0 0;line-height:1.4}

@container(min-width:800px){
 #weather-details #reading-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}
 #weather-details #reading-list>div{padding:0;line-height:1.15}
 #weather-details #reading-context{margin:2px 0 4px}
 #weather-details #reading-list>div:only-child{grid-column:1/-1}
}

#shell.has-alerts{--alert-height:40px;min-height:505px}
#shell.has-fishing{--fishing-height:48px}
.has-fishing .conditions-strip{grid-template-rows:auto minmax(0,1fr)}
.has-fishing.has-alerts .conditions-strip{grid-template-rows:auto 34px minmax(0,1fr)}
.conditions-strip{display:grid;grid-template-rows:minmax(0,1fr);min-height:0}
.has-alerts .conditions-strip{grid-template-rows:34px minmax(0,1fr);gap:6px}
#alert-banner{display:flex;align-items:center;gap:8px;min-width:0;border:1px solid #f2a951;
 background:#41250d;color:#ffe2a9;border-radius:8px;text-align:left;padding:4px 9px}
#alert-banner[hidden]{display:none}
#alert-banner[data-kind=warning]{border-color:#ff8174;background:#671f20;color:#fff0ed}
#alert-banner strong{text-transform:uppercase;font-size:.85em;flex:none}
#alert-banner span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#alerts-list article{padding:12px 0;border-bottom:1px solid var(--line)}
#alerts-list .alert-description{white-space:pre-line}
#alerts-list a{color:var(--accent)}

#shell dialog{font-size:var(--popup-fitted-size,clamp(14px,1.55cqw,26px))}
#periods .period.period-reading small{font-size:clamp(14px,1.55cqw,26px);font-weight:700;line-height:1.15}
@container(max-width:700px){
 #periods .period.period-reading small{font-size:clamp(12px,3.8cqw,19px)}
}

#temperature-trend{display:block;width:100%;height:28px;flex:none;color:var(--accent)}
#temperature-trend[hidden]{display:none}
.forecast:has(#temperature-trend:not([hidden])) .periods{grid-template-rows:minmax(0,1fr)}
.forecast:has(#temperature-trend:not([hidden])) .period .icon{min-height:0}
@container(min-width:701px){
 #shell:has(#temperature-trend:not([hidden])){grid-template-rows:minmax(var(--header-row,70px),max-content) minmax(130px,.8fr) calc(65px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(230px,1.2fr) auto}
}
@container(max-width:700px){
 #temperature-trend{height:20px}
 .forecast:has(#temperature-trend:not([hidden])){gap:3px}
 #shell:has(#temperature-trend:not([hidden])){
   grid-template-rows:auto minmax(104px,.55fr) calc(63px + var(--alert-height,0px) + var(--fishing-height,0px)) minmax(230px,1fr) auto;
 }
 .forecast:has(#temperature-trend:not([hidden])) .period{gap:2px}
 .forecast:has(#temperature-trend:not([hidden])) .period .icon i{font-size:clamp(22px,7cqw,38px)}
}

#shell[data-theme=trek]>header>.actions{min-width:0}
#shell[data-theme=trek] #location{min-width:0;width:100%;max-width:52cqw;text-align:right;text-align-last:right;
 font-size:clamp(10px,calc(83cqw / var(--location-length,18)),21px);padding-inline:2px}
@container(max-width:700px){
 #shell[data-theme=trek] #location{max-width:42cqw;font-size:clamp(9px,calc(69cqw / var(--location-length,18)),13px)}
}

.radar-map-area{position:relative;min-height:0}
.radar-map-area .map{height:100%}
.radar-heading{flex-wrap:wrap;gap:6px;margin-bottom:2px}
.radar-title{margin:0}
.radar-tools{display:flex;flex-wrap:wrap;gap:4px}
#mobile-radar-slot .radar-title{display:none}
.radar-tools button{background:#101a27;color:#eef5fa;border:1px solid #8297ad;font-weight:700;
 border-radius:7px;min-width:36px;min-height:36px;padding:4px 7px;font:600 13px/1.1 system-ui}
.radar-tools button[aria-pressed=true]{background:#d9ecfb;color:#132333}
.radar-tools button:disabled{opacity:.55}
.wind-rose{position:absolute;bottom:6px;left:6px;display:grid;justify-items:center;
 width:min(174px,52%);padding:5px;color:#eef5fa;background:#0b1727ee;border-radius:8px;font:600 10px/1.15 system-ui}
.wind-rose[hidden],.wind-rose canvas[hidden]{display:none}
.wind-rose canvas{display:block;width:min(100%,138px,19vh);height:auto}
.wind-rose-key{display:flex;justify-content:center;flex-wrap:wrap;gap:3px;color:#eef5fa!important;font-size:8px!important}
.wind-rose-key span{white-space:nowrap}
.wind-rose-key i{display:inline-block;width:6px;height:6px;margin-right:2px}
@container(max-width:700px){.radar-tools button{min-width:40px;min-height:40px}.wind-rose canvas{width:min(100%,122px,16vh)}}

.radar-map-area .map{touch-action:none;cursor:grab;user-select:none}
.radar-map-area .map.dragging{cursor:grabbing}
.radar-plane{position:absolute;inset:0;pointer-events:none}

#hero-layout{position:relative;display:grid;min-height:0;min-width:0}
#hero-layout.with-camera{grid-template-columns:minmax(0,3fr) minmax(0,1fr);gap:10px}
#camera-preview[hidden],#thermostat[hidden]{display:none}
#camera-preview,.camera-media{display:grid;place-items:center;min-width:0;min-height:0;overflow:hidden}
#camera-preview{position:relative;padding:0;background:#0b1017;border-radius:14px}
.camera-media{position:absolute;inset:0;pointer-events:none;color:#eef5fa;text-align:center}
.camera-media :is(img,video){width:100%;height:100%;min-height:0;object-fit:cover}
.camera-media > :not(img,video){width:100%;min-width:0}
#camera-fullscreen{position:fixed;inset:0;margin:0;width:100%;height:100%;max-width:none;max-height:none;padding:0;border:0;border-radius:0;background:#000}
#camera-close{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:#000}
#camera-close .camera-media :is(img,video){object-fit:contain}
#camera-close::after{content:'×';position:absolute;right:12px;top:max(12px,env(safe-area-inset-top));width:44px;line-height:44px;border-radius:50%;background:#121822dd;color:white;font-size:28px}
#thermostat{position:absolute;z-index:2;left:18px;bottom:12px;min-height:34px;padding:5px 9px;background:var(--surface);color:var(--ink)}
.hero:has(#thermostat:not([hidden])){padding-bottom:48px}
@container(max-width:850px){
 .hero.has-briefing #thermostat{bottom:30px}
 .hero.has-briefing:has(#thermostat:not([hidden])){padding-bottom:64px}
}
@container(max-width:700px){
 #hero-layout.with-camera{grid-template-columns:minmax(0,1fr);gap:0}
 #hero-layout.with-camera .hero{padding-bottom:clamp(58px,19cqw,108px)}
 #hero-layout.with-camera .weather-briefing{right:40%;left:15px}
 #hero-layout.with-camera .hero.has-briefing #thermostat{bottom:clamp(35px,9cqw,49px)}
 #camera-preview{position:absolute;z-index:2;right:7px;bottom:7px;width:33%;height:clamp(54px,17cqw,102px);border-radius:9px}
}

@media (orientation:landscape) and (max-height:540px){
 #shell:has(#temperature-trend){height:auto;grid-template-rows:auto minmax(175px,auto) auto minmax(340px,auto) auto}
 #shell .conditions-strip{min-height:65px}
 #shell .metrics{min-height:65px}
 #shell #radar .radar-content{grid-template-rows:auto minmax(180px,1fr) auto auto}
 #shell .wind-rose canvas{width:min(100%,110px)}
 #shell .period .icon i{font-size:clamp(27px,4.2cqw,46px)}
}

`;
customElements.define('atmosphere-weather-card', AtmosphereWeatherCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'atmosphere-weather-card',name:'Atmosphere Weather',description:'Weather and radar for your saved locations'});
