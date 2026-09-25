
(function(){
  var root=document.documentElement,mapEl=document.getElementById('mapapp'),pujaEl=document.getElementById('pujaapp'),guideEl=document.getElementById('guide');
  var tabs=[].slice.call(document.querySelectorAll('#sitebar [data-tab]'));
  var ctl={map:null,puja:null},tried={map:false,puja:false},lastY=0,cur='guide';
  function setTabs(t){tabs.forEach(function(b){b.setAttribute('aria-selected',b.dataset.tab===t?'true':'false')})}
  function tabForHash(h){if(/^#\/puja/.test(h||''))return 'puja';if(/^#\/(yatra|temple)/.test(h||''))return 'map';return null}
  function poke(){if(window.__heroUpdate)window.__heroUpdate()}
  function show(t){
    if(cur===t)return;
    if(cur==='guide')lastY=window.pageYOffset||0;
    if(cur==='map'&&ctl.map)ctl.map.setVisible(false);
    if(cur==='puja'&&ctl.puja)ctl.puja.setVisible(false);
    cur=t;
    root.classList.toggle('map-on',t!=='guide');
    guideEl.hidden=t!=='guide';mapEl.hidden=t!=='map';pujaEl.hidden=t!=='puja';
    setTabs(t);
    if(t==='map'){
      if(!tried.map){tried.map=true;try{ctl.map=window.__startMap()||null}catch(e){window.__fail(String(e&&e.message||e))}}
      if(ctl.map){ctl.map.setVisible(true);ctl.map.resize()}
    }else if(t==='puja'){
      if(!tried.puja){tried.puja=true;try{ctl.puja=window.__startPuja()||null}catch(e){window.__failPuja(String(e&&e.message||e))}}
      if(ctl.puja){ctl.puja.setVisible(true);ctl.puja.resize()}
    }else{
      if(tabForHash(location.hash)){try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
      window.scrollTo(0,lastY);
    }
    poke();
  }
  tabs.forEach(function(b){b.addEventListener('click',function(){
    var t=b.dataset.tab;
    if(t==='puja'&&location.hash!=='#/puja'){try{history.replaceState(null,'',location.pathname+location.search+'#/puja')}catch(e){}}
    show(t);
  })});
  window.addEventListener('hashchange',function(){var t=tabForHash(location.hash);if(t)show(t)});

  // guide photos share the map's embedded images
  [].slice.call(document.querySelectorAll('img[data-img]')).forEach(function(im){
    if(window.IMG&&window.IMG[im.dataset.img])im.src=window.IMG[im.dataset.img];
  });

  // Keep section navigation aligned with both the fixed bar and sticky TOC.
  var links=[].slice.call(document.querySelectorAll('nav.toc a'));
  var sections=[].slice.call(document.querySelectorAll('main section'));
  var activeSection='';
  var scrollTick=false;
  var scrollAnimation=0;
  function sectionOffset(){
    var bar=document.getElementById('sitebar'),toc=document.querySelector('nav.toc');
    return (bar?bar.getBoundingClientRect().height:0)+(toc?toc.getBoundingClientRect().height:0)+8;
  }
  function setSection(id){
    if(!id||id===activeSection)return;
    activeSection=id;
    links.forEach(function(a){
      var on=a.getAttribute('href')==='#'+id;
      a.classList.toggle('on',on);
    });
  }
  function syncSection(){
    scrollTick=false;
    if(scrollAnimation)return;
    var line=(window.pageYOffset||window.scrollY||0)+sectionOffset()+1;
    var current=sections[0];
    sections.forEach(function(section){
      if(section.offsetTop<=line)current=section;
    });
    if(current)setSection(current.id);
  }
  function scrollToSection(target){
    if(scrollAnimation)cancelAnimationFrame(scrollAnimation);
    var start=window.pageYOffset||window.scrollY||0;
    var destination=Math.max(0,start+target.getBoundingClientRect().top-sectionOffset());
    var distance=destination-start;
    if(Math.abs(distance)<1)return;
    var started=performance.now();
    var duration=Math.min(800,Math.max(380,Math.abs(distance)*.35));
    function frame(now){
      var progress=Math.min(1,(now-started)/duration);
      var eased=progress<.5?2*progress*progress:1-Math.pow(-2*progress+2,2)/2;
      window.scrollTo(0,start+distance*eased);
      if(progress<1)scrollAnimation=requestAnimationFrame(frame);else{scrollAnimation=0;syncSection()}
    }
    scrollAnimation=requestAnimationFrame(frame);
  }
  links.forEach(function(link){
    link.addEventListener('click',function(event){
      var id=(link.getAttribute('href')||'').slice(1),target=document.getElementById(id);
      if(!target)return;
      event.preventDefault();
      setSection(id);
      try{history.pushState(null,'','#'+id)}catch(e){location.hash=id}
      scrollToSection(target);
    });
  });
  window.addEventListener('scroll',function(){
    if(!scrollTick){scrollTick=true;window.requestAnimationFrame(syncSection)}
  },{passive:true});
  window.addEventListener('resize',syncSection);
  syncSection();
  // checklist ticks are remembered on this device when storage is available
  var boxes=[].slice.call(document.querySelectorAll('#check input'));
  var saved=[];
  try{saved=JSON.parse(localStorage.getItem('bd-check')||'[]')}catch(e){}
  boxes.forEach(function(b,i){
    b.checked=!!saved[i];
    b.addEventListener('change',function(){
      var v=boxes.map(function(x){return x.checked});
      try{localStorage.setItem('bd-check',JSON.stringify(v))}catch(e){}
    });
  });
  window.__site={show:show,current:function(){return cur},ctl:ctl};
  var t0=tabForHash(location.hash);if(t0)show(t0);
})();