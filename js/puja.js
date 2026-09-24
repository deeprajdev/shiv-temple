
/* Shiva puja: an animated 3D temple interior with sound. Everything is a pure function of the loop time,
   so it can pause, restart and loop cleanly. */
window.__failPuja=function(msg){
  var m=document.getElementById('pjloadmsg'),e=document.getElementById('pjerr');
  if(m)m.textContent="The puja scene couldn't start";
  if(e)e.textContent=msg;
};
window.__startPuja=function(){
'use strict';
var host=document.getElementById('pujaapp');
function q(s){return host.querySelector(s)}
var V3=THREE.Vector3;
function clamp(x,a,b){return Math.min(b,Math.max(a,x))}
function lerp(a,b,t){return a+(b-a)*t}
function smooth(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function tri(t){return 1-Math.abs(((t%1)+1)%1*2-1)}
var seed=7;function rnd(){seed=seed*16807%2147483647;return seed/2147483647}
function rr(a,b){return a+(b-a)*rnd()}
function pick(a){return a[Math.floor(rnd()*a.length)]}
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function W(){return host.clientWidth||innerWidth}
function H(){return host.clientHeight||innerHeight}

/* ---------- renderer, scene, camera ---------- */
var renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true})}catch(err){window.__failPuja('WebGL is not available on this device or browser.');return}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.setSize(W(),H());
renderer.setClearColor(0x050b1c,1);
q('#pjstage').appendChild(renderer.domElement);
var scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x0a1330,0.015);
var cam=new THREE.PerspectiveCamera(54,W()/H(),0.1,160);
cam.position.set(0,1.9,32);
var controls=new THREE.OrbitControls(cam,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.08;controls.enabled=false;
controls.maxPolarAngle=Math.PI*0.52;controls.minDistance=1.2;controls.maxDistance=40;

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xa9c8ff,0x0a1230,0.6));
function plight(c,i,d,x,y,z){var l=new THREE.PointLight(c,i,d,1.6);l.position.set(x,y,z);scene.add(l);return l}
var lSanct=plight(0xffb45a,1.7,24,0,3.6,-11);
var lNandi=plight(0xffa040,0.9,18,0,4.2,-1);
var lHall1=plight(0xff9a45,0.95,28,0,7.5,10);
var lHall2=plight(0xff9a45,0.85,28,0,7.5,22);
var lDoor=plight(0xbcd6ff,1.0,24,0,5,32);

/* ---------- materials and merged static geometry ---------- */
var vcMat=new THREE.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:0.88,metalness:0.02,flatShading:true});
var goldMat=new THREE.MeshStandardMaterial({color:0xdfe9fb,metalness:0.8,roughness:0.3,emissive:0x1a2a55,emissiveIntensity:0.4,flatShading:true});
var brassMat=new THREE.MeshStandardMaterial({color:0xb8862b,metalness:0.7,roughness:0.38,emissive:0x3a2500,emissiveIntensity:0.3,flatShading:true});
var copperMat=new THREE.MeshStandardMaterial({color:0xb9683a,metalness:0.65,roughness:0.36,emissive:0x2a1004,emissiveIntensity:0.3,flatShading:true});
var stoneMat=new THREE.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:0.95,metalness:0,flatShading:true});
var lingamMat=new THREE.MeshStandardMaterial({color:0x121216,metalness:0.35,roughness:0.28,emissive:0x0a1520,emissiveIntensity:0});
var potMat=new THREE.MeshStandardMaterial({vertexColors:true,color:0xffffff,metalness:0.5,roughness:0.4,flatShading:true});
var _m4=new THREE.Matrix4(),_qq=new THREE.Quaternion(),_ee=new THREE.Euler(),_pp=new V3(),_ss=new V3(),_cc=new THREE.Color(),_vv=new V3();
function mergeParts(list){
  var pa=[],na=[],ca=[];
  list.forEach(function(d){
    var g=d.geo.index?d.geo.toNonIndexed():d.geo;
    _ee.set(d.rot[0],d.rot[1],d.rot[2],'YXZ');_qq.setFromEuler(_ee);
    _pp.set(d.pos[0],d.pos[1],d.pos[2]);_ss.set(d.scl[0],d.scl[1],d.scl[2]);
    _m4.compose(_pp,_qq,_ss);
    var nm=new THREE.Matrix3().getNormalMatrix(_m4);
    var p=g.attributes.position,n=g.attributes.normal;_cc.set(d.col);
    for(var i=0;i<p.count;i++){
      _vv.fromBufferAttribute(p,i).applyMatrix4(_m4);pa.push(_vv.x,_vv.y,_vv.z);
      _vv.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();na.push(_vv.x,_vv.y,_vv.z);
      ca.push(_cc.r,_cc.g,_cc.b);
    }
  });
  var out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(pa,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(na,3));
  out.setAttribute('color',new THREE.Float32BufferAttribute(ca,3));
  return out;
}
/* a parts list with small helpers: x,y,z are the centre of each part */
function Parts(){this.list=[]}
Parts.prototype.add=function(geo,col,x,y,z,rx,ry,rz,sx,sy,sz){
  this.list.push({geo:geo,col:col,pos:[x,y,z],rot:[rx||0,ry||0,rz||0],scl:[sx||1,sy===undefined?(sx||1):sy,sz===undefined?(sx||1):sz]});return this;
};
Parts.prototype.box=function(w,h,d,col,x,y,z,ry){return this.add(new THREE.BoxGeometry(w,h,d),col,x,y,z,0,ry||0,0)};
Parts.prototype.cyl=function(rt,rb,h,col,x,y,z,seg,rx,rz){return this.add(new THREE.CylinderGeometry(rt,rb,h,seg||10),col,x,y,z,rx||0,0,rz||0)};
Parts.prototype.cone=function(r,h,col,x,y,z,seg,rx,rz){return this.add(new THREE.ConeGeometry(r,h,seg||8),col,x,y,z,rx||0,0,rz||0)};
Parts.prototype.sph=function(r,col,x,y,z,sx,sy,sz,rx,ry,rz){return this.add(new THREE.SphereGeometry(r,10,8),col,x,y,z,rx||0,ry||0,rz||0,sx||1,sy===undefined?1:sy,sz===undefined?1:sz)};
Parts.prototype.tor=function(r,t,col,x,y,z,rx,ry,rz,arc,seg){return this.add(new THREE.TorusGeometry(r,t,6,seg||18,arc||Math.PI*2),col,x,y,z,rx||0,ry||0,rz||0)};
Parts.prototype.mesh=function(mat,shadow){var m=new THREE.Mesh(mergeParts(this.list),mat||vcMat);return m};

