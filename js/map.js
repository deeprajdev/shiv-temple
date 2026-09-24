window.__startMap=function(){
'use strict';
var $=function(s){return document.querySelector(s)};
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var clamp=function(x,a,b){return Math.min(b,Math.max(a,x))};
var seed=11;
function rnd(){seed=seed*16807%2147483647;return seed/2147483647}
function rr(a,b){return a+(b-a)*rnd()}
function pick(a){return a[Math.floor(rnd()*a.length)]}
var V3=THREE.Vector3;

var host=document.getElementById('mapapp');
function mapW(){return host.clientWidth||innerWidth}
function mapH(){return host.clientHeight||innerHeight}
var visible=true;

/* ---------- renderer, camera, lights ---------- */
var renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true})}catch(err){window.__fail('WebGL is not available on this device or browser.');return}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(mapW(),mapH());
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('#stage').appendChild(renderer.domElement);

var scene=new THREE.Scene();
scene.background=new THREE.Color('#bfe0ea');
scene.fog=new THREE.Fog('#bfe0ea',300,900);

var cam=new THREE.PerspectiveCamera(45,mapW()/mapH(),0.5,2200);
var controls=new THREE.OrbitControls(cam,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.08;
controls.maxPolarAngle=Math.PI*0.47;

var hemi=new THREE.HemisphereLight('#ffffff','#8a7a5c',1);
scene.add(hemi);
var sun=new THREE.DirectionalLight('#fff2d6',1.3);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.bias=-0.0008;
scene.add(sun);
scene.add(sun.target);

// sky dome with a soft gradient
var skyGeo=new THREE.SphereGeometry(1800,24,14);
var skyCols=new Float32Array(skyGeo.attributes.position.count*3);
skyGeo.setAttribute('color',new THREE.BufferAttribute(skyCols,3));
var skyMesh=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
skyMesh.renderOrder=-1;scene.add(skyMesh);
function paintSky(top,hor){
  var pos=skyGeo.attributes.position;
  for(var i=0;i<pos.count;i++){
    var t=Math.pow(Math.min(1,Math.max(0,pos.getY(i)/1800)),0.55);
    skyCols[i*3]=hor.r+(top.r-hor.r)*t;skyCols[i*3+1]=hor.g+(top.g-hor.g)*t;skyCols[i*3+2]=hor.b+(top.b-hor.b)*t;
  }
  skyGeo.attributes.color.needsUpdate=true;
}
var cloudMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0.85});

/* ---------- geometry helpers ---------- */
var matCache={};
function M(c){return matCache[c]||(matCache[c]=new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:1,metalness:0}))}
var glowMat=new THREE.MeshStandardMaterial({color:'#ffe6a8',emissive:'#ffb347',emissiveIntensity:0,roughness:1,metalness:0});
var redGlow=new THREE.MeshStandardMaterial({color:'#ff2d55',emissive:'#ff2d55',emissiveIntensity:0.15,roughness:0.6,metalness:0});
var steelMat=new THREE.MeshStandardMaterial({color:'#c3ccd4',metalness:0.7,roughness:0.35,flatShading:true});
var roofGlass=new THREE.MeshStandardMaterial({color:'#efe8d8',roughness:1,metalness:0,transparent:true,opacity:0.5,depthWrite:false});

var vcMat=new THREE.MeshStandardMaterial({vertexColors:true,color:'#ffffff',roughness:1,metalness:0,flatShading:true});
var _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_p3=new V3(),_s3=new V3(),_cc=new THREE.Color(),_v3=new V3();
function mergeParts(list){
  var posA=[],norA=[],colA=[];
  list.forEach(function(d){
    var g=d.geo.index?d.geo.toNonIndexed():d.geo;
    _e.set(d.rotation.x,d.rotation.y,d.rotation.z,'YXZ');_q.setFromEuler(_e);
    _p3.set(d.pos[0],d.pos[1],d.pos[2]);_s3.set(d.scale.x,d.scale.y,d.scale.z);
    _m4.compose(_p3,_q,_s3);
    var nm=new THREE.Matrix3().getNormalMatrix(_m4);
    var pa=g.attributes.position,na=g.attributes.normal;
    _cc.set(d.col);
    for(var i=0;i<pa.count;i++){
      _v3.fromBufferAttribute(pa,i).applyMatrix4(_m4);posA.push(_v3.x,_v3.y,_v3.z);
      _v3.fromBufferAttribute(na,i).applyMatrix3(nm).normalize();norA.push(_v3.x,_v3.y,_v3.z);
      colA.push(_cc.r,_cc.g,_cc.b);
    }
  });
  var out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(posA,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(norA,3));
  out.setAttribute('color',new THREE.Float32BufferAttribute(colA,3));
  return out;
}
function Batch(group){this.group=group;this.list=[];this.isBatch=true}
Batch.prototype.push=function(geo,col,x,y,z){
  var d={geo:geo,col:col,pos:[x,y,z],rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},castShadow:true};
  this.list.push(d);return d;
};
Batch.prototype.add=function(o){this.group.add(o)};
Batch.prototype.flush=function(){
  var grp=this.group,all=this.list;
  [true,false].forEach(function(cast){
    var part=all.filter(function(d){return d.castShadow===cast});
    if(!part.length)return;
    var m=new THREE.Mesh(mergeParts(part),vcMat);
    m.castShadow=cast;m.receiveShadow=true;grp.add(m);
  });
  this.list=[];
};
function mesh(geo,c,x,y,z,p){
  if(p&&p.isBatch&&typeof c==='string')return p.push(geo,c,x,y,z);
  var m=new THREE.Mesh(geo,typeof c==='string'?M(c):c);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;
}
function ns(m){m.castShadow=false;return m}
function box(w,h,d,c,x,y,z,p){return mesh(new THREE.BoxGeometry(w,h,d),c,x,y+h/2,z,p)}
function cyl(rt,rb,h,c,x,y,z,p,seg){return mesh(new THREE.CylinderGeometry(rt,rb,h,seg||10),c,x,y+h/2,z,p)}
function cone(r,h,c,x,y,z,p,seg){return mesh(new THREE.ConeGeometry(r,h,seg||8),c,x,y+h/2,z,p)}
function ball(r,c,x,y,z,p){return mesh(new THREE.SphereGeometry(r,10,8),c,x,y+r,z,p)}
function cable(p,a,b,r,c){
  var d=new V3().subVectors(b,a),L=d.length();
  var m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,5),M(c));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());
  m.castShadow=false;p.add(m);return m;
}
function person(p,x,z,s,col){
  var g=new THREE.Group();g.position.set(x,0.08,z);g.scale.setScalar(s);p.add(g);
  cyl(0.5,0.65,2,col,0,0,0,g,6);ball(0.45,'#7a4b2a',0,1.95,0,g);
  return g;
}
function mkCurve(pts,y,closed){
  return new THREE.CatmullRomCurve3(pts.map(function(q){return new V3(q[0],y,q[1])}),!!closed,'catmullrom',0.5);
}

