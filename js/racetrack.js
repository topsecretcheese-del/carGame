(()=>{'use strict';
const $=id=>document.getElementById(id),STORE='carBuilder.v1',LAPS=3;
let store={};try{store=JSON.parse(localStorage.getItem(STORE))||{}}catch{}
const design={...DEFAULT_DESIGN,...(store.current||{})};
const spec=simulate(design);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
$('game').append(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8da6b7);
scene.fog=new THREE.Fog(0x8da6b7,80,145);
const camera=new THREE.PerspectiveCamera(58,1,.1,220);
scene.add(new THREE.HemisphereLight(0xffffff,0x27321f,1.05));
const sun=new THREE.DirectionalLight(0xffffff,1.45);sun.position.set(-26,46,-20);sun.castShadow=true;scene.add(sun);

const ROAD_W=7,CENTER_Z=10,OUT_W=46,OUT_H=32,CORNER=9;
const MID_W=OUT_W/2-ROAD_W/2,MID_H=OUT_H/2-ROAD_W/2,MID_R=CORNER-ROAD_W/2;

const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,82),new THREE.MeshStandardMaterial({color:0x496a36,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

function roundedRectShape(w,h,r){
  const s=new THREE.Shape();
  s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);
  s.absarc(w/2-r,-h/2+r,r,-Math.PI/2,0,false);s.lineTo(w/2,h/2-r);
  s.absarc(w/2-r,h/2-r,r,0,Math.PI/2,false);s.lineTo(-w/2+r,h/2);
  s.absarc(-w/2+r,h/2-r,r,Math.PI/2,Math.PI,false);s.lineTo(-w/2,-h/2+r);
  s.absarc(-w/2+r,-h/2+r,r,Math.PI,Math.PI*1.5,false);return s
}
const roadShape=roundedRectShape(OUT_W,OUT_H,CORNER);
roadShape.holes.push(roundedRectShape(OUT_W-ROAD_W*2,OUT_H-ROAD_W*2,Math.max(2,CORNER-ROAD_W)));
const roadGeo=new THREE.ShapeGeometry(roadShape,64);roadGeo.rotateX(-Math.PI/2);
const road=new THREE.Mesh(roadGeo,new THREE.MeshStandardMaterial({color:0x25272a,roughness:.82,metalness:.03}));
road.position.z=CENTER_Z;road.position.y=.02;road.receiveShadow=true;scene.add(road);

const islandShape=roundedRectShape(OUT_W-ROAD_W*2-.35,OUT_H-ROAD_W*2-.35,Math.max(1.5,CORNER-ROAD_W-.2));
const islandGeo=new THREE.ShapeGeometry(islandShape,32);islandGeo.rotateX(-Math.PI/2);
const island=new THREE.Mesh(islandGeo,new THREE.MeshStandardMaterial({color:0x5e7d45,roughness:1}));
island.position.set(0,.025,CENTER_Z);scene.add(island);

function buildPath(){
  const pts=[],straight=12,arc=10,pushLine=(x0,z0,x1,z1)=>{for(let i=0;i<=straight;i++){const t=i/straight;pts.push(new THREE.Vector3(THREE.MathUtils.lerp(x0,x1,t),0,CENTER_Z+THREE.MathUtils.lerp(z0,z1,t)))}};const pushArc=(cx,cz,a0,a1)=>{for(let i=1;i<=arc;i++){const t=i/arc,a=THREE.MathUtils.lerp(a0,a1,t);pts.push(new THREE.Vector3(cx+Math.cos(a)*MID_R,0,CENTER_Z+cz+Math.sin(a)*MID_R))}};
  pushLine(-MID_W+MID_R,-MID_H,MID_W-MID_R,-MID_H);
  pushArc(MID_W-MID_R,-MID_H+MID_R,-Math.PI/2,0);
  pushLine(MID_W,-MID_H+MID_R,MID_W,MID_H-MID_R);
  pushArc(MID_W-MID_R,MID_H-MID_R,0,Math.PI/2);
  pushLine(MID_W-MID_R,MID_H,-MID_W+MID_R,MID_H);
  pushArc(-MID_W+MID_R,MID_H-MID_R,Math.PI/2,Math.PI);
  pushLine(-MID_W,MID_H-MID_R,-MID_W,-MID_H+MID_R);
  pushArc(-MID_W+MID_R,-MID_H+MID_R,Math.PI,Math.PI*1.5);
  return new THREE.CatmullRomCurve3(pts,true,'centripetal',.2)
}
const curve=buildPath(),SAMPLES=240,path=[];
for(let i=0;i<SAMPLES;i++){const u=i/SAMPLES,p=curve.getPointAt(u),t=curve.getTangentAt(u);path.push({p,t,n:new THREE.Vector3(-t.z,0,t.x).normalize()})}

const dashMat=new THREE.MeshStandardMaterial({color:0xe0b01c,roughness:.45});
for(let i=0;i<SAMPLES;i+=6){const q=path[i],m=new THREE.Mesh(new THREE.BoxGeometry(.16,.035,1.1),dashMat);m.position.set(q.p.x,.05,q.p.z);m.rotation.y=Math.atan2(q.t.x,q.t.z);scene.add(m)}
function edgeLine(offset,color){
  const pts=path.map(q=>q.p.clone().addScaledVector(q.n,offset).setY(.055));pts.push(pts[0].clone());
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color})))
}
edgeLine(ROAD_W/2-.22,0xffffff);edgeLine(-ROAD_W/2+.22,0xffffff);