/* ---------- canvas textures ---------- */
function canvasTex(w,h,draw,repeat){
  var c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  var t=new THREE.CanvasTexture(c);t.anisotropy=4;
  if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat[0],repeat[1])}
  return t;
}
var glowTex=canvasTex(128,128,function(g,w,h){
  var r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
  r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.25,'rgba(255,255,255,0.55)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.fillRect(0,0,w,h);
});
var smokeTex=canvasTex(128,128,function(g,w,h){
  var r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
  r.addColorStop(0,'rgba(255,255,255,0.7)');r.addColorStop(0.5,'rgba(255,255,255,0.22)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.fillRect(0,0,w,h);
});
var shaftTex=canvasTex(64,256,function(g,w,h){
  var l=g.createLinearGradient(0,0,0,h);
  l.addColorStop(0,'rgba(200,225,255,0.9)');l.addColorStop(0.6,'rgba(150,195,255,0.25)');l.addColorStop(1,'rgba(120,170,255,0)');
  g.fillStyle=l;g.fillRect(0,0,w,h);
  var s=g.createLinearGradient(0,0,w,0);
  s.addColorStop(0,'rgba(0,0,0,1)');s.addColorStop(0.5,'rgba(0,0,0,0)');s.addColorStop(1,'rgba(0,0,0,1)');
  g.globalCompositeOperation='destination-out';g.fillStyle=s;g.fillRect(0,0,w,h);
});
var floorTex=canvasTex(512,512,function(g,w,h){
  var n=8,s=w/n,i,j;
  for(i=0;i<n;i++)for(j=0;j<n;j++){g.fillStyle=(i+j)%2?'#8ea3c8':'#b5c5e2';g.fillRect(i*s,j*s,s,s)}
  g.strokeStyle='rgba(40,70,120,0.55)';g.lineWidth=3;
  for(i=0;i<=n;i++){g.beginPath();g.moveTo(i*s,0);g.lineTo(i*s,h);g.stroke();g.beginPath();g.moveTo(0,i*s);g.lineTo(w,i*s);g.stroke()}
  for(i=0;i<n;i++)for(j=0;j<n;j++){g.strokeStyle='rgba(60,90,150,0.35)';g.lineWidth=1.5;g.strokeRect(i*s+8,j*s+8,s-16,s-16)}
},[6,9.8]);
var carpetTex=canvasTex(128,512,function(g,w,h){
  g.fillStyle='#12306e';g.fillRect(0,0,w,h);
  g.strokeStyle='#dcebff';g.lineWidth=6;g.strokeRect(6,0,w-12,h);
  g.lineWidth=2;g.strokeRect(16,0,w-32,h);
  g.fillStyle='#dcebff';
  for(var y=20;y<h;y+=64){g.beginPath();g.moveTo(w/2,y);g.lineTo(w/2+18,y+16);g.lineTo(w/2,y+32);g.lineTo(w/2-18,y+16);g.closePath();g.fill();
    g.fillStyle='#5fa0ff';g.beginPath();g.arc(w/2,y+16,5,0,6.3);g.fill();g.fillStyle='#dcebff'}
});
function mandala(g,w,h,cols,rings){
  var cx=w/2,cy=h/2,R=w/2-6,k,i;
  g.fillStyle=cols[0];g.beginPath();g.arc(cx,cy,R,0,6.3);g.fill();
  for(k=0;k<rings;k++){
    var r=R*(1-k/rings),n=8+k*4;
    for(i=0;i<n;i++){
      var a=i/n*6.283;g.save();g.translate(cx,cy);g.rotate(a);
      g.fillStyle=cols[(k+i)%cols.length];g.beginPath();g.moveTo(0,-r*0.55);g.quadraticCurveTo(r*0.22,-r*0.78,0,-r);g.quadraticCurveTo(-r*0.22,-r*0.78,0,-r*0.55);g.fill();
      g.restore();
    }
    g.strokeStyle='rgba(255,240,200,0.5)';g.lineWidth=2;g.beginPath();g.arc(cx,cy,r*0.5,0,6.3);g.stroke();
  }
  g.fillStyle='#ffd23f';g.beginPath();g.arc(cx,cy,R*0.09,0,6.3);g.fill();
}
var rangoliTex=canvasTex(512,512,function(g,w,h){
  g.clearRect(0,0,w,h);
  mandala(g,w,h,['#1f4fb0','#ff9a1f','#ffffff','#ffd23f','#5fa0ff','#e75480'],6);
});
var ceilTex=canvasTex(512,512,function(g,w,h){
  mandala(g,w,h,['#0a1a48','#cfe0ff','#173a86','#7fb2f0'],7);
});
var jaliTex=canvasTex(128,128,function(g,w,h){
  g.fillStyle='#cfe0ff';g.fillRect(0,0,w,h);
  g.strokeStyle='#0c1a3a';g.lineWidth=7;
  for(var i=0;i<=4;i++){g.beginPath();g.moveTo(i*w/4,0);g.lineTo(i*w/4,h);g.stroke();g.beginPath();g.moveTo(0,i*h/4);g.lineTo(w,i*h/4);g.stroke()}
  g.lineWidth=4;g.beginPath();g.moveTo(0,0);g.lineTo(w,h);g.moveTo(w,0);g.lineTo(0,h);g.stroke();
});

/* ---------- the temple: hall, pillars, sanctum door, ceiling ---------- */
var SAND='#aab8d4',SAND2='#7c8bab',MAROON='#152a5c',WOOD='#101a36',WOOD2='#1a2748',MARBLE='#e8eefb',BLACK='#0c1224',GOLDC='#dfe9fb';
var S=new Parts(),G=new Parts();
G.box=function(w,h,d,x,y,z,ry){return Parts.prototype.box.call(this,w,h,d,GOLDC,x,y,z,ry)};
var diyaPts=[],bigFlames=[];
// hall shell
S.box(1,11.9,39.4,SAND2,-12.5,5.95,14.3);S.box(1,11.9,39.4,SAND2,12.5,5.95,14.3);
S.box(8.4,11.9,1,SAND2,-8.2,5.95,34.5);S.box(8.4,11.9,1,SAND2,8.2,5.95,34.5);S.box(8,4.4,1,SAND2,0,9.7,34.5);
S.box(25.4,0.6,40.4,WOOD,0,11.9,14.3);
for(var bz=-4;bz<=34;bz+=4)S.box(24,0.5,0.7,WOOD2,0,11.35,bz);
for(var bx=-8;bx<=8;bx+=4)S.box(0.7,0.5,39,WOOD2,bx,11.35,14.3);
// door frame at the entrance
G.box(0.3,7.6,0.6,-4.1,3.8,33.9);G.box(0.3,7.6,0.6,4.1,3.8,33.9);G.box(8.5,0.35,0.6,0,7.6,33.9);
G.tor(4.1,0.16,GOLDC,0,7.6,33.8,0,0,0,Math.PI,24);
// pillars: octagonal shafts, gold bands, bell capitals, brackets and architraves
var pz=[0,5,10,15,20,25,30];
function pillar(x,z,half){
  var s=half?0.8:1;
  S.box(1.5*s,0.5,1.5*s,SAND2,x,0.25,z);S.box(1.05*s,1.6,1.05*s,SAND,x,1.3,z);
  S.cyl(0.42*s,0.42*s,4.6,SAND,x,4.4,z,8);S.cyl(0.36*s,0.42*s,1.3,SAND,x,7.35,z,8);
  G.cyl(0.47*s,0.47*s,0.14,GOLDC,x,2.3,z,8);G.cyl(0.45*s,0.45*s,0.14,GOLDC,x,4.2,z,8);G.cyl(0.45*s,0.45*s,0.14,GOLDC,x,6.1,z,8);
  S.cyl(0.95*s,0.42*s,0.9,'#24408a',x,8.05,z,8);S.box(1.5*s,0.3,1.5*s,SAND,x,8.65,z);
  G.box(3.0*s,0.3,0.45,x,8.95,z);G.box(0.45,0.3,3.0*s,x,8.95,z);
}
[-7,7].forEach(function(x){pz.forEach(function(z,i){
  pillar(x,z,false);
  if(i)S.box(0.8,0.7,5,MAROON,x,9.5,z-2.5);
})});
[-11.7,11.7].forEach(function(x){pz.forEach(function(z){pillar(x,z,true)})});
// architraves across the hall
pz.forEach(function(z){S.box(14.6,0.5,0.6,MAROON,0,9.85,z);G.box(14.6,0.1,0.65,0,10.15,z)});
// wall niches with lamps and jali windows
[-1,1].forEach(function(sd){
  [2.5,7.5,12.5,17.5,22.5,27.5].forEach(function(z){
    S.box(0.3,3,1.7,WOOD,sd*11.85,3.3,z);G.box(0.12,0.12,1.9,sd*11.7,4.9,z);
    for(var k=-1;k<=1;k++)diyaPts.push([sd*11.55,1.9,z+k*0.5]);
  });
});
// sanctum shell and door
S.box(12.6,8.4,1.2,SAND2,0,4.2,-19.3);S.box(1.2,8.4,14.2,SAND2,-6.2,4.2,-12.3);S.box(1.2,8.4,14.2,SAND2,6.2,4.2,-12.3);
S.box(13.6,0.6,14.4,WOOD,0,8.5,-12.3);
S.box(4.4,8.4,1.2,SAND2,-4,4.2,-5.4);S.box(4.4,8.4,1.2,SAND2,4,4.2,-5.4);S.box(3.6,3,1.2,SAND2,0,6.9,-5.4);
S.box(12.4,0.35,14.2,BLACK,0,0.175,-12.3);
S.box(4.6,0.2,1.4,MARBLE,0,0.1,-4.5);S.box(4.0,0.35,0.9,MARBLE,0,0.175,-5.3);
S.box(6.2,5.2,0.2,'#0c1a48',0,3.2,-18.6);
G.box(6.4,0.16,0.3,0,5.9,-18.5);G.box(6.4,0.16,0.3,0,0.7,-18.5);G.box(0.16,5.4,0.3,-3.2,3.3,-18.5);G.box(0.16,5.4,0.3,3.2,3.3,-18.5);
[[-2.2,3.2],[2.2,3.2]].forEach(function(p){G.tor(0.9,0.06,GOLDC,p[0],p[1]+0.3,-18.45,0,0,0,Math.PI*2,20)});
// gold-framed doorway with a torana arch, and guardian plinths
G.box(0.32,5.6,0.7,-1.95,2.8,-4.7);G.box(0.32,5.6,0.7,1.95,2.8,-4.7);G.box(4.2,0.34,0.7,0,5.6,-4.7);
G.box(0.2,5.6,0.8,-2.25,2.8,-4.7);G.box(0.2,5.6,0.8,2.25,2.8,-4.7);
G.tor(2.1,0.13,GOLDC,0,5.6,-4.65,0,0,0,Math.PI,24);G.cyl(0.55,0.55,0.16,GOLDC,0,7.85,-4.6,12,Math.PI/2);
[-1,1].forEach(function(sd){S.box(1.3,0.6,1.3,SAND,sd*3.4,0.3,-4.4)});
var stoneGeo=S.mesh(vcMat);scene.add(stoneGeo);
var goldGeo=G.mesh(goldMat);scene.add(goldGeo);
// floors, carpet, rangoli, medallions
var floor=new THREE.Mesh(new THREE.PlaneGeometry(25,40).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:floorTex,roughness:0.65,metalness:0.05}));
floor.position.set(0,0,14.3);scene.add(floor);
var carpet=new THREE.Mesh(new THREE.PlaneGeometry(3.4,33).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:carpetTex,roughness:0.9}));
carpet.position.set(0,0.012,17.6);scene.add(carpet);
var rangoli=new THREE.Mesh(new THREE.PlaneGeometry(7,7).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:rangoliTex,transparent:true,roughness:0.9}));
rangoli.position.set(0,0.02,9);scene.add(rangoli);
[[14,4.6],[27,3.4]].forEach(function(m){
  var d=new THREE.Mesh(new THREE.CircleGeometry(m[1],36).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({map:ceilTex,emissive:0xffffff,emissiveMap:ceilTex,emissiveIntensity:0.32,roughness:0.8}));
  d.position.set(0,11.55,m[0]);scene.add(d);
});
// warm doorway sky
var skyTex=canvasTex(8,256,function(g,w,h){
  var l=g.createLinearGradient(0,0,0,h);l.addColorStop(0,'#02061a');l.addColorStop(0.45,'#0f2c70');l.addColorStop(1,'#6fa8ff');g.fillStyle=l;g.fillRect(0,0,w,h);
});
var doorSky=new THREE.Mesh(new THREE.PlaneGeometry(16,14),new THREE.MeshBasicMaterial({map:skyTex,fog:false}));
doorSky.position.set(0,5.5,40);doorSky.rotation.y=Math.PI;scene.add(doorSky);
[-1,1].forEach(function(sd){
  var w=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.8),new THREE.MeshBasicMaterial({map:jaliTex,color:0xbcd6ff}));
  [6,14,22].forEach(function(z){
    var m=w.clone();m.position.set(sd*11.97,8.1,z);m.rotation.y=-sd*Math.PI/2;scene.add(m);
    // a slanted shaft of light from each window
    var from=new V3(sd*11.5,8.1,z),to=new V3(sd*6.2,0.2,z-1),dir=to.clone().sub(from),len=dir.length();
    var shaft=new THREE.Mesh(new THREE.PlaneGeometry(2.4,len),new THREE.MeshBasicMaterial({map:shaftTex,transparent:true,opacity:0.2,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
    shaft.position.copy(from).add(to).multiplyScalar(0.5);shaft.quaternion.setFromUnitVectors(new V3(0,1,0),dir.clone().normalize());
    shaft.rotateY(Math.PI/2*0);scene.add(shaft);
  });
});

/* ---------- Shivling on its peetha, the naga, offerings and the sanctum ---------- */
var SH=new THREE.Group();SH.position.set(0,0.35,-12.2);SH.scale.setScalar(0.6);scene.add(SH);
var P=new Parts();
P.cyl(1.4,1.45,0.16,MARBLE,0,0.08,0,22);P.cyl(1.15,1.22,0.28,'#f6efe2',0,0.3,0,22);P.box(1.6,0.2,0.6,'#f6efe2',-1.5,0.34,0);P.box(0.5,0.14,0.42,'#f6efe2',-2.4,0.3,0);
// flowers heaped around the base
for(var fi=0;fi<26;fi++){var fa=rnd()*6.28,fr=1.25+rnd()*0.5;P.sph(0.11,pick(['#ff9a1f','#ffd23f','#e75480','#fff3d6']),Math.cos(fa)*fr,0.4+rnd()*0.06,Math.sin(fa)*fr,1,0.7,1)}
// naga hoods behind the lingam
[-0.56,-0.28,0,0.28,0.56].forEach(function(x,i){var h=1.0+(2-Math.abs(i-2))*0.12;P.sph(0.26,'#cfd5dc',x,h+0.55,-0.62,1,1.3,0.32)});
P.cyl(0.16,0.2,0.9,'#cfd5dc',0,0.95,-0.62,10);P.tor(1.0,0.09,'#cfd5dc',0,0.5,0,Math.PI/2,0,0,Math.PI*1.6,20);
var shBase=P.mesh(vcMat);SH.add(shBase);
var lingam=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.53,0.7,28),lingamMat);lingam.position.y=0.42+0.35;SH.add(lingam);
var dome=new THREE.Mesh(new THREE.SphereGeometry(0.5,28,14,0,Math.PI*2,0,Math.PI/2),lingamMat);dome.scale.y=0.75;dome.position.y=0.42+0.7;SH.add(dome);
var white=new THREE.MeshBasicMaterial({color:0xf5f1ea});
[0.22,0.38,0.54].forEach(function(y){var t=new THREE.Mesh(new THREE.TorusGeometry(0.515,0.016,5,30),white);t.rotation.x=Math.PI/2;t.position.y=0.42+y;SH.add(t)});
var tilak=new THREE.Mesh(new THREE.CircleGeometry(0.055,12),new THREE.MeshBasicMaterial({color:0xc01e2a}));tilak.position.set(0,0.42+0.5,0.52);SH.add(tilak);
var gm=new THREE.Mesh(new THREE.TorusGeometry(0.6,0.075,7,26),new THREE.MeshStandardMaterial({color:0xff9a1f,roughness:0.9,emissive:0x552200,emissiveIntensity:0.4}));gm.rotation.x=Math.PI/2;gm.position.y=0.42+0.06;SH.add(gm);
var gm2=gm.clone();gm2.scale.setScalar(0.9);gm2.position.y=0.42+0.16;gm2.material=new THREE.MeshStandardMaterial({color:0xffd23f,roughness:0.9,emissive:0x553300,emissiveIntensity:0.4});SH.add(gm2);
var bel=new THREE.MeshStandardMaterial({color:0x2e8b57,roughness:0.8,emissive:0x0a2a14,emissiveIntensity:0.4,side:THREE.DoubleSide});
for(var bi=0;bi<7;bi++){var lf=new THREE.Mesh(new THREE.CircleGeometry(0.14,3),bel);var la=bi/7*6.28;lf.position.set(Math.cos(la)*0.22,0.42+0.7+0.3-Math.abs(Math.cos(la))*0.05,Math.sin(la)*0.22);lf.rotation.set(-1.0+Math.sin(la)*0.4,la,0);SH.add(lf)}
// hanging copper kalash that drips onto the lingam
var kal=new THREE.Group();kal.position.set(0,2.95,0);SH.add(kal);
var kalM=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.001,-0.36),new THREE.Vector2(0.06,-0.36),new THREE.Vector2(0.12,-0.3),new THREE.Vector2(0.28,-0.1),new THREE.Vector2(0.36,0.06),new THREE.Vector2(0.4,0.22),new THREE.Vector2(0.44,0.32)],14),copperMat);kal.add(kalM);
var chainMat=new THREE.MeshStandardMaterial({color:0xc8952e,metalness:0.7,roughness:0.4});
[0,2.1,4.2].forEach(function(a){var ch=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,5.2,4),chainMat);ch.position.set(Math.cos(a)*0.32,0.32+2.6,Math.sin(a)*0.32);ch.rotation.set(Math.sin(a)*0.06,0,-Math.cos(a)*0.06);kal.add(ch)});
// trishul and damaru, standing lamps and a marigold curtain over the door
var TR=new Parts();
TR.cyl(0.03,0.03,2.9,GOLDC,0,1.45,0,6);TR.cyl(0.05,0.05,0.5,'#24408a',0,1.1,0,8);
TR.cone(0.06,0.5,GOLDC,0,3.15,0,6);TR.cone(0.05,0.4,GOLDC,-0.22,3.05,0,6);TR.cone(0.05,0.4,GOLDC,0.22,3.05,0,6);TR.tor(0.22,0.03,GOLDC,0,2.9,0,0,0,0,Math.PI,12);
TR.cone(0.11,0.22,'#8a5a2a',0.16,2.2,0.02,8,0,Math.PI/2);TR.cone(0.11,0.22,'#8a5a2a',0.02,2.2,0.02,8,0,-Math.PI/2);
var trishul=TR.mesh(goldMat);trishul.position.set(-3.0,0,-0.6);SH.add(trishul);
[-1,1].forEach(function(sd){
  var LS=new Parts();LS.cyl(0.05,0.08,1.5,GOLDC,0,0.75,0,8);LS.cyl(0.32,0.3,0.06,GOLDC,0,1.5,0,14);LS.cyl(0.4,0.1,0.1,GOLDC,0,0.06,0,12);
  var ls=LS.mesh(goldMat);ls.position.set(sd*3.6,0,1.6);SH.add(ls);
  for(var k=0;k<5;k++){var a=k/5*6.28;diyaPts.push([sd*3.6*0.6+Math.cos(a)*0.13,0.35+1.62*0.6,-12.2+1.6*0.6+Math.sin(a)*0.13]);}
});
var strands=new Parts();
for(var sk=-4;sk<=4;sk++){var sl=0.9+((sk+9)%3)*0.35;for(var kk=0;kk<5;kk++){strands.sph(0.075,(kk+sk)%2?'#ff9a1f':'#ffd23f',sk*0.42,5.35-kk*sl/5,-4.95,1,1,1)}}
scene.add(strands.mesh(vcMat));
var haloM=new THREE.Mesh(new THREE.CircleGeometry(2.4,40),new THREE.MeshBasicMaterial({color:0xa8cfff,transparent:true,opacity:0.32,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
haloM.position.set(0,3.4,-18.5);scene.add(haloM);
// sanctum door bells (they swing with the drums)
var doorBells=[];
for(var db=-4;db<=4;db++){
  var dbg=new THREE.Group();dbg.position.set(db*0.4,5.35,-4.95);scene.add(dbg);
  var dbm=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.1,-0.26),new THREE.Vector2(0.09,-0.2),new THREE.Vector2(0.06,-0.08),new THREE.Vector2(0.03,0),new THREE.Vector2(0.001,0.02)],10),brassMat);dbg.add(dbm);
  var dbc=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.4,3),chainMat);dbc.position.y=0.2;dbg.add(dbc);
  doorBells.push(dbg);
}

