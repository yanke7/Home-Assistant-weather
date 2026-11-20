const defaultPresets = [['Eco',18.5],['Comfort',21.5],['Warm',23.5]];
const feature = {target:1, range:2, fan:8};
const modes = {off:'Off',heat:'Heat',cool:'Cool',heat_cool:'Heat / cool',auto:'Auto',dry:'Dry',fan_only:'Fan only'};
const actions = {heating:'Heating',cooling:'Cooling',idle:'Idle',off:'Off',drying:'Drying',fan:'Fan running',defrosting:'Defrosting'};
const point = (angle,radius = 115) => {
  const radians = angle * Math.PI / 180;
  return [150 + radius * Math.sin(radians),150 - radius * Math.cos(radians)];
};
const [startX,startY] = point(-135);
const track = `M ${startX} ${startY} A 115 115 0 1 1 ${point(135).join(' ')}`;

const ticks = Array.from({length:37},(_,index)=>{
  const angle = -135 + index * 7.5;
  return `M ${point(angle,130).join(' ')} L ${point(angle,index % 6 ? 135 : 140).join(' ')}`;
}).join(' ');

export const thermostatMarkup = `
<dialog id="thermostat-dialog" aria-labelledby="climate-title">
  <header class="climate-heading"><div><h2 id="climate-title">Thermostat</h2><div id="climate-name"></div></div>
    <div class="climate-heading-actions">
      <button id="climate-gear" type="button" aria-haspopup="dialog" aria-label="Thermostat settings" title="Thermostat settings">⚙</button>
      <button id="climate-close" type="button" aria-label="Close thermostat">×</button>
    </div></header>
  <div class="climate-telemetry">
    <div><small>Indoor</small><strong id="climate-indoor"></strong></div>
    <div id="climate-humidity-box"><small>Humidity</small><strong id="climate-humidity"></strong></div>
  </div>
  <div class="climate-dial">
    <svg id="climate-track" viewBox="0 0 300 300" role="slider" aria-label="Target temperature" tabindex="0">
      <circle cx="150" cy="150" r="104" class="climate-well"/>
      <path d="${ticks}" class="climate-ticks"/>
      <path d="${track}" class="climate-base"/>
      <path id="climate-progress" class="climate-progress"/>
      <circle id="climate-thumb" r="8" class="climate-thumb"/>
    </svg>
    <div class="climate-readout">
      <span id="climate-activity"></span><strong id="climate-value"></strong>
      <div class="climate-stepper">
        <button type="button" id="climate-down" aria-label="Decrease temperature">−</button>
        <button type="button" id="climate-up" aria-label="Increase temperature">+</button>
      </div>
    </div>
  </div>
  <div id="climate-range" class="climate-options" role="group" aria-label="Temperature range"></div>
  <div id="climate-presets" class="climate-options" role="group" aria-label="Quick temperature settings"></div>
  <section id="climate-mode-box"><h3>System mode</h3><div id="climate-modes" class="climate-options"></div></section>
  <section id="climate-fan-box"><h3>Fan speed</h3><div id="climate-fans" class="climate-options"></div></section>
  <p id="climate-message" role="status" hidden></p>
</dialog>
<dialog id="climate-settings" aria-labelledby="climate-settings-title">
  <header class="climate-heading"><h2 id="climate-settings-title">Thermostat presets</h2>
    <button id="climate-settings-close" type="button" aria-label="Close thermostat settings">×</button></header>
  <form id="climate-preset-form">
    <div id="climate-preset-fields"></div>
    <div class="climate-heading-actions">
      <button id="climate-preset-reset" type="button">Reset defaults</button>
      <button type="submit">Save presets</button>
    </div>
  </form>
</dialog>`;

