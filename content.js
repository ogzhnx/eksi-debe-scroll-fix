(() => {
  'use strict';
  const KEY = 'eksi-debe-fix-v2';
  const SELECTORS = ['#partial-index', '#index-section', '#topic-list', '.topic-list', '#left-frame', '.left-frame', '#sidebar', '.sidebar'];
  const TAB_RE = /(?:^|\/)debe(?:\/|$)/i;
  let panel = null, target = null, lastTop = 0, activated = false, restoringUntil = 0;
  let lastHref = location.href, lastIntent = 0, intentionalTop = false, lastAnchor = null;
  function load() { try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && Date.now()-s.time < 6*3600000 ? s : null; } catch { return null; } }
  const old = load();
  activated = TAB_RE.test(location.pathname) || !!old?.active;
  lastTop = old?.top || 0;
  lastAnchor = old?.anchor || null;
  function save() { if (!activated) return; try { sessionStorage.setItem(KEY, JSON.stringify({active:true,top:lastTop,anchor:lastAnchor,time:Date.now()})); } catch {} }
  function isLeft(el) { if (!el || !el.isConnected) return false; const r=el.getBoundingClientRect(); return r.width>70 && r.height>40 && r.left < innerWidth*.46; }
  function findPanel() {
    for (const sel of SELECTORS) for (const el of document.querySelectorAll(sel)) {
      if (isLeft(el) && el.querySelectorAll('a[href]').length >= 5) return el;
    }
    return null;
  }
  function scrollable(el) { if (!(el instanceof Element)) return false; const st=getComputedStyle(el); return /(auto|scroll|overlay)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 10; }
  function getTarget(p) {
    // Find the scrollable wrapper first. Some layouts scroll the wrapper, others the list itself.
    for (let e=p; e && e !== document.body; e=e.parentElement) if (scrollable(e) && isLeft(e)) return e;
    for (const e of [p,...p.querySelectorAll('*')]) if (scrollable(e) && isLeft(e)) return e;
    return null;
  }
  function top() { return target?.scrollTop ?? 0; }
  function anchorNow() {
    if (!panel) return null;
    const bounds=panel.getBoundingClientRect();
    const links=[...panel.querySelectorAll('a[href]')];
    const candidate=links.find(a=> {const r=a.getBoundingClientRect(); return r.height>0 && r.bottom >= Math.max(0,bounds.top) + 12 && r.top < innerHeight;});
    return candidate ? {href:candidate.getAttribute('href'), offset:candidate.getBoundingClientRect().top - bounds.top} : null;
  }
  function remember() { if (!activated || !target) return; lastTop=top(); if (lastTop>35) lastAnchor=anchorNow(); save(); }
  function restore() {
    if (!activated || !target || !target.isConnected || lastTop<30) return;
    const max=target.scrollHeight-target.clientHeight;
    if (max<=0) return;
    target.scrollTop=Math.min(lastTop,max);
    if (lastAnchor && target.scrollHeight > target.clientHeight) {
      const a=[...panel.querySelectorAll('a[href]')].find(x=>x.getAttribute('href')===lastAnchor.href);
      // Anchor is useful when the list has changed height after a partial rerender.
      if (a && target.scrollTop===0 && max>lastTop*.7) target.scrollTop=Math.min(lastTop,max);
    }
  }
  function onScroll() {
    if (!activated || !target) return;
    const v=top(), now=Date.now();
    if (v<25 && lastTop>110 && !intentionalTop && (now<restoringUntil || now-lastIntent>600)) {
      requestAnimationFrame(restore); return;
    }
    if (now<restoringUntil && v<lastTop*.4 && !intentionalTop) { requestAnimationFrame(restore); return; }
    lastTop=v; if(v>35) lastAnchor=anchorNow(); save();
  }
  function setup() {
    if (TAB_RE.test(location.pathname)) activated=true;
    if (!activated) return;
    const p=findPanel(); if(!p) return;
    const t=getTarget(p); if(!t) return;
    if (t!==target) {
      if(target) target.removeEventListener('scroll',onScroll);
      panel=p; target=t; target.addEventListener('scroll',onScroll,{passive:true});
      if(lastTop>25) {
        restoringUntil=Date.now()+2600;
        for(const ms of [0,60,200,500,1000,1800,2500]) setTimeout(restore,ms);
      } else lastTop=top();
    } else panel=p;
  }
  document.addEventListener('click',e=>{
    const a=e.target.closest?.('a[href]');
    if(!a) return;
    const href=a.getAttribute('href') || '';
    if(TAB_RE.test(href)) {
      activated=true; lastTop=0; lastAnchor=null; save();
      setTimeout(setup,100); return;
    }
    if(target && panel?.contains(a)) {
      remember(); restoringUntil=Date.now()+3500;
      for(const ms of [60,180,400,850,1600,3000]) setTimeout(()=>{setup();restore();},ms);
    }
  },true);
  // Only deliberate movement inside the sidebar is allowed to clear the remembered position.
  for (const type of ['wheel','touchstart','keydown']) document.addEventListener(type,e=>{
    if(!target || !(target===e.target || target.contains(e.target))) return;
    lastIntent=Date.now(); intentionalTop=false;
    if(type==='keydown' && ['Home','Control','Meta'].includes(e.key)) intentionalTop=true;
    if(type==='wheel' && e.deltaY<0 && top()<160) intentionalTop=true;
    restoringUntil=0;
  },{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden) remember();});
  window.addEventListener('pagehide',remember);
  const init=()=>{
    setup();
    new MutationObserver(()=>{if(activated && (!target || !target.isConnected || !panel?.isConnected)) setup();}).observe(document.documentElement,{subtree:true,childList:true});
    setInterval(()=>{
      if(location.href!==lastHref) {lastHref=location.href; if(TAB_RE.test(location.pathname)) activated=true; restoringUntil=Date.now()+2000; setup();}
      if(!target || !target.isConnected) setup();
      if(activated && target && lastTop>110 && top()<25 && !intentionalTop && Date.now()-lastIntent>600) restore();
    },250);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