/* ---------- stone Nandi, seated on a plinth on the axis, facing the Shivling ---------- */
var NP=new Parts();NP.box(3.7,0.5,5.3,'#9fb0cf',0,0.25,-2.3);NP.box(3.9,0.12,5.5,'#6f82a8',0,0.06,-2.3);NP.box(3.5,0.1,5.1,'#b9c8e4',0,0.55,-2.3);
scene.add(NP.mesh(vcMat));
var NG=new THREE.Group();NG.position.set(0,0.6,-2.3);scene.add(NG);
var N=new Parts(),ST='#a9b3c6',ST2='#93a0b8',ST3='#c3cde0';
N.sph(1,ST,0,1.0,0.25,0.72,0.62,1.45);N.sph(1,ST,0,0.96,0.95,0.76,0.66,0.7);
N.sph(1,ST2,0,1.52,-0.45,0.42,0.36,0.5);N.sph(1,ST,0,1.15,-0.75,0.56,0.6,0.7);
N.cyl(0.3,0.36,0.85,ST,0,1.42,-1.12,12,-0.72,0);
N.sph(1,ST,0,1.78,-1.6,0.34,0.4,0.55,0.25,0,0);N.sph(1,ST3,0,1.6,-2.05,0.26,0.24,0.34);
N.sph(0.05,'#2b2622',-0.09,1.58,-2.36);N.sph(0.05,'#2b2622',0.09,1.58,-2.36);
[-1,1].forEach(function(sd){
  N.sph(1,ST2,sd*0.37,1.85,-1.5,0.07,0.17,0.1,0,0,sd*0.5);
  N.cone(0.06,0.55,ST3,sd*0.24,2.12,-1.5,7,0,-sd*0.55);
  N.sph(0.045,'#2b2622',sd*0.27,1.82,-1.86);
  N.cyl(0.16,0.15,1.25,ST,sd*0.3,0.42,-1.15,10,Math.PI/2,0);N.box(0.3,0.14,0.34,ST2,sd*0.3,0.3,-1.8);
  N.sph(1,ST,sd*0.5,0.55,1.1,0.22,0.3,0.55);
});
N.cyl(0.05,0.03,0.9,ST2,0,0.95,1.75,6,0.5,0);N.box(1.25,0.07,1.35,'#8493b0',0,1.31,0.2);
N.tor(0.36,0.04,GOLDC,0,1.4,-1.05,-0.72+Math.PI/2,0,0,Math.PI*2,14);
var nandi=N.mesh(stoneMat);NG.add(nandi);
var NGold=new Parts();
for(var nb=-2;nb<=2;nb++)NGold.sph(0.06,GOLDC,nb*0.13,1.12-Math.abs(nb)*0.03,-1.3,1,1.2,1);
NGold.tor(0.4,0.04,GOLDC,0,1.44,-1.08,Math.PI/2-0.72,0,0,Math.PI*2,14);NGold.sph(0.06,GOLDC,0,1.66,-1.85);
NG.add(NGold.mesh(goldMat));
var ngar=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.07,6,20),new THREE.MeshStandardMaterial({color:0xff9a1f,roughness:0.9,emissive:0x552200,emissiveIntensity:0.4}));
ngar.position.set(0,1.38,-1.02);ngar.rotation.x=Math.PI/2-0.72;NG.add(ngar);
var ntilak=new THREE.Mesh(new THREE.CircleGeometry(0.05,10),new THREE.MeshBasicMaterial({color:0xc01e2a}));ntilak.position.set(0,1.9,-1.9);ntilak.rotation.x=-0.5;NG.add(ntilak);

/* ---------- big bells on ropes, hanging lamps, flames, smoke, petals and water ---------- */
function bellGeo(){
  var pts=[[0.52,0],[0.48,0.08],[0.4,0.3],[0.3,0.56],[0.2,0.74],[0.12,0.82],[0.07,0.9],[0.001,0.94]].map(function(p){return new THREE.Vector2(p[0],p[1])});
  return new THREE.LatheGeometry(pts,16);
}
var bellG=bellGeo();
var bigBells=[[-2.5,13],[2.5,13],[-2.5,23],[2.5,23]].map(function(p,i){
  var g=new THREE.Group();g.position.set(p[0],10.4,p[1]);scene.add(g);
  var b=new THREE.Mesh(bellG,brassMat);b.position.y=-1.1;g.add(b);
  var clap=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6),brassMat);clap.position.y=-1.05;g.add(clap);
  var ch=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1.3,4),chainMat);ch.position.y=-0.2;g.add(ch);
  var rope=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,7.6,5),new THREE.MeshStandardMaterial({color:0xc8a878,roughness:1}));
  rope.position.set(0,-1.1-3.8,0);g.add(rope);
  var tas=new THREE.Mesh(new THREE.SphereGeometry(0.07,6,5),new THREE.MeshStandardMaterial({color:0xc01e2a}));tas.position.set(0,-1.1-7.6,0);g.add(tas);
  return {g:g,ev:[],ropeEnd:new V3(p[0],1.7,p[1]),pitch:[392,440,349,415][i]};
});
// hanging lamps (deepmala) along the aisle
[6,16,26].forEach(function(z){
  var L=new Parts();L.tor(0.95,0.06,GOLDC,0,0,0,Math.PI/2,0,0,Math.PI*2,24);L.tor(0.55,0.05,GOLDC,0,0.02,0,Math.PI/2,0,0,Math.PI*2,20);
  for(var k=0;k<8;k++){var a=k/8*6.283;L.cyl(0.07,0.05,0.07,'#b8862b',Math.cos(a)*0.95,0.06,Math.sin(a)*0.95,8);bigFlames.push([Math.cos(a)*0.95,8.0+0.16,z+Math.sin(a)*0.95])}
  var lm=L.mesh(goldMat);lm.position.set(0,8.0,z);scene.add(lm);
  var lc=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,3.4,4),chainMat);lc.position.set(0,9.7,z);scene.add(lc);
});
// rows of clay lamps in front of the sanctum steps and beside the aisle
for(var dk=-6;dk<=6;dk++){if(Math.abs(dk)>1)diyaPts.push([dk*0.45,0.14,-3.6]);if(Math.abs(dk)>1)diyaPts.push([dk*0.45,0.14,-3.0])}
[-1,1].forEach(function(sd){for(var dj=0;dj<6;dj++)diyaPts.push([sd*(2.2+dj*0.25),0.14,5.5+dj*0.1])});
var cupParts=new Parts();
diyaPts.forEach(function(p){if(p[1]<0.3)cupParts.cyl(0.09,0.06,0.06,'#b5643a',p[0],0.03,p[2],8)});
scene.add(cupParts.mesh(vcMat));
function glowPoints(list,size,col){
  var g=new THREE.BufferGeometry(),a=new Float32Array(list.length*3);
  list.forEach(function(p,i){a[i*3]=p[0];a[i*3+1]=p[1];a[i*3+2]=p[2]});
  g.setAttribute('position',new THREE.BufferAttribute(a,3));
  var m=new THREE.PointsMaterial({map:glowTex,size:size,color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,sizeAttenuation:true});
  var pts=new THREE.Points(g,m);pts.frustumCulled=false;scene.add(pts);return m;
}
var flameMat=glowPoints(diyaPts,0.75,0xffa040);
var bigFlameMat=glowPoints(bigFlames,1.5,0xffb050);
var coreGeo=new THREE.SphereGeometry(0.05,6,5);
var cores=new THREE.InstancedMesh(coreGeo,new THREE.MeshBasicMaterial({color:0xffe08a}),diyaPts.length+bigFlames.length);
(function(){var d=new THREE.Object3D();diyaPts.concat(bigFlames).forEach(function(p,i){d.position.set(p[0],p[1],p[2]);d.updateMatrix();cores.setMatrixAt(i,d.matrix)})})();
cores.frustumCulled=false;scene.add(cores);
// stream of liquid, floating dust, incense smoke
function streamMesh(){
  var m=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.018,1,6),new THREE.MeshBasicMaterial({color:0xcfeeff,transparent:true,opacity:0.85,depthWrite:false}));
  m.visible=false;m.frustumCulled=false;scene.add(m);return m;
}
var streamA=streamMesh(),streamB=streamMesh(),streamC=streamMesh();
var _dirv=new V3(),_up=new V3(0,1,0);
function setStream(m,a,b,col,on){
  m.visible=!!on;if(!on)return;
  _dirv.copy(b).sub(a);var len=_dirv.length();if(len<0.001){m.visible=false;return}
  m.position.copy(a).add(b).multiplyScalar(0.5);m.scale.set(1,len,1);m.quaternion.setFromUnitVectors(_up,_dirv.multiplyScalar(1/len));
  m.material.color.setHex(col);
}
var dustN=140,dustG=new THREE.BufferGeometry(),dustA=new Float32Array(dustN*3);
for(var du=0;du<dustN;du++){dustA[du*3]=rr(-11,11);dustA[du*3+1]=rr(0.5,10);dustA[du*3+2]=rr(-4,33)}
dustG.setAttribute('position',new THREE.BufferAttribute(dustA,3));
var dust=new THREE.Points(dustG,new THREE.PointsMaterial({map:glowTex,size:0.14,color:0xcfe0ff,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
dust.frustumCulled=false;scene.add(dust);
var smokeSrc=[[-2.1,0.62,-9.0],[2.1,0.62,-9.0],[-3.6,1.6,-10.6],[3.6,1.6,-10.6],[-5.5,0.4,4],[5.5,0.4,4]];
var smokes=[];
for(var sm=0;sm<30;sm++){
  var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,color:0xd8cfc4,transparent:true,opacity:0,depthWrite:false,fog:true}));
  sp.visible=false;scene.add(sp);smokes.push({s:sp,age:rr(0,6),src:smokeSrc[sm%smokeSrc.length],dx:rr(-0.3,0.3),dz:rr(-0.3,0.3)});
}
// petals and droplets
function petalPool(color,n){
  var im=new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14,0.1),new THREE.MeshBasicMaterial({color:color,side:THREE.DoubleSide}),n);
  im.frustumCulled=false;var st=[];for(var i=0;i<n;i++)st.push({p:new V3(0,-50,0),v:new V3(),life:0,spin:rr(-4,4),rx:0,ry:0});
  scene.add(im);return {im:im,st:st,next:0};
}
var petalPools=[petalPool(0xff9a1f,90),petalPool(0xffd23f,80),petalPool(0xe75480,70),petalPool(0xfff3d6,50)];
function emitPetal(x,y,z,vx,vy,vz){
  var pl=petalPools[Math.floor(rnd()*petalPools.length)],s=pl.st[pl.next];pl.next=(pl.next+1)%pl.st.length;
  s.p.set(x,y,z);s.v.set(vx,vy,vz);s.life=rr(3,6);s.rx=rnd()*6;s.ry=rnd()*6;
}
var dropN=110,dropG=new THREE.BufferGeometry(),dropA=new Float32Array(dropN*3),dropSt=[];
for(var dd=0;dd<dropN;dd++){dropA[dd*3+1]=-50;dropSt.push({v:new V3(),life:0})}
dropG.setAttribute('position',new THREE.BufferAttribute(dropA,3));
var dropMat=new THREE.PointsMaterial({color:0xcfeeff,size:0.09,transparent:true,opacity:0.9,depthWrite:false});
var drops=new THREE.Points(dropG,dropMat);drops.frustumCulled=false;scene.add(drops);
var dropNext=0;
function emitDrop(x,y,z,vx,vy,vz,life){var i=dropNext;dropNext=(dropNext+1)%dropN;dropA[i*3]=x;dropA[i*3+1]=y;dropA[i*3+2]=z;dropSt[i].v.set(vx,vy,vz);dropSt[i].life=life||0.6}