/* Real Baidyanath-style shikhara: white, curved, ridged tiers with a gold finial. Porch faces -x. */
var whiteMat=new THREE.MeshStandardMaterial({vertexColors:true,color:'#ffffff',emissive:'#ffdca0',emissiveIntensity:0.1,roughness:0.9,metalness:0,flatShading:true});
var goldMat=new THREE.MeshStandardMaterial({color:'#ffc93c',emissive:'#ff9f00',emissiveIntensity:0.25,roughness:0.4,metalness:0.5,flatShading:true});
var towerGeos={};
function towerGeo(W,H,n){
  var key=W+'_'+H+'_'+n;if(towerGeos[key])return towerGeos[key];
  var R=W*1.2,pts=[];
  for(var i=0;i<n;i++){
    var t0=i/n,t1=(i+1)/n,r0=R*(1-0.84*Math.pow(t0,1.45));
    pts.push(new THREE.Vector2(r0,H*t0));pts.push(new THREE.Vector2(r0,H*t1));
  }
  pts.push(new THREE.Vector2(R*0.16,H));pts.push(new THREE.Vector2(0.001,H));
  return (towerGeos[key]=new THREE.LatheGeometry(pts,8,Math.PI/8));
}
var towerCache={};
function towerGeoFull(W,H,n,accent){
  var key=[W,H,n,accent].join('_');if(towerCache[key])return towerCache[key];
  var bt=new Batch(null);
  var ap=W*1.2*Math.cos(Math.PI/8),px=-(ap+W*0.5),ph=1.8+W*0.75,ty=1.8+H,kr=W*0.16+0.3;
  function B(w,h,d,x,y,z,c){bt.push(new THREE.BoxGeometry(w,h,d),c,x,y+h/2,z)}
  function C(rt,rb,h,x,y,z,c,seg){bt.push(new THREE.CylinderGeometry(rt,rb,h,seg||10),c,x,y+h/2,z)}
  function K(r,h,x,y,z,c,seg){bt.push(new THREE.ConeGeometry(r,h,seg||8),c,x,y+h/2,z)}
  B(W*2+4,1,W*2+4,0,0,0,'#f6e6c8');
  B(W*2+2,0.8,W*2+2,0,1,0,'#fffaf0');
  bt.push(towerGeo(W,H,n),'#fffaf0',0,1.8,0);
  B(W*0.2,W*0.6,W*0.45,-ap,1.8,0,'#7a4b3a');
  B(W*0.9,ph,W*1.3,px,0,0,'#fffaf0');
  B(W*1.05,0.6,W*1.45,px,ph,0,accent);
  K(W*0.75,W*0.5,px,ph+0.6,0,'#ffc93c',4);
  // entrance: dark doorway with a gold frame, steps, a torana gate in front and side doors on the porch
  var xf=px-W*0.45;
  B(0.5,W*0.9,W*0.55,xf-0.05,1.8,0,'#4a2f22');
  B(0.6,W*1.05,0.3,xf-0.1,1.8,-W*0.33,'#ffc93c');B(0.6,W*1.05,0.3,xf-0.1,1.8,W*0.33,'#ffc93c');
  B(0.6,0.35,W*0.95,xf-0.1,1.8+W*0.9,0,'#ffc93c');
  [-1,1].forEach(function(k){B(0.4,W*0.4,W*0.2,xf-0.05,1.8+W*0.2,k*W*0.55,'#7a4b3a')});
  B(W*0.55,0.55,W*1.1,xf-W*0.27,0,0,'#f0dcb8');
  B(W*0.3,0.3,W*0.95,xf-W*0.7,0,0,'#e8d0a6');
  var xt=xf-W*1.1;
  [-1,1].forEach(function(k){B(W*0.14,W*1.3,W*0.14,xt,0,k*W*0.55,accent)});
  B(W*0.16,W*0.16,W*1.4,xt,W*1.3,0,accent);
  var tor=bt.push(new THREE.TorusGeometry(W*0.55,W*0.07,6,14,Math.PI),'#ffc93c',xt,W*1.3,0);tor.rotation.y=Math.PI/2;
  bt.push(new THREE.SphereGeometry(W*0.09,6,5),'#ffc93c',xt,W*1.3+W*0.6+W*0.09,0);
  bt.push(new THREE.SphereGeometry(W*0.08,6,5),'#e11d48',xt,W*1.3-W*0.1,0);
  [-1,1].forEach(function(k){
    B(W*0.32,W*0.55,0.25,px,1.8,k*(W*0.65+0.05),'#4a2f22');
    B(W*0.42,0.2,0.3,px,1.8+W*0.55,k*(W*0.65+0.05),'#ffc93c');
  });
  C(W*0.3,W*0.3,1,0,ty,0,'#fffaf0',12);
  C(W*0.36,W*0.36,0.3,0,ty+1,0,'#ffc93c',12);
  bt.push(new THREE.SphereGeometry(kr,8,6),'#ffc93c',0,ty+1.3+kr,0);
  K(0.3,3,0,ty+1.3+2*kr,0,'#ffc93c',6);
  var fy=ty+1.3+2*kr+3;
  C(0.06,0.06,3,0,fy,0,'#7a5a3a',4);
  B(0.05,1.2,2.2,0,fy+1.5,1.1,accent);
  return (towerCache[key]=mergeParts(bt.list));
}
function shikhara(p,x,z,s,stone,accent,y0,o){
  o=o||{};
  var W=o.W||7,H=o.H||26,n=o.n||14,y=y0||0;
  var m=new THREE.Mesh(towerGeoFull(W,H,n,accent),whiteMat);
  m.position.set(x,y,z);m.scale.setScalar(s);m.rotation.y=o.ry||0;m.castShadow=true;m.receiveShadow=true;p.add(m);
  var kr=W*0.16+0.3,fy=1.8+H+1.3+2*kr+3;
  return {group:m,top:new V3(x,y+s*fy,z)};
}
/* red sacred thread strung between two spire tops */
function strand(p,a,b,sag,r){
  var m=a.clone().lerp(b,0.5);m.y-=sag;
  var c=new THREE.CatmullRomCurve3([a.clone(),m,b.clone()]);
  var t=new THREE.Mesh(new THREE.TubeGeometry(c,18,r,4,false),M('#e63946'));
  t.castShadow=false;p.add(t);return t;
}
function umbrella(p,x,z,col,y0){
  ns(cyl(0.06,0.06,3.2,'#6b4f2f',x,y0,z,p,4));
  ns(cone(1.7,0.9,col,x,y0+3.1,z,p,8));
}
function bed(p,x,z,r){
  var cols=['#ff9d2e','#ff5d8f','#ffd23f','#fff5e6','#c86bff'];
  ns(cyl(r,r,0.3,'#5fcf72',x,0,z,p,14));
  for(var i=0;i<12;i++){
    var a=rnd()*6.28,d=Math.sqrt(rnd())*r*0.85;
    ns(ball(0.45,pick(cols),x+Math.cos(a)*d,0.3,z+Math.sin(a)*d,p));
  }
}
function lotus(p,x,z,y0){
  y0=y0||0.72;
  ns(cyl(1.0,1.0,0.08,'#3fbf6a',x,y0,z,p,10));
  var f=ns(ball(0.5,'#ff8fb1',x,y0+0.08,z,p));f.scale.y=0.65;
}
function crowd(p,n,y0,ok){
  var cols=['#ff8c1a','#e63946','#ffd23f','#ff6b9d','#fff5e6','#2bc4b4'];
  var bodyGeo=new THREE.CylinderGeometry(0.5,0.7,2,6),headGeo=new THREE.SphereGeometry(0.45,8,6);
  var groups=cols.map(function(){return []});
  var cnt=0,tries=0;
  while(cnt<n&&tries<n*40){
    tries++;
    var x=rr(-51,39),z=rr(-27,27);
    if(!ok(x,z))continue;
    groups[cnt%cols.length].push([x,z,rr(0.85,1.15)]);cnt++;
  }
  var d=new THREE.Object3D(),hm=M('#8a5a3a');
  groups.forEach(function(L,ci){
    if(!L.length)return;
    var b=new THREE.InstancedMesh(bodyGeo,M(cols[ci]),L.length),h=new THREE.InstancedMesh(headGeo,hm,L.length);
    L.forEach(function(q,i){
      var sc=q[2]*0.8;
      d.position.set(q[0],y0+sc,q[1]);d.scale.setScalar(sc);d.updateMatrix();b.setMatrixAt(i,d.matrix);
      d.position.set(q[0],y0+sc*2.1,q[1]);d.updateMatrix();h.setMatrixAt(i,d.matrix);
    });
    p.add(b);p.add(h);
  });
}
/* drifting petals */
function petals(p,cx,cz,spread,n,col,size){
  var geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3);
  for(var i=0;i<n;i++){pos[i*3]=cx+rr(-spread,spread);pos[i*3+1]=rr(1,50);pos[i*3+2]=cz+rr(-spread*0.6,spread*0.6)}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  var pts=new THREE.Points(geo,new THREE.PointsMaterial({color:col,size:size||1.7,transparent:true,opacity:0.95,depthWrite:false}));
  pts.frustumCulled=false;p.add(pts);
  var t=0;
  return {update:function(dt){
    t+=dt;
    for(var i=0;i<n;i++){
      pos[i*3+1]-=dt*(1.4+(i%5)*0.35);
      pos[i*3]+=Math.sin(t*0.9+i)*dt*0.9;
      if(pos[i*3+1]<0.6){pos[i*3+1]=50;pos[i*3]=cx+rr(-spread,spread);pos[i*3+2]=cz+rr(-spread*0.6,spread*0.6)}
    }
    geo.attributes.position.needsUpdate=true;
  }};
}
function makeClouds(p,n,area,ymin,ymax,sc){
  var list=[];
  for(var i=0;i<n;i++){
    var g=new THREE.Group();
    for(var k=0;k<5;k++){
      var m=new THREE.Mesh(new THREE.SphereGeometry(rr(6,11)*sc,8,6),cloudMat);
      m.position.set(rr(-11,11)*sc,rr(-2,3)*sc,rr(-6,6)*sc);m.scale.y=0.55;g.add(m);
    }
    g.position.set(rr(-area,area),rr(ymin,ymax),rr(-area*0.6,area*0.6));p.add(g);list.push(g);
  }
  return {update:function(dt){list.forEach(function(c){c.position.x+=dt*2.2*sc;if(c.position.x>area)c.position.x=-area})}};
}
function house(p,x,z,w,d,h,c){
  box(w,h,d,c,x,0,z,p);
  box(w+0.4,0.5,d+0.4,'#e0a36b',x,h,z,p);
  ns(box(1.1,1.1,0.1,glowMat,x,h*0.5,z+d/2+0.05,p));
}
function scatterTrees(p,list,sc){
  var trunkGeo=new THREE.CylinderGeometry(0.35,0.5,3,5);
  var crownGeo=new THREE.ConeGeometry(2.6,7,6);
  var A=[],B=[];
  list.forEach(function(t,i){(i%2?B:A).push(t)});
  [[A,'#3fae5a'],[B,'#66c25a']].forEach(function(pair){
    var L=pair[0];if(!L.length)return;
    var tr=new THREE.InstancedMesh(trunkGeo,M('#7a5a3a'),L.length);
    var cr=new THREE.InstancedMesh(crownGeo,M(pair[1]),L.length);
    var d=new THREE.Object3D();
    L.forEach(function(t,i){
      var s=t[2]*sc;
      d.position.set(t[0],1.5*s,t[1]);d.scale.setScalar(s);d.updateMatrix();tr.setMatrixAt(i,d.matrix);
      d.position.set(t[0],6*s,t[1]);d.updateMatrix();cr.setMatrixAt(i,d.matrix);
    });
    tr.castShadow=cr.castShadow=true;tr.receiveShadow=cr.receiveShadow=true;
    p.add(tr);p.add(cr);
  });
}

/* Pilgrims (saffron, carrying a Kanwar pole) walking along a route curve */
function makePilgrims(p,curve,n,sc,speed,baseY){
  var list=[];
  for(var i=0;i<n;i++){
    var g=new THREE.Group();
    cyl(0.5,0.7,2.2,pick(['#ff8c1a','#ff8c1a','#e63946','#ffd23f','#ff6b9d']),0,0,0,g,6);
    ball(0.5,'#7a4b2a',0,2.1,0,g);
    box(3.4,0.15,0.15,'#8a6a3a',0,1.9,0,g);
    ball(0.4,'#3d8ed0',-1.7,0.7,0,g);
    ball(0.4,'#3d8ed0',1.7,0.7,0,g);
    g.scale.setScalar(sc);g.visible=false;p.add(g);
    list.push({g:g,u:rnd(),off:rr(-1.2,1.2)*sc,ph:rnd()*6.28,sp:speed*rr(0.8,1.2)});
  }
  var tan=new V3();
  return {
    update:function(dt){
      list.forEach(function(o){
        o.u=(o.u+o.sp*dt)%1;o.ph+=dt*7;
        var pt=curve.getPointAt(o.u);curve.getTangentAt(o.u,tan);
        var nx=-tan.z,nz=tan.x;
        o.g.position.set(pt.x+nx*o.off,baseY+Math.abs(Math.sin(o.ph))*0.12*sc,pt.z+nz*o.off);
        o.g.rotation.y=Math.atan2(tan.x,tan.z);
      });
    },
    setVisible:function(v){list.forEach(function(o){o.g.visible=v})}
  };
}

function mkRoute(g,o){
  var curve=mkCurve(o.pts,o.y,o.closed);
  var tube=new THREE.Mesh(new THREE.TubeGeometry(curve,320,o.r,6,false),new THREE.MeshBasicMaterial({color:'#e0442a'}));
  tube.visible=false;g.add(tube);
  var pil=makePilgrims(g,curve,o.n,o.sc,o.speed,o.base);
  return {id:o.id,name:o.name,text:o.text,curve:curve,tube:tube,pilgrims:pil,stops:o.stops,view:o.view,noline:!!o.noline,
    samples:curve.getSpacedPoints(240)};
}
function mkAreas(list){
  var map={};list.forEach(function(a){map[a.id]=a});
  return {map:map,list:list};
}

/* ---------- market pieces ---------- */
function stall(p,x,z,dir,kind,awn){
  var sg=new THREE.Group();sg.position.set(x,0,z);sg.rotation.y=dir>0?0:Math.PI;p.add(sg);var g=new Batch(sg);
  box(3.4,1.1,0.9,'#8a6a3a',0,0.08,0.6,g);
  ns(box(3.5,0.08,1,'#f7f3ea',0,1.18,0.6,g));
  [[-1.7,-0.5,3.4],[1.7,-0.5,3.4],[-1.7,1.1,2.6],[1.7,1.1,2.6]].forEach(function(q){
    ns(cyl(0.09,0.09,q[2],'#6b4f2f',q[0],0.08,q[1],g,5));
  });
  var aw=mesh(new THREE.BoxGeometry(3.9,0.14,2.5),awn,0,3.05,0.3,g);aw.rotation.x=0.22;aw.castShadow=false;
  var y=1.26;
  if(kind==='peda'){
    [-0.9,0.9].forEach(function(px){
      ns(cyl(0.68,0.68,0.1,'#f5ead0',px,y,0.6,g,12));
      [[-0.25,0],[0.25,0],[0,0.25]].forEach(function(o){ns(ball(0.24,'#e9c46a',px+o[0],y+0.1,0.6+o[1],g))});
    });
  }else if(kind==='puja'){
    ns(ball(0.34,'#d1381f',-1.1,y,0.6,g));ns(ball(0.34,'#f2a33a',-0.4,y,0.6,g));
    ns(ball(0.3,'#6b4f2f',0.3,y,0.6,g));ns(ball(0.3,'#6b4f2f',0.9,y,0.7,g));
  }else if(kind==='flowers'){
    ns(ball(0.5,'#f2a33a',-0.95,y,0.6,g));ns(ball(0.5,'#f7f3ea',0,y,0.6,g));ns(ball(0.45,'#f2a33a',0.95,y,0.6,g));
    [-1.3,-0.45,0.45,1.3].forEach(function(gx){ns(box(0.12,1.1,0.12,'#f2a33a',gx,1.75,1.45,g))});
  }else{
    ns(box(1.2,0.5,0.8,'#f28c28',-0.9,y,0.6,g));ns(box(1.2,0.35,0.8,'#f7f3ea',-0.9,y+0.5,0.6,g));
    ns(ball(0.4,'#3d8ed0',0.5,y,0.6,g));ns(ball(0.4,'#3d8ed0',1.1,y,0.6,g));
    var pole=ns(cyl(0.07,0.07,4,'#8a6a3a',1.95,0.08,0.2,g,4));pole.rotation.z=0.12;
  }
  person(g,0,-0.3,0.7,pick(['#d9b99b','#2f6f8f','#7a5a3a','#c9a227']));
  g.flush();
}
function bunting(p,x,z0,z1,y){
  var g=new THREE.Group();g.position.set(x,y,(z0+z1)/2);p.add(g);
  var b=new Batch(g),L=Math.abs(z1-z0),n=8,cols=['#ff9d2e','#ff5d8f','#fff5e6','#ffd23f'];
  var ln=mesh(new THREE.CylinderGeometry(0.05,0.05,L,4),'#5b4630',0,0,0,b);ln.rotation.x=Math.PI/2;ln.castShadow=false;
  for(var k=0;k<n;k++){
    var zz=-L/2+(k+0.5)*L/n;
    ns(mesh(new THREE.BoxGeometry(0.05,0.9,0.7),cols[k%4],0,-0.5,zz,b));
    if(k%2===0){var bl=new THREE.Mesh(new THREE.SphereGeometry(0.2,8,6),glowMat);bl.position.set(0,-0.1,zz+L/n/2);g.add(bl)}
  }
  b.flush();
}

