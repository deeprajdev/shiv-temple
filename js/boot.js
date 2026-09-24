window.__fail=function(msg){
  var m=document.getElementById('loadmsg'),e=document.getElementById('loaderr');
  if(m)m.textContent="The map couldn't start";
  if(e)e.textContent=msg;
};
window.addEventListener('error',function(ev){window.__fail(ev.message||'Unknown error')});