const kerbRed=new THREE.MeshStandardMaterial({color:0xc9202d,roughness:.8}),kerbWhite=new THREE.MeshStandardMaterial({color:0xf5f5f5,roughness:.8});
for(let i=0;i<SAMPLES;i+=4){const q=path[i];for(const side of[-1,1]){const k=new THREE.Mesh(new THREE.BoxGeometry(.7,.09,.9),(i/4)%2?kerbRed:kerbWhite);k.position.copy(q.p).addScaledVector(q.n,side*(ROAD_W/2-.45));k.position.y=.07;k.rotation.y=Math.atan2(q.t.x,q.t.z);scene.add(k)}}

const railMat=new THREE.MeshStandardMaterial({color:0x7a8088,roughness:.5,metalness:.45});
for(let i=0;i<SAMPLES;i+=5){const q=path[i];for(const side of[-1,1]){const r=new THREE.Mesh(new THREE.BoxGeometry(.1,.16,1.25),railMat);r.position.copy(q.p).addScaledVector(q.n,side*(ROAD_W/2+1.2));r.position.y=.55;r.rotation.y=Math.atan2(q.t.x,q.t.z);scene.add(r)}}

const finish=path[5];
for(let i=0;i<10;i++){const tile=new THREE.Mesh(new THREE.BoxGeometry(ROAD_W/10,.04,.42),new THREE.MeshBasicMaterial({color:i%2?0x111111:0xffffff}));tile.position.copy(finish.p).addScaledVector(finish.n,-ROAD_W/2+(i+.5)*ROAD_W/10);tile.position.y=.07;tile.rotation.y=Math.atan2(finish.t.x,finish.t.z);scene.add(tile)}

for(let i=0;i<18;i++){const a=i/18*Math.PI*2,r=38+(i%3)*4,x=Math.cos(a)*r,z=CENTER_Z+Math.sin(a)*r*.72;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2.5,7),new THREE.MeshStandardMaterial({color:0x60422f}));trunk.position.set(x,1.25,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.6,4,8),new THREE.MeshStandardMaterial({color:0x2c5d37}));crown.position.set(x,3.7,z);scene.add(crown)}

function carMesh(d,color){
  const g=new THREE.Group(),body=BODIES[d.body],p=PROFILES[d.body],sim=simulate(d),len=body.length,width=p.width,r=Math.max(.28,sim.wheelRadius*.88);
  const paint=new THREE.MeshStandardMaterial({color:color||d.color,metalness:.28,roughness:.34}),dark=new THREE.MeshStandardMaterial({color:0x111318,roughness:.8}),glass=new THREE.MeshStandardMaterial({color:0x243543,transparent:true,opacity:.8,metalness:.15,roughness:.2});
  const shell=new THREE.Mesh(new THREE.BoxGeometry(width,.5,len*.78),paint);shell.position.y=r+.3;shell.castShadow=true;g.add(shell);
  if(d.body!=='roadster'){const cab=new THREE.Mesh(new THREE.BoxGeometry(width*.82,p.height*.45,len*(d.body==='wagon'||d.body==='suv'||d.body==='hatch'?.46:.36)),glass);cab.position.set(0,r+.72,-len*.04);cab.castShadow=true;g.add(cab)}
  const wheelZ=len*.29,tw=Math.max(.18,d.tireWidth/1000);
  for(const x of[-width*.5,width*.5])for(const z of[-wheelZ,wheelZ]){const tire=new THREE.Mesh(new THREE.CylinderGeometry(r,r,tw,20),dark);tire.rotation.z=Math.PI/2;tire.position.set(x,r,z);g.add(tire)}
  g.scale.setScalar(.86);return g
}

