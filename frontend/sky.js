import { Camera, Mesh, PlaneGeometry, Scene, ShaderMaterial, WebGLRenderer, Vector2 } from 'three';

const modes = {sunny:0,'clear-night':0,partlycloudy:1,cloudy:2,rainy:3,pouring:3,
  'lightning-rainy':3,lightning:2,snowy:4,'snowy-rainy':5,fog:6,windy:1,'windy-variant':1,hail:5};

export function mountSky(host) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    renderer = new WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
  } catch { return null; }
  canvas.setAttribute('aria-hidden','true');
  host.prepend(canvas);
  const scene = new Scene();
  const camera = new Camera();
  const geometry = new PlaneGeometry(2,2);
  const uniforms = {time:{value:0},size:{value:new Vector2(1,1)},mode:{value:0},night:{value:0}};
  const material = new ShaderMaterial({
    uniforms, transparent:true,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform float time,mode,night;
      uniform vec2 size;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      float cloud(vec2 p){return .55*noise(p)+.29*noise(p*2.05)+.16*noise(p*4.12);}
      float particles(vec2 p,float snow,float seed){
        vec2 grid=p*mix(vec2(36.,13.),vec2(28.,16.),snow);
        grid.y+=time*mix(15.,1.9,snow);
        grid.x+=mix(grid.y*.21,sin(grid.y*.25+seed)*.4,snow);
        vec2 id=floor(grid),q=fract(grid)-vec2(.25+.5*hash(id+seed),.5);
        float d=length(q*mix(vec2(7.,.7),vec2(4.,2.6),snow));
        return (1.-smoothstep(.06,.24,d))*step(.47,hash(id+seed+9.));
      }
      void main(){
        vec2 uv=gl_FragCoord.xy/size;
        vec2 p=vec2(uv.x*size.x/size.y,uv.y);
        float drift=time*.055;
        float n=cloud(vec2(p.x*1.45-drift,p.y*4.6));
        float threshold=mode<1.5?.56:.36;
        float cover=smoothstep(threshold,threshold+.26,n)*smoothstep(.07,.56,uv.y);
        cover*=mode>.5?.64:0.;
        vec3 color=mix(vec3(.79,.87,.94),vec3(.46,.57,.72),night);
        if(mode>5.5){
          cover=smoothstep(.22,.76,cloud(vec2(p.x*.89-drift,p.y*9.)))*.69;
          color=mix(vec3(.86,.91,.95),vec3(.62,.70,.80),night);
        }
        if(mode>2.5 && mode<5.5){
          float drops=particles(p,mode>3.5?1.:0.,3.);
          if(mode>4.5) drops=max(drops,particles(p+.07,0.,8.)*.65);
          cover=max(cover,drops*.86);
        }
        if(mode<.5 && night>.5){
          vec2 stars=p*45.;
          float sparkle=(1.-smoothstep(.025,.13,length(fract(stars)-.5)))*step(.993,hash(floor(stars)));
          cover=sparkle*(.48+.25*sin(time*1.4+hash(floor(stars))*22.));
        }
        float edge=smoothstep(0.,.38,uv.x);
        gl_FragColor=vec4(color,cover*edge);
      }`,
  });
  scene.add(new Mesh(geometry,material));
  let frame=0, started=performance.now(), visible=true, lost=false;
  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight),false);
    renderer.getDrawingBufferSize(uniforms.size.value);
    draw(performance.now());
  }
  function draw(now) {
    if (lost || motion.matches || !visible || document.hidden) return;
    uniforms.time.value=(now-started)/1000;
    renderer.render(scene,camera);
  }
  function tick(now) {
    frame=0;
    draw(now);
    sync();
  }
  function sync() {
    canvas.hidden=motion.matches || lost;
    const active=visible && !document.hidden && !motion.matches && !lost
      && (uniforms.mode.value !== 0 || uniforms.night.value !== 0);
    if(active && !frame) frame=requestAnimationFrame(tick);
    if(!active && frame){cancelAnimationFrame(frame);frame=0;}
  }
  const observer=new ResizeObserver(resize);
  observer.observe(host);
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
  intersection.observe(host);
  const contextLost=()=>{lost=true;sync();};
  canvas.addEventListener('webglcontextlost',contextLost);
  document.addEventListener('visibilitychange',sync);
  motion.addEventListener('change',sync);
  resize();
  return {
    update(condition, isNight) {
      uniforms.mode.value=modes[condition] ?? 0;
      uniforms.night.value=isNight?1:0;
      canvas.style.visibility=condition?'visible':'hidden';
      draw(performance.now());
      sync();
    },
    dispose() {
      lost=true;
      sync();
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange',sync);
      motion.removeEventListener('change',sync);
      canvas.removeEventListener('webglcontextlost',contextLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