/* ---------- outer town helpers (all batched) ---------- */
function stallW(p,x,z,fx,fz,kind,awn){
  var th=Math.atan2(fx,fz),c=Math.cos(th),sn=Math.sin(th);
  function part(geo,col,lx,ly,lz,o){
    var d=p.push(geo,col,x+lx*c+lz*sn,ly,z-lx*sn+lz*c);
    d.rotation.y=th;
    if(o){if(o.rx)d.rotation.x=o.rx;if(o.rz)d.rotation.z=o.rz;if(o.ns)d.castShadow=false}
    return d;
  }
  function B(w,h,d2,col,lx,y,lz,n){return part(new THREE.BoxGeometry(w,h,d2),col,lx,y+h/2,lz,{ns:n})}
  function C(rt,rb,h,col,lx,y,lz,seg){return part(new THREE.CylinderGeometry(rt,rb,h,seg||8),col,lx,y+h/2,lz,{ns:1})}
  function S(r,col,lx,y,lz){return part(new THREE.SphereGeometry(r,8,6),col,lx,y+r,lz,{ns:1})}
  B(3.4,1.1,0.9,'#8a6a3a',0,0.08,0.6,0);
  B(3.5,0.08,1,'#f7f3ea',0,1.18,0.6,1);
  [[-1.7,-0.5,3.4],[1.7,-0.5,3.4],[-1.7,1.1,2.6],[1.7,1.1,2.6]].forEach(function(q){C(0.09,0.09,q[2],'#6b4f2f',q[0],0.08,q[1],5)});
  part(new THREE.BoxGeometry(3.9,0.14,2.5),awn,0,3.05,0.3,{rx:0.22,ns:1});
  var y=1.26;
  if(kind==='peda'){
    [-0.9,0.9].forEach(function(px){C(0.68,0.68,0.1,'#f5ead0',px,y,0.6,12);[[-0.25,0],[0.25,0],[0,0.25]].forEach(function(o){S(0.24,'#e9c46a',px+o[0],y+0.1,0.6+o[1])})});
  }else if(kind==='puja'){
    S(0.34,'#d1381f',-1.1,y,0.6);S(0.34,'#f2a33a',-0.4,y,0.6);S(0.3,'#6b4f2f',0.3,y,0.6);S(0.3,'#6b4f2f',0.9,y,0.7);
  }else if(kind==='flowers'){
    S(0.5,'#f2a33a',-0.95,y,0.6);S(0.5,'#f7f3ea',0,y,0.6);S(0.45,'#f2a33a',0.95,y,0.6);
    [-1.3,-0.45,0.45,1.3].forEach(function(gx){B(0.12,1.1,0.12,'#f2a33a',gx,1.75,1.45,1)});
  }else{
    B(1.2,0.5,0.8,'#f28c28',-0.9,y,0.6,1);B(1.2,0.35,0.8,'#f7f3ea',-0.9,y+0.5,0.6,1);
    S(0.4,'#3d8ed0',0.5,y,0.6);S(0.4,'#3d8ed0',1.1,y,0.6);
    part(new THREE.CylinderGeometry(0.07,0.07,4,4),'#8a6a3a',1.95,2.08,0.2,{rz:0.12,ns:1});
  }
  var vc=['#d9b99b','#2f6f8f','#7a5a3a','#c9a227'][Math.floor(rnd()*4)];
  C(0.35,0.46,1.4,vc,0,0.08,-0.3,6);S(0.32,'#8a5a3a',0,1.48,-0.3);
}
function hotelW(p,wins,cx,cz,w,d,h,col,fx,fz){
  box(w,h,d,col,cx,0,cz,p);box(w+0.5,0.6,d+0.5,'#e0a36b',cx,h,cz,p);box(w*0.5,1.6,d*0.5,'#fff5e6',cx,h+0.6,cz,p);
  var th=Math.atan2(fx,fz),rx=fz,rz=-fx;
  var cols=Math.max(2,Math.floor(w/3)),rows=Math.max(2,Math.floor(h/4)),r,c;
  for(r=0;r<rows;r++)for(c=0;c<cols;c++){
    var lat=(c-(cols-1)/2)*3;
    wins.push([cx+fx*(d/2+0.05)+rx*lat,2.4+r*3.6,cz+fz*(d/2+0.05)+rz*lat,th]);
  }
  var sb=mesh(new THREE.BoxGeometry(w*0.6,1.1,0.25),'#ff5d8f',cx+fx*(d/2+0.15),h-0.3,cz+fz*(d/2+0.15),p);sb.rotation.y=th;ns(sb);
}
function clockTower(p,x,z){
  function B(w,h,d,c,ox,y,oz){box(w,h,d,c,x+ox,y,z+oz,p)}
  B(7,3,7,'#f6e6c8',0,0,0);B(4.6,14,4.6,'#ffd166',0,3,0);B(5.6,1,5.6,'#f6e6c8',0,17,0);B(5,5.5,5,'#fff5e6',0,18,0);
  [[0,1],[0,-1],[1,0],[-1,0]].forEach(function(f){
    var d=mesh(new THREE.CylinderGeometry(1.9,1.9,0.3,20),'#ffffff',x+f[0]*2.6,20.6,z+f[1]*2.6,p);
    if(f[1]!==0)d.rotation.x=Math.PI/2;else d.rotation.z=Math.PI/2;
    ns(d);
    var mh=mesh(new THREE.BoxGeometry(f[1]!==0?0.14:0.1,1.5,f[1]!==0?0.1:0.14),'#2b3a4a',x+f[0]*2.8,20.9,z+f[1]*2.8,p);ns(mh);
    var hh=mesh(new THREE.BoxGeometry(f[1]!==0?1.0:0.1,0.14,f[1]!==0?0.1:1.0),'#2b3a4a',x+f[0]*2.8,20.6,z+f[1]*2.8,p);ns(hh);
  });
  cone(3.6,4.5,'#ff9d2e',x,23.5,z,p,8);ball(0.6,'#ffc93c',x,28,z,p);
  cyl(0.06,0.06,3,'#7a5a3a',x,28.8,z,p,4);box(0.05,1,2,'#e11d48',x,30.6,z+1,p);
}
function autoW(p,x,z,th,col){
  var c=Math.cos(th),sn=Math.sin(th);
  function part(geo,colr,lx,ly,lz,o){
    var d=p.push(geo,colr,x+lx*c+lz*sn,ly,z-lx*sn+lz*c);
    d.rotation.y=th;if(o&&o.rx)d.rotation.x=o.rx;return d;
  }
  part(new THREE.BoxGeometry(2.2,1.0,1.4),col,0,0.85,0);
  part(new THREE.BoxGeometry(0.8,0.7,1.2),col,1.4,0.7,0);
  part(new THREE.BoxGeometry(1.9,0.14,1.5),'#2b2b3a',-0.1,1.65,0);
  part(new THREE.BoxGeometry(0.1,0.7,1.3),'#9ad7f2',0.95,1.2,0);
  [[1.5,0],[-0.8,0.78],[-0.8,-0.78]].forEach(function(w){part(new THREE.CylinderGeometry(0.32,0.32,0.25,8),'#222',w[0],0.32,w[1],{rx:Math.PI/2})});
}
function crowdIn(p,rects,n,y0){
  var cols=['#ff8c1a','#e63946','#ffd23f','#ff6b9d','#fff5e6','#2bc4b4'];
  var bodyGeo=new THREE.CylinderGeometry(0.5,0.7,2,6),headGeo=new THREE.SphereGeometry(0.45,8,6);
  var groups=cols.map(function(){return []}),i;
  for(i=0;i<n;i++){var r=rects[Math.floor(rnd()*rects.length)];groups[i%cols.length].push([rr(r[0],r[2]),rr(r[1],r[3]),rr(0.85,1.15)])}
  var d=new THREE.Object3D(),hm=M('#8a5a3a');
  groups.forEach(function(L,ci){
    if(!L.length)return;
    var b=new THREE.InstancedMesh(bodyGeo,M(cols[ci]),L.length),h=new THREE.InstancedMesh(headGeo,hm,L.length);
    L.forEach(function(q,k){
      var sc=q[2]*0.8;
      d.position.set(q[0],y0+sc,q[1]);d.scale.setScalar(sc);d.updateMatrix();b.setMatrixAt(k,d.matrix);
      d.position.set(q[0],y0+sc*2.1,q[1]);d.updateMatrix();h.setMatrixAt(k,d.matrix);
    });
    p.add(b);p.add(h);
  });
}