const P=(()=>{const box=GEARBOXES[design.gearbox],tire=TIRES[design.tires],body=BODIES[design.body];return{box,eff:box.eff*(design.drivetrain==='awd'?.95:1),mu:tire.mu*(1+(design.tireWidth-205)/1000),rr:tire.rr*(1+(design.tireWidth-205)/800),cdA:1.12*body.cd*body.area,brake:Math.max(8,spec.brakeG*10.2),launchRpm:Math.min(spec.engine.revLimit*.7,Math.max(2500,spec.engine.peakTorqueRpm*.8))}})();
const spawn=path[0],spawnYaw=Math.atan2(spawn.t.x,spawn.t.z);
const player={x:spawn.p.x,z:spawn.p.z,yaw:spawnYaw,speed:0,gear:0,rpm:P.launchRpm,shiftTimer:0,lap:1,progress:0,lastIndex:0,elapsed:0,finished:false};
const playerMesh=carMesh(design,design.color);scene.add(playerMesh);
const ai=[0x3b82f6,0xf59e0b,0x22c55e,0xa855f7,0xef4444].map((c,i)=>{const m=carMesh({...DEFAULT_DESIGN,body:['coupe','hatch','sedan','roadster','wagon'][i]},c);scene.add(m);return{mesh:m,u:(SAMPLES-8*(i+1))/SAMPLES,lap:1,progress:0,factor:.87+i*.025,finished:false}});
const keys={throttle:false,brake:false,left:false,right:false};let state='countdown',countStart=performance.now();