export const thermostatCSS = `
#thermostat-dialog,#climate-settings{
  width:min(430px,calc(100vw - 24px));padding:clamp(14px,4vw,24px);border:1px solid var(--line);
  border-radius:28px;background:var(--bg);color:var(--ink);font:14px system-ui,sans-serif;
  --climate-accent:var(--accent);--climate-well:color-mix(in srgb,var(--bg),#000 26%);
}
#thermostat-dialog{background:radial-gradient(ellipse at 50% 34%,color-mix(in srgb,var(--bg),var(--climate-accent) 15%),var(--bg) 65%)}
#thermostat-dialog [hidden]{display:none}
.climate-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.climate-heading h2{margin:0;color:var(--ink);font-size:22px}.climate-heading #climate-name{color:var(--muted);margin-top:4px;overflow-wrap:anywhere}
.climate-heading-actions{display:flex;gap:6px;align-items:center}
#climate-gear,#climate-settings-close,#climate-close{width:44px;height:44px;flex:none;font-size:27px;padding:0}
.climate-telemetry,.climate-options,.climate-stepper{display:flex;gap:8px;flex-wrap:wrap}
.climate-telemetry>div{flex:1;background:#ffffff08;border:1px solid #ffffff16;border-radius:12px;padding:8px 12px}
.climate-telemetry small,#thermostat-dialog h3{display:block;color:var(--muted);font-size:12px}
.climate-telemetry strong{display:block;font-size:17px;margin-top:2px}
.climate-dial{position:relative;width:min(100%,260px);margin:0 auto;aspect-ratio:1}
#climate-track{display:block;width:100%;height:100%;touch-action:none;cursor:grab;border-radius:50%}
#climate-track[aria-disabled=true]{cursor:default;touch-action:auto}
.climate-well{fill:var(--climate-well);stroke:#ffffff12;stroke-width:2}
.climate-ticks{fill:none;stroke:#aab8c379;stroke-width:1.5;stroke-linecap:round}
.climate-base,.climate-progress{fill:none;stroke-width:12;stroke-linecap:round}
.climate-base{stroke:#ffffff1c}.climate-progress{stroke:var(--climate-accent)}
.climate-thumb{fill:#fff;stroke:var(--climate-accent);stroke-width:4}
.climate-readout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none}
#climate-activity{padding:4px 9px;background:#ffffff12;color:var(--climate-accent);border-radius:999px}
#climate-value{font-size:clamp(32px,12vw,49px);font-weight:400;font-variant-numeric:tabular-nums;line-height:1.08}
.climate-stepper button{pointer-events:auto;min-width:44px;min-height:44px;font-size:22px;padding:0}
.climate-options button{flex:1 1 auto;min-height:40px;overflow-wrap:anywhere}
#climate-presets button{border-radius:999px;font-size:12px}
#thermostat-dialog h3{margin:12px 0 6px}
#thermostat-dialog button[aria-pressed=true]{color:var(--climate-accent);border-color:var(--climate-accent);outline:0}
#climate-message{margin:12px 0 0;color:var(--ink)}
#climate-preset-fields{display:grid;gap:10px;margin-bottom:16px}
#climate-preset-fields fieldset{margin:0;border:1px solid var(--line);border-radius:12px;display:grid;grid-template-columns:1fr minmax(92px,.5fr);gap:8px}
#climate-preset-fields input{width:100%}
#climate-preset-form .climate-heading-actions{justify-content:space-between;flex-wrap:wrap}
#climate-preset-form button{min-height:44px}

main[data-theme=trek] :is(#thermostat-dialog,#climate-settings){
  --climate-gold:#ffcc66;--climate-peach:#ff9b55;--climate-lavender:#a798e6;--climate-blue:#afc3fc;
  --climate-accent:var(--climate-gold);--ink:var(--climate-gold);--muted:var(--climate-blue);
  --line:#ffcc6666;--surface:#18110e;--climate-well:#050505;
  border:0;border-radius:24px 14px 14px 24px;background:#050505;
  font:600 15px "Atmosphere Console",system-ui,sans-serif;
}
main[data-theme=trek] #thermostat-dialog{
  padding-left:clamp(32px,10vw,52px);
  background:linear-gradient(var(--climate-gold) 0 13%,#050505 13% 14%,var(--climate-peach) 14% 31%,#050505 31% 32%,var(--climate-lavender) 32% 84%,#050505 84% 85%,var(--climate-blue) 85%) left/24px 100% no-repeat,#050505;
}
main[data-theme=trek] #thermostat-dialog .climate-heading{
  padding-bottom:12px;
  background:linear-gradient(90deg,var(--climate-gold) 0 60%,#050505 60% 62%,var(--climate-peach) 62% 85%,#050505 85% 87%,var(--climate-lavender) 87%) bottom/100% 7px no-repeat;
}
main[data-theme=trek] .climate-heading h2{font-size:clamp(17px,5vw,25px);text-transform:uppercase}
main[data-theme=trek] .climate-telemetry>div{padding:0;border:0;border-left:4px solid var(--climate-gold);border-radius:10px 10px 0 0;background:transparent}
main[data-theme=trek] .climate-telemetry small{padding:3px 8px;background:var(--climate-gold);color:#050505;text-transform:uppercase}
main[data-theme=trek] .climate-telemetry strong{padding:3px 8px;font-size:22px}
main[data-theme=trek] #climate-humidity-box{border-color:var(--climate-peach);color:var(--climate-peach)}
main[data-theme=trek] #climate-humidity-box small{background:var(--climate-peach)}
main[data-theme=trek] .climate-dial{width:min(100%,232px)}
main[data-theme=trek] :is(.climate-base,.climate-progress){stroke-width:17;stroke-dasharray:11 4;stroke-linecap:butt}
main[data-theme=trek] .climate-base{stroke:var(--climate-lavender);opacity:.45}
main[data-theme=trek] .climate-well{stroke:none}
main[data-theme=trek] .climate-ticks{display:none}
main[data-theme=trek] .climate-readout{gap:3px}
main[data-theme=trek] #climate-activity{color:#050505;background:var(--climate-blue);font-size:12px;text-transform:uppercase}
main[data-theme=trek] #climate-value{font-weight:600}
main[data-theme=trek] :is(#climate-gear,#climate-close,#climate-settings-close,#climate-down,#climate-up){background:var(--climate-lavender);color:#050505;border:0;border-radius:999px}
main[data-theme=trek] :is(#climate-down,#climate-up){min-width:56px;min-height:40px}
main[data-theme=trek] #climate-down{background:var(--climate-blue)}
main[data-theme=trek] #climate-up{background:var(--climate-peach)}
main[data-theme=trek] #climate-presets button{background:var(--climate-gold);color:#050505;border:0}
main[data-theme=trek] #climate-modes select,main[data-theme=trek] #climate-fans select{width:100%;min-height:42px;border-radius:999px;background:var(--climate-peach);color:#050505}
main[data-theme=trek] #climate-fans select{background:var(--climate-gold)}

`;