/* ---------- timeline and rhythm ---------- */
var LOOP=128;
var PHASES=[[0,'Entering the mandapa'],[14,'Abhishek of the Shivling'],[38,'Kanwar Yatris arrive'],[52,'Offering the holy jal'],[84,'Maha aarti'],[116,'Peace and blessings']];
function phaseAt(t){var n=PHASES[0][1];PHASES.forEach(function(p){if(t>=p[0])n=p[1]});return n}
function inten(t){
  if(t<14)return 0.4;if(t<38)return 0.55+0.2*smooth((t-14)/24);if(t<52)return 0.75+0.25*smooth((t-38)/14);
  if(t<116)return 1;return lerp(1,0.15,smooth((t-116)/12));
}
var BPM=112,STEP=60/BPM/4,BEAT=60/BPM;
var PAT={bass:[1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,0],tre:[0,0,1,0,1,1,0,1,0,1,0,0,1,0,1,1],nag:[1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,1]};
function gateHit(kind,st,I){
  var v=PAT[kind][((st%16)+16)%16];if(!v)return false;
  if(kind==='bass')return I>0.5||((st%4)+4)%4===0;
  if(kind==='tre')return I>0.6;
  return I>0.75;
}
function hitEnv(kind,t,I,k){
  var s=Math.floor(t/STEP);
  for(var d=0;d<16;d++){var st=s-d;if(st<0)break;if(gateHit(kind,st,I))return Math.exp(-(t-st*STEP)/(k||0.11))}
  return 0;
}
// bell ring events: a list of [time, bell, strength]
var bellEvents=[];
(function(){
  var t=1.2,b=0;
  while(t<LOOP-6){
    var I=inten(t);
    bellEvents.push([t,b%4,0.5+0.5*I]);b++;
    t+=lerp(4.2,1.5,I)+(b%3)*0.15;
  }
  [38.5,41,44,47,50,53,58,64.5,71,77.5,84,84.4,85].forEach(function(tt,i){bellEvents.push([tt,i%4,1])});
  bellEvents.sort(function(a,b2){return a[0]-b2[0]});
  bellEvents.forEach(function(e){bigBells[e[1]].ev.push(e)});
})();
function bellAngle(bell,t){
  var a=0;
  for(var i=0;i<bell.ev.length;i++){var e=bell.ev[i],dt=t-e[0];if(dt>=0&&dt<9)a+=e[2]*Math.exp(-dt/2.6)*Math.sin(dt*4.3)*0.2}
  return a;
}
function recentBell(bell,t,win){for(var i=0;i<bell.ev.length;i++){var dt=t-bell.ev[i][0];if(dt>=0&&dt<win)return 1-dt/win}return 0}

/* ---------- people: a light skeleton with arms that reach targets (two-bone IK) ---------- */
var skins=['#c98a5e','#b5764a','#d9a273','#a86a42','#8f5a38'];
var skirtMats={};
function skirtMat(c){return skirtMats[c]||(skirtMats[c]=new THREE.MeshStandardMaterial({color:c,roughness:0.9,side:THREE.DoubleSide,flatShading:true}))}
var skirtGeo=new THREE.CylinderGeometry(0.2,0.31,0.92,12,1,true);
var people=[];
function makePerson(o){
  var s=o.scale||1,skin=o.skin||pick(skins);
  var root=new THREE.Group();root.scale.setScalar(s);scene.add(root);
  var hips=new THREE.Group();hips.position.y=0.92;root.add(hips);
  var torso=new THREE.Group();hips.add(torso);
  var T=new Parts(),chest=o.bare?skin:(o.top||'#f4efe6');
  T.cyl(0.2,0.175,0.6,chest,0,0.3,0,10);
  T.sph(0.1,chest,-0.22,0.56,0,1,0.9,1);T.sph(0.1,chest,0.22,0.56,0,1,0.9,1);
  T.cyl(0.055,0.06,0.1,skin,0,0.65,0,8);
  T.sph(0.115,skin,0,0.78,0,1,1.08,1);
  if(o.turban){T.tor(0.11,0.055,o.turban,0,0.83,0,Math.PI/2,0,0,Math.PI*2,14);T.sph(0.09,o.turban,0,0.88,0,1,0.6,1)}
  else{T.sph(0.12,o.hair||'#1a1210',0,0.83,0.01,1,0.7,1.02);if(o.bun)T.sph(0.06,o.hair||'#1a1210',0,0.86,0.11)}
  T.box(0.03,0.05,0.01,'#c01e2a',0,0.8,-0.114);
  if(o.priest){
    T.cyl(0.012,0.012,0.7,'#f5f1ea',0,0.3,-0.185,4,0,0.65);T.tor(0.14,0.02,'#5a3a22',0,0.52,0,Math.PI/2,0,0,Math.PI*2,14);
    T.tor(0.15,0.035,'#ff9a1f',0,0.46,0,Math.PI/2,0,0,Math.PI*2,14);T.box(0.14,0.5,0.4,'#ff8c1a',-0.2,0.34,0);
    [0.82,0.835,0.85].forEach(function(y){T.box(0.09,0.011,0.01,'#f5f1ea',0,y,-0.115)});
  }
  if(o.woman){T.box(0.5,0.05,0.34,o.dupatta||'#d0396a',0,0.6,0);T.box(0.3,0.45,0.04,o.dupatta||'#d0396a',0,0.35,0.19)}
  if(o.kanwari){T.tor(0.115,0.02,'#c01e2a',0,0.85,0,Math.PI/2,0,0,Math.PI*2,14);T.box(0.14,0.4,0.36,'#c01e2a',0.2,0.36,0);T.tor(0.15,0.035,'#ff9a1f',0,0.46,0,Math.PI/2,0,0,Math.PI*2,14)}
  if(o.sash)T.tor(0.2,0.045,o.sash,0,0.02,0,Math.PI/2,0,0,Math.PI*2,16);
  torso.add(T.mesh(vcMat));
  var skirt=new THREE.Mesh(skirtGeo,skirtMat(o.bottom||'#f4efe6'));skirt.position.y=-0.46;hips.add(skirt);
  function arm(sd){
    var up=new THREE.Group();up.position.set(sd*0.235,0.56,0);torso.add(up);
    var U=new Parts();U.cyl(0.055,0.05,0.29,o.bare?skin:(o.sleeve||chest),0,-0.145,0,8);up.add(U.mesh(vcMat));
    var fore=new THREE.Group();fore.position.y=-0.29;up.add(fore);
    var F=new Parts();F.cyl(0.048,0.04,0.27,skin,0,-0.135,0,8);F.sph(0.05,skin,0,-0.3,0);
    if(o.woman)F.tor(0.05,0.01,'#d9a431',0,-0.2,0,Math.PI/2,0,0,Math.PI*2,10);
    fore.add(F.mesh(vcMat));
    return {up:up,fore:fore};
  }
  var p={root:root,hips:hips,torso:torso,skirt:skirt,arms:{L:arm(-1),R:arm(1)},s:s,L1:0.29*s,L2:0.29*s,o:o,yaw:0};
  people.push(p);return p;
}
function setSeat(p,sit){
  var hy=sit?0.3:0.92;p.hips.position.y=hy;
  var sc=sit?1.45:1;p.skirt.scale.set(sc,hy/0.92,sc);p.skirt.position.y=-hy/2;
}
function place(p,x,y,z,yaw){p.root.position.set(x,y,z);p.root.rotation.y=yaw;p.yaw=yaw}
function angLerp(a,b,k){var d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*k}
var _S=new V3(),_D=new V3(),_B=new V3(),_E=new V3(),_Wr=new V3(),_dn=new V3(0,-1,0),_pq=new THREE.Quaternion(),_dl=new V3(),_bw=new V3(),_d1=new V3();
function setDir(obj,dw){obj.parent.getWorldQuaternion(_pq);_pq.invert();_dl.copy(dw).applyQuaternion(_pq);obj.quaternion.setFromUnitVectors(_dn,_dl)}
function aimArm(p,side,tgt,bl,by,bz){
  var A=p.arms[side];
  A.up.getWorldPosition(_S);
  var L1=p.L1,L2=p.L2;
  _D.copy(tgt).sub(_S);var dist=_D.length();if(dist<1e-4)return;_D.multiplyScalar(1/dist);
  dist=clamp(dist,Math.abs(L1-L2)+0.02,L1+L2-0.004);
  var a=(L1*L1-L2*L2+dist*dist)/(2*dist),h=Math.sqrt(Math.max(L1*L1-a*a,0));
  _bw.set(bl,by,bz).applyQuaternion(p.root.quaternion);
  _B.copy(_bw).addScaledVector(_D,-_bw.dot(_D));if(_B.lengthSq()<1e-6)_B.set(0,-1,0);_B.normalize();
  _E.copy(_S).addScaledVector(_D,a).addScaledVector(_B,h);
  _Wr.copy(_S).addScaledVector(_D,dist);
  _d1.copy(_E).sub(_S).normalize();setDir(A.up,_d1);
  _d1.copy(_Wr).sub(_E).normalize();setDir(A.fore,_d1);
}
var T1=new V3(),T2=new V3();
function tl(p,v,x,y,z){return p.torso.localToWorld(v.set(x,y,z))}
function rl(p,v,x,y,z){return p.root.localToWorld(v.set(x,y,z))}
function pray(p,lift,spread){var s=0.035+(spread||0);aimArm(p,'L',tl(p,T1,-s,0.4+(lift||0),-0.2),-0.7,-1,0.2);aimArm(p,'R',tl(p,T2,s,0.4+(lift||0),-0.2),0.7,-1,0.2)}
function floorY(x,z){if(z<-5.7)return 0.35;if(z>-4.3)return 0;return lerp(0.35,0,smooth((z+5.7)/1.4))}

