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
const icons = {sunny:'☀','clear-night':'☾',partlycloudy:'⛅',cloudy:'☁',rainy:'☂',pouring:'☂',
  snowy:'❄','snowy-rainy':'❄',fog:'≋','lightning-rainy':'ϟ'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

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
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 60000);
  }
  disconnectedCallback() { clearInterval(this.timer); this.request++; }
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
          <button id="settings" aria-label="Settings" title="Settings">⚙</button></div></header>
      <section id="hero" class="hero"></section>
      <section class="metrics" id="metrics" aria-label="Weather details"></section>
      <div class="outlook">
        <section class="panel forecast"><div class="heading"><h2>Forecast</h2>
          <div class="tabs"><button data-tab="hourly">Hourly</button><button data-tab="daily">Daily</button>
          <button data-tab="radar" class="mobile-tab">Radar</button></div></div>
          <div id="periods"></div></section>
        <section class="panel radar"><div class="heading"><h2>Precipitation radar</h2></div><div id="radar"></div></section>
      </div>
      <footer><a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather by Open-Meteo</a><span id="status" role="status"></span></footer>
      <dialog id="dialog" aria-labelledby="settings-title">
       <div class="heading"><h2 id="settings-title">Settings</h2><button id="close" aria-label="Close settings">✕</button></div>
       <div class="tabs settings-tabs"><button data-settings="locations">Locations</button><button data-settings="appearance">Appearance</button><button data-settings="data">Data</button></div>
       <div id="settings-content"></div><p id="notice" role="status"></p>
      </dialog></main>`;
    this.$('settings').onclick = () => {
      this.settingsPanel('locations');
      this.$('dialog').showModal();
    };
    this.$('close').onclick = () => this.$('dialog').close();
    this.$('location').onchange = event => {
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

  render() {
    const shell = this.$('shell');
    if (!shell) return;
    const {locations = [], selected, weather, fresh} = this.data || {};
    const current = weather?.current || {};
    const [, , background, surface, accent] = themes.find(item => item[0] === this.theme) || themes[0];
    shell.dataset.theme = this.theme;
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
    this.$('hero').dataset.sky = current.sky_period || (current.is_day === 0 ? 'night' : 'day');
    this.$('hero').innerHTML = selected ? `<div class="current"><div class="kicker">${escape(selected.name)}</div>
       <div class="temperature">${this.temp(current.temperature_2m)}<sup>${this.imperial ? 'F' : 'C'}</sup></div>
       <div class="condition">${escape(label || 'Waiting for weather')}</div></div>
       <div class="orb" aria-hidden="true"></div><div class="summary">
       <div>${this.date(new Date(),{weekday:'long',month:'short',day:'numeric'})}</div>
       <strong>H ${this.temp(current.temperature_high)} · L ${this.temp(current.temperature_low)}</strong>
       <div>Feels like ${this.temp(current.apparent_temperature)}</div></div>`
      : `<div class="current"><h2>${this.error ? 'Weather unavailable' : this.data ? 'Add a location in Settings' : 'Loading weather…'}</h2><p>${escape(this.error)}</p></div>`;
    const metrics = [
      ['Wind',this.wind(current.wind_speed_10m)],
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
    this.$('periods').innerHTML = periods.length ? `<div class="periods ${mode}">${periods.map(item => `
      <div class="period"><small>${this.date(item.datetime,mode === 'daily' ? {weekday:'short'} : {hour:'numeric'})}</small>
      <span class="icon" role="img" aria-label="${escape(item.condition || 'Unknown condition')}">${icons[item.condition] || '◌'}</span>
      <strong>${this.temp(item.native_temperature)}</strong>
      <span>${mode === 'daily' ? 'Low ' + this.temp(item.native_templow) : this.wind(item.native_wind_speed)}</span>
      <span class="chance">${this.measure(item.precipitation_probability,'%')}</span></div>`).join('')}</div>`
      : '<p class="empty">Forecast unavailable</p>';
    this.$('status').textContent = current.updated_at ? (fresh ? 'Updated ' : 'Stale · last update ') + this.time(current.updated_at) : '';
    this.renderRadar();
  }

  async loadRadar() {
    const location = this.data?.selected;
    const mobile = this.$('shell')?.clientWidth <= 700;
    if (!location || !this.data.radar || (mobile && this.tab !== 'radar')) return;
    const key = location.id + ':' + Math.floor(Date.now() / 300000);
    if (this.radarKey === key) return;
    this.radarKey = key;
    try {
      const frames = await this.call('radar',{location:location.id});
      if (this.radarKey !== key) return;
      this.frames = frames;
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
        const base = `https://tile.openstreetmap.org/${zoom}/${wrapped}/${row}.png`;
        const url = `https://tilecache.rainviewer.com${frame.path}/256/${zoom}/${wrapped}/${row}/2/1_1.png`;
        tiles.push(`<img alt="" src="${base}" style="${style}"><img class="overlay" alt="" src="${escape(url)}" style="${style}">`);
      }
    }
    host.innerHTML = `<div class="radar-content" data-signature="${signature}">
      <div class="map" role="img" aria-label="Recent observed precipitation near ${escape(location.name)}">${tiles.join('')}<span class="pin"></span></div>
      <div class="radar-controls"><input type="range" id="radar-time" min="0" max="${this.frames.length - 1}" value="${this.frameIndex}" aria-label="Observed radar time">
      <span>${this.time(frame.time * 1000)}</span></div>
      <small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> ·
      <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a></small></div>`;
    host.querySelectorAll('.overlay').forEach(tile => tile.onerror = () => {
      tile.remove();
      host.querySelector('.map')?.setAttribute('aria-label','Radar tiles incomplete');
      host.querySelector('.radar-controls span').textContent = 'Tiles incomplete';
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
.map img{position:absolute;width:256px;height:256px;max-width:none}.map .overlay{opacity:.8}.pin{position:absolute;top:50%;left:50%;translate:-50% -50%;background:#ffcc66;width:10px;height:10px;border:2px solid #403319;border-radius:50%;box-shadow:0 0 0 4px #ffcc6666}
.radar-controls input{width:75%;padding:0;accent-color:var(--accent)}.radar-controls span{font-size:.75em}
footer a,.radar-content a{color:inherit}footer{gap:8px}
dialog{width:min(570px,calc(100vw - 24px));max-height:calc(100dvh - 28px);overflow:auto;
 color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:18px}
dialog::backdrop{background:#071019aa}.settings-tabs{margin:12px 0}.themes,.coordinates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.themes button{display:flex;gap:8px;align-items:center;text-align:left}.themes i{width:23px;height:23px;flex:none;border:2px solid;border-radius:50%}
.locations{list-style:none;padding:0}.locations li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)}
.location-form,#search{display:grid;gap:8px;margin-top:12px}label{display:grid;gap:4px;font-size:.88em}label input{min-width:0}
#results{display:grid;gap:4px;margin-top:6px}#notice{color:var(--accent);margin-bottom:0}.units{margin-top:12px}
main[data-theme=trek]{--ink:#ffda77;--muted:#dbb975;--font:"Avenir Next Condensed","Arial Narrow",sans-serif}
main[data-theme=trek] :is(.panel,.hero){border-inline-start:12px solid #a29bda;border-top:5px solid #df893e;border-radius:24px 8px 8px 24px}
main[data-theme=neon] .panel{box-shadow:inset 0 0 24px #28deef14}
@container(max-width:900px){.hourly .period:nth-child(n+7){display:none}.periods.hourly{grid-template-columns:repeat(6,minmax(0,1fr))}}
@container(max-width:700px){
 main{min-height:510px;padding:8px 12px;gap:8px;grid-template-rows:38px minmax(112px,.8fr) 64px minmax(170px,1fr) auto}
 .brand{font-size:17px}.hero{padding:12px 15px}.metrics{gap:5px}.metrics>div{padding:7px 5px}.metrics span{font-size:.66em}
 .metrics strong{font-size:.9em}.outlook{display:block;position:relative;height:100%}.forecast{height:100%}.radar{display:none}
 .mobile-tab{display:block}main[data-tab=radar] .radar{display:flex;position:absolute;inset:47px 7px 7px;padding:3px 5px;border:0}
 main[data-tab=radar] .radar .heading{display:none}main[data-tab=radar] #periods{visibility:hidden}
 .period strong{font-size:1.15em}.period span,.period small{font-size:.66em}.period .icon{font-size:1.35em}.tabs button{padding:7px 8px}
}
`;
customElements.define('atmosphere-weather-card', AtmosphereWeatherCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'atmosphere-weather-card',name:'Atmosphere Weather',description:'Weather and radar for your saved locations'});