export class ThermostatControls {
  constructor(card) {
    this.card = card;
    this.dialog = card.$('thermostat-dialog');
    this.track = card.$('climate-track');
    this.settings = card.$('climate-settings');
    card.$('climate-gear').onclick = () => {
      this.renderPresetFields(this.presets());
      this.settings.showModal();
    };
    card.$('climate-settings-close').onclick = () => this.settings.close();
    card.$('climate-preset-reset').onclick = () => this.renderPresetFields(defaultPresets);
    card.$('climate-preset-form').onsubmit = event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const presets = defaultPresets.map((_,index)=>[
        values.get('name'+index).trim(),
        this.fahrenheit ? (Number(values.get('temp'+index))-32)/1.8 : Number(values.get('temp'+index)),
      ]);
      if (presets.some(([name])=>!name)) {
        const empty = event.currentTarget.elements['name'+presets.findIndex(([name])=>!name)];
        empty.value = '';
        empty.reportValidity();
        return;
      }
      card.write('thermostatPresets',JSON.stringify(presets));
      this.settings.close();
      this.update();
    };
    card.$('climate-close').onclick = () => this.dialog.close();
    this.dialog.addEventListener('close', () => { this.clearRequested(); this.draft = null; this.pointer = null; this.settings.close(); });
    card.$('climate-down').onclick = () => this.adjust(-1);
    card.$('climate-up').onclick = () => this.adjust(1);
    this.track.onkeydown = event => {
      const direction = {ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[event.key];
      if (!direction) return;
      event.preventDefault();
      this.adjust(direction);
    };
    this.track.onpointerdown = event => {
      if (event.button !== 0 || this.pointer != null || !this.adjustable) return;
      this.pointer = event.pointerId;
      this.track.setPointerCapture(event.pointerId);
      this.readPointer(event);
    };
    this.track.onpointermove = event => { if (event.pointerId === this.pointer) this.readPointer(event); };
    this.track.onpointerup = event => {
      if (event.pointerId !== this.pointer) return;
      const value = this.draft;
      this.pointer = null;
      this.draft = null;
      this.setTarget(value);
    };
    this.track.onlostpointercapture = () => {
      if (this.pointer == null) return;
      this.pointer = null;
      this.draft = null;
      this.update();
    };
  }

  open(entityId) {
    if (this.entityId !== entityId) {
      this.entityId = entityId;
      this.edge = 'low';
    }
    this.message = '';
    this.update(true);
    if (!this.dialog.open) this.dialog.showModal();
  }