/* ---------- instruments ---------- */
function makeDhol(p){
  var D=new Parts();
  var prof=[[0.12,-0.4],[0.16,-0.3],[0.2,-0.12],[0.215,0],[0.2,0.12],[0.16,0.3],[0.12,0.4]].map(function(a){return new THREE.Vector2(a[0],a[1])});
  D.add(new THREE.LatheGeometry(prof,14),'#7a4a24',0,0,0,0,0,Math.PI/2);
  D.cyl(0.13,0.13,0.03,'#efe7d3',0.41,0,0,14,0,Math.PI/2);D.cyl(0.13,0.13,0.03,'#efe7d3',-0.41,0,0,14,0,Math.PI/2);
  [-0.22,0,0.22].forEach(function(x){D.tor(0.208-Math.abs(x)*0.15,0.018,'#c01e2a',x,0,0,0,Math.PI/2,0,Math.PI*2,14)});
  D.tor(0.5,0.02,'#ff8c1a',0,0.42,0,0,0,0,Math.PI*1.0,14);
  var m=D.mesh(vcMat);m.position.set(0,0.12,-0.3);p.hips.add(m);return m;
}
function makeNagada(x,z,yaw){
  var g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=yaw;scene.add(g);
  var N2=new Parts();
  N2.box(1.6,0.06,0.9,'#5a3a1e',0,0.78,0);[[-0.7,-0.35],[0.7,-0.35],[-0.7,0.35],[0.7,0.35]].forEach(function(l){N2.cyl(0.05,0.05,0.78,'#5a3a1e',l[0],0.39,l[1],6)});
  [-0.38,0.38].forEach(function(dx){
    N2.add(new THREE.SphereGeometry(0.36,14,10,0,Math.PI*2,Math.PI/2,Math.PI/2),'#b9683a',dx,1.12,0);
    N2.cyl(0.36,0.36,0.04,'#e6d5b0',dx,1.13,0,16);N2.tor(0.36,0.025,'#c01e2a',dx,1.11,0,Math.PI/2,0,0,Math.PI*2,16);
  });
  g.add(N2.mesh(vcMat));return g;
}
function handBell(){
  var m=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.06,-0.1),new THREE.Vector2(0.05,-0.06),new THREE.Vector2(0.03,0),new THREE.Vector2(0.001,0.03)],10),brassMat);
  return m;
}
function makePot(){
  var g=new THREE.Group();scene.add(g);
  var body=new THREE.Mesh(potBodyGeo,copperMat);g.add(body);
  var deco=new THREE.Mesh(potDecoGeo,potMat);g.add(deco);
  return g;
}
var potBodyGeo=new THREE.LatheGeometry([[0.001,-0.3],[0.12,-0.3],[0.2,-0.24],[0.26,-0.08],[0.26,0.08],[0.2,0.2],[0.11,0.3],[0.1,0.42],[0.15,0.5]].map(function(a){return new THREE.Vector2(a[0],a[1])}),14);
var potDecoGeo=(function(){
  var D=new Parts();
  D.tor(0.145,0.035,'#ff9a1f',0,0.36,0,Math.PI/2,0,0,Math.PI*2,14);D.tor(0.26,0.03,'#c01e2a',0,0.0,0,Math.PI/2,0,0,Math.PI*2,16);D.tor(0.22,0.025,'#ffd23f',0,0.16,0,Math.PI/2,0,0,Math.PI*2,16);
  for(var k=0;k<8;k++){var a=k/8*6.283;D.cone(0.03,0.16,'#c01e2a',Math.cos(a)*0.26,-0.14,Math.sin(a)*0.26,5,Math.PI,0)}
  D.sph(0.05,'#d9a431',0,-0.3,0);
  return D.mesh(potMat).geometry;
})();
function makeKanwar(p){
  var kw=new THREE.Group();kw.position.set(0,0.57,0.02);p.torso.add(kw);
  var K=new Parts();
  K.cyl(0.032,0.032,2.3,'#c9a45a',0,0,0,8,0,Math.PI/2);
  [-1.15,1.15].forEach(function(x){K.sph(0.06,'#d9a431',x,0,0);K.cone(0.09,0.28,'#ff8c1a',x,0.16,0,6);K.box(0.02,0.16,0.26,'#c01e2a',x,0.42,0.13);K.cyl(0.006,0.006,0.5,'#8a5a2a',x,0.25,0,4)});
  [-1.05,1.05].forEach(function(x){K.cyl(0.008,0.008,0.5,'#c8a878',x,-0.25,0,4);K.tor(0.05,0.012,'#ff9a1f',x,-0.02,0,Math.PI/2,0,0,Math.PI*2,10)});
  kw.add(K.mesh(vcMat));
  var pots=[makePot(),makePot()];
  return {g:kw,pots:pots,hang:[new V3(-1.05,-0.78,0),new V3(1.05,-0.78,0)]};
}

/* ---------- the cast ---------- */
var LING=new V3(0,1.3,-12.2);            // top of the Shivling
function yawTo(fx,fz,tx,tz){return Math.atan2(-(tx-fx),-(tz-fz))}
// priests
var priest=makePerson({bare:true,priest:true,bottom:'#fbf7ee',skin:'#b5764a'});
var assistant=makePerson({bare:true,priest:true,bottom:'#ff8c1a',skin:'#a86a42',scale:0.97});
place(assistant,3.2,0.35,-13.4,yawTo(3.2,-13.4,0,-12.2));
var pKalash=new THREE.Group();scene.add(pKalash);
pKalash.add(new THREE.Mesh(potBodyGeo,copperMat));pKalash.scale.setScalar(0.55);
var pBell=handBell();priest.arms.L.fore.add(pBell);pBell.position.set(0,-0.34,0);
var aartiG=new THREE.Group();scene.add(aartiG);
aartiG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.15,0.03,14),brassMat));
var aFlames=[];
for(var af=0;af<5;af++){
  var fs=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffb050,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  var fa=af/5*6.283;fs.position.set(Math.cos(fa)*0.1,0.07,Math.sin(fa)*0.1);fs.scale.setScalar(0.32);aartiG.add(fs);aFlames.push(fs);
  var fc2=new THREE.Mesh(new THREE.SphereGeometry(0.02,6,5),new THREE.MeshBasicMaterial({color:0xfff0b0}));fc2.position.copy(fs.position);aartiG.add(fc2);
}
var conch=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.24,10),new THREE.MeshStandardMaterial({color:0xf3ead8,roughness:0.5}));
conch.rotation.x=Math.PI/2;assistant.arms.R.fore.add(conch);conch.position.set(0,-0.32,-0.08);
var aBell=handBell();assistant.arms.L.fore.add(aBell);aBell.position.set(0,-0.34,0);

function priestPose(t){
  var x,z,yaw,lean=0;
  if(t<52){x=1.15;z=-12.2;yaw=Math.PI/2}
  else if(t<56){var u=smooth((t-52)/4);x=lerp(1.15,-1.15,u);z=-12.2;yaw=lerp(Math.PI/2,-Math.PI/2,u)}
  else if(t<82){x=-1.15;z=-12.2;yaw=-Math.PI/2}
  else if(t<86){var u2=smooth((t-82)/4);x=lerp(-1.15,0,u2);z=lerp(-12.2,-10.95,u2);yaw=lerp(-Math.PI/2,0,u2)}
  else{x=0;z=-10.95;yaw=0}
  return [x,z,yaw];
}
// what the priest pours: returns {on, colour, amount}
function priestPour(t){
  if(t>=4&&t<14){var c=(t-4)%5;return {on:c<3,col:0xbfe6ff,amt:0.5,u:smooth(Math.min(c,3-c)/0.6)}}
  if(t>=14&&t<38){var c2=(t-14)%6.5,col=t<24?0xfdfdfb:(t<31?0xe8b33a:0xbfe6ff);return {on:c2<4.4,col:col,amt:1,u:smooth(Math.min(c2,4.4-c2)/0.7)}}
  return {on:false,col:0xbfe6ff,amt:0,u:0};
}
var wetAmt=0,milkAmt=0,pourNow=0;
var dholPl=[],nagPl=[];
var _hv=new V3(),_hv2=new V3();
function updPriest(t){
  var p=priest,pp=priestPose(t),pr=priestPour(t);
  place(p,pp[0],0.35,pp[1],pp[2]);
  var lean=0,shake=0;
  var aarti=t>=86&&t<116,offer=t>=38&&t<52;
  var ph=t*0.9;
  var pouring=pr.on&&pr.u>0.05;
  lean=pouring?0.5*pr.u:(aarti?0.28:(offer?0.25:0.06));
  p.torso.rotation.set(-lean+Math.sin(ph)*0.01,0,Math.sin(ph*0.7)*0.02);
  p.root.updateMatrixWorld(true);
  // left hand: bell
  var bp=aarti?0.34:(t<84?0.9:1.6);
  var bt=t-Math.floor(t/bp)*bp;shake=Math.exp(-bt*9);
  tl(p,_hv,-0.14,0.62+0.05*shake*Math.sin(t*40),-0.3);
  aimArm(p,'L',_hv,-0.8,-1,0.2);
  pBell.rotation.z=Math.sin(t*40)*0.5*shake;
  var kOn=false;
  if(pouring||(t<14&&pr.on)){
    // pour from a small copper vessel held over the lingam
    var u=pr.u,th=1.9*smooth((u-0.3)/0.7);
    var chest=tl(p,_hv2,0.1,0.5,-0.3);
    _hv.set(0.42,1.68,-12.2).lerp(chest,1-smooth(u*1.4));
    pKalash.position.copy(_hv);pKalash.rotation.set(0,0,th);
    aimArm(p,'R',_hv,0.8,-1,0.1);
    kOn=true;
  }else if(offer){
    var c3=((t-38)%3.2)/3.2,up=smooth(Math.sin(c3*Math.PI)*1.3);
    tl(p,_hv2,0.1,0.45,-0.35);_hv.set(0.3,1.55,-12.2).lerp(_hv2,1-up);
    aimArm(p,'R',_hv,0.8,-1,0.1);
    pKalash.position.set(0,-9,0);
    if(up>0.9&&rnd()<0.3)emitPetal(0.3+rr(-0.15,0.15),1.6,-12.2+rr(-0.15,0.15),rr(-0.3,0.3),rr(0,0.4),rr(-0.3,0.3));
  }else if(aarti){
    var a=t*Math.PI*2*0.75,cx=0,cy=1.5,cz=-11.5;
    _hv.set(cx+Math.cos(a)*0.22,cy+Math.sin(a)*0.22,cz);
    aimArm(p,'R',_hv,0.8,-1,0.1);
    aartiG.position.copy(_hv);aartiG.position.y-=0.04;
    pKalash.position.set(0,-9,0);
  }else{
    tl(p,_hv,0.04,0.42,-0.22);aimArm(p,'R',_hv,0.7,-1,0.2);pKalash.position.set(0,-9,0);
  }
  if(!aarti)aartiG.position.set(0,-9,0);
  // stream over the lingam
  var on=kOn&&pr.u>0.5;
  if(on){
    _hv.copy(pKalash.position);_hv.x-=0.36;_hv.y-=0.08;
    _hv2.copy(LING);_hv2.x+=rr(-0.02,0.02);
    setStream(streamA,_hv,_hv2,pr.col,true);
    pourNow=Math.max(pourNow,pr.amt);milkAmt=Math.max(milkAmt,pr.col===0xfdfdfb?1:0);
    if(rnd()<0.6)emitDrop(rr(-0.15,0.15),1.32,-12.2+rr(-0.15,0.15),rr(-0.5,0.5),rr(0.6,1.5),rr(-0.5,0.5),0.5);
    if(rnd()<0.35)emitDrop(-0.78,0.74,-12.2,-0.2,0.3,0,0.7);
  }else setStream(streamA,_hv,_hv,0,false);
}
function updAssistant(t){
  var p=assistant,ph=t*0.8,aarti=t>=86&&t<116;
  p.torso.rotation.set(-0.05,0,Math.sin(ph)*0.02);p.root.updateMatrixWorld(true);
  var blow=t>=84&&t<88.5;
  if(blow){tl(p,_hv,0.02,0.72,-0.16);aimArm(p,'R',_hv,0.8,-1,0.2);conch.visible=true}
  else{tl(p,_hv,0.1,0.4,-0.28);aimArm(p,'R',_hv,0.7,-1,0.2);conch.visible=false}
  var bp=aarti?0.34:0.9,bt=t-Math.floor(t/bp)*bp,sh=Math.exp(-bt*9);
  tl(p,_hv,-0.14,0.6+0.05*sh*Math.sin(t*40),-0.3);aimArm(p,'L',_hv,-0.8,-1,0.2);
  aBell.rotation.z=Math.sin(t*40)*0.5*sh;
}