/* ---------- world: temple complex ---------- */
function buildTemple(){
  var grp=new THREE.Group(),g=new Batch(grp),CY=0.3;
  var ground=mesh(new THREE.PlaneGeometry(1400,1000),'#9fdc7a',0,0,0,g);
  ground.rotation.x=-Math.PI/2;ground.castShadow=false;

  // courtyard, walls, gate
  box(92,CY,56,'#f8ecd6',-6,0,0,g);
  function wall(w,d,x,z){box(w,3.2,d,'#f1e7d3',x,CY,z,g);box(w+0.2,0.5,d+0.2,'#f28c28',x,CY+3.2,z,g)}
  // walls have openings for the south, Singh Dwar (north after the turn) and west gates
  wall(37,1.2,-33.5,-28);wall(49,1.2,15.5,-28);
  wall(35,1.2,-34.5,28);wall(51,1.2,14.5,28);
  wall(1.2,43,40,-6.5);wall(1.2,8,40,24);
  wall(1.2,31,-52,-12.5);wall(1.2,15,-52,20.5);
  [3,13].forEach(function(z){
    box(2.6,10,2.6,'#f1e7d3',-52,CY,z,g);
    cone(1.9,2.6,'#d1381f',-52,CY+10,z,g,6);
    ball(0.6,glowMat,-52,CY+7.5,z<8?z-1.6:z+1.6,g);
  });
  box(2.8,2.2,12.4,'#f28c28',-52,CY+9,8,g);
  cone(2.2,3.5,'#d1381f',-52,CY+11.2,8,g,4);

  // Singh Dwar (unverified illustration): ornamental gate with lion statues
  function lion(lx,lz,ly){
    box(1.8,1.3,2.6,'#e8b23a',lx,ly,lz,g);
    ball(1.0,'#c98a1e',lx,ly+0.7,lz+0.9,g);
    ball(0.75,'#e8b23a',lx,ly+1.3,lz+1.5,g);
    cone(0.25,0.5,'#e8b23a',lx-0.4,ly+2.5,lz+1.4,g,4);cone(0.25,0.5,'#e8b23a',lx+0.4,ly+2.5,lz+1.4,g,4);
    box(0.5,0.4,1.1,'#e8b23a',lx,ly+0.4,lz-1.8,g);
  }
  [-17.6,-10.4].forEach(function(gx){
    box(2.4,10,2.4,'#f6e6c8',gx,CY,28,g);
    box(2.9,0.5,2.9,'#ffc93c',gx,CY+10,28,g);
    lion(gx,28,CY+10.5);
  });
  box(9.6,1.6,2.2,'#f6e6c8',-14,CY+7,28,g);
  box(5,1.3,1.6,'#ff9d2e',-14,CY+8.6,28,g);
  cone(2.0,2.6,'#ffc93c',-14,CY+9.9,28,g,8);
  // south gate (unverified placeholder): two gatehouse towers
  [-16.2,-7.8].forEach(function(gx){
    box(3.4,9,3.4,'#fff5e6',gx,CY,-28,g);
    box(0.9,1.6,0.2,'#7a4b3a',gx,CY+3.5,-29.8,g);
    cone(3.0,3.2,'#ff5d8f',gx,CY+9,-28,g,4);
    ball(0.5,'#ffc93c',gx,CY+12.2,-28,g);
  });
  box(9,1.4,2.4,'#fff5e6',-12,CY+7,-28,g);
  // west gate (unverified placeholder): slim pillars and a gold arch
  [14.6,20.4].forEach(function(gz){box(1.6,7,1.6,'#f6e6c8',40,CY,gz,g)});
  var westArch=mesh(new THREE.TorusGeometry(2.9,0.4,8,20,Math.PI),'#ffc93c',40,CY+7,17.5,g);westArch.rotation.y=Math.PI/2;
  ball(0.35,'#ffc93c',40,CY+5.6,17.5,g);

  // main temple, Parvati temple and a crowded ring of white shrines
  var towers=[],tops=[];
  var mainT=shikhara(g,0,0,1.25,'','#ff9d2e',CY,{W:7.5,H:34});
  towers.push([0,0,(7.5*1.2+4)*1.25]);
  var parT=shikhara(g,32,-2,0.8,'','#ff5d8f',CY,{W:6.5,H:26});
  towers.push([32,-2,(6.5*1.2+3)*0.8]);
  var fill=[
    [-40,-23.5,0.30],[-30,-23.5,0.34],[-18,-23.5,0.36],[-6,-23.5,0.28],[6,-23.5,0.32],[14.5,-23.5,0.30],[24,-23.5,0.36],[34,-23.5,0.30],
    [-40,23.5,0.30],[-30,23.5,0.34],[-20,23.5,0.36],[-8,23.5,0.28],[2,23.5,0.36],[12,23.5,0.30],[24,23.5,0.36],[34,23.5,0.30],
    [34,-14,0.28],[34,12,0.30],[-44,-14,0.30],[-34,-12,0.30]
  ];
  var S=' Its position on the map is approximate.';
  var shrineDefs=[
    ['anand-bhairav','Anand Bhairav Temple','A shrine to Anand Bhairav, a form of Bhairav.'],
    ['gauri-shankar','Gauri Shankar Temple','A shrine to Gauri Shankar, Shiva and Parvati together.'],
    ['ganesh','Ganesh Temple','A shrine to Ganesh, the remover of obstacles.'],
    ['brahma','Brahma Temple','A shrine to Brahma, the creator.'],
    ['sandhya','Sandhya Temple','A shrine to Sandhya, the goddess of twilight.'],
    ['surya-narayan','Surya Narayan Temple','A shrine to Surya Narayan, the sun god as Vishnu.'],
    ['kali','Kali Temple','A shrine to the goddess Kali.'],
    ['tara','Tara Temple','A shrine to the goddess Tara.'],
    ['hanuman','Hanuman Temple','A shrine to Hanuman.'],
    ['ram','Shri Ram Temple','A shrine to Shri Ram.'],
    ['annapurna','Annapurna Temple','A shrine to Annapurna, goddess of food and nourishment.'],
    ['manasa','Manasa Temple','A shrine to Manasa, the serpent goddess.'],
    ['lakshmi-narayan','Lakshmi Narayan Temple','A shrine to Lakshmi and Narayan (Vishnu).'],
    ['saraswati','Saraswati Temple','A shrine to Saraswati, goddess of learning.'],
    ['kal-bhairav','Kal Bhairav Temple','A shrine to Kal Bhairav, a fierce form of Shiva.'],
    ['narvadeshwar','Narvadeshwara Temple','Listed among the complex\u2019s temples as Narvadeshwara.'],
    ['neel-kanth','Neel Kanth Temple','A shrine to Neelkanth, Shiva of the blue throat.'],
    ['jagat-janani','Jagat Janani Temple','A shrine to Jagat Janani, the mother of the world.'],
    ['bagla','Bagla Temple','A shrine to Maa Bagla (Baglamukhi).'],
    ['ganga','Ganga Temple','A shrine to Maa Ganga.']
  ];
  var shrineAreas=[];
  var accs=['#ff9d2e','#ff5d8f','#ffd23f'];
  fill.forEach(function(f,i){
    var t=shikhara(g,f[0],f[1],f[2],'',accs[i%3],CY,{W:6,H:20+(i%4)*2});
    towers.push([f[0],f[1],(6*1.2+3)*f[2]]);tops.push(t.top);
    var sd=shrineDefs[i];
    shrineAreas.push({id:sd[0],name:sd[1],pos:new V3(f[0],0,f[1]),h:14,d:0.9,mini:true,text:sd[2]+S});
  });
  // red sacred threads: main spire to the Parvati spire, and fanning out to nearby shrines
  for(var c=0;c<6;c++){
    var ca=mainT.top.clone();ca.x+=rr(-0.6,0.6);ca.z+=rr(-0.6,0.6);ca.y-=rr(0,2.2);
    var cb=parT.top.clone();cb.x+=rr(-0.6,0.6);cb.z+=rr(-0.6,0.6);cb.y-=rr(0,1.6);
    strand(g,ca,cb,rr(2.5,5),0.14);
  }
  [1,5,9,13,17,19].forEach(function(ti){
    var ta=mainT.top.clone();ta.y-=4;
    var tb=tops[ti].clone();tb.y-=1.5;
    strand(g,ta,tb,rr(3,6),0.1);
  });
  function okPos(x,z){
    if(x<-51||x>39||z<-27||z>27)return false;
    if(x>-50&&x<-27&&z>0.5&&z<15.5)return false;
    for(var i=0;i<towers.length;i++){if(Math.hypot(x-towers[i][0],z-towers[i][1])<towers[i][2])return false}
    return true;
  }
  crowd(g,170,CY,okPos);
  var ucols=['#ff5d8f','#2bc4b4','#ffd23f','#c86bff','#ff8c1a','#4fb0ff'];
  for(var u=0,ut=0;u<12&&ut<300;ut++){
    var ux=rr(-50,38),uz=rr(-26,26);
    if(!okPos(ux,uz))continue;
    umbrella(g,ux,uz,ucols[u%ucols.length],CY);u++;
  }
  [[-30,-31.5],[0,-31.5],[30,-31.5],[-30,31.5],[0,31.5],[30,31.5],[-58,-6],[-58,22]].forEach(function(q){bed(g,q[0],q[1],2.8)});
  [[-14,-13],[-14,13],[14,-13],[14,13]].forEach(function(q){
    cyl(0.25,0.3,4,'#5b4630',q[0],CY,q[1],g,6);ball(0.7,glowMat,q[0],CY+4,q[1],g);
  });
  for(var lx=-46;lx<=34;lx+=10){ball(0.6,glowMat,lx,CY+3.7,-28,g);ball(0.6,glowMat,lx,CY+3.7,28,g)}
  // marigold garland across the gate
  for(var gk=0;gk<=10;gk++){
    ns(ball(0.38,gk%2?'#ff9d2e':'#ffd23f',-52,CY+8.6-1.3*Math.sin(gk*Math.PI/10),3+gk,g));
  }

  // more red around the temple: porch banners, pennant lines, a thread web, gate drapes, red carpet, lanterns
  function porchBanners(bx,bz,by,w,h){
    [-1,1].forEach(function(k){
      var zc=bz+k*w*0.27;
      box(0.4,h,w*0.46,'#e11d48',bx,by,zc,g);
      box(0.46,0.25,w*0.46,'#ffc93c',bx-0.03,by+h,zc,g);
      box(0.46,0.25,w*0.46,'#ffc93c',bx-0.03,by-0.25,zc,g);
    });
  }
  porchBanners(-19.7,0,CY+6.4,12,2.4);
  porchBanners(21,-2,CY+3.3,6.4,1.6);
  function pennantLine(lx,ly,z0,z1){
    var L=z1-z0,n=Math.floor(L/1.5),pc=['#e11d48','#ff9d2e','#e11d48','#ff5d8f'];
    cyl(0.15,0.15,ly,'#6b4f2f',lx,CY,z0,g,6);cyl(0.15,0.15,ly,'#6b4f2f',lx,CY,z1,g,6);
    var ln=mesh(new THREE.CylinderGeometry(0.05,0.05,L,4),'#5b4630',lx,CY+ly,(z0+z1)/2,g);ln.rotation.x=Math.PI/2;ns(ln);
    for(var pk=0;pk<n;pk++){
      var pf=mesh(new THREE.ConeGeometry(0.55,1.1,3),pc[pk%4],lx,CY+ly-0.7,z0+(pk+0.5)*L/n,g);
      pf.rotation.x=Math.PI;ns(pf);
    }
  }
  [-22,-36,-46,20].forEach(function(lx){pennantLine(lx,11,-26.5,26.5)});
  for(var wi=0;wi<15;wi++){
    if(wi===7)continue;
    strand(g,tops[wi].clone().add(new V3(0,-1.2,0)),tops[wi+1].clone().add(new V3(0,-1.2,0)),1.6,0.07);
  }
  [16,17].forEach(function(ti){strand(g,parT.top.clone().add(new V3(0,-2,0)),tops[ti].clone().add(new V3(0,-1.2,0)),2.4,0.08)});
  for(var dz=0;dz<9;dz++){
    var dh=dz%2?2.6:3.6;
    box(0.25,dh,0.8,dz%3===0?'#ff9d2e':'#e11d48',-53.6,CY+9-dh,3.8+dz*1.05,g);
  }
  var rc1=ns(mesh(new THREE.BoxGeometry(7,0.05,2.6),'#c81e3c',-24,CY+0.03,7.2,g));
  var rc2=ns(mesh(new THREE.BoxGeometry(5,0.05,2.6),'#c81e3c',-19.5,CY+0.03,3.6,g));rc2.rotation.y=-0.65;
  for(var rl=-41;rl<=34;rl+=10){
    [-27.2,27.2].forEach(function(lz){
      var lb=new THREE.Mesh(new THREE.SphereGeometry(0.55,10,8),redGlow);
      lb.position.set(rl,CY+3.6,lz);g.add(lb);
    });
  }

  // covered walkway outside the gate (x -66 to -52)
  ns(box(14,0.05,2.6,'#9c1f33',-59,0.08,8,g));
  ns(box(7,0.18,3.6,'#dfe3e6',-62.5,3.4,8,g));
  ns(box(7,0.18,3.6,'#2fb58c',-55.5,3.4,8,g));
  [6.2,9.8].forEach(function(rz){
    ns(box(14,0.12,0.12,'#cfd5da',-59,1.0,rz,g));ns(box(14,0.12,0.12,'#cfd5da',-59,2.4,rz,g));
    for(var px=-65.5;px<=-52.4;px+=1.75)ns(box(0.1,3.4,0.1,'#cfd5da',px,0.08,rz,g));
    for(var gx=-58;gx<=-53;gx+=1.7)ns(ball(0.3,'#f2a33a',gx,3.1,rz,g));
  });

  // queue hall inside the gate: translucent roof, pillars, steel barricade rows
  var hx0=-38.5;
  var roof=mesh(new THREE.BoxGeometry(21.6,0.3,13.6),roofGlass,hx0,CY+4.4,8,g);roof.castShadow=false;roof.receiveShadow=false;
  [-49,-38.5,-28].forEach(function(px){[1.5,14.5].forEach(function(pz){box(0.6,4.4,0.6,'#7a4b3a',px,CY,pz,g)})});
  [3.3,5.3,10.7,12.7].forEach(function(bz){ns(box(17,1.6,0.12,'#cfd5da',hx0,CY,bz,g))});
  ns(box(21,0.04,2.4,'#9c1f33',hx0,CY,8,g));

  // Shivganga: a large stepped tank with a boundary wall, corner chhatris, floating lamps and a steel-chain fence
  var px0=-80,pz0=-38,pr=22,hwx=17,hwz=12;
  var prevA=hwx,prevB=hwz;
  [[18.5,13.5,0.7,'#f3e6cb'],[20,15,1.1,'#ead8b5'],[21.5,16.5,1.5,'#f3e6cb']].forEach(function(t){
    var a2=t[0],b2=t[1],hh=t[2],col=t[3];
    box(2*a2,hh,b2-prevB,col,px0,0,pz0-(prevB+b2)/2,g);
    box(2*a2,hh,b2-prevB,col,px0,0,pz0+(prevB+b2)/2,g);
    box(a2-prevA,hh,2*prevB,col,px0-(prevA+a2)/2,0,pz0,g);
    box(a2-prevA,hh,2*prevB,col,px0+(prevA+a2)/2,0,pz0,g);
    prevA=a2;prevB=b2;
  });
  var water=box(2*hwx,0.5,2*hwz,'#39c6d6',px0,0,pz0,g);water.castShadow=false;
  // boundary wall with an entrance on the market side
  var WX=21.9,WZ=16.9;
  box(2*WX+0.8,2.2,0.8,'#f1e7d3',px0,0,pz0-WZ,g);
  box(0.8,2.2,2*WZ,'#f1e7d3',px0-WX,0,pz0,g);box(0.8,2.2,2*WZ,'#f1e7d3',px0+WX,0,pz0,g);
  box(WX-4,2.2,0.8,'#f1e7d3',px0-(WX+4)/2-0.2,0,pz0+WZ,g);box(WX-4,2.2,0.8,'#f1e7d3',px0+(WX+4)/2+0.2,0,pz0+WZ,g);
  box(2*WX+1,0.3,1.1,'#ff9d2e',px0,2.2,pz0-WZ,g);
  box(1.1,0.3,2*WZ+1,'#ff9d2e',px0-WX,2.2,pz0,g);box(1.1,0.3,2*WZ+1,'#ff9d2e',px0+WX,2.2,pz0,g);
  box(WX-3.5,0.3,1.1,'#ff9d2e',px0-(WX+4)/2-0.2,2.2,pz0+WZ,g);box(WX-3.5,0.3,1.1,'#ff9d2e',px0+(WX+4)/2+0.2,2.2,pz0+WZ,g);
  box(8,1.0,0.8,'#ead8b5',px0,0,pz0+WZ,g);box(8,0.5,1.2,'#ead8b5',px0,0,pz0+WZ+1.0,g);
  // corner chhatris
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(k){
    var cx=px0+k[0]*20.2,cz=pz0+k[1]*15.4;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){cyl(0.2,0.2,3,'#f1e7d3',cx+q[0]*1.3,1.5,cz+q[1]*1.3,g,6)});
    box(3.6,0.3,3.6,'#ffd76a',cx,4.5,cz,g);cone(2.5,1.7,'#ff9d2e',cx,4.8,cz,g,8);ball(0.35,'#ffc93c',cx,6.4,cz,g);
  });
  // lotuses, and a small shrine on the far bank
  for(var lt=0;lt<26;lt++){lotus(g,px0+rr(-14.5,14.5),pz0+rr(-9.5,9.5),0.52)}
  shikhara(g,px0,pz0-27,0.3,'','#ff9d2e',0,{W:6,H:20,ry:Math.PI/2});
  // steel-chain fence on the wall: steel posts, chain links hanging between them
  var postList=[],linkV=[],linkH=[];
  function fenceSide(x0,z0,x1,z1){
    var L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.round(L/3.2)),i,k;
    for(i=0;i<=n;i++)postList.push([x0+(x1-x0)*i/n,z0+(z1-z0)*i/n]);
    for(i=0;i<n;i++){
      var ax=x0+(x1-x0)*i/n,az=z0+(z1-z0)*i/n,bx=x0+(x1-x0)*(i+1)/n,bz=z0+(z1-z0)*(i+1)/n,yaw=Math.atan2(bx-ax,bz-az);
      for(k=0;k<9;k++){
        var t=(k+0.5)/9;
        (k%2?linkH:linkV).push([ax+(bx-ax)*t,3.65-0.6*4*t*(1-t),az+(bz-az)*t,yaw]);
      }
    }
  }
  fenceSide(px0-WX,pz0-WZ,px0+WX,pz0-WZ);
  fenceSide(px0-WX,pz0-WZ,px0-WX,pz0+WZ);
  fenceSide(px0+WX,pz0-WZ,px0+WX,pz0+WZ);
  fenceSide(px0-WX,pz0+WZ,px0-4.2,pz0+WZ);
  fenceSide(px0+4.2,pz0+WZ,px0+WX,pz0+WZ);
  var pi=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13,0.15,1.4,6),steelMat,postList.length);
  var pc=new THREE.InstancedMesh(new THREE.SphereGeometry(0.21,6,5),steelMat,postList.length);
  var od=new THREE.Object3D();
  postList.forEach(function(q,i){
    od.position.set(q[0],3.2,q[1]);od.rotation.set(0,0,0);od.updateMatrix();pi.setMatrixAt(i,od.matrix);
    od.position.set(q[0],3.95,q[1]);od.updateMatrix();pc.setMatrixAt(i,od.matrix);
  });
  pi.castShadow=true;g.add(pi);g.add(pc);
  [[linkV,new THREE.TorusGeometry(0.2,0.05,5,8).rotateY(Math.PI/2)],[linkH,new THREE.TorusGeometry(0.2,0.05,5,8).rotateX(Math.PI/2)]].forEach(function(pair){
    if(!pair[0].length)return;
    var im=new THREE.InstancedMesh(pair[1],steelMat,pair[0].length);
    pair[0].forEach(function(q,i){od.position.set(q[0],q[1],q[2]);od.rotation.set(0,q[3],0);od.updateMatrix();im.setMatrixAt(i,od.matrix)});
    g.add(im);
  });
  // floating lamps (they glow at night)
  var lampN=34,lamps=new THREE.InstancedMesh(new THREE.SphereGeometry(0.28,6,5),glowMat,lampN);
  for(var ln=0;ln<lampN;ln++){od.position.set(px0+rr(-15.5,15.5),0.62,pz0+rr(-10.5,10.5));od.rotation.set(0,0,0);od.updateMatrix();lamps.setMatrixAt(ln,od.matrix)}
  g.add(lamps);

  // market street: road, houses, stalls, bunting
  box(76,0.08,8,'#a8987d',-90,0,8,g);
  var kinds={'-119':'kanwar','-112':'kanwar','-105':'flowers','-98':'flowers','-91':'puja','-84':'puja','-77':'peda','-70':'peda'};
  var pal=['#ffd166','#ff8a80','#7bdcb5','#8ecae6','#c7a5ff','#ffb38a'],awn=['#ff9d2e','#fff5e6','#ff5d8f','#ffd23f'];
  for(var hx=-119,ci=0;hx<=-70;hx+=7,ci++){
    [0,1].forEach(function(side){
      var hz=side?16.5:-0.5,h=rr(5,9);
      house(g,hx,hz,6,8,h,pick(pal));
      ns(box(4.4,1,0.2,pick(awn),hx,h*0.55,hz+(side?-4.1:4.1),g));
      stall(g,hx,side?11.4:4.6,side?-1:1,kinds[hx],awn[(ci+side)%4]);
    });
  }
  [-115,-101,-87,-73].forEach(function(bx){bunting(g,bx,3.5,12.5,7)});
  cyl(0.8,0.9,9,'#f1e7d3',-124,0,3,g,8);cyl(0.8,0.9,9,'#f1e7d3',-124,0,13,g,8);
  box(1.2,2.6,11,'#f28c28',-124,8,8,g);
  ball(0.7,glowMat,-124,10.8,4,g);ball(0.7,glowMat,-124,10.8,12,g);

  // Naulakha Mandir
  ns(cyl(16,16,0.2,'#8fd66b',58,0,-24,g,24));
  shikhara(g,58,-24,1.0,'','#ff5d8f',0.2,{W:7,H:28,ry:Math.PI});
  bed(g,44,-14,2.6);bed(g,72,-34,2.6);

  // routes
  var darshan=mkRoute(g,{id:'darshan',name:'Darshan route',y:0.6,r:0.35,n:18,sc:0.8,speed:0.022,base:0.2,
    pts:[[-122,8],[-110,8.4],[-98,7.6],[-86,8.3],[-74,7.7],[-62,8],[-52,8],[-44,8],[-34,8],[-27,7.5],[-22,6],[-18,3],[-16.5,1.5]],
    stops:['kanwar-shops','shivganga','walkway','gate','queue-hall','baidyanath','naulakha'],
    text:'From the market lane through the covered walkway and the main gate, then the barricaded queue hall to the sanctum.',
    view:{center:new V3(-60,0,2),halfW:80,minOv:90}});
  var market=mkRoute(g,{id:'market',name:'Market walk',y:0.5,r:0.3,n:12,sc:0.8,speed:0.03,base:0.15,
    pts:[[-122,8],[-112,8.5],[-102,7.5],[-92,8.5],[-82,7.5],[-72,8.3],[-62,8]],
    stops:['kanwar-shops','flowers','puja-stalls','peda-shops'],
    text:'Kanwar shops, flower sellers, puja stalls and peda shops along the lane to the temple.',
    view:{center:new V3(-92,0,8),halfW:34,minOv:55}});
  var ppts=[];
  for(var k=0;k<16;k++){var th=Math.PI+k*Math.PI*2/16;ppts.push([24*Math.cos(th),19*Math.sin(th)])}
  var parikrama=mkRoute(g,{id:'parikrama',name:'Parikrama',y:0.65,r:0.35,n:12,sc:0.8,speed:0.02,base:0.25,closed:true,pts:ppts,
    stops:['baidyanath','bagla','ganga','anand-bhairav','gauri-shankar','ganesh','brahma','sandhya','surya-narayan','kali','tara','neel-kanth','parvati','jagat-janani','narvadeshwar','kal-bhairav','saraswati','lakshmi-narayan','manasa','annapurna','ram','hanuman'],
    text:'A clockwise walk around the main temple past all 22 temples listed for the complex. Positions of the smaller shrines are approximate.',
    view:{center:new V3(0,0,0),halfW:34,minOv:60}});
  var gates=mkRoute(g,{id:'gates',name:'Gates (unverified)',y:0.6,r:0.3,n:0,sc:0.8,speed:0.02,base:0.25,noline:true,pts:[[0,0],[1,0]],
    stops:['gate','gate-south','gate-west','singh-dwar'],
    text:'Unverified. A visitor\u2019s note says the temple has four main gates of different types. The east gate is the entrance the darshan route uses; the other three are placeholders, and no source checked confirms their names or designs.',
    view:{center:new V3(-6,0,0),halfW:62,minOv:80}});
  var town=mkRoute(g,{id:'town',name:'Town and markets',y:0.6,r:0.3,n:0,sc:0.8,speed:0.02,base:0.25,noline:true,pts:[[0,0],[1,0]],
    stops:['bus-stand','west-road','clock-tower','north-market','south-market','pond-lane','shivganga'],
    text:'Illustrative markets, hotels, a clock tower and a bus stand around the temple, and the large Shivganga tank. This is not a survey of the real streets.',
    view:{center:new V3(-6,0,0),halfW:130,minOv:140}});
  var routes=[darshan,market,parikrama,gates,town];

  // ---- outer town: more markets, hotels, a clock tower, a bus stand, lamps and people ----
  var wins=[],bulbs=[];
  function roadX(cx,z0,z1){box(8,0.08,Math.abs(z1-z0),'#a8987d',cx,0,(z0+z1)/2,g)}
  function roadZ(cz,x0,x1){box(Math.abs(x1-x0),0.08,8,'#a8987d',(x0+x1)/2,0,cz,g)}
  function shop(bx,bz,fx,fz,kind,idx){
    var h=rr(5,9),th=Math.atan2(fx,fz);
    box(7,h,7,pal[idx%pal.length],bx,0,bz,g);box(7.4,0.5,7.4,'#e0a36b',bx,h,bz,g);
    var sg=mesh(new THREE.BoxGeometry(4.4,1,0.2),awn[(idx+1)%4],bx+fx*3.6,h*0.62,bz+fz*3.6,g);sg.rotation.y=th;ns(sg);
    wins.push([bx+fx*3.55,h*0.4,bz+fz*3.55,th]);
    stallW(g,bx+fx*4.7,bz+fz*4.7,fx,fz,kind,awn[idx%4]);
  }
  function lamp(lx,lz){cyl(0.15,0.2,6,'#3b3b4b',lx,0,lz,g,6);box(1.1,0.12,0.12,'#3b3b4b',lx,6,lz,g);bulbs.push([lx,6.4,lz])}
  var kk=['peda','puja','flowers','kanwar'];
  // street 1: the market street outside Singh Dwar, with a Tower Chowk junction and clock tower
  roadX(-14,30,108);
  [38,46,54,62,78,86,94,102].forEach(function(sz,si){shop(-21.5,sz,1,0,kk[si%4],si);shop(-6.5,sz,-1,0,kk[(si+2)%4],si+3)});
  roadZ(70,-66,46);
  [-60,-51,-42,-33,6,15,24,33,42].forEach(function(sx,si){shop(sx,62.5,0,1,kk[si%4],si+1);shop(sx,77.5,0,-1,kk[(si+1)%4],si+4)});
  cyl(9,9,0.12,'#e6d7bd',-14,0,70,g,28);clockTower(g,-14,70);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(k){bed(g,-14+k[0]*6.3,70+k[1]*6.3,1.9)});
  // street 2: the market street on the far side, ending in a plaza with autos
  roadX(-12,-30,-100);
  [-38,-46,-54,-62,-70,-78,-86,-94].forEach(function(sz,si){shop(-19.5,sz,1,0,kk[(si+1)%4],si+2);shop(-4.5,sz,-1,0,kk[(si+3)%4],si+5)});
  box(30,0.1,12,'#e6d7bd',-12,0,-108,g);
  // street 3: a road of shops, hotels and guest houses running to the bus stand
  roadZ(17.5,42,124);
  [52,61,70,79,88,97,106,115].forEach(function(sx,si){
    shop(sx,10,0,1,kk[si%4],si+1);
    if(sx!==79&&sx!==106)shop(sx,25,0,-1,kk[(si+2)%4],si+6);
  });
  hotelW(g,wins,79,26,10,9,14,'#ffd9e0',0,-1);
  hotelW(g,wins,106,26,10,9,16,'#cfe8ff',0,-1);
  box(28,0.1,26,'#e6d7bd',138,0,17.5,g);
  ns(box(10,0.3,4,'#ff9d2e',138,4.2,6,g));[-4.5,4.5].forEach(function(o){cyl(0.2,0.2,4.2,'#6b4f2f',138+o,0,6+1.5,g,6);cyl(0.2,0.2,4.2,'#6b4f2f',138+o,0,6-1.5,g,6)});
  var vcols=['#ffd23f','#2bc4b4','#ff7a45','#5ab8ff','#ff6b9d','#7bdcb5'];
  for(var vi=0;vi<12;vi++){autoW(g,128+(vi%6)*4.2,14+Math.floor(vi/6)*6,vi%2?0.1:-0.1,vcols[vi%6])}
  for(var vj=0;vj<8;vj++){autoW(g,-20+(vj%4)*7,-107+Math.floor(vj/4)*4,Math.PI/2+(vj%2?0.08:-0.08),vcols[(vj+2)%6])}
  // guest houses near the market lane, a pond-side lane of stalls and an alley
  hotelW(g,wins,-100,37,16,12,14,'#ffe3a6',0,-1);
  hotelW(g,wins,-78,37,16,12,12,'#e6d6ff',0,-1);
  roadZ(-12,-102,-60);
  box(5,0.08,20,'#a8987d',-60,0,-2,g);
  box(6,0.08,5,'#e6d7bd',px0,0,-18.4,g);
  [-98,-92,-86,-74,-68].forEach(function(sx,si){stallW(g,sx,-15.4,0,1,kk[(si+1)%4],awn[si%4])});
  [-98,-92,-86,-80,-74,-68].forEach(function(sx,si){stallW(g,sx,-8.6,0,-1,kk[(si+2)%4],awn[(si+1)%4])});
  // street lamps
  [42,58,90].forEach(function(lz){lamp(-17,lz);lamp(-11,lz)});
  [-42,-58,-74,-90].forEach(function(lz){lamp(-15,lz);lamp(-9,lz)});
  [56,72,88,104,118].forEach(function(lx){lamp(lx,13.5);lamp(lx,21.5)});
  [[-24,62],[-4,62],[-24,78],[-4,78]].forEach(function(q){lamp(q[0],q[1])});
  [-96,-84,-72].forEach(function(lx){lamp(lx,-12)});
  // people on the streets
  crowdIn(g,[[-16,32,-12,104],[-62,68.5,42,71.5],[-14,-100,-10,-32],[44,15.5,120,19.5],[124,6,152,30],[-98,-13.5,-62,-10.5],[-24,-112,0,-104]],150,0.1);
  // windows and street lamps are instanced so they can glow at night
  var od2=new THREE.Object3D();
  var wi=new THREE.InstancedMesh(new THREE.BoxGeometry(1.1,1.1,0.1),glowMat,wins.length);
  wins.forEach(function(w,i){od2.position.set(w[0],w[1],w[2]);od2.rotation.set(0,w[3],0);od2.updateMatrix();wi.setMatrixAt(i,od2.matrix)});
  g.add(wi);
  var bi=new THREE.InstancedMesh(new THREE.SphereGeometry(0.5,8,6),glowMat,bulbs.length);
  bulbs.forEach(function(q,i){od2.position.set(q[0],q[1],q[2]);od2.rotation.set(0,0,0);od2.updateMatrix();bi.setMatrixAt(i,od2.matrix)});
  g.add(bi);

  // trees (kept off the courtyard, streets, pond, lawn and route)
  var noTree=[[-30,26,2,112],[-70,55,48,86],[-28,-116,4,-26],[40,2,158,36],[px0-27,pz0-24,px0+27,pz0+24],[-112,26,-66,46],[-106,-20,-56,-6],[-66,-14,-54,10]];
  var tl=[];
  for(var i=0;i<1200&&tl.length<170;i++){
    var tx=rr(-175,180),tz=rr(-140,140);
    if(tx>-58&&tx<44&&tz>-32&&tz<32)continue;
    if(tx<-52&&tz>-9&&tz<25)continue;
    if(Math.hypot(tx-58,tz+24)<19)continue;
    var blocked=false;
    for(var nb=0;nb<noTree.length;nb++){var nr=noTree[nb];if(tx>nr[0]&&tx<nr[2]&&tz>nr[1]&&tz<nr[3]){blocked=true;break}}
    if(blocked)continue;
    tl.push([tx,tz,rr(0.7,1.3)]);
  }
  scatterTrees(g,tl,1);

  var A=mkAreas([
    {id:'kanwar-shops',name:'Kanwar shops',pos:new V3(-115,0,8),h:9,d:1.3,
     text:'Shops selling saffron cloth, bamboo poles and the pots pilgrims use to carry Ganga water.',
     action:{label:'Back to the yatra route',world:'yatra',route:'kanwar',area:'dham'}},
    {id:'flowers',name:'Flower sellers',pos:new V3(-101,0,8),h:9,d:1.2,
     text:'Marigold garlands and loose flowers for the offering, sold fresh through the day.'},
    {id:'puja-stalls',name:'Puja and prasad stalls',pos:new V3(-87,0,8),h:9,d:1.2,
     text:'Coconuts, incense and ready-made offering sets for the puja.'},
    {id:'peda-shops',name:'Peda shops',pos:new V3(-73,0,8),h:9,d:1.2,
     text:'Deoghar is known for its pedas, and many pilgrims carry a box home as prasad.'},
    {id:'shivganga',name:'Shivganga',pos:new V3(px0,0,pz0),h:9,d:1.9,
     text:'The sacred pond near the temple, drawn here as a large stepped tank with a boundary wall, corner pavilions and a steel-chain fence. Many pilgrims bathe here before darshan.'},
    {id:'walkway',name:'Covered walkway',pos:new V3(-59,0,8),h:6,d:0.8,
     text:'A covered steel walkway with a red carpet leads pilgrims from the market towards the main gate. Some stretches have a green roof.'},
    {id:'gate',name:'Main gate (east)',pos:new V3(-52,0,8),h:17,d:1,unverified:true,
     text:'The temple faces east, and one Hindi source calls its east door the main entrance. The gate\u2019s name and design here are approximate. Queues build up here at busy times.'},
    {id:'queue-hall',name:'Queue hall',pos:new V3(-38.5,0,8),h:8,d:1,
     text:'Steel barricades guide the queue through the halls before the sanctum. Saffron-clad Kanwariyas fill them at busy times.'},
    {id:'baidyanath',name:'Baidyanath Temple',pos:new V3(0,0,0),h:56,d:2.0,
     text:'The main shrine of Shiva, revered as a Jyotirlinga. The darshan route ends at the sanctum.'},
    {id:'naulakha',name:'Naulakha Mandir',pos:new V3(58,0,-24),h:24,d:1.2,nearby:true,
     text:'A Radha-Krishna temple in Deoghar. In reality it is a few kilometres from the main temple; it is placed close here to fit the map.'},
    {id:'parvati',name:'Parvati Temple',pos:new V3(32,0,-2),h:32,d:1.1,
     text:'A shrine to Parvati beside the main temple. Its spire and the main temple are traditionally linked by red cloth strings, shown here in red. Position is approximate.'}
  ]);
  shrineAreas.forEach(function(a){A.list.push(a);A.map[a.id]=a});
  [
    {id:'singh-dwar',name:'Singh Dwar',pos:new V3(-14,0,28),h:17,d:1.1,unverified:true,
     text:'A visitor\u2019s note describes Singh Dwar as an ornamental gate with lion statues on the temple\u2019s northern side, built around 1638. No source checked confirms the name, the date or the position. This model is only an illustration.'},
    {id:'gate-south',name:'South gate',pos:new V3(-12,0,-28),h:14,d:1,unverified:true,
     text:'A placeholder. A visitor\u2019s note says the temple has four main gates of different types, and this stands in for one of the other three. Its real name and design are unknown.'},
    {id:'gate-west',name:'West gate',pos:new V3(40,0,17.5),h:11,d:1,unverified:true,
     text:'A placeholder. A visitor\u2019s note says the temple has four main gates of different types, and this stands in for one of the other three. Its real name and design are unknown.'}
  ].forEach(function(a){A.list.push(a);A.map[a.id]=a});
  [
    {id:'clock-tower',name:'Clock tower chowk',pos:new V3(-14,0,70),h:33,d:1.3,
     text:'Tower Chowk is a well-known market junction on the way to the temple. This clock tower is an illustration of it, not a survey.'},
    {id:'north-market',name:'North market street',pos:new V3(-14,0,50),h:10,d:1.4,
     text:'An illustrative market street outside the northern side of the temple, with peda, puja, flower and Kanwar shops.'},
    {id:'south-market',name:'South market street',pos:new V3(-12,0,-62),h:10,d:1.4,
     text:'An illustrative market street on the southern side of the temple, ending in a plaza where autos wait.'},
    {id:'west-road',name:'West road',pos:new V3(82,0,17.5),h:10,d:1.4,
     text:'An illustrative road of shops, hotels and guest houses. Reviewers say autos and Totos run from the stations to the temple.'},
    {id:'bus-stand',name:'Bus stand',pos:new V3(138,0,17.5),h:9,d:1.3,
     text:'One guide puts Deoghar bus stand about 2 km from the temple. It is drawn close here to fit the map.'},
    {id:'pond-lane',name:'Pond-side lane',pos:new V3(-81,0,-12),h:9,d:1.3,
     text:'A short lane of puja and flower stalls between the market and Shivganga.'}
  ].forEach(function(a){A.list.push(a);A.map[a.id]=a});
  var fx=[makeClouds(g,10,300,235,300,2.6),petals(g,-6,0,60,150,'#ffb400',1.7),petals(g,-6,0,60,110,'#ff7eb3',1.7)];
  grp.traverse(function(o){if(o.isInstancedMesh)o.frustumCulled=false});
  grp.rotation.y=Math.PI;
  A.list.forEach(function(a){a.pos.x=-a.pos.x;a.pos.z=-a.pos.z});
  routes.forEach(function(r){if(r.view&&r.view.center){r.view.center.x=-r.view.center.x;r.view.center.z=-r.view.center.z}});
  g.flush();
  return {group:grp,fx:fx,areas:A.map,areaList:A.list,routes:routes,center:new V3(30,0,0),halfW:135,minOv:130,maxD:380,
    fog:[320,900],shadow:175,stopOffset:new V3(22,22,38),ovDir:new V3(0.08,0.72,0.69).normalize()};
}