  update(force = false) {
    if (!force && !this.dialog.open) return;
    const card = this.card;
    const selected = card.data?.selected;
    if (!selected?.is_home || selected.thermostat_entity !== this.entityId) {
      this.dialog.close();
      return;
    }
    const state = card._hass?.states?.[this.entityId];
    const attributes = state?.attributes || {};
    this.attributes = attributes;
    const unit = card._hass?.config?.unit_system?.temperature || '°C';
    const fahrenheit = this.fahrenheit = unit === '°F';
    this.unit = unit;
    this.trek = card.theme === 'trek';
    card.$('climate-title').textContent = this.trek ? 'Climate control' : 'Thermostat';
    this.step = attributes.target_temp_step > 0 ? attributes.target_temp_step : fahrenheit ? 1 : .5;
    this.min = Number.isFinite(attributes.min_temp) ? attributes.min_temp : fahrenheit ? 45 : 7;
    this.max = Number.isFinite(attributes.max_temp) ? attributes.max_temp : fahrenheit ? 95 : 35;
    const supports = value => Boolean(attributes.supported_features & value);
    this.range = supports(feature.range) && Number.isFinite(attributes.target_temp_low)
      && Number.isFinite(attributes.target_temp_high) && (state?.state === 'heat_cool' || !supports(feature.target) || attributes.temperature == null);
    const key = this.range ? 'target_temp_' + this.edge : 'temperature';
    const reported = attributes[key];
    if (this.requested && (this.requested.key !== key || this.requested.entity !== this.entityId ||
        this.requested.mode !== state?.state || this.requested.previous !== reported)) this.clearRequested();
    this.target = this.requested?.value ?? reported;
    const available = Boolean(state && !['unknown','unavailable'].includes(state.state));
    this.adjustable = available && !this.pending && (this.range || supports(feature.target))
      && Number.isFinite(this.target) && this.max > this.min;
    const format = value => Number.isFinite(value) ? `${new Intl.NumberFormat(card.language,{maximumFractionDigits:2}).format(value)} ${unit}` : '—';
    this.format = format;
    this.dialog.dataset.mode = state?.state || 'off';
    card.$('climate-name').textContent = attributes.friendly_name || this.entityId;
    card.$('climate-indoor').textContent = format(attributes.current_temperature);
    card.$('climate-humidity-box').hidden = !Number.isFinite(attributes.current_humidity);
    card.$('climate-humidity').textContent = `${attributes.current_humidity}%`;
    const action = attributes.hvac_action || state?.state;
    card.$('climate-activity').textContent = available ? (actions[action] || modes[action] || action) : 'Unavailable';
    this.track.tabIndex = this.adjustable ? 0 : -1;
    this.track.setAttribute('aria-disabled',String(!this.adjustable));
    this.track.setAttribute('aria-valuemin',this.min);
    this.track.setAttribute('aria-valuemax',this.max);
    card.$('climate-down').disabled = !this.adjustable;
    card.$('climate-up').disabled = !this.adjustable;
    this.paintTarget();
    this.options('climate-range',this.range ? [['low','Heat to'],['high','Cool to']] : [],this.edge,!available,
      edge=>{this.edge=edge;this.update();});
    const presets = this.adjustable && !this.range
      ? this.presets().map(([label,celsius])=>[label,Math.max(this.min,Math.min(this.max,Number((fahrenheit ? celsius*1.8+32 : celsius).toFixed(2))))])
      : [];
    this.options('climate-presets',presets.map(([label,value])=>[String(value),`${label} ${format(value)}`]),null,false,
      value=>this.setTarget(Number(value)));
    const hvacModes = (attributes.hvac_modes || []).map(mode=>[mode,modes[mode] || mode]);
    const fans = supports(feature.fan) ? (attributes.fan_modes || []).map(mode=>[mode,mode]) : [];
    card.$('climate-mode-box').hidden = !hvacModes.length;
    card.$('climate-fan-box').hidden = !fans.length;
    this.options('climate-modes',hvacModes,state?.state,!available || this.pending,
      mode=>this.send('set_hvac_mode',{hvac_mode:mode}));
    this.options('climate-fans',fans,attributes.fan_mode,!available || this.pending,
      mode=>this.send('set_fan_mode',{fan_mode:mode}));
    const message = card.$('climate-message');
    message.hidden = !this.message;
    message.textContent = this.message;
  }

  presets() {
    try {
      const saved = JSON.parse(this.card.read('thermostatPresets'));
      if (Array.isArray(saved) && saved.length === 3 && saved.every(item=>
        Array.isArray(item) && typeof item[0] === 'string' && item[0].trim() && Number.isFinite(item[1]))) return saved;
    } catch { /* Use the standard presets if stored preferences are unreadable. */ }
    return defaultPresets;
  }