// devotees kneeling and standing
var mens=['#f4efe6','#e8d9b0','#8fb7d9','#e7a04b','#cfd8a8'],womens=[['#d0396a','#c0392b'],['#e07a1f','#b85a10'],['#2e8b57','#1f6a40'],['#4a4ab5','#33338a'],['#c0392b','#8a2a20'],['#e75480','#b03a64']];
var devotees=[];
var seat=[[-3.4,7,0],[-5.0,7.7,1],[-3.6,10.5,1],[-5.4,11.2,0],[-3.8,15.2,1],[-5.6,16,0],[3.4,7.4,1],[5.0,7,0],[3.6,10.8,0],[5.4,10.4,1],[3.8,16,0],[5.6,15,1],[-4.4,19,1],[4.6,19.4,0]];
seat.forEach(function(s){
  var w=s[2]===1,c=pick(womens);
  var p=makePerson(w?{woman:true,top:c[0],bottom:c[1],dupatta:c[0],bun:true,scale:0.95,hair:'#1a1210'}:{top:pick(mens),bottom:'#f4efe6',turban:rnd()<0.35?pick(['#e7a04b','#c0392b','#f4efe6']):null,scale:1});
  setSeat(p,true);place(p,s[0],0,s[1],rr(-0.08,0.08));
  devotees.push({p:p,ph:rnd()*20,period:rr(14,20),clap:rnd()<0.85,raise:rnd()<0.5,thali:false});
});
[[-2.5,4.6],[2.6,4.9]].forEach(function(s){var p=makePerson({top:'#e07a1f',bottom:'#f4efe6',scale:0.62});setSeat(p,true);place(p,s[0],0,s[1],0);devotees.push({p:p,ph:rnd()*20,period:12,clap:true,raise:true,thali:false})});
// standing devotees carrying offering plates
[[-8.6,9.5],[8.6,12],[-8.7,18.5],[8.5,20]].forEach(function(s){
  var w=rnd()<0.5,c=pick(womens);
  var p=makePerson(w?{woman:true,top:c[0],bottom:c[1],dupatta:c[0],bun:true,scale:0.95}:{top:pick(mens),bottom:'#f4efe6',scale:1});
  setSeat(p,false);place(p,s[0],0,s[1],yawTo(s[0],s[1],s[0]*0.35,-2));
  var th=new Parts();th.cyl(0.19,0.17,0.03,GOLDC,0,0,0,14);th.sph(0.06,'#ff9a1f',0.05,0.05,0.02);th.sph(0.05,'#ffd23f',-0.06,0.05,-0.03);th.sph(0.045,'#e75480',0.0,0.05,0.07);th.cyl(0.03,0.025,0.03,'#b5643a',-0.02,0.04,0.0,8);
  var tm=th.mesh(goldMat);tm.position.set(0,0.34,-0.34);p.torso.add(tm);
  devotees.push({p:p,ph:rnd()*20,period:16,clap:false,raise:false,thali:true});
});
// devotees who pull the bell ropes
var pullers=[[bigBells[1],-1],[bigBells[2],1]].map(function(bp){
  var p=makePerson({top:'#e8d9b0',bottom:'#f4efe6',scale:1,turban:'#e7a04b'});
  setSeat(p,false);place(p,bp[0].ropeEnd.x+0.28*bp[1],0,bp[0].ropeEnd.z+0.45,0);
  return {p:p,bell:bp[0],ph:rnd()*5};
});
function updDevotee(d,t){
  var p=d.p,ph=t+d.ph,I=inten(t);
  var c=(((ph%d.period)+d.period)%d.period)/d.period;
  var pr=c<0.2?Math.sin(c/0.2*Math.PI):0;
  pr=Math.max(pr,smooth((t-116)/2.5)*(1-smooth((t-124)/2.5)));
  if(d.thali)pr=0;
  var sway=Math.sin(ph*0.9)*0.02*(1+I*1.5);
  p.torso.rotation.set(-0.05-1.0*pr+Math.sin(ph*1.3)*0.012,0,sway);
  p.root.updateMatrixWorld(true);
  var aarti=t>=84&&t<116;
  if(d.thali){
    tl(p,_hv,-0.11,0.35,-0.36);tl(p,_hv2,0.11,0.35,-0.36);
    aimArm(p,'L',_hv,-0.8,-1,0.1);aimArm(p,'R',_hv2,0.8,-1,0.1);
  }else if(pr>0.35){
    rl(p,_hv,-0.16,0.03,-0.6);rl(p,_hv2,0.16,0.03,-0.6);
    aimArm(p,'L',_hv,-0.5,-1,0.2);aimArm(p,'R',_hv2,0.5,-1,0.2);
  }else if(aarti&&d.clap){
    var ap=0.5+0.5*Math.cos(t*Math.PI*2/BEAT);
    if(d.raise&&t>98&&t<112){
      tl(p,_hv,-0.17,1.2+0.06*Math.sin(t*6),-0.1);tl(p,_hv2,0.17,1.2+0.06*Math.cos(t*6),-0.1);
      aimArm(p,'L',_hv,-1,-0.4,0.2);aimArm(p,'R',_hv2,1,-0.4,0.2);
    }else pray(p,0.02,0.12*ap);
  }else pray(p,0,0);
}
function updPuller(d,t){
  var p=d.p,rec=recentBell(d.bell,t,0.5);
  p.torso.rotation.set(-0.06-0.12*rec,0,0);p.root.updateMatrixWorld(true);
  _hv.copy(d.bell.ropeEnd);_hv.y+=0.15-0.5*rec;
  aimArm(p,'R',_hv,0.8,-1,0.1);
  pray(p,0,0);aimArm(p,'R',_hv,0.8,-1,0.1);
  tl(p,_hv2,-0.12,0.42,-0.25);aimArm(p,'L',_hv2,-0.7,-1,0.2);
}

// musicians: dhol players and nagada players
var musicians=[];
[[-8.6,5.5,-0.9,'#c0392b','#e7a04b'],[8.6,5,0.9,'#2e8b57','#e7a04b'],[-8.5,24.5,-0.5,'#4a4ab5','#c0392b']].forEach(function(m){
  var p=makePerson({top:'#f4efe6',bottom:'#f4efe6',turban:m[3],sash:m[4],scale:1.0});
  setSeat(p,false);place(p,m[0],0,m[1],yawTo(m[0],m[1],0,m[1]-3)+(-m[2]*0.5));
  makeDhol(p);musicians.push({p:p,kind:'dhol'});
});
[[9.4,10.5,-Math.PI/2],[9.4,13.6,-Math.PI/2]].forEach(function(m,i){
  var p=makePerson({top:i?'#e7a04b':'#f4efe6',bottom:'#f4efe6',turban:i?'#c0392b':'#2e8b57',sash:'#e7a04b'});
  setSeat(p,false);
  place(p,m[0]+0.85,0,m[1],Math.PI/2);
  makeNagada(m[0],m[1],m[2]);
  musicians.push({p:p,kind:'nag',cx:m[0],cz:m[1],alt:i});
});
function updMusician(m,t){
  var p=m.p,I=inten(t);
  p.root.updateMatrixWorld(true);
  var s=0.5+0.5*I;
  if(m.kind==='dhol'){
    var eb=hitEnv('bass',t,I,0.12),et=hitEnv('tre',t,I,0.09);
    p.torso.rotation.set(-0.05,0,Math.sin(t*3.5)*0.05*I);
    rl(p,_hv,0.4,0.98,-0.32);_hv.y+=0.32*(1-eb);_hv.z-=0.05;
    aimArm(p,'R',_hv,0.8,-0.2,0.5);
    rl(p,_hv2,-0.4,0.98,-0.32);_hv2.y+=0.26*(1-et);
    aimArm(p,'L',_hv2,-0.8,-0.2,0.5);
    p.root.position.y=0.03*Math.abs(Math.sin(t*Math.PI/BEAT))*I;
  }else{
    var en=hitEnv('nag',t,I,0.14),en2=hitEnv('bass',t+0.1,I,0.14);
    p.torso.rotation.set(-0.1,0,Math.sin(t*2.6+m.alt)*0.05*I);
    // drums sit in front of the player, on the -x side
    p.root.updateMatrixWorld(true);
    _hv.set(m.cx,1.2,m.cz+0.38);_hv.y+=0.3*(1-(m.alt?en2:en));
    _hv2.set(m.cx,1.2,m.cz-0.38);_hv2.y+=0.3*(1-(m.alt?en:en2));
    aimArm(p,'R',_hv,0.8,-0.4,0.3);aimArm(p,'L',_hv2,-0.8,-0.4,0.3);
  }
}