/* ---------- world: yatra route ---------- */
function buildYatra(){
  var grp=new THREE.Group(),g=new Batch(grp);
  var pts=[[-205,45],[-170,30],[-130,52],[-90,22],[-50,-14],[-10,12],[30,46],[72,22],[104,-22],[146,-8],[184,-30],[200,-46]];
  var kanwar=mkRoute(g,{id:'kanwar',name:'Kanwar route',y:1,r:0.9,n:38,sc:1.5,speed:0.010,base:0,pts:pts,
    stops:['sultanganj','ajgaibinath','asarganj','tarapur','kumarsar','chandan-nagar','suiya','katoria','lakshman-jhula','bhulbhulaiya','kalakatia','dham','tapovan','trikut'],
    text:'Pilgrims carry Ganga water from Sultanganj to Deoghar on foot, roughly 105 km. Halts and leg lengths follow published route lists and are approximate.',
    view:{center:new V3(20,0,-5),halfW:265,minOv:200}});
  var curve=kanwar.curve,S=kanwar.samples;
  function far(x,z,d){for(var i=0;i<S.length;i++){if(Math.hypot(S[i].x-x,S[i].z-z)<d)return false}return true}
  var ground=mesh(new THREE.PlaneGeometry(1400,1000),'#a5dd7a',0,0,0,g);
  ground.rotation.x=-Math.PI/2;ground.castShadow=false;

  // river Ganga, sand bank, ghat steps, boats, rock shrine
  box(70,0.5,320,'#35c2d3',-262,0,0,g).castShadow=false;
  box(16,0.4,320,'#f3dfb0',-220,0,0,g).castShadow=false;
  for(var i=0;i<5;i++)box(4,0.6+i*0.55,26,'#e8dcc3',-234+i*4,0,45,g);
  [[-250,22],[-256,66],[-244,84]].forEach(function(b){box(9,1.2,3.2,'#8b5a2b',b[0],0.3,b[1],g)});
  cyl(4.5,9,9,'#7a6a58',-247,0,32,g,7);
  shikhara(g,-247,32,0.32,'','#ff9d2e',9,{W:6,H:22});

  // hills, fields
  var hc=['#6fc06b','#7fd07a','#98d888','#b8c86a'];
  for(var h=0,tries=0;h<38&&tries<400;tries++){
    var hx=rr(-190,230),hz=rnd()<0.5?rr(-160,-75):rr(80,160);
    if(!far(hx,hz,30))continue;
    cone(rr(14,30),rr(16,40),pick(hc),hx,0,hz,g,6);h++;
  }
  var fc=['#ffd166','#8fd66b','#ffb84d','#c5e063'];
  for(var f=0,t2=0;f<26&&t2<300;t2++){
    var fx=rr(-190,220),fz=rr(-110,110),fw=rr(14,26),fd=rr(10,18);
    if(!far(fx,fz,fw*0.6+8))continue;
    box(fw,0.25,fd,pick(fc),fx,0,fz,g).castShadow=false;f++;
  }

  // Tapovan hill with a small shrine, Trikut hills with a ropeway
  cone(22,34,'#8a7a66',255,0,-95,g,7);
  shikhara(g,255,-95,0.24,'','#ff9d2e',31,{W:6,H:20});
  cone(18,55,'#7d6e5c',262,0,5,g,6);cone(14,40,'#8a7a66',244,0,-8,g,6);cone(13,36,'#7d6e5c',276,0,-9,g,6);
  var ra=new V3(232,3,22),rb=new V3(262,50,6);
  box(2,6,2,'#8a6a3a',232,0,22,g);
  cable(g,ra,rb,0.18,'#333333');
  [0.25,0.55,0.8].forEach(function(t){var q=ra.clone().lerp(rb,t);box(2.4,2,2.4,'#d1381f',q.x,q.y-2.6,q.z,g)});

  // trees
  var tl=[];
  for(var k=0;k<700&&tl.length<230;k++){
    var tx=rr(-212,300),tz=rr(-125,125);
    if(!far(tx,tz,7))continue;
    if(Math.hypot(tx-208,tz+52)<40)continue;
    if(Math.hypot(tx-255,tz+95)<28)continue;
    if(tx>225&&tx<295&&tz>-25&&tz<35)continue;
    tl.push([tx,tz,rr(0.8,1.5)]);
  }
  scatterTrees(g,tl,1.3);

  // villages along the way
  var tan=new V3();
  var hut=['#ffe0a3','#ffc9a8','#ffd9e0'],roof=['#d9663a','#c0503a','#e0864a'];
  [0.18,0.32,0.52,0.72,0.84].forEach(function(u,vi){
    var c=curve.getPointAt(u);curve.getTangentAt(u,tan);
    var side=vi%2?1:-1,cx=c.x+(-tan.z)*side*15,cz=c.z+tan.x*side*15;
    for(var n=0;n<5;n++){
      var x=cx+rr(-9,9),z=cz+rr(-9,9);
      box(4,3,4,pick(hut),x,0,z,g);cone(3.6,2.6,pick(roof),x,3,z,g,4);
    }
  });

  // halts along the walking route (leg lengths from published route lists)
  var halts=[['asarganj','Asarganj',13],['tarapur','Tarapur',21],['kumarsar','Kumarsar',36],['chandan-nagar','Chandan Nagar',46],
    ['suiya','Suiya',62],['katoria','Katoria',78],['lakshman-jhula','Lakshman Jhula',86],['bhulbhulaiya','Bhulbhulaiya',97],['kalakatia','Kalakatia Dharamsala',105]];
  var haltAreas=halts.map(function(hh){
    var u=hh[2]/112,p=curve.getPointAt(u),ct=curve.getTangentAt(u);
    for(var m=0;m<2;m++){
      var off=(m?1:-1)*10;
      cone(3.4,4.4,m?'#f28c28':'#f7f3ea',p.x+(-ct.z)*off,0,p.z+ct.x*off,g,4);
    }
    return {id:hh[0],name:hh[1],pos:new V3(p.x,0,p.z),h:8,d:0.9,mini:true,
      text:'About '+hh[2]+' km from Sultanganj on the walking route. Camps along the way offer free food, water and rest. Distances are approximate.'};
  });

  // Deoghar town + Baidyanath temple
  var tc=['#ffd166','#ff8a80','#7bdcb5','#8ecae6','#ffb38a'];
  for(var q=0,t3=0;q<26&&t3<300;t3++){
    var a=rnd()*6.28,r=rr(20,50),hx2=208+Math.cos(a)*r,hz2=-54+Math.sin(a)*r*0.8;
    if(Math.hypot(hx2-208,hz2+52)<17||!far(hx2,hz2,8))continue;
    house(g,hx2,hz2,rr(5,8),rr(5,8),rr(4,9),pick(tc));q++;
  }
  var dm=shikhara(g,208,-52,1.0,'','#ff9d2e',0,{W:7.5,H:34});
  [[194,-62,0.42],[222,-60,0.40],[216,-38,0.36],[196,-40,0.34],[228,-46,0.34]].forEach(function(q,i){
    var t=shikhara(g,q[0],q[1],q[2],'',i%2?'#ff5d8f':'#ffd23f',0,{W:6,H:22});
    strand(g,dm.top.clone().add(new V3(0,-3,0)),t.top.clone().add(new V3(0,-1,0)),3+i*0.6,0.14);
  });

  var A=mkAreas([
    {id:'sultanganj',name:'Sultanganj Ghat',pos:new V3(-222,0,45),h:9,d:1,
     text:'The start of the Kanwar Yatra. Pilgrims fill their pots with Ganga water here and set out on foot for Deoghar, roughly 105 km away.'},
    {id:'ajgaibinath',name:'Ajgaibinath Temple',pos:new V3(-247,9,32),h:9,d:0.8,
     text:'A Shiva temple on a rocky outcrop in the Ganga, where many pilgrims collect water and pray before they begin the walk.'}
  ].concat(haltAreas).concat([
    {id:'dham',name:'Baidyanath Dham',pos:new V3(208,0,-52),h:50,d:1.8,
     text:'The end of the walk. The Ganga water is poured over the Shiva lingam at the main temple.',
     action:{label:'Walk the darshan route',world:'temple',route:'darshan',area:'kanwar-shops'}},
    {id:'tapovan',name:'Tapovan hills',pos:new V3(255,0,-95),h:44,d:1.4,nearby:true,
     text:'Rocky hills with cave shrines a short distance from Deoghar. Placed close to town here to fit the map.'},
    {id:'trikut',name:'Trikut hills',pos:new V3(262,0,5),h:62,d:2.2,nearby:true,
     text:'A group of hills near Deoghar with a ropeway to the top. Placed close to town here to fit the map.'}
  ]));
  var fx=[makeClouds(g,14,700,440,560,5.2),petals(g,208,-52,60,90,'#ffb400',2.4)];
  grp.traverse(function(o){if(o.isInstancedMesh)o.frustumCulled=false});
  g.flush();
  return {group:grp,fx:fx,areas:A.map,areaList:A.list,routes:[kanwar],center:new V3(20,0,-5),halfW:265,minOv:200,maxD:660,
    fog:[450,1400],shadow:340,stopOffset:new V3(0,46,70),ovDir:new V3(0,0.64,0.77).normalize()};
}