function rpmFor(speed,gear){return(Math.abs(speed)/spec.wheelRadius)*spec.ratios[gear]*design.finalDrive*60/(2*Math.PI)}
function nearestIndex(x,z){let best=0,bd=Infinity;for(let i=0;i<SAMPLES;i++){const p=path[i].p,d=(p.x-x)**2+(p.z-z)**2;if(d<bd){bd=d;best=i}}return{index:best,distance:Math.sqrt(bd)}}
function resistance(v){const a=Math.abs(v);return .5*1.2*P.cdA*a*a+P.rr*spec.mass*9.81}
function reset(){Object.assign(player,{x:spawn.p.x,z:spawn.p.z,yaw:spawnYaw,speed:0,gear:0,rpm:P.launchRpm,shiftTimer:0,lap:1,progress:0,lastIndex:0,elapsed:0,finished:false});ai.forEach((b,i)=>Object.assign(b,{u:(SAMPLES-8*(i+1))/SAMPLES,lap:1,progress:0,finished:false}));state='countdown';countStart=performance.now();$('result').hidden=true}
function updatePlayer(dt){
  if(state!=='racing'||player.finished)return;
  const throttle=keys.throttle?1:0,braking=keys.brake?1:0,near=nearestIndex(player.x,player.z),off=near.distance>ROAD_W*.56;
  let drive=0;if(player.shiftTimer>0){player.shiftTimer=Math.max(0,player.shiftTimer-dt)}else if(player.speed>=0){let rpm=rpmFor(player.speed,player.gear);if(player.gear===0)rpm=Math.max(rpm,P.launchRpm);if(rpm>=spec.engine.revLimit*.985&&player.gear<spec.ratios.length-1){player.gear++;player.shiftTimer=P.box.shift;rpm=rpmFor(player.speed,player.gear)}if(player.gear>0&&rpm<Math.max(1400,spec.engine.peakTorqueRpm*.48)){const lo=rpmFor(player.speed,player.gear-1);if(lo<spec.engine.revLimit*.93)player.gear--;rpm=rpmFor(player.speed,player.gear)}player.rpm=Math.min(spec.engine.revLimit,rpm);if(throttle){const torque=spec.engine.torqueAt(player.rpm),wheel=torque*spec.ratios[player.gear]*design.finalDrive*P.eff;drive=Math.min(wheel/spec.wheelRadius,P.mu*spec.mass*9.81)}}
  let brake=0;if(braking){if(player.speed>.4)brake=P.brake*spec.mass;else drive=-spec.mass*2.5}
  const net=drive-brake-resistance(player.speed)*(player.speed===0?0:Math.sign(player.speed));player.speed+=net/(spec.mass*1.05)*dt;if(!throttle&&!braking)player.speed*=Math.pow(.997,dt*60);player.speed=Math.max(-7,player.speed);if(off)player.speed*=Math.pow(.955,dt*60);
  const steer=(keys.left?1:0)-(keys.right?1:0),ratio=Math.min(1,Math.abs(player.speed)/18);player.yaw+=steer*(.78+spec.lateralG*.35)*(.35+ratio*.65)*dt*(player.speed>=0?1:-1);
  player.x+=Math.sin(player.yaw)*player.speed*dt;player.z+=Math.cos(player.yaw)*player.speed*dt;player.elapsed+=dt;
  const ni=near.index;if(player.lastIndex>SAMPLES*.8&&ni<SAMPLES*.2){player.lap++;if(player.lap>LAPS){player.finished=true;state='finished'}}player.lastIndex=ni;player.progress=(player.lap-1)*SAMPLES+ni;
  playerMesh.position.set(player.x,.04,player.z);playerMesh.rotation.y=player.yaw;
}
function updateAI(dt){if(state!=='racing')return;ai.forEach(b=>{if(b.finished)return;const old=b.u;b.u+=(0.045+Math.min(.035,spec.topSpeed/1800))*b.factor*dt;if(b.u>=1){b.u-=1;b.lap++;if(b.lap>LAPS)b.finished=true}const p=curve.getPointAt(b.u),t=curve.getTangentAt(b.u);b.mesh.position.set(p.x,.04,p.z);b.mesh.rotation.y=Math.atan2(t.x,t.z);b.progress=(b.lap-1)*SAMPLES+b.u*SAMPLES})}
function fmt(t){const m=Math.floor(t/60),s=t-m*60;return m+':'+s.toFixed(3).padStart(6,'0')}
function hud(){const list=[{me:1,p:player.progress},...ai.map(b=>({me:0,p:b.progress}))].sort((a,b)=>b.p-a.p),pos=list.findIndex(x=>x.me)+1;$('position').textContent=pos+' / 6';$('lap').textContent='Lap '+Math.min(player.lap,LAPS)+' / '+LAPS;$('speed').textContent=Math.round(Math.max(0,player.speed)*3.6)+' km/h';$('gear').textContent='G '+(player.speed<-.1?'R':player.gear+1);$('rpm').textContent=Math.round(player.rpm/100)*100+' rpm';$('time').textContent=fmt(player.elapsed);if(player.finished&&$('result').hidden){$('result').textContent='Finished '+pos+(pos===1?'st':pos===2?'nd':pos===3?'rd':'th')+' · '+fmt(player.elapsed);$('result').hidden=false}}
function resize(){const el=$('game'),w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe($('game'));
const map={ArrowUp:'throttle',KeyW:'throttle',ArrowDown:'brake',KeyS:'brake',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
addEventListener('keydown',e=>{if(e.code==='KeyR')return reset();if(map[e.code]){e.preventDefault();keys[map[e.code]]=true}});
addEventListener('keyup',e=>{if(map[e.code])keys[map[e.code]]=false});
document.querySelectorAll('[data-k]').forEach(b=>{const k=b.dataset.k;b.onpointerdown=e=>{e.preventDefault();keys[k]=true};b.onpointerup=b.onpointercancel=b.onpointerleave=()=>keys[k]=false});
$('restart').onclick=reset;
$('car-name').textContent=design.name||'Current design';$('car-spec').textContent=BODIES[design.body].name+' · '+LAYOUTS[design.layout].name+' · '+GEARBOXES[design.gearbox].name+' · '+DRIVETRAINS[design.drivetrain].name;$('stats').innerHTML='<span>'+Math.round(spec.engine.peakPower*1.341)+' hp</span><span>'+Math.round(spec.mass)+' kg</span><span>'+Math.round(spec.topSpeed*3.6)+' km/h</span><span>'+spec.lateralG.toFixed(2)+' g</span>';
reset();resize();let last=performance.now();
function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;if(state==='countdown'){const e=(now-countStart)/1000;$('countdown').textContent=e<1?'3':e<2?'2':e<3?'1':e<3.7?'GO':'';if(e>=3.7)state='racing'}updatePlayer(dt);updateAI(dt);const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw),want=new THREE.Vector3(player.x-fx*10,7.2,player.z-fz*10);camera.position.lerp(want,1-Math.pow(.002,dt));camera.lookAt(player.x+fx*8,1.2,player.z+fz*8);hud();renderer.render(scene,camera);requestAnimationFrame(frame)}
requestAnimationFrame(frame);
})();