/* ---------- Kanwar Yatris: they walk in with decorated kanwars and pour holy water on the Shivling ---------- */
function buildPath(i){
  var sx=i%2?1:-1,xo=sx*0.9,d=(i>>1)*2.2,E=38+d,V=3.0;
  var slot=[sx*2.9,4.6-(i>>1)*1.7],pts=[[E,xo,35]];
  var t1=E+27/V;pts.push([t1,xo,8]);
  var t2=t1+Math.hypot(slot[0]-xo,slot[1]-8)/V;pts.push([t2,slot[0],slot[1]]);
  if(i<4){
    var T=58+i*6.5,dep=T-8,rest=[sx*4.2,2.0+(i>>1)*1.8];
    pts.push([dep,slot[0],slot[1]]);pts.push([dep+3.0,sx*2.3,-2.2]);pts.push([dep+4.2,sx*2.3,-4.9]);pts.push([dep+5.2,sx*1.0,-6.2]);
    pts.push([dep+7.4,0,-10.95]);pts.push([T+3.6,0,-10.95]);
    pts.push([T+5.0,sx*1.0,-6.2]);pts.push([T+6.0,sx*2.3,-4.9]);pts.push([T+7.2,sx*2.6,-1.5]);pts.push([T+9.5,rest[0],rest[1]]);
    pts.push([LOOP+60,rest[0],rest[1]]);
  }else{
    var side=[sx*5.2,3.4+(i-4)*1.5];
    pts.push([58,slot[0],slot[1]]);pts.push([62,side[0],side[1]]);pts.push([LOOP+60,side[0],side[1]]);
  }
  return pts;
}
var yatris=[],KC=['#ff8c1a','#e8710a','#ff9a3d','#f28c28','#ffab40','#e8710a'];
for(var yi=0;yi<6;yi++){
  var yp=makePerson({kanwari:true,top:KC[yi],bottom:'#ff9a3d',sleeve:KC[yi],hair:'#1a1210',scale:1});
  setSeat(yp,false);
  yatris.push({p:yp,kw:makeKanwar(yp),path:buildPath(yi),ph:rnd()*6,T:58+yi*6.5,idx:yi});
}
var _path={vis:false,x:0,z:0,dx:0,dz:0,moving:false};
function pathAt(pts,t,o){
  if(t<=pts[0][0]){o.vis=false;return}
  o.vis=true;var i=1;while(i<pts.length-1&&pts[i][0]<t)i++;
  var a=pts[i-1],b=pts[i],u=clamp((t-a[0])/(b[0]-a[0]),0,1);
  o.x=lerp(a[1],b[1],u);o.z=lerp(a[2],b[2],u);o.dx=b[1]-a[1];o.dz=b[2]-a[2];o.moving=(Math.abs(o.dx)+Math.abs(o.dz))>0.01&&t<b[0];
}
var _kq=new THREE.Quaternion(),_tq=new THREE.Quaternion(),_te=new THREE.Euler(),_kv=new V3(),_lipv=new V3();
var POT_TARGET=new V3(0,1.85,-11.6);
function updYatri(y,t){
  var p=y.p;pathAt(y.path,t,_path);
  p.root.visible=_path.vis;y.kw.pots.forEach(function(pt){pt.visible=_path.vis});
  if(!_path.vis)return;
  var walking=_path.moving,ph=t*5.2+y.ph;
  p.yaw=angLerp(p.yaw,walking?yawTo(0,0,_path.dx,_path.dz):0,walking?0.14:0.08);
  var dance=!walking&&_path.z>-4;
  var bob=(walking?Math.abs(Math.sin(ph))*0.06:0)+(dance?Math.abs(Math.sin(ph*0.9))*0.1:0);
  place(p,_path.x,floorY(_path.x,_path.z)+bob,_path.z,p.yaw);
  var T=y.T,pour=y.idx<4&&t>=T-1.4&&t<T+4.2;
  var lift=pour?smooth((t-(T-1.4))/1.4)*(1-smooth((t-(T+3.2))/1.0)):0;
  var tilt=pour?1.9*smooth((t-T)/0.9)*(1-smooth((t-(T+2.9))/0.7)):0;
  p.torso.rotation.set(-(walking?0.05:0)-0.35*lift,0,Math.sin(ph)*(walking?0.06:0.03)+(dance?Math.sin(ph*0.9)*0.06:0));
  y.kw.g.rotation.set(0,0,Math.sin(ph+1)*0.03);
  p.root.updateMatrixWorld(true);
  y.kw.g.getWorldQuaternion(_kq);
  for(var k=0;k<2;k++){
    var pot=y.kw.pots[k];
    y.kw.g.localToWorld(_kv.copy(y.kw.hang[k]));
    pot.position.copy(_kv);pot.quaternion.copy(_kq);
    if(k===0&&lift>0.001){
      pot.position.lerp(POT_TARGET,lift);
      _te.set(-tilt,0,0);_tq.setFromEuler(_te);pot.quaternion.slerp(_tq,lift);
    }
    pot.updateMatrixWorld(true);
  }
  var pot0=y.kw.pots[0];
  if(lift>0.05){
    _hv.copy(pot0.position);_hv.x+=0.24;_hv.y-=0.05;_hv.z+=0.02;aimArm(p,'R',_hv,0.8,-1,0.2);
    _hv2.copy(pot0.position);_hv2.x-=0.24;_hv2.y-=0.05;_hv2.z+=0.02;aimArm(p,'L',_hv2,-0.8,-1,0.2);
  }else{
    y.kw.g.localToWorld(_hv.set(0.55,0,0));aimArm(p,'R',_hv,0.9,-1,0);
    y.kw.g.localToWorld(_hv2.set(-0.55,0,0));aimArm(p,'L',_hv2,-0.9,-1,0);
  }
  if(pour&&tilt>1.0){
    pot0.localToWorld(_lipv.set(0,0.5,0));_hv2.copy(LING);_hv2.x+=rr(-0.02,0.02);
    setStream(streamB,_lipv,_hv2,0xbfe6ff,true);pourNow=Math.max(pourNow,1);
    if(rnd()<0.7)emitDrop(rr(-0.15,0.15),1.32,-12.2+rr(-0.15,0.15),rr(-0.6,0.6),rr(0.7,1.7),rr(-0.6,0.6),0.5);
    if(rnd()<0.3)emitDrop(-0.78,0.74,-12.2,-0.2,0.3,0,0.7);
  }else if(y.idx<4&&t>=y.T&&t<y.T+4.2){/* between pours */}
  yatriPourOn=yatriPourOn||(pour&&tilt>1.0);
}
var yatriPourOn=false;

/* ---------- sound: synthesized drums, bells, conch and water (no recordings) ---------- */
var AU={ctx:null,ok:false,on:false};
function auInit(){
  if(AU.ctx)return AU.ok;
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  try{
    var c=new AC();AU.ctx=c;
    AU.master=c.createGain();AU.master.gain.value=0.9;
    var comp=c.createDynamicsCompressor();AU.master.connect(comp);comp.connect(c.destination);
    var len=Math.floor(c.sampleRate*2.4),imp=c.createBuffer(2,len,c.sampleRate),ch,i;
    for(ch=0;ch<2;ch++){var d=imp.getChannelData(ch);for(i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3)}
    AU.rev=c.createConvolver();AU.rev.buffer=imp;var rg=c.createGain();rg.gain.value=0.5;AU.rev.connect(rg);rg.connect(AU.master);
    AU.bus=c.createGain();AU.bus.connect(AU.master);AU.bus.connect(AU.rev);
    var nb=c.createBuffer(1,c.sampleRate,c.sampleRate),nd=nb.getChannelData(0);for(i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;AU.noise=nb;
    var dg=c.createGain();dg.gain.value=0.05;dg.connect(AU.master);
    [98,147,196.6,98.7].forEach(function(f,k){var o=c.createOscillator();o.type=k===2?'triangle':'sine';o.frequency.value=f;var g2=c.createGain();g2.gain.value=k===2?0.4:1;o.connect(g2);g2.connect(dg);o.start()});
    var ps=c.createBufferSource();ps.buffer=AU.noise;ps.loop=true;var pf=c.createBiquadFilter();pf.type='bandpass';pf.frequency.value=1900;pf.Q.value=0.7;
    AU.pour=c.createGain();AU.pour.gain.value=0;ps.connect(pf);pf.connect(AU.pour);AU.pour.connect(AU.bus);ps.start();
    AU.ok=true;
  }catch(e){AU.ok=false}
  return AU.ok;
}
function noiseHit(t,dur,freq,gain,type){
  var c=AU.ctx,src=c.createBufferSource();src.buffer=AU.noise;
  var f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;
  var g=c.createGain();g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  src.connect(f);f.connect(g);g.connect(AU.bus);src.start(t);src.stop(t+dur+0.02);
}
function toneHit(t,type,f0,f1,dur,gain){
  var c=AU.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;
  o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur*0.6);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(AU.bus);o.start(t);o.stop(t+dur+0.03);
}
function sDholBass(v){if(!AU.on)return;var t=AU.ctx.currentTime;toneHit(t,'sine',150,52,0.34,0.95*v);noiseHit(t,0.05,700,0.22*v,'lowpass')}
function sDholTre(v){if(!AU.on)return;var t=AU.ctx.currentTime;noiseHit(t,0.06,3600,0.3*v,'bandpass');toneHit(t,'triangle',420,300,0.1,0.18*v)}
function sNagada(v){if(!AU.on)return;var t=AU.ctx.currentTime;toneHit(t,'triangle',230,150,0.3,0.6*v);noiseHit(t,0.07,1000,0.22*v,'lowpass')}
function sBell(pitch,v){
  if(!AU.on)return;var c=AU.ctx,t=c.currentTime;
  [[1,1,3.4],[2.01,0.6,2.6],[2.76,0.45,2.0],[4.07,0.3,1.5],[5.4,0.2,1.1]].forEach(function(p){
    var o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=pitch*p[0];
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.12*v*p[1],t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+p[2]);
    o.connect(g);g.connect(AU.bus);o.start(t);o.stop(t+p[2]+0.05);
  });
}
function sHandBell(v){
  if(!AU.on)return;var c=AU.ctx,t=c.currentTime;
  [[1,1,1.0],[2.7,0.5,0.7],[5.1,0.25,0.5]].forEach(function(p){
    var o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=1560*p[0];
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.06*v*p[1],t+0.003);g.gain.exponentialRampToValueAtTime(0.0001,t+p[2]);
    o.connect(g);g.connect(AU.bus);o.start(t);o.stop(t+p[2]+0.05);
  });
}
function sConch(dur){
  if(!AU.on)return;var c=AU.ctx,t=c.currentTime;
  var o=c.createOscillator(),o2=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter(),lfo=c.createOscillator(),lg=c.createGain();
  o.type='sawtooth';o.frequency.value=233;o2.type='sawtooth';o2.frequency.value=349;
  f.type='lowpass';f.frequency.value=1100;lfo.frequency.value=5;lg.gain.value=5;lfo.connect(lg);lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.16,t+0.35);g.gain.setValueAtTime(0.16,t+dur-0.6);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(f);o2.connect(f);f.connect(g);g.connect(AU.bus);
  o.start(t);o2.start(t);lfo.start(t);o.stop(t+dur+0.1);o2.stop(t+dur+0.1);lfo.stop(t+dur+0.1);
}
var soundBtn=q('#pjsound');
function setSound(on){
  if(on){
    if(!auInit()){soundBtn.textContent='Sound unavailable';return}
    AU.on=true;if(AU.ctx.resume)AU.ctx.resume();AU.master.gain.setTargetAtTime(0.9,AU.ctx.currentTime,0.05);soundBtn.textContent='Sound on';
  }else{
    AU.on=false;if(AU.ok)AU.master.gain.setTargetAtTime(0,AU.ctx.currentTime,0.05);soundBtn.textContent='Sound off';
  }
  soundBtn.setAttribute('aria-pressed',on?'true':'false');
}
var lastStep=-1,lastBellK=-1;
function audioTick(t,prev){
  var I=inten(t);
  if(t<prev){lastStep=-1;lastBellK=-1;prev=-0.001}
  var s=Math.floor(t/STEP);if(lastStep<0)lastStep=s-1;
  if(s-lastStep>8)lastStep=s-1;
  for(var st=lastStep+1;st<=s;st++){
    if(gateHit('bass',st,I))sDholBass(0.5+0.5*I);
    if(gateHit('tre',st,I))sDholTre(0.5+0.5*I);
    if(gateHit('nag',st,I))sNagada(0.5+0.5*I);
  }
  lastStep=s;
  for(var i=0;i<bellEvents.length;i++){var e=bellEvents[i];if(e[0]>prev&&e[0]<=t)sBell(bigBells[e[1]].pitch,e[2])}
  var aarti=t>=86&&t<116,bp=aarti?0.34:(t<84?0.9:1.6),k=Math.floor(t/bp);
  if(k!==lastBellK){lastBellK=k;sHandBell(aarti?0.9:0.6)}
  if((prev<84&&t>=84)||(prev<14&&t>=14)){sConch(prev<84&&t>=84?4:1.6)}
  if(AU.ok){AU.pour.gain.setTargetAtTime(pourNow>0?0.1*pourNow:0,AU.ctx.currentTime,0.08)}
}

