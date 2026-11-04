/* Shared page runtime: theme, Lenis + GSAP ScrollTrigger sync, pinned-hero master timeline, count-ups, reveals, sticky steps.
   Classic script. Expects gsap, ScrollTrigger and Lenis to be loaded before it (pinned CDN builds in index.html). */
(function(){
  const root=document.documentElement, reduced=matchMedia('(prefers-reduced-motion:reduce)').matches, phone=matchMedia('(max-width:640px)').matches;
  const saved=(()=>{try{return localStorage.getItem('theme')}catch(e){return null}})(); if(saved) root.setAttribute('data-theme',saved);
  const isDark=()=>root.getAttribute('data-theme')==='dark'||(!root.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme:dark)').matches);
  function applyFigs(){const t=isDark()?'dark':'light';document.querySelectorAll('img[data-fig]').forEach(i=>{const ext=i.dataset.ext?'.'+i.dataset.ext.replace(/^\./,''):'.svg';i.src=(i.dataset.dir||'assets/')+i.dataset.fig+'_'+t+ext});document.dispatchEvent(new CustomEvent('themechange',{detail:{dark:isDark()}}))}
  const btn=document.getElementById('themeBtn'); if(btn) btn.addEventListener('click',()=>{const n=isDark()?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('theme',n)}catch(e){}applyFigs()});
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',applyFigs); applyFigs();

  const S=window.SITE={reduced, phone, isDark, hero:{t:0, fade:1, glow:0}, frame:[], ready:false};
  S.onFrame=cb=>S.frame.push(cb);
  const hasGSAP=typeof gsap!=='undefined'&&typeof ScrollTrigger!=='undefined';
  if(hasGSAP){gsap.registerPlugin(ScrollTrigger)}
  // Lenis smooth scroll synced with ScrollTrigger (pattern from the Lenis README). Not started for reduced motion.
  let lenis=null;
  if(hasGSAP&&!reduced&&typeof Lenis!=='undefined'){
    lenis=new Lenis({lerp:.11, smoothWheel:true, syncTouch:false});
    lenis.on('scroll',ScrollTrigger.update);
    gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const el=document.querySelector(a.getAttribute('href'));if(el){e.preventDefault();lenis.scrollTo(el,{offset:-52})}}));
  }
  S.lenis=lenis;
  if(hasGSAP){gsap.ticker.add((t,dt)=>{for(const cb of S.frame) cb(t,dt)})}else{(function loop(t){for(const cb of S.frame) cb(t/1000,16);requestAnimationFrame(loop)})(0)}

  // pinned hero master timeline: scrubs SITE.hero.t from 0 to 1 over the track; fades and lifts the copy; sets glow
  const track=document.querySelector('.hero-track'), copy=document.querySelector('.hero .copy'), hint=document.querySelector('.scrollhint');
  if(track&&hasGSAP){
    if(reduced){S.hero.t=1;S.hero.fade=1}
    else{
      const tl=gsap.timeline({scrollTrigger:{trigger:track,start:'top top',end:'bottom bottom',scrub:.8}});
      tl.to(S.hero,{t:1,ease:'none',duration:1},0)
        .to(S.hero,{glow:1,ease:'sine.inOut',duration:.5},0).to(S.hero,{glow:.35,ease:'sine.inOut',duration:.5},.5)
        .to(copy,{autoAlpha:0,y:-40,ease:'power1.in',duration:.28},.02)
        .to(hint,{autoAlpha:0,duration:.1},0);
      S.heroTimeline=tl;
    }
  }
  // count-ups
  const fmt=(v,f)=>f==='int'?Math.round(v).toLocaleString('en-US'):(+v).toFixed(+f);
  document.querySelectorAll('[data-count]').forEach(el=>{const target=+el.dataset.count,f=el.dataset.format||'int',node=el.firstChild;const set=v=>{node.textContent=fmt(v,f)};
    if(reduced||!hasGSAP){set(target);return}
    const o={v:0}; gsap.to(o,{v:target,duration:1.6,ease:'power3.out',onUpdate:()=>set(o.v),scrollTrigger:{trigger:el,start:'top 88%',once:true}})});
  // reveals
  const rv=[...document.querySelectorAll('.reveal')];
  if(reduced||!hasGSAP){rv.forEach(el=>el.classList.add('in'))}
  else{ScrollTrigger.batch(rv,{start:'top 90%',once:true,onEnter:b=>b.forEach((el,i)=>setTimeout(()=>el.classList.add('in'),i*90))})}
  // sticky steps: cb(key) when a step reaches the viewport centre
  S.steps=(sel,cb)=>{const steps=[...document.querySelectorAll(sel)];if(!steps.length)return;const act=s=>{steps.forEach(x=>x.classList.toggle('active',x===s));cb(s.dataset.step||s.dataset.ion)};
    if(reduced||!hasGSAP){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)act(e.target)}),{rootMargin:'-45% 0px -45% 0px'});steps.forEach(s=>io.observe(s))}
    else steps.forEach(s=>ScrollTrigger.create({trigger:s,start:'top 55%',end:'bottom 45%',onEnter:()=>act(s),onEnterBack:()=>act(s)}));
    act(steps[0])};
  // tables from data
  S.table=(id,rows)=>{const el=document.getElementById(id);if(el)el.innerHTML=rows.map(r=>'<tr>'+r.map((c,i)=>`<td${typeof c==='number'||/^[−\-\d.,≈ ×⁻¹²³⁴⁵⁶⁷⁸⁹⁰e%]+$/.test(String(c))&&i>0?' class="num"':''}>${c}</td>`).join('')+'</tr>').join('')};
  // refresh after late layout
  addEventListener('load',()=>{if(hasGSAP)ScrollTrigger.refresh()});
  S.ready=true; document.dispatchEvent(new CustomEvent('siteready'));
})();
