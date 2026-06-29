const burger=document.getElementById('burger'),panel=document.getElementById('panel'),pc=document.getElementById('panelClose');
  const toggle=()=>{const o=panel.classList.toggle('open');burger.classList.toggle('open',o);document.body.style.overflow=o?'hidden':'';};
  burger.addEventListener('click',toggle);
  pc.addEventListener('click',toggle);
  panel.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{panel.classList.remove('open');burger.classList.remove('open');document.body.style.overflow='';}));
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('[data-rev]').forEach(el=>io.observe(el));
  document.querySelectorAll('.sec__title').forEach(t=>{const en=t.querySelector('.en');if(!en)return;const g=document.createElement('span');g.className='sec__ghost';g.textContent=en.textContent;g.setAttribute('aria-hidden','true');t.insertBefore(g,t.firstChild);});
  const fab=document.getElementById('fab');
  if(fab){
    const fabScroll=()=>fab.classList.toggle('show',scrollY>420);
    addEventListener('scroll',fabScroll,{passive:true});fabScroll();
    const ft=document.querySelector('.ft'); // フッターに重なる間は引っ込める
    if(ft)new IntersectionObserver(es=>fab.classList.toggle('at-footer',es[0].isIntersecting)).observe(ft);
  }
  // テーマ切替（light/dark）：<html data-theme> を切替え localStorage に保存。Figma DS の dark モードに対応。
  (function(){
    const root=document.documentElement;
    const saved=localStorage.getItem('theme');
    if(saved==='light'||saved==='dark')root.setAttribute('data-theme',saved);
    const moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    const sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>';
    const isDark=()=>{const t=root.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;};
    const btn=document.createElement('button');
    btn.className='theme-toggle';
    const render=()=>{btn.innerHTML=isDark()?sun:moon;btn.setAttribute('aria-label',isDark()?'ライトモードに切替':'ダークモードに切替');};
    render();
    btn.addEventListener('click',()=>{const next=isDark()?'light':'dark';root.setAttribute('data-theme',next);localStorage.setItem('theme',next);render();});
    document.body.appendChild(btn);
  })();
  // ブログ一覧：カテゴリチップで記事を絞り込み（.bcardがある時だけ＝gallery等と競合させない）
  const chips=document.querySelector('.chips');
  if(chips && document.querySelector('.bcard')){
    const cards=[...document.querySelectorAll('.bcard')];
    const empty=document.querySelector('.bempty');
    chips.addEventListener('click',e=>{
      const a=e.target.closest('a');if(!a)return;e.preventDefault();
      chips.querySelectorAll('a').forEach(x=>x.classList.toggle('on',x===a));
      const cat=a.dataset.cat;
      let shown=0;
      cards.forEach(c=>{const hit=!cat||c.dataset.cat===cat;c.hidden=!hit;if(hit)shown++;});
      if(empty)empty.hidden=shown>0;
    });
  }
