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
    <button id="climate-close" type="button" aria-label="Close thermostat">×</button></header>
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
</dialog>`;

export const thermostatCSS = `
#thermostat-dialog{width:min(430px,calc(100vw - 24px));padding:clamp(14px,4vw,24px);border:1px solid #ffffff25;
  border-radius:28px;background:radial-gradient(ellipse at 50% 34%,#322524,#181b24 65%);color:#f4f5fa;
  font:14px system-ui,sans-serif;--climate-accent:#ffab70;--surface:#252833;--line:#ffffff29;--accent:#ffab70}
#thermostat-dialog[data-mode=cool]{--climate-accent:#7dd3fc;background:radial-gradient(ellipse at 50% 34%,#183140,#181b24 65%)}
#thermostat-dialog[data-mode=heat_cool],#thermostat-dialog[data-mode=auto]{--climate-accent:#91e6bd}
#thermostat-dialog[data-mode=off]{--climate-accent:#aeb8c8}
#thermostat-dialog [hidden]{display:none}
.climate-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.climate-heading h2{margin:0;color:#f4f5fa;font-size:22px}.climate-heading #climate-name{color:#c1cadb;margin-top:4px;overflow-wrap:anywhere}
#climate-close{width:44px;height:44px;flex:none;font-size:27px;padding:0}
.climate-telemetry,.climate-options,.climate-stepper{display:flex;gap:8px;flex-wrap:wrap}
.climate-telemetry>div{flex:1;background:#ffffff08;border:1px solid #ffffff16;border-radius:12px;padding:8px 12px}
.climate-telemetry small,#thermostat-dialog h3{display:block;color:#c1cadb;font-size:12px}
.climate-telemetry strong{display:block;font-size:17px;margin-top:2px}
.climate-dial{position:relative;width:min(100%,260px);margin:0 auto;aspect-ratio:1}
#climate-track{display:block;width:100%;height:100%;touch-action:none;cursor:grab;border-radius:50%}
#climate-track[aria-disabled=true]{cursor:default;touch-action:auto}
.climate-well{fill:#12161f;stroke:#ffffff12;stroke-width:2}
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
#climate-message{margin:12px 0 0;color:#ffc0b2}
`;

export class ThermostatControls {
  constructor(card) {
    this.card = card;
    this.dialog = card.$('thermostat-dialog');
    this.track = card.$('climate-track');
    card.$('climate-close').onclick = () => this.dialog.close();
    this.dialog.addEventListener('close', () => { this.draft = null; this.pointer = null; });
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
    const fahrenheit = unit === '°F';
    this.step = attributes.target_temp_step > 0 ? attributes.target_temp_step : fahrenheit ? 1 : .5;
    this.min = Number.isFinite(attributes.min_temp) ? attributes.min_temp : fahrenheit ? 45 : 7;
    this.max = Number.isFinite(attributes.max_temp) ? attributes.max_temp : fahrenheit ? 95 : 35;
    const supports = value => Boolean(attributes.supported_features & value);
    this.range = supports(feature.range) && Number.isFinite(attributes.target_temp_low)
      && Number.isFinite(attributes.target_temp_high) && (state?.state === 'heat_cool' || !supports(feature.target) || attributes.temperature == null);
    this.target = this.range ? attributes['target_temp_' + this.edge] : attributes.temperature;
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
      ? [['Eco',18.5],['Comfort',21.5],['Warm',23.5]].map(([label,celsius])=>[label,this.snap(fahrenheit ? celsius*1.8+32 : celsius)])
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

  options(id, items, active, disabled, select) {
    const host = this.card.$(id);
    const signature = JSON.stringify([items,active,Boolean(disabled)]);
    if (host.dataset.options === signature) return;
    host.dataset.options = signature;
    host.hidden = !items.length;
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
    return Number(Math.min(this.max,this.min + Math.round((bounded-this.min)/this.step)*this.step).toFixed(3));
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
    this.send('set_temperature',fields);
  }

  async send(service, fields) {
    if (this.pending || !this.dialog.open) return;
    this.pending = true;
    this.message = '';
    this.update();
    try {
      await this.card._hass.callService('climate',service,{entity_id:this.entityId,...fields});
    } catch {
      this.message = 'Home Assistant could not apply the change.';
    } finally {
      this.pending = false;
      this.update();
    }
  }
}