/* ---------- effects: bells, flames, smoke, petals, water, the wet Shivling ---------- */
var _od=new THREE.Object3D(),lastPetalT=0;
function updateFX(t,dt,I){
  bigBells.forEach(function(b){var a=bellAngle(b,t);b.g.rotation.z=a;b.g.rotation.x=a*0.3});
  var db=hitEnv('bass',t,I,0.25);
  doorBells.forEach(function(d,i){d.rotation.z=Math.sin(t*2.2+i)*0.03*(0.4+I)+Math.sin(t*4+i)*0.12*db});
  flameMat.size=0.72+0.1*Math.sin(t*13)+0.06*Math.sin(t*23.3);
  bigFlameMat.size=1.5+0.2*Math.sin(t*9)+0.1*Math.sin(t*17);
  var aarti=t>=84&&t<116;
  lSanct.intensity=1.7+0.15*Math.sin(t*11)+0.1*Math.sin(t*17)+(aarti?0.35:0);
  lHall1.intensity=0.95+0.08*Math.sin(t*9+1);lHall2.intensity=0.85+0.08*Math.sin(t*10+2);lNandi.intensity=0.9+0.07*Math.sin(t*12);
  haloM.material.opacity=0.28+0.06*Math.sin(t*1.7)+(aarti?0.12:0);
  aFlames.forEach(function(s,i){s.scale.setScalar(0.3+0.05*Math.sin(t*15+i*2))});
  // smoke
  smokes.forEach(function(sm){
    sm.age+=dt;if(sm.age>6.5)sm.age=0;
    var a=sm.age;sm.s.visible=true;
    sm.s.position.set(sm.src[0]+sm.dx*a*0.3+Math.sin(a*1.3+sm.dz*9)*0.15,sm.src[1]+a*0.5,sm.src[2]+sm.dz*a*0.3);
    sm.s.scale.setScalar(0.3+a*0.32);sm.s.material.opacity=0.16*Math.sin(Math.PI*a/6.5);
  });
  dust.rotation.y=Math.sin(t*0.05)*0.04;dust.position.y=Math.sin(t*0.2)*0.15;
  // the lingam is washed with milk, honey and water
  var milk=t<14?0:(t<24?smooth((t-14)/3):(t<31?1:(t<38?1-smooth((t-31)/4):0)));
  var honey=t>=24&&t<31?smooth((t-24)/2)*(1-smooth((t-29)/2)):0;
  lingamMat.color.setRGB(0.07+milk*0.42+honey*0.4,0.07+milk*0.42+honey*0.28,0.09+milk*0.4);
  wetAmt=lerp(wetAmt,pourNow>0?1:0,pourNow>0?0.12:0.012);
  lingamMat.roughness=lerp(0.3,0.1,wetAmt);lingamMat.emissiveIntensity=0.15*wetAmt;
  // petals: a shower during the aarti and a small burst as each Yatri pours
  if(playing){
    if(aarti){var n=Math.floor((t-lastPetalT)*26);if(n>0){for(var i=0;i<n;i++)emitPetal(rr(-3.2,3.2),rr(6.5,8),rr(-9,3),rr(-0.2,0.2),rr(-0.2,0),rr(-0.2,0.2));lastPetalT=t}}
    else lastPetalT=t;
    yatris.forEach(function(y){if(y.idx<4&&t>=y.T+2&&t<y.T+2.1)for(var i=0;i<14;i++)emitPetal(rr(-0.4,0.4),rr(1.6,2.2),-11.8+rr(-0.4,0.4),rr(-0.6,0.6),rr(0.4,1.4),rr(-0.6,0.6))});
  }
  petalPools.forEach(function(pl){
    pl.st.forEach(function(s,i){
      if(s.life>0){
        s.life-=dt;s.v.y=Math.max(s.v.y-1.3*dt,-0.9);s.v.x*=0.99;s.p.addScaledVector(s.v,dt);
        s.rx+=s.spin*dt;s.ry+=s.spin*0.7*dt;
        if(s.p.y<0.03){s.p.y=0.03;s.v.set(0,0,0);s.life=Math.min(s.life,0.8)}
        _od.position.copy(s.p);_od.rotation.set(s.rx,s.ry,0);_od.scale.setScalar(Math.min(1,s.life*2));
      }else{_od.position.set(0,-50,0);_od.scale.setScalar(0.001)}
      _od.updateMatrix();pl.im.setMatrixAt(i,_od.matrix);
    });
    pl.im.instanceMatrix.needsUpdate=true;
  });
  for(var d2=0;d2<dropN;d2++){
    var ds=dropSt[d2];
    if(ds.life>0){ds.life-=dt;ds.v.y-=4*dt;dropA[d2*3]+=ds.v.x*dt;dropA[d2*3+1]+=ds.v.y*dt;dropA[d2*3+2]+=ds.v.z*dt;if(dropA[d2*3+1]<0.4||ds.life<=0){ds.life=0;dropA[d2*3+1]=-50}}
  }
  dropG.attributes.position.needsUpdate=true;
}

/* ---------- camera direction ---------- */
var KEYS=[
  [0,   0,1.9,33,     0,2.4,-10],
  [9,   0,1.75,21,    0,2.3,-9],
  [15,  2.4,1.55,9,   0,1.7,-8],
  [22,  -2.9,1.35,0.8, 0,1.5,-11],
  [32,  2.5,1.6,-8.6, 0,1.3,-12.2],
  [38,  0,2.2,27,     0,1.7,8],
  [49,  -4.2,1.9,9,   0,1.4,0],
  [58,  1.5,1.6,-7.4, 0,1.4,-11.8],
  [71,  -1.7,1.6,-3.5, 0,1.5,-11.5],
  [86,  0,2.9,7,      0,2.0,-11],
  [98,  5.2,2.1,-3.5, 0,1.6,-11],
  [110, 0,2.8,15,     0,2.4,-8],
  [120, 0,2.0,29,     0,2.6,-9],
  [128, 0,1.9,33,     0,2.4,-10]
];
var KX=KEYS.slice();
KX.unshift([KEYS[KEYS.length-2][0]-LOOP].concat(KEYS[KEYS.length-2].slice(1)));
KX.push([KEYS[1][0]+LOOP].concat(KEYS[1].slice(1)));
function hermite(p0,p1,m0,m1,u,dt){var u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*p0+(u3-2*u2+u)*dt*m0+(-2*u3+3*u2)*p1+(u3-u2)*dt*m1}
var camV=[0,0,0,0,0,0];
function sampleCam(t){
  var i=1;while(i<KX.length-3&&KX[i+1][0]<=t)i++;
  var a=KX[i],b=KX[i+1],dtk=b[0]-a[0],u=clamp((t-a[0])/dtk,0,1);
  for(var c=1;c<=6;c++){
    var m0=(b[c]-KX[i-1][c])/(b[0]-KX[i-1][0]),m1=(KX[i+2][c]-a[c])/(KX[i+2][0]-a[0]);
    camV[c-1]=hermite(a[c],b[c],m0,m1,u,dtk);
  }
  return camV;
}
var VIEWS={aisle:[0,1.7,30,0,2.4,-9],nandi:[-3.6,1.35,1.4,0,1.4,-11],priest:[2.9,1.45,-8.2,0,1.35,-12.2]};
var view='auto',camTarget=new V3(0,2,-9);
function setView(v){
  view=v;
  controls.enabled=(v==='free');
  if(v==='free'){controls.target.copy(camTarget);}
  host.querySelectorAll('#pjviews button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v===v?'true':'false')});
}
function updateCamera(t,clockT){
  var v;
  if(view==='free'){controls.update();camTarget.copy(controls.target);return}
  v=view==='auto'?sampleCam(t):VIEWS[view];
  var sw=Math.sin(clockT*0.35)*0.18,sy=Math.sin(clockT*0.5)*0.05;
  cam.position.set(v[0]+sw,v[1]+sy,v[2]);camTarget.set(v[3],v[4],v[5]);cam.lookAt(camTarget);
}

/* ---------- main loop and controls ---------- */
var T=0,playing=true,visible=true,last=performance.now(),firstDone=false,prevT=0;
var elPhase=q('#pjphase'),elFade=q('#pjfade'),elPlay=q('#pjplay');
elPlay.addEventListener('click',function(){playing=!playing;elPlay.textContent=playing?'Pause':'Play'});
soundBtn.addEventListener('click',function(){setSound(!AU.on)});
q('#pjrestart').addEventListener('click',function(){T=0;prevT=0;lastStep=-1});
host.querySelectorAll('#pjviews button').forEach(function(b){b.addEventListener('click',function(){setView(b.dataset.v)})});
setView('auto');
if(reduce){T=22;playing=false;elPlay.textContent='Play'}
function updateAll(t,dt,clockT){
  var I=inten(t);
  pourNow=0;streamB.visible=false;yatriPourOn=false;
  updPriest(t);updAssistant(t);
  devotees.forEach(function(d){updDevotee(d,t)});
  pullers.forEach(function(d){updPuller(d,t)});
  musicians.forEach(function(m){updMusician(m,t)});
  yatris.forEach(function(y){updYatri(y,t)});
  updateFX(t,dt,I);
  updateCamera(t,clockT);
  elPhase.textContent=phaseAt(t);
  elFade.style.opacity=String(Math.max(clamp((0.9-t)/0.9,0,1),clamp((t-(LOOP-1.2))/1.2,0,1)));
}
function frame(now){
  if(!visible){requestAnimationFrame(frame);return}
  try{
    var dt=Math.min(0.05,(now-last)/1000||0.016);last=now;
    if(playing){prevT=T;T+=dt;if(T>=LOOP){T-=LOOP}}
    updateAll(T,playing?dt:0,now/1000);
    if(playing)audioTick(T,prevT);
    if(view==='free')controls.update();
    renderer.render(scene,cam);
    if(!firstDone){firstDone=true;host.classList.add('ready')}
  }catch(err){window.__failPuja(String(err&&err.message||err));return}
  requestAnimationFrame(frame);
}
function onResize(){cam.aspect=W()/H();cam.updateProjectionMatrix();renderer.setSize(W(),H())}
window.addEventListener('resize',onResize);
requestAnimationFrame(frame);
return {resize:onResize,setVisible:function(v){
  visible=v;last=performance.now();
  if(AU.ok){if(v){if(AU.on&&AU.ctx.resume)AU.ctx.resume()}else if(AU.ctx.suspend)AU.ctx.suspend()}
},state:function(){return {t:T,playing:playing,view:view}},seek:function(t){T=t;prevT=t},debug:function(){return {yatris:yatris,priest:priest,assistant:assistant,NG:NG,nandi:nandi,SH:SH,people:people,streamA:streamA,streamB:streamB,LING:LING,bigBells:bigBells,scene:scene,cam:cam,pKalash:pKalash,aartiG:aartiG,pullers:pullers,devotees:devotees,musicians:musicians,AU:AU,POT_TARGET:POT_TARGET}}};
};