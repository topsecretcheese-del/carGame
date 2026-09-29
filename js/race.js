(()=>{'use strict';const $=id=>document.getElementById(id),STORE='carBuilder.v1',LAPS=3,RX=56,RZ=34,W=11;let store={};try{store=JSON.parse(localStorage.getItem(STORE))||{}}catch{}const choices=[{label:'Current design',design:{...DEFAULT_DESIGN,...(store.current||{})}},...((store.garage||[]).filter(x=>x&&x.design).map(x=>({label:x.design.name||'Saved car',design:{...DEFAULT_DESIGN,...x.design}})))];const sel=$('car-select');choices.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.label;sel.append(o)});let design=choices[0].design,spec=simulate(design);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;$('race-view').append(renderer.domElement);const scene=new THREE.Scene();scene.background=new THREE.Color(0x86a2b8);scene.fog=new THREE.Fog(0x86a2b8,95,180);const camera=new THREE.PerspectiveCamera(58,1,.1,250);scene.add(new THREE.HemisphereLight(0xffffff,0x35442f,1.15));const sun=new THREE.DirectionalLight(0xffffff,1.4);sun.position.set(-35,55,20);sun.castShadow=true;scene.add(sun);const ground=new THREE.Mesh(new THREE.PlaneGeometry(190,145),new THREE.MeshStandardMaterial({color:0x527441}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);function ring(rx,rz,width,color){const s=new THREE.Shape();s.absellipse(0,0,rx+width/2,rz+width/2,0,Math.PI*2);const h=new THREE.Path();h.absellipse(0,0,rx-width/2,rz-width/2,0,Math.PI*2,true);s.holes.push(h);const m=new THREE.Mesh(new THREE.ShapeGeometry(s,128),new THREE.MeshStandardMaterial({color,roughness:.95}));m.rotation.x=Math.PI/2;m.position.y=.02;m.receiveShadow=true;scene.add(m)}ring(RX,RZ,W,0x30343a);const stripe=new THREE.Mesh(new THREE.PlaneGeometry(W,1.1),new THREE.MeshBasicMaterial({color:0xffffff}));stripe.rotation.x=-Math.PI/2;stripe.rotation.z=Math.PI/2;stripe.position.set(RX,.04,0);scene.add(stripe);for(let i=0;i<30;i++){const a=i/30*Math.PI*2,r=i%2?74:22,x=r*Math.cos(a)*1.08,z=r*Math.sin(a)*.78,t=new THREE.Mesh(new THREE.CylinderGeometry(.3,.45,3.2,7),new THREE.MeshStandardMaterial({color:0x65452f}));t.position.set(x,1.6,z);scene.add(t);const c=new THREE.Mesh(new THREE.ConeGeometry(2.2,5.5,8),new THREE.MeshStandardMaterial({color:0x2c5e36}));c.position.set(x,4.8,z);scene.add(c)}function car(d,color){
  const g=new THREE.Group(),b=BODIES[d.body],p=PROFILES[d.body],sim=simulate(d);
  const len=b.length,width=p.width,r=Math.max(.28,sim.wheelRadius*.88),tireW=Math.max(.18,d.tireWidth/1000);
  const paint=new THREE.MeshStandardMaterial({color:color||d.color,metalness:.32,roughness:.38});
  const dark=new THREE.MeshStandardMaterial({color:0x101114,roughness:.85});
  const chrome=new THREE.MeshStandardMaterial({color:0xd9dde2,metalness:1,roughness:.16});
  const stripeMat=new THREE.MeshStandardMaterial({color:d.stripeColor||'#f2f2f2',metalness:.08,roughness:.4});
  const tint={clear:[0x6f8797,.45],light:[0x1b2632,.78],dark:[0x040608,.94]}[d.tint]||[0x1b2632,.78];
  const glass=new THREE.MeshStandardMaterial({color:tint[0],transparent:true,opacity:tint[1],metalness:.18,roughness:.15});
  const rimDef=RIM_FINISHES[d.rimFinish]||RIM_FINISHES.silver;
  const rimMat=new THREE.MeshStandardMaterial({color:rimDef.color,metalness:rimDef.metal,roughness:rimDef.rough});
  const headMat=new THREE.MeshStandardMaterial({color:0xfff4c9,emissive:0xffd98a,emissiveIntensity:.7});
  const tailMat=new THREE.MeshStandardMaterial({color:0x690707,emissive:0xe42018,emissiveIntensity:.55});
  const add=(geo,mat,x,y,z,parent=g)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
  const box=(x,y,z,sx,sy,sz,mat,parent=g)=>add(new THREE.BoxGeometry(sx,sy,sz),mat,x,y,z,parent);
  const shellY=r+.28;
  const shell=box(0,shellY,0,len*.78,.5,width,paint);
  const cabinLen=len*(d.body==='pickup' ? .28 :d.body==='wagon'||d.body==='suv'||d.body==='hatch' ? .48 :d.body==='roadster' ? .12 : .4);
  if(d.body!=='roadster'){
    const cabin=box(d.body==='pickup'?len*.1:-len*.02,r+.68,0,cabinLen,p.height*.48,width*.82,glass);
    cabin.castShadow=true;
  }else{
    box(-len*.02,r+.52,0,len*.18,.12,width*.78,dark);
    const screen=box(len*.09,r+.72,0,.04,.42,width*.72,glass);screen.rotation.z=-.18;
  }

  // Headlights and grille at the front (+X).
  const frontX=len*.395,rearX=-len*.395,lightY=shellY+.06;
  for(const side of[-1,1]){
    const z=side*width*.31;
    if(d.headlights==='round'){
      const lamp=add(new THREE.CylinderGeometry(.085,.085,.055,20),headMat,frontX+.02,lightY,z);lamp.rotation.z=Math.PI/2;
    }else if(d.headlights==='slim'){
      box(frontX+.02,lightY+.02,z,.055,.045,.34,headMat);
    }else if(d.headlights==='popup'){
      box(frontX-.12,shellY+.31,z,.2,.1,.28,paint);
      box(frontX-.015,shellY+.33,z,.035,.075,.24,headMat);
    }else{
      box(frontX+.02,lightY,z,.055,.095,.28,headMat);
    }
    box(rearX-.02,lightY,z,.05,.09,.3,tailMat);
  }
  if(d.grille==='slats'){
    box(frontX+.025,shellY-.08,0,.04,.15,width*.46,dark);
    for(const y of[-.045,0,.045])box(frontX+.05,shellY-.08+y,0,.014,.012,width*.44,chrome);
  }else if(d.grille==='mesh'){
    box(frontX+.03,shellY-.08,0,.045,.17,width*.5,dark);
    for(let k=-3;k<=3;k++)box(frontX+.055,shellY-.08,k*width*.055,.012,.14,.012,chrome);
  }else if(d.grille==='big'){
    box(frontX+.03,shellY-.05,0,.045,.28,width*.55,chrome);
    box(frontX+.055,shellY-.05,0,.03,.22,width*.48,dark);
  }else{
    box(frontX+.03,shellY-.12,0,.035,.05,width*.55,dark);
  }

  // Hood details.
  const hoodX=len*.22,hoodY=shellY+.28;
  if(d.hood==='bulge')box(hoodX,hoodY+.03,0,len*.22,.07,width*.42,paint);
  if(d.hood==='scoop'){
    box(hoodX,hoodY+.07,0,.36,.11,.42,paint);
    box(hoodX+.19,hoodY+.07,0,.025,.06,.32,dark);
  }
  if(d.hood==='vents')for(const side of[-1,1])for(let k=0;k<3;k++)box(hoodX+k*.07,hoodY+.015,side*.25,.12,.018,.035,dark);

  // Roof choices.
  const roofY=r+.93;
  if(d.body!=='roadster'){
    if(d.roof==='black')box(-len*.03,roofY,0,cabinLen*.78,.035,width*.72,dark);
    if(d.roof==='sunroof')box(-len*.03,roofY+.01,0,cabinLen*.42,.025,width*.48,glass);
    if(d.roof==='rack'){
      for(const z of[-width*.34,width*.34])box(-len*.03,roofY+.11,z,cabinLen*.72,.035,.035,dark);
      for(const x of[-cabinLen*.25,cabinLen*.25])box(x-len*.03,roofY+.14,0,.035,.035,width*.75,dark);
    }
  }

  // Racing and side stripes.
  if(d.stripes==='twin'||d.stripes==='both'){
    for(const z of[-.12,.12])box(0,shellY+.265,z,len*.72,.025,.11,stripeMat);
    if(d.body!=='roadster')for(const z of[-.12,.12])box(-len*.02,r+.925,z,cabinLen*.7,.025,.1,stripeMat);
  }
  if(d.stripes==='side'||d.stripes==='both'){
    for(const z of[-width*.505,width*.505])box(0,shellY-.02,z,len*.65,.07,.018,stripeMat);
  }

  // Spoilers.
  if(d.spoiler&&d.spoiler!=='none'){
    if(d.spoiler==='lip')box(rearX-.02,shellY+.29,0,.16,.04,width*.72,paint);
    else if(d.spoiler==='ducktail'){const sp=box(rearX-.03,shellY+.33,0,.24,.08,width*.76,paint);sp.rotation.z=.18}
    else{
      const big=d.spoiler==='bigWing',h=big ? .42 : .28,span=width*(big?1:.9);
      for(const z of[-width*.28,width*.28])box(rearX+.08,shellY+.32+h/2,z,.06,h,.04,dark);
      box(rearX+.03,shellY+.32+h,0,big ? .4 : .32,.045,span,dark);
      if(big)for(const z of[-span/2,span/2])box(rearX+.03,shellY+.32+h,z,.42,.15,.025,dark);
    }
  }

  // Body kits.
  if(d.bodykit==='skirts'){
    for(const z of[-width*.51,width*.51])box(0,r+.1,z,len*.56,.075,.05,dark);
    box(frontX-.07,r+.08,0,.2,.035,width*.9,dark);
  }else if(d.bodykit==='rally'){
    for(const x of[-len*.29,len*.29])for(const z of[-width*.51,width*.51])box(x-.12,r*.55,z,.035,.25,tireW+.07,dark);
    for(const z of[-.42,-.14,.14,.42]){
      const lamp=add(new THREE.CylinderGeometry(.065,.065,.05,16),headMat,frontX+.06,shellY,z);lamp.rotation.z=Math.PI/2;
    }
  }

  // Wheels and selected rim style/finish.
  const wheelX=len*.29,rimR=Math.max(.12,d.rim*.0127*.82);
  function wheelAt(x,z,side){
    const wg=new THREE.Group();wg.position.set(x,r,z);g.add(wg);
    const tire=add(new THREE.CylinderGeometry(r,r,tireW,24),dark,0,0,0,wg);tire.rotation.x=Math.PI/2;
    const face=side*(tireW/2+.008);
    const disc=add(new THREE.CylinderGeometry(rimR,rimR,.025,28),d.wheelStyle==='steel'?dark:rimMat,0,0,face,wg);disc.rotation.x=Math.PI/2;
    if(d.wheelStyle==='steel'){
      const hub=add(new THREE.CylinderGeometry(rimR*.5,rimR*.5,.035,24),chrome,0,0,face+side*.012,wg);hub.rotation.x=Math.PI/2;
    }else if(d.wheelStyle==='dish'){
      const hub=add(new THREE.CylinderGeometry(rimR*.24,rimR*.24,.04,24),rimMat,0,0,face+side*.012,wg);hub.rotation.x=Math.PI/2;
      for(let k=0;k<10;k++){const a=k/10*Math.PI*2,s=box(Math.cos(a)*rimR*.6,Math.sin(a)*rimR*.6,face,.12,.025,.025,dark,wg);s.rotation.z=a}
    }else{
      const n=d.wheelStyle==='multiSpoke'?10:d.wheelStyle==='mesh'?12:5;
      for(let k=0;k<n;k++){
        const a=k/n*Math.PI*2,sp=box(Math.cos(a)*rimR*.42,Math.sin(a)*rimR*.42,face,rimR*.75,(d.wheelStyle==='multiSpoke'||d.wheelStyle==='mesh') ? .026 : .045,.025,rimMat,wg);
        sp.rotation.z=a;
        if(d.wheelStyle==='mesh'){const sp2=sp.clone();sp2.rotation.z=a+.35;wg.add(sp2)}
      }
    }
    const hub=add(new THREE.CylinderGeometry(rimR*.16,rimR*.16,.04,20),chrome,0,0,face+side*.015,wg);hub.rotation.x=Math.PI/2;
  }
  for(const x of[-wheelX,wheelX])for(const side of[-1,1])wheelAt(x,side*width*.5,side);

  g.scale.setScalar(.86);
  return g;
}const player={x:RX,z:-2.4,yaw:0,speed:0,lap:1,progress:0,last:0,elapsed:0,lapStart:0,best:null,finished:false,gear:0,shiftTimer:0,rpm:0,accel:0};let playerMesh,ai=[],state='countdown',countStart=performance.now();const keys={throttle:false,brake:false,left:false,right:false};function ang(x,z){let a=Math.atan2(z/RZ,x/RX);return a<0?a+Math.PI*2:a}function delta(a,b){let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d}function phys(){
  const body=BODIES[design.body],box=GEARBOXES[design.gearbox],tire=TIRES[design.tires];
  const eff=box.eff*(design.drivetrain==='awd'?.95:1);
  const widthGrip=1+(design.tireWidth-205)/1000;
  const mu=tire.mu*widthGrip;
  const rr=tire.rr*(1+(design.tireWidth-205)/800);
  const cdA=1.12*body.cd*body.area*(1+(design.tireWidth-205)/2000);
  const launchRpm=Math.min(spec.engine.revLimit*.7,Math.max(2500,spec.engine.peakTorqueRpm*.8));
  return{
    box,eff,mu,rr,cdA,launchRpm,
    brake:Math.max(8,spec.brakeG*10.2),
    grip:Math.max(.55,spec.lateralG),
    reverse:8
  };
}
function engineRpmFor(speed,gear){
  return (Math.abs(speed)/spec.wheelRadius)*spec.ratios[gear]*design.finalDrive*60/(2*Math.PI);
}
function tractionLimit(accel){
  const shift=.12*(accel/9.81);
  const share=design.drivetrain==='awd'?1:design.drivetrain==='fwd'?.6-shift:.46+shift;
  return P.mu*spec.mass*9.81*Math.max(.3,Math.min(1,share));
}
function roadResistance(speed){
  const v=Math.abs(speed);
  return .5*1.2*P.cdA*v*v+P.rr*spec.mass*9.81;
}
let P=phys();function reset(){Object.assign(player,{x:RX,z:-2.4,yaw:0,speed:0,lap:1,progress:0,last:ang(RX,-2.4),elapsed:0,lapStart:0,best:null,finished:false,gear:0,shiftTimer:0,rpm:P.launchRpm,accel:0});$('result').hidden=true;state='countdown';countStart=performance.now();ai.forEach((b,i)=>Object.assign(b,{t:-.045*(i+1),lap:1,progress:0,finished:false}))}function setup(){if(playerMesh)scene.remove(playerMesh);ai.forEach(b=>scene.remove(b.mesh));ai=[];playerMesh=car(design,design.color);scene.add(playerMesh);[0x3b82f6,0xf59e0b,0x22c55e,0xa855f7,0xef4444].forEach((c,i)=>{const m=car({...DEFAULT_DESIGN,body:['coupe','hatch','sedan','roadster','wagon'][i]},c);scene.add(m);ai.push({mesh:m,t:-.045*(i+1),lap:1,progress:0,factor:.82+i*.035,lane:(i%2?1:-1)*(1.3+i%3*.35),finished:false})});$('car-name').textContent=design.name||'Unnamed';$('car-spec').textContent=`${BODIES[design.body].name} · ${LAYOUTS[design.layout].name} · ${GEARBOXES[design.gearbox].name} · ${DRIVETRAINS[design.drivetrain].name}`;$('car-stats').innerHTML=`<span>${Math.round(spec.engine.peakPower*1.341)} hp</span><span>${Math.round(spec.mass)} kg</span><span>${Math.round(spec.topSpeed*3.6)} km/h</span><span>${spec.lateralG.toFixed(2)} g</span>`;reset()}function fmt(t){const m=Math.floor(t/60),s=t-m*60;return `${m}:${s.toFixed(3).padStart(6,'0')}`}function off(){return Math.abs(Math.sqrt((player.x/RX)**2+(player.z/RZ)**2)-1)>.105}function updatePlayer(dt){
  if(state!=='racing'||player.finished)return;

  const throttle=keys.throttle?1:0;
  const braking=keys.brake?1:0;
  const isOff=off();
  let driveForce=0;

  if(player.shiftTimer>0){
    player.shiftTimer=Math.max(0,player.shiftTimer-dt);
    player.rpm=engineRpmFor(player.speed,player.gear);
  }else if(player.speed>=0){
    let rpm=engineRpmFor(player.speed,player.gear);
    if(player.gear===0)rpm=Math.max(rpm,P.launchRpm);

    // Automatic upshift just before the limiter, using the selected gearbox's real shift delay.
    if(rpm>=spec.engine.revLimit*.985&&player.gear<spec.ratios.length-1){
      player.gear++;
      player.shiftTimer=P.box.shift;
      rpm=engineRpmFor(player.speed,player.gear);
    }

    // Downshift when revs fall well below the useful torque band.
    if(player.gear>0&&rpm<Math.max(1400,spec.engine.peakTorqueRpm*.48)){
      const lower=engineRpmFor(player.speed,player.gear-1);
      if(lower<spec.engine.revLimit*.93)player.gear--;
      rpm=engineRpmFor(player.speed,player.gear);
    }

    player.rpm=Math.min(spec.engine.revLimit,rpm);
    if(throttle){
      const torque=spec.engine.torqueAt(player.rpm);
      const wheelTorque=torque*spec.ratios[player.gear]*design.finalDrive*P.eff;
      const rawForce=wheelTorque/spec.wheelRadius;
      driveForce=Math.min(rawForce,tractionLimit(player.accel));
    }
  }

  // Forward braking; once stopped, the brake control becomes reverse.
  let brakeForce=0;
  if(braking){
    if(player.speed>.5)brakeForce=P.brake*spec.mass;
    else if(player.speed<=.5)driveForce=-Math.min(spec.mass*3.0,tractionLimit(0)*.45);
  }

  let resist=roadResistance(player.speed);
  if(Math.abs(player.speed)<.15&&!throttle&&!braking)resist=0;
  const resistSign=player.speed===0?0:Math.sign(player.speed);
  const netForce=driveForce-brakeForce-resist*resistSign;
  player.accel=netForce/(spec.mass*1.05);
  player.speed+=player.accel*dt;

  if(!throttle&&!braking)player.speed*=Math.pow(.997,dt*60);
  if(Math.abs(player.speed)<.03&&!throttle&&!braking)player.speed=0;
  player.speed=Math.max(-P.reverse,player.speed);
  if(isOff)player.speed*=Math.pow(.965,dt*60);

  const steer=(keys.left?1:0)-(keys.right?1:0);
  const ratio=Math.min(1,Math.abs(player.speed)/18);
  player.yaw+=steer*(.7+P.grip*.42)*(.35+ratio*.65)*dt*(player.speed>=0?1:-1);
  if(Math.abs(steer)&&Math.abs(player.speed)>12){
    const cornerDemand=Math.abs(player.speed)/(Math.max(.6,P.grip)*21);
    if(cornerDemand>1)player.speed*=Math.pow(.982,dt*60*(cornerDemand-.7));
  }

  player.x+=Math.sin(player.yaw)*player.speed*dt;
  player.z+=Math.cos(player.yaw)*player.speed*dt;
  const a=ang(player.x,player.z),d=delta(a,player.last);
  player.progress+=d>-.12?d:d*.15;
  player.last=a;
  player.elapsed+=dt;

  if(player.progress>=Math.PI*2){
    player.progress-=Math.PI*2;
    const lt=player.elapsed-player.lapStart;
    player.best=player.best==null?lt:Math.min(player.best,lt);
    player.lapStart=player.elapsed;
    if(player.lap>=LAPS){player.finished=true;state='finished'}else player.lap++;
  }

  playerMesh.position.set(player.x,.04,player.z);
  playerMesh.rotation.y=player.yaw-Math.PI/2;
}
function updateAI(dt){if(state!=='racing')return;ai.forEach(b=>{if(b.finished)return;const old=b.t;b.t+=(28+Math.min(52,spec.topSpeed*.18))*b.factor/45*dt;b.progress+=b.t-old;if(b.progress>=Math.PI*2){b.progress-=Math.PI*2;if(b.lap>=LAPS)b.finished=true;else b.lap++}const rx=RX+b.lane,rz=RZ+b.lane,x=rx*Math.cos(b.t),z=rz*Math.sin(b.t),dx=-rx*Math.sin(b.t),dz=rz*Math.cos(b.t);b.mesh.position.set(x,.04,z);b.mesh.rotation.y=Math.atan2(dx,dz)-Math.PI/2})}function prog(r){return(r.lap-1)*Math.PI*2+Math.max(0,r.progress||0)}function hud(){const list=[{me:1,p:prog(player)},...ai.map(b=>({me:0,p:prog(b)}))].sort((a,b)=>b.p-a.p),pos=list.findIndex(x=>x.me)+1;$('position').textContent=`${pos} / 6`;$('lap').textContent=`Lap ${Math.min(player.lap,LAPS)} / ${LAPS}`;$('speed').textContent=`${Math.round(Math.max(0,player.speed)*3.6)} km/h`;$('time').textContent=fmt(player.elapsed);$('best').textContent=`Best ${player.best==null?'—':fmt(player.best)}`;if($('gear'))$('gear').textContent=`G ${player.speed<-.1?'R':player.gear+1}`;if($('rpm'))$('rpm').textContent=`${Math.round(player.rpm/100)*100} rpm`;if(player.finished&&$('result').hidden){$('result').textContent=`Finished ${pos}${pos===1?'st':pos===2?'nd':pos===3?'rd':'th'} · ${fmt(player.elapsed)}`;$('result').hidden=false}}function resize(){const h=$('race-view'),w=h.clientWidth,hh=h.clientHeight;renderer.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe($('race-view'));const map={ArrowUp:'throttle',KeyW:'throttle',ArrowDown:'brake',KeyS:'brake',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};addEventListener('keydown',e=>{if(e.code==='KeyR')return reset();if(map[e.code]){e.preventDefault();keys[map[e.code]]=true}});addEventListener('keyup',e=>{if(map[e.code])keys[map[e.code]]=false});document.querySelectorAll('[data-k]').forEach(b=>{const k=b.dataset.k;b.onpointerdown=e=>{e.preventDefault();keys[k]=true};b.onpointerup=b.onpointercancel=b.onpointerleave=()=>keys[k]=false});sel.onchange=()=>{design=choices[+sel.value].design;spec=simulate(design);P=phys();setup()};$('restart').onclick=reset;setup();resize();let last=performance.now();function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;if(state==='countdown'){const e=(now-countStart)/1000;$('countdown').textContent=e<1?'3':e<2?'2':e<3?'1':e<3.7?'GO':'';if(e>=3.7)state='racing'}updatePlayer(dt);updateAI(dt);const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw),want=new THREE.Vector3(player.x-fx*11,6.8,player.z-fz*11);camera.position.lerp(want,1-Math.pow(.002,dt));camera.lookAt(player.x+fx*8,1.1,player.z+fz*8);hud();renderer.render(scene,camera);requestAnimationFrame(frame)}requestAnimationFrame(frame)})();