/* ---------- state ---------- */
var worlds={yatra:buildYatra(),temple:buildTemple()};
var state={world:null,route:null,i:-1,h:12};
var stopSet={};
var fly=null;
Object.keys(worlds).forEach(function(k){
  worlds[k].group.visible=false;scene.add(worlds[k].group);
  worlds[k].areaList.forEach(function(a){if(PHOTOS[a.id])a.photos=PHOTOS[a.id]});
});
function routeOf(w,id){for(var i=0;i<w.routes.length;i++)if(w.routes[i].id===id)return w.routes[i];return null}
function curRoute(){return routeOf(worlds[state.world],state.route)}

/* ---------- time of day ---------- */
function mkStops(a){return a.map(function(x){return [x[0],new THREE.Color(x[1])]})}
var topStops=mkStops([[-0.25,'#070b26'],[-0.02,'#1a1c4d'],[0.08,'#5a6fd6'],[0.3,'#4fb0ff'],[1,'#3aa0ff']]);
var horStops=mkStops([[-0.25,'#1b2450'],[-0.02,'#5a3b6b'],[0.08,'#ffa26b'],[0.28,'#ffe3b3'],[0.6,'#e6f7ff'],[1,'#e9fbff']]);
var cTmp=new THREE.Color(),skyTopC=new THREE.Color(),skyHorC=new THREE.Color();
function stopsAt(s,e,out){
  if(e<=s[0][0])return out.copy(s[0][1]);
  for(var i=1;i<s.length;i++){
    if(e<=s[i][0]){return out.copy(s[i-1][1]).lerp(s[i][1],(e-s[i-1][0])/(s[i][0]-s[i-1][0]))}
  }
  return out.copy(s[s.length-1][1]);
}
var dayC=new THREE.Color('#fff2d6'),duskC=new THREE.Color('#ff9a5a'),nightC=new THREE.Color('#7f95ff');
function fmt(h){
  var hh=Math.floor(h),mm=Math.round((h-hh)*60);
  if(mm===60){hh++;mm=0}
  return ((hh+11)%12+1)+':'+(mm<10?'0':'')+mm+' '+(hh%24<12?'am':'pm');
}
function setTime(h){
  state.h=h;
  var ang=(h-6)/12*Math.PI,e=Math.sin(ang);
  var w=worlds[state.world],R=w.shadow*1.4;
  sun.position.set(w.center.x+Math.cos(ang)*R,R*(0.25+0.75*Math.abs(e)),w.center.z+R*0.3);
  if(e>=0){sun.color.copy(duskC).lerp(dayC,clamp(e/0.35,0,1));sun.intensity=0.3+1.2*clamp(e/0.5,0,1)}
  else{sun.color.copy(nightC);sun.intensity=0.35}
  stopsAt(topStops,e,skyTopC);stopsAt(horStops,e,skyHorC);
  paintSky(skyTopC,skyHorC);
  scene.background.copy(skyHorC);scene.fog.color.copy(skyHorC);
  hemi.color.copy(skyTopC).lerp(cTmp.set('#ffffff'),0.55);
  var dayf=clamp((e+0.15)/0.5,0,1),night=clamp((0.1-e)/0.25,0,1);
  hemi.groundColor.set('#f0d9a8').multiplyScalar(0.3+0.7*dayf);
  hemi.intensity=0.55+0.55*dayf;
  glowMat.emissiveIntensity=night*1.1;
  whiteMat.emissiveIntensity=0.1+night*0.5;
  goldMat.emissiveIntensity=0.25+night*0.6;
  redGlow.emissiveIntensity=0.15+night*1.2;
  cloudMat.color.set('#ffffff').lerp(cTmp.set('#59629b'),night);
  $('#tlabel').textContent=fmt(h);
  $('#time').value=h;
}