  renderPresetFields(presets) {
    const fields = this.card.$('climate-preset-fields');
    fields.replaceChildren(...presets.map(([name,celsius],index)=>{
      const group = document.createElement('fieldset');
      group.innerHTML = `<legend>Preset ${index+1}</legend><label>Name <input name="name${index}" maxlength="24" required></label>
        <label>Setpoint <span></span><input name="temp${index}" type="number" step="any" required></label>`;
      const [label,temp] = group.querySelectorAll('input');
      group.querySelector('span').textContent = '(' + this.unit + ')';
      label.value = name;
      temp.min = this.min;
      temp.max = this.max;
      const value = this.fahrenheit ? celsius * 1.8 + 32 : celsius;
      temp.value = Math.min(this.max,Math.max(this.min,Number(value.toFixed(2))));
      return group;
    }));
  }

  options(id, items, active, disabled, select) {
    const host = this.card.$(id);
    const compact = this.trek && (id === 'climate-modes' || id === 'climate-fans');
    const signature = JSON.stringify([items,active,Boolean(disabled),compact]);
    if (host.dataset.options === signature) return;
    host.dataset.options = signature;
    host.hidden = !items.length;
    if (compact && items.length) {
      const control = document.createElement('select');
      control.setAttribute('aria-label',id === 'climate-modes' ? 'System mode' : 'Fan speed');
      control.disabled = Boolean(disabled);
      if (!items.some(([value])=>value === active)) control.add(new Option('Choose…','',true,true));
      for (const [value,label] of items) control.add(new Option(label,value,false,value === active));
      control.onchange = () => { if (control.value) select(control.value); };
      host.replaceChildren(control);
      return;
    }
    host.replaceChildren(...items.map(([value,label])=>{
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = Boolean(disabled);
      if (active != null) button.setAttribute('aria-pressed',String(value === active));
      button.onclick = () => select(value);
      return button;
    }));
  }

  paintTarget() {
    const value = this.draft ?? this.target;
    const valid = Number.isFinite(value) && this.max > this.min;
    const angle = valid ? Math.max(0,Math.min(1,(value-this.min)/(this.max-this.min))) * 270 - 135 : -135;
    const [x,y] = point(angle);
    const progress = this.card.$('climate-progress');
    progress.setAttribute('d',angle > -135 ? `M ${startX} ${startY} A 115 115 0 ${angle>45 ? 1 : 0} 1 ${x} ${y}` : '');
    const thumb = this.card.$('climate-thumb');
    thumb.hidden = !valid;
    thumb.setAttribute('cx',x);
    thumb.setAttribute('cy',y);
    if (valid) this.track.setAttribute('aria-valuenow',value);
    else this.track.removeAttribute('aria-valuenow');
    this.card.$('climate-value').textContent = this.format(value);
  }

  snap(value) {
    const bounded = Math.min(this.max,Math.max(this.min,value));
    return Number(Math.max(this.min,Math.min(this.max,Math.round(bounded/this.step)*this.step)).toFixed(3));
  }

  readPointer(event) {
    const box = this.track.getBoundingClientRect();
    const angle = Math.atan2(event.clientX-box.x-box.width/2,box.y+box.height/2-event.clientY)*180/Math.PI;
    this.draft = this.snap(this.min + (Math.max(-135,Math.min(135,angle))+135)/270*(this.max-this.min));
    this.paintTarget();
  }

  adjust(direction) {
    if (this.adjustable) this.setTarget(this.snap(this.target + direction*this.step));
  }

  setTarget(value) {
    if (!this.adjustable || !Number.isFinite(value)) return;
    const {target_temp_low:low,target_temp_high:high} = this.attributes;
    const fields = !this.range ? {temperature:value} : {
      target_temp_low:this.edge === 'low' ? Math.min(value,high) : low,
      target_temp_high:this.edge === 'high' ? Math.max(value,low) : high,
    };
    const key = this.range ? 'target_temp_' + this.edge : 'temperature';
    this.clearRequested();
    this.requested = {key, value:fields[key], previous:this.attributes[key], entity:this.entityId, mode:this.dialog.dataset.mode};
    this.requestTimer = setTimeout(() => { this.clearRequested(); this.update(); }, 10000);
    this.send('set_temperature',fields);
  }

  clearRequested() {
    clearTimeout(this.requestTimer);
    this.requested = null;
  }

  async send(service, fields) {
    if (this.pending || !this.dialog.open) return;
    this.pending = true;
    this.message = '';
    this.update();
    try {
      await this.card._hass.callService('climate',service,{entity_id:this.entityId,...fields});
    } catch {
      if (service === 'set_temperature') this.clearRequested();
      this.message = 'Home Assistant could not apply the change.';
    } finally {
      this.pending = false;
      this.update();
    }
  }
}