/* ---------- camera moves ---------- */
function ease(k){return k<0.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2}
function flyTo(target,offset,dur){
  var c=target.clone().add(offset);
  if(reduce||dur===0){controls.target.copy(target);cam.position.copy(c);fly=null;return}
  fly={t0:performance.now(),dur:(dur||1.3)*1000,c0:cam.position.clone(),c1:c,o0:controls.target.clone(),o1:target.clone()};
}
controls.addEventListener('start',function(){fly=null});
function overview(w,r){
  var v=r.view||{},half=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));
  var d=clamp((v.halfW||w.halfW)/(half*cam.aspect)*1.05,v.minOv||w.minOv,w.maxD*0.95);
  return {center:v.center||w.center,off:w.ovDir.clone().multiplyScalar(d)};
}

/* ---------- pins ---------- */
var pinsEl=$('#pins');
Object.keys(worlds).forEach(function(k){
  worlds[k].areaList.forEach(function(a){
    var el=document.createElement('button');
    el.className='pin'+(a.mini?' mini':'');el.innerHTML='<i></i><span></span>';
    el.lastChild.textContent=a.name+(a.unverified?' (unverified)':'');
    el.style.display='none';
    el.addEventListener('click',function(){if(state.world===k)selectId(a.id)});
    pinsEl.appendChild(el);a.el=el;
  });
});
var _v=new V3();
function updatePins(){
  var w=worlds[state.world],pw=host.clientWidth,ph=host.clientHeight;
  w.areaList.forEach(function(a){
    if(!stopSet[a.id]){a.el.style.display='none';return}
    _v.copy(a.pos);_v.y+=a.h;_v.project(cam);
    var on=_v.z<1&&_v.z>-1;
    a.el.style.display=on?'':'none';
    if(on)a.el.style.transform='translate('+((_v.x*0.5+0.5)*pw)+'px,'+((-_v.y*0.5+0.5)*ph)+'px) translate(-50%,-100%)';
  });
}

/* ---------- card, lightbox ---------- */
var card=$('#card'),lb=$('#lightbox');
function openLB(src,cap){$('#lbimg').src=src;$('#lbcap').textContent=cap||'';lb.classList.add('open')}
lb.addEventListener('click',function(){lb.classList.remove('open')});
function closeCard(){card.classList.remove('open')}
function fillCard(t){
  $('#cstop').textContent=t.stop||'';
  $('#cn').textContent=t.name;
  $('#ctext').textContent=t.text;
  var ph=$('#cphotos');ph.innerHTML='';
  var list=t.photos||[];
  list.forEach(function(p){
    var im=document.createElement('img');
    im.src=p.src;im.alt=p.cap||t.name;
    im.addEventListener('click',function(){openLB(p.src,p.cap)});
    ph.appendChild(im);
  });
  ph.style.display=list.length?'flex':'none';
  var b=$('#cact');
  if(t.action){
    b.style.display='';b.textContent=t.action.label;
    b.onclick=function(){
      var ac=t.action,rt=routeOf(worlds[ac.world],ac.route);
      setWorld(ac.world,ac.route,rt.stops.indexOf(ac.area),false);
    };
  }else{b.style.display='none';b.onclick=null}
  card.classList.add('open');card.scrollTop=0;
}

/* ---------- selection, routes, worlds ---------- */
function writeHash(){
  try{
    var w=worlds[state.world],r=curRoute();
    history.replaceState(null,'','#/'+state.world+'/'+r.id+(state.i>=0?'/'+r.stops[state.i]:''));
  }catch(e){}
}
function select(i,intro){
  var w=worlds[state.world],r=curRoute(),n=r.stops.length;
  state.i=i;
  var id=i>=0?r.stops[i]:null;
  w.areaList.forEach(function(a){a.el.classList.toggle('on',a.id===id)});
  if(i<0){
    $('#cur').textContent=r.name;
    var v=overview(w,r);flyTo(v.center,v.off,1.2);
    if(intro)fillCard({name:r.name,stop:n+' stops',text:r.text,photos:ROUTE_PHOTOS[r.id]});
    else closeCard();
  }else{
    var a=w.areas[id];
    $('#cur').textContent=a.name;
    fillCard({name:a.name,stop:(a.unverified?'Unverified. ':'')+(a.nearby?'Nearby landmark':'Stop '+(i+1)+' of '+n),text:a.text,photos:a.photos,action:a.action});
    flyTo(a.pos,w.stopOffset.clone().multiplyScalar(a.d||1),1.3);
  }
  writeHash();
}
function selectId(id){var r=curRoute(),i=r.stops.indexOf(id);if(i>-1)select(i)}
function renderChips(w){
  var el=$('#routes');el.innerHTML='';
  if(w.routes.length<2){el.style.display='none';return}
  el.style.display='flex';
  w.routes.forEach(function(r){
    var b=document.createElement('button');
    b.className='chip panel';b.textContent=r.name;
    b.setAttribute('aria-pressed',r.id===state.route?'true':'false');
    b.addEventListener('click',function(){
      if(r.id!==state.route)setWorld(state.world,r.id,-1,true);else select(-1,true);
    });
    el.appendChild(b);
  });
}
function setWorld(name,routeId,idx,intro){
  var w=worlds[name],r=routeOf(w,routeId)||w.routes[0];
  idx=(idx===undefined)?-1:idx;
  var changed=state.world!==name;
  state.world=name;state.route=r.id;
  Object.keys(worlds).forEach(function(k){
    worlds[k].group.visible=(k===name);
    if(k!==name)worlds[k].areaList.forEach(function(a){a.el.style.display='none';a.el.classList.remove('on')});
  });
  w.routes.forEach(function(rt){var on=rt.id===r.id;rt.tube.visible=on&&!rt.noline;rt.pilgrims.setVisible(on)});
  stopSet={};r.stops.forEach(function(id){stopSet[id]=true});
  document.querySelectorAll('.seg button').forEach(function(b){b.setAttribute('aria-selected',b.dataset.w===name?'true':'false')});
  renderChips(w);
  scene.fog.near=w.fog[0];scene.fog.far=w.fog[1];
  controls.minDistance=14;controls.maxDistance=w.maxD;
  var s=w.shadow,sc=sun.shadow.camera;
  sc.left=-s;sc.right=s;sc.top=s;sc.bottom=-s;sc.near=1;sc.far=s*6;sc.updateProjectionMatrix();
  sun.target.position.copy(w.center);
  setTime(state.h);
  if(changed){
    var v=overview(w,r);
    controls.target.copy(v.center);cam.position.copy(v.center).add(v.off);fly=null;
  }
  select(idx,intro);
}
function step(d){
  var n=curRoute().stops.length;
  select(state.i<0?(d>0?0:n-1):(state.i+d+n)%n);
}
function goTo(wn,id){
  var w=worlds[wn],r=null;
  if(state.world===wn){var cr=routeOf(w,state.route);if(cr.stops.indexOf(id)>-1)r=cr}
  if(!r){for(var i=0;i<w.routes.length;i++){if(w.routes[i].stops.indexOf(id)>-1){r=w.routes[i];break}}}
  if(!r)r=w.routes[0];
  var idx=r.stops.indexOf(id);
  if(state.world===wn&&state.route===r.id)select(idx);else setWorld(wn,r.id,idx,false);
}

/* ---------- search ---------- */
var searchEl=$('#search'),qEl=$('#q'),resEl=$('#results'),sel=0,shown=[];
var all=[];
Object.keys(worlds).forEach(function(k){worlds[k].areaList.forEach(function(a){all.push({w:k,id:a.id,a:a})})});
function renderResults(){
  var q=qEl.value.trim().toLowerCase();
  shown=all.filter(function(r){return !q||r.a.name.toLowerCase().indexOf(q)>-1});
  sel=0;resEl.innerHTML='';
  if(!shown.length){var d=document.createElement('div');d.id='empty';d.textContent='No matching place. Try Shivganga or Sultanganj.';resEl.appendChild(d);return}
  shown.forEach(function(r,j){
    var li=document.createElement('li'),b=document.createElement('button');
    b.innerHTML='<span></span><small></small>';
    b.firstChild.textContent=r.a.name;b.lastChild.textContent=r.w==='yatra'?'Yatra':'Temple';
    if(j===0)b.className='sel';
    b.addEventListener('click',function(){go(r)});
    li.appendChild(b);resEl.appendChild(li);
  });
}
function markSel(){
  var bs=resEl.querySelectorAll('button');
  bs.forEach(function(b,j){b.classList.toggle('sel',j===sel)});
  if(bs[sel]&&bs[sel].scrollIntoView)bs[sel].scrollIntoView({block:'nearest'});
}
function go(r){closeSearch();goTo(r.w,r.id)}
function openSearch(){searchEl.classList.add('open');qEl.value='';renderResults();setTimeout(function(){qEl.focus()},0)}
function closeSearch(){searchEl.classList.remove('open');qEl.blur()}
qEl.addEventListener('input',renderResults);
qEl.addEventListener('keydown',function(e){
  if(e.key==='ArrowDown'){e.preventDefault();if(shown.length){sel=(sel+1)%shown.length;markSel()}}
  else if(e.key==='ArrowUp'){e.preventDefault();if(shown.length){sel=(sel-1+shown.length)%shown.length;markSel()}}
  else if(e.key==='Enter'){if(shown[sel])go(shown[sel])}
});
searchEl.addEventListener('pointerdown',function(e){if(e.target===searchEl)closeSearch()});

/* ---------- events ---------- */
$('#kbd').textContent=/Mac|iPhone|iPad/.test(navigator.platform||'')?'\u2318K':'Ctrl K';
$('#searchBtn').addEventListener('click',openSearch);
$('#closeCard').addEventListener('click',closeCard);
$('#cur').addEventListener('click',function(){select(-1,true)});
$('#prev').addEventListener('click',function(){step(-1)});
$('#next').addEventListener('click',function(){step(1)});
$('#time').addEventListener('input',function(e){setTime(parseFloat(e.target.value))});
document.querySelectorAll('.seg button').forEach(function(b){
  b.addEventListener('click',function(){if(b.dataset.w!==state.world)setWorld(b.dataset.w,undefined,-1,true)});
});
addEventListener('keydown',function(e){
  if(!visible)return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();return}
  if(lb.classList.contains('open')){if(e.key==='Escape')lb.classList.remove('open');return}
  if(searchEl.classList.contains('open')){if(e.key==='Escape')closeSearch();return}
  if(e.target&&e.target.tagName==='INPUT')return;
  if(e.key==='ArrowDown'){e.preventDefault();step(1)}
  else if(e.key==='ArrowUp'){e.preventDefault();step(-1)}
  else if(e.key==='Escape'){closeCard()}
});
function onResize(){cam.aspect=mapW()/mapH();cam.updateProjectionMatrix();renderer.setSize(mapW(),mapH())}
addEventListener('resize',onResize);
function readHash(){
  var m=(location.hash||'').match(/^#\/(yatra|temple)(?:\/([\w-]+))?(?:\/([\w-]+))?/);
  if(!m)return null;
  var w=worlds[m[1]],r=routeOf(w,m[2])||w.routes[0];
  return [m[1],r.id,m[3]?r.stops.indexOf(m[3]):-1];
}
addEventListener('hashchange',function(){
  var h=readHash();
  if(h&&(h[0]!==state.world||h[1]!==state.route||h[2]!==state.i))setWorld(h[0],h[1],h[2],false);
});

// double-click / double-tap to fly to a spot
var ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),gPlane=new THREE.Plane(new V3(0,1,0),0),_p=new V3();
function flyToPoint(x,y){
  var rc=cv.getBoundingClientRect();
  ndc.set((x-rc.left)/rc.width*2-1,-((y-rc.top)/rc.height)*2+1);
  ray.setFromCamera(ndc,cam);
  if(!ray.ray.intersectPlane(gPlane,_p))return;
  var off=cam.position.clone().sub(controls.target);
  off.setLength(Math.max(controls.minDistance+6,off.length()*0.6));
  flyTo(_p.clone(),off,1);
}
var cv=renderer.domElement,lastTap=0,downInfo=null,lastType='mouse';
cv.addEventListener('pointerdown',function(e){lastType=e.pointerType;downInfo={x:e.clientX,y:e.clientY,t:performance.now()}});
cv.addEventListener('pointerup',function(e){
  if(e.pointerType!=='touch'||!downInfo)return;
  var now=performance.now();
  if(Math.hypot(e.clientX-downInfo.x,e.clientY-downInfo.y)>10||now-downInfo.t>300)return;
  if(now-lastTap<320){flyToPoint(e.clientX,e.clientY);lastTap=0}else lastTap=now;
});
cv.addEventListener('dblclick',function(e){if(lastType!=='touch')flyToPoint(e.clientX,e.clientY)});

/* ---------- start ---------- */
var now=new Date(),h0=now.getHours()+Math.round(now.getMinutes()/15)*0.25;
state.h=clamp(h0,0,24);
var start=readHash()||['yatra',null,-1];
setWorld(start[0],start[1],start[2],false);

var clock=new THREE.Clock(),first=true;
function loop(){
  if(!visible){requestAnimationFrame(loop);return}
  try{
    var dt=Math.min(clock.getDelta(),0.1);
    if(fly){
      var k=clamp((performance.now()-fly.t0)/fly.dur,0,1),e=ease(k);
      cam.position.lerpVectors(fly.c0,fly.c1,e);
      controls.target.lerpVectors(fly.o0,fly.o1,e);
      if(k>=1)fly=null;
    }
    controls.update();
    if(!reduce){curRoute().pilgrims.update(dt);worlds[state.world].fx.forEach(function(f){f.update(dt)})}
    skyMesh.position.copy(cam.position);
    updatePins();
    renderer.render(scene,cam);
    if(first){first=false;host.classList.add('ready')}
  }catch(err){window.__fail(String(err&&err.message||err));return}
  requestAnimationFrame(loop);
}
loop();
return {resize:onResize,setVisible:function(v){visible=v}};
};