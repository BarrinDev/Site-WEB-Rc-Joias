/* RC Joias · compra de ouro e cautelas
   Cenas presas (pin) com scrub: GSAP + ScrollTrigger, rolagem suave com Lenis e texto por palavra com SplitType.
   Só transform, opacity e clip-path são animados. Nas timelines com scrub, sempre fromTo/to (nunca from),
   para o estado inicial não se perder quando o ScrollTrigger recalcula. */
(() => {
  'use strict';

  const raiz = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const virgula = (n, casas) => n.toFixed(casas).replace('.', ',');

  const CENAS = ['inicio', 'avaliacao', 'compramos', 'cautela', 'domicilio', 'perguntas', 'contato'];
  // ao pular para uma cena, parar onde ela já está montada (fração da cena)
  const POUSO = { inicio: 0, avaliacao: 0.12, compramos: 0.14, cautela: 0.12, domicilio: 0.1, perguntas: 0.12, contato: 0.9 };
  // a caneta escreve da esquerda para a direita
  const PENA0 = { clipPath: 'inset(-20% 100% -30% -4%)' };
  const PENA1 = { clipPath: 'inset(-20% -4% -30% -4%)' };

  const temLibs = window.gsap && window.ScrollTrigger && window.Lenis && window.SplitType;
  let lenis = null;

  menu();
  $$('.regua a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); vaiPara(a.hash.slice(1)); }));

  if (!raiz.classList.contains('motion') || !temLibs) {
    raiz.classList.remove('motion', 'carregando');
    raiz.classList.add('js-ok');
    atualSemMovimento();
    return;
  }
  raiz.classList.add('js-ok');

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  prepara();

  const mm = gsap.matchMedia();
  mm.add({ cel: '(max-width: 899px)', desk: '(min-width: 900px)' }, (ctx) => {
    const { cel } = ctx.conditions;
    [abertura, avaliacao, compramos, cautela, domicilio, perguntas, contato].forEach((cenaFn) => cenaFn(cel));
  });

  regua();
  preloader(() => {
    raiz.classList.remove('carregando');
    lenis.start();
    ScrollTrigger.refresh();
    entradaAbertura();
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());

  /* ---------- preparação ---------- */

  function prepara() {
    $$('[data-split]').forEach((el) => new SplitType(el, { types: 'words', tagName: 'span' }));
    // palavras que deslizam precisam de máscara
    $$('.cp-titulo .word, .cp-lead .word, .ct-titulo .word, .pq-titulo .word').forEach((w) => {
      const m = document.createElement('span');
      m.className = 'mascara';
      w.parentNode.insertBefore(m, w);
      m.appendChild(w);
    });
    // marcador de pergunta ativa
    $$('.pq-q').forEach((q) => {
      const m = document.createElement('span');
      m.className = 'pq-marca';
      m.setAttribute('aria-hidden', 'true');
      q.prepend(m);
    });
    // visores começam zerados; o título da abertura entra depois do preloader
    $$('.ab-visor .visor-num, .leitor-num').forEach((n) => { n.textContent = '0,00'; });
    gsap.set('.ab-visor .visor-ok, .leitor .visor-ok', { opacity: 0 });
    gsap.set('.ab-titulo .word, .ab-lead, .ab-dica', { opacity: 0 });
  }

  function entradaAbertura() {
    gsap.timeline()
      // como letra carimbada: cada palavra aparece de uma vez
      .to('.ab-titulo .word', { opacity: 1, duration: 0.01, stagger: 0.07 })
      .to('.ab-lead, .ab-dica', { opacity: 1, duration: 0.6, stagger: 0.15 }, '+=0.1');
  }

  /* ---------- utilidades ---------- */

  // posição de um elemento dentro de outro, ignorando transformações (offset)
  function posEm(el, ate) {
    let x = 0, y = 0, n = el;
    while (n && n !== ate) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y };
  }

  function cena(el, fim, extra) {
    return gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: Object.assign({
        id: el.id, trigger: el, start: 'top top', end: fim,
        pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
      }, extra || {}),
    });
  }

  // se o conteúdo não couber na tela (celular baixo), a cena desliza para mostrar o resto
  function panorama(tl, el, conteudo, inicio, duracao) {
    tl.fromTo(conteudo, { y: 0 }, { y: () => -Math.max(0, conteudo.scrollHeight - el.clientHeight), duration: duracao }, inicio);
  }

  function vaiPara(id) {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    const foca = () => { alvo.setAttribute('tabindex', '-1'); alvo.focus({ preventScroll: true }); };
    if (!lenis) { alvo.scrollIntoView(); foca(); return; }
    const st = ScrollTrigger.getById(id);
    const y = st ? st.start + (st.end - st.start) * (POUSO[id] || 0) + 1 : alvo;
    lenis.scrollTo(y, { duration: 1.4, onComplete: foca });
  }

  /* ---------- menu: índice com "você está aqui" ---------- */

  function menu() {
    const botao = $('.menu-botao'), painel = $('#indice'), fechar = $('.indice-fechar');
    const fora = [$('main'), $('.topo'), $('.regua'), $('.wa')];
    const anima = () => window.gsap && raiz.classList.contains('motion');
    let aberto = false;

    function abre() {
      aberto = true;
      painel.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
      fora.forEach((el) => { if (el) el.inert = true; });
      if (lenis) lenis.stop();
      // a folha do índice desce como papel saindo da impressora
      if (anima()) gsap.fromTo(painel, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power3.inOut' });
      ($('[aria-current="location"]', painel) || $('.indice-lista a', painel)).focus();
      document.addEventListener('keydown', teclas);
    }

    function fecha(depois) {
      if (!aberto) return;
      aberto = false;
      document.removeEventListener('keydown', teclas);
      fora.forEach((el) => { if (el) el.inert = false; });
      botao.setAttribute('aria-expanded', 'false');
      const fim = () => {
        painel.hidden = true;
        if (lenis) lenis.start();
        if (depois) depois(); else botao.focus();
      };
      if (anima()) gsap.to(painel, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.4, ease: 'power3.in', onComplete: fim });
      else fim();
    }

    function teclas(e) {
      if (e.key === 'Escape') { fecha(); return; }
      if (e.key !== 'Tab') return;
      const focaveis = $$('a, button', painel);
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }

    botao.addEventListener('click', abre);
    fechar.addEventListener('click', () => fecha());
    $$('.indice-lista a', painel).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      fecha(() => vaiPara(a.hash.slice(1)));
    }));
  }

  function marcaAtual(i) {
    $$('.indice-lista a').forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    $$('.regua a').forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
  }

  function atualSemMovimento() {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => { if (en.isIntersecting) marcaAtual(CENAS.indexOf(en.target.id)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    CENAS.forEach((id) => io.observe(document.getElementById(id)));
  }

  /* ---------- régua: marcas nas cenas e ponteiro do progresso ---------- */

  function regua() {
    const nav = $('.regua'), marcas = $$('.regua li');
    let atual = -1;
    function posiciona() {
      const max = ScrollTrigger.maxScroll(window) || 1;
      CENAS.forEach((id, i) => {
        const st = ScrollTrigger.getById(id);
        if (st) marcas[i].style.setProperty('--pos', Math.min(1, st.start / max).toFixed(4));
      });
      atualiza();
    }
    function atualiza() {
      const y = lenis.scroll, max = ScrollTrigger.maxScroll(window) || 1;
      nav.style.setProperty('--p', Math.min(1, Math.max(0, y / max)).toFixed(4));
      let agora = 0;
      CENAS.forEach((id, i) => {
        const st = ScrollTrigger.getById(id);
        if (st && y >= st.start - window.innerHeight * 0.5) agora = i;
      });
      if (agora === atual) return;
      atual = agora;
      marcaAtual(atual);
      raiz.classList.toggle('na-final', CENAS[atual] === 'contato');
    }
    lenis.on('scroll', atualiza);
    ScrollTrigger.addEventListener('refresh', posiciona);
  }

  /* ---------- preloader: o visor conta o carregamento real, zera e vai para a balança ---------- */

  function preloader(pronto) {
    const pl = $('.preloader'), fundo = $('.pl-fundo', pl), visor = $('.pl-visor', pl);
    const num = $('.visor-num', visor), un = $('.visor-un', visor), estado = $('.pl-estado', pl);
    const alvo = $('.ab-visor');
    const tarefas = [
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((ok) => { if (document.readyState === 'complete') ok(); else window.addEventListener('load', ok, { once: true }); }),
    ];
    const carga = { p: 0 };
    let feitas = 0, saiu = false;
    const avanca = (v) => gsap.to(carga, {
      p: v, duration: 0.8, ease: 'power2.out', overwrite: true,
      onUpdate: () => { num.textContent = virgula(carga.p * 100, 2); },
      onComplete: () => { if (v >= 1) sai(); },
    });
    tarefas.forEach((t) => t.then(() => { feitas += 1; avanca(feitas / tarefas.length); }));
    setTimeout(() => avanca(1), 7000);

    function sai() {
      if (saiu) return;
      saiu = true;
      gsap.timeline({ onComplete: () => { pl.remove(); pronto(); } })
        .call(() => { num.textContent = '- - - -'; estado.textContent = 'tara'; }, null, 0.3)
        .call(() => { num.textContent = '0,00'; un.textContent = 'g'; }, null, 0.75)
        .to(estado, { opacity: 0, duration: 0.3 }, 0.9)
        // o visor encolhe e se encaixa no visor da balança desenhada
        .to(visor, {
          x: () => alvo.getBoundingClientRect().left - visor.getBoundingClientRect().left,
          y: () => alvo.getBoundingClientRect().top - visor.getBoundingClientRect().top,
          scale: () => alvo.getBoundingClientRect().width / visor.getBoundingClientRect().width,
          transformOrigin: '0 0', duration: 1, ease: 'power3.inOut',
        }, 1.0)
        .to(fundo, { opacity: 0, duration: 0.7, ease: 'power1.inOut' }, 1.15);
    }
  }

  /* ---------- 1. Abertura: a corrente pousa no prato; na saída, a câmera mergulha no prato ---------- */

  function abertura(cel) {
    const el = $('#inicio');
    const texto = $('.ab-texto', el), balanca = $('.ab-balanca', el);
    const corrente = $('.bl-corrente', el), prato = $('.bl-prato', el);
    const num = $('.ab-visor .visor-num', el), ok = $('.ab-visor .visor-ok', el), legenda = $('.ab-legenda', el);
    const mergulho = $('.ab-mergulho', el);
    const peso = { g: 0 };
    // centro e raios do prato na tela, pelo desenho (viewBox 520 × 460, prato em 260,226)
    const noPrato = () => {
      const k = balanca.clientWidth / 520, o = posEm(balanca, el);
      return { x: o.x + 260 * k, y: o.y + 226 * k, rx: 124 * k, ry: 27 * k };
    };
    const elipse = (aberta) => {
      const p = noPrato();
      const R = Math.hypot(el.clientWidth, el.clientHeight) * 1.1;
      // nasce de um ponto no centro do prato (se nascesse do tamanho do prato, cobriria a corrente)
      return aberta ? `ellipse(${R}px ${R}px at ${p.x}px ${p.y}px)` : `ellipse(0px 0px at ${p.x}px ${p.y}px)`;
    };

    const tl = cena(el, cel ? '+=150%' : '+=170%');
    tl.fromTo(corrente, { y: -640, rotation: -6, transformOrigin: '50% 50%' }, { y: 0, rotation: 0, duration: 3, ease: 'power2.out' }, 0)
      .fromTo(prato, { y: 0 }, { y: 3, duration: 0.25, ease: 'power1.out' }, 2.75)
      .to(prato, { y: 0, duration: 0.4, ease: 'power1.inOut' }, 3.0)
      .fromTo(peso, { g: 0 }, { g: 4.82, duration: 1.1, ease: 'power2.out', onUpdate: () => { num.textContent = virgula(peso.g, 2); } }, 2.8)
      .fromTo([ok, legenda], { opacity: 0 }, { opacity: 1, duration: 0.3 }, 3.9)
      .to({}, { duration: 0.8 })
      .addLabel('mergulho')
      .to(texto, { opacity: 0, duration: 0.6 }, 'mergulho')
      .fromTo(mergulho, { clipPath: () => elipse(false) }, { clipPath: () => elipse(true), duration: 1.8, ease: 'power2.in' }, 'mergulho')
      .fromTo(balanca, { scale: 1 }, {
        scale: 1.8, duration: 1.8, ease: 'power2.in',
        transformOrigin: () => { const k = balanca.clientWidth / 520; return `${260 * k}px ${226 * k}px`; },
      }, 'mergulho');
  }

  /* ---------- 2. Como avaliamos: a ficha se preenche e os números voam até a conta ---------- */

  function avaliacao(cel) {
    const el = $('#avaliacao'), folha = $('.av-folha', el);
    const [p1, p2, p3] = $$('.av-passo', el);
    const quilates = $('.quilates', el), itens = $$('.q-item', el), amostras = $$('.q-amostra', el), ponteiro = $('.q-ponteiro', el);
    const qValor = $('.q-valor', el), qTeor = $('.q-teor', el);
    const leitor = $('.leitor', el), leitorNum = $('.leitor-num', el), leitorOk = $('.leitor .visor-ok', el);
    const cPeso = $('.c-peso', el), cTeor = $('.c-teor', el), cPuro = $('.c-puro', el), cTxt = $('.c-txt', el);
    const [linha1, linha2] = $$('.conta-linha', el);
    const ops1 = $$('.c-op', linha1), resto2 = [...linha2.children];
    const carimbo = $('.carimbo', el);
    const peso = { g: 0 };
    // o CSS deixa o ponteiro no centro do 18k (62,5%); estes são os desvios até cada amostra
    const centro = (i) => itens[i].offsetLeft + itens[i].offsetWidth / 2 - quilates.clientWidth * 0.625;
    // distância de onde o número está até o lugar dele na conta
    const voo = (de, para) => { const a = posEm(de, el), b = posEm(para, el); return { x: a.x - b.x, y: a.y - b.y }; };
    const partes = (p) => ({ titulo: $('.av-passo-titulo', p), txt: $$('.av-txt .word', p) });

    const tl = cena(el, '+=320%');
    // a folha sai da impressora, de cima para baixo
    tl.fromTo(folha, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power2.out' }, 0)
      .fromTo($$('.av-titulo .word', el), PENA0, { ...PENA1, duration: 0.4, stagger: 0.08 }, 0.5)
      .fromTo($$('.av-sub, .av-ref', el), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.8);

    // passo 1: teste do quilate
    const a = partes(p1);
    tl.fromTo(a.titulo, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.2)
      .fromTo(a.txt, PENA0, { ...PENA1, duration: 0.25, stagger: 0.03 }, 1.3)
      .fromTo($('.av-metodo', p1), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.8)
      .fromTo(amostras, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4, stagger: 0.1 }, 1.9)
      .fromTo($$('.q-k, .q-pc', p1), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.03 }, 2.1)
      .fromTo(ponteiro, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 2.3)
      .fromTo(ponteiro, { x: () => centro(0) }, { x: () => centro(2), duration: 0.9, ease: 'power2.inOut' }, 2.4)
      .fromTo(qValor, PENA0, { ...PENA1, duration: 0.4 }, 3.2)
      .fromTo(cTeor, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 3.5)
      .fromTo(cTeor, { x: () => voo(qTeor, cTeor).x, y: () => voo(qTeor, cTeor).y }, { x: 0, y: 0, duration: 0.9, ease: 'power2.inOut' }, 3.5);

    // passo 2: pesagem
    const b = partes(p2);
    tl.fromTo(b.titulo, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 3.8)
      .fromTo(b.txt, PENA0, { ...PENA1, duration: 0.25, stagger: 0.03 }, 3.9)
      .fromTo(leitor, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4 }, 4.3)
      .fromTo(peso, { g: 0 }, { g: 4.82, duration: 1, ease: 'power2.out', onUpdate: () => { leitorNum.textContent = virgula(peso.g, 2); } }, 4.6)
      .fromTo(leitorOk, { opacity: 0 }, { opacity: 1, duration: 0.15 }, 5.6)
      .fromTo(cPeso, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 5.8)
      .fromTo(cPeso, { x: () => voo(leitorNum, cPeso).x, y: () => voo(leitorNum, cPeso).y }, { x: 0, y: 0, duration: 0.9, ease: 'power2.inOut' }, 5.8);

    // passo 3: a conta se completa na frente do cliente
    const c = partes(p3);
    tl.fromTo(c.titulo, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 6.6)
      .fromTo(c.txt, PENA0, { ...PENA1, duration: 0.25, stagger: 0.03 }, 6.7)
      .fromTo(ops1[0], { opacity: 0 }, { opacity: 1, duration: 0.15 }, 6.9)
      .fromTo(ops1[1], { opacity: 0 }, { opacity: 1, duration: 0.15 }, 7.2)
      .fromTo(cPuro, PENA0, { ...PENA1, duration: 0.5 }, 7.35)
      .fromTo($('.av-nota', p3), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 7.4)
      .fromTo(cTxt, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 7.8)
      .fromTo(resto2, PENA0, { ...PENA1, duration: 0.35, stagger: 0.25 }, 8.1)
      .fromTo(carimbo, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.in' }, 9.4)
      .to({}, { duration: 0.8 })
      // saída: a folha é puxada para cima, como de uma prancheta
      .to(folha, { yPercent: -118, rotation: -3, transformOrigin: '50% 0%', duration: 1.4, ease: 'power2.in' });

    // no celular, um passo por tela: as páginas da ficha passam para o lado
    if (cel) {
      tl.fromTo(p1, { xPercent: 0 }, { xPercent: -105, duration: 0.5, ease: 'power2.inOut' }, 3.7)
        .fromTo(p2, { xPercent: 105 }, { xPercent: 0, duration: 0.5, ease: 'power2.inOut' }, 3.7)
        .fromTo(p2, { xPercent: 0 }, { xPercent: -105, duration: 0.5, ease: 'power2.inOut', immediateRender: false }, 6.4)
        .fromTo(p3, { xPercent: 105 }, { xPercent: 0, duration: 0.5, ease: 'power2.inOut' }, 6.4);
    }
  }

  /* ---------- 3. O que compramos: a etiqueta desce no fio e vira para a próxima ---------- */

  function compramos() {
    const el = $('#compramos');
    const tags = $$('.etiqueta', el), fio = $('.cp-fio', el);
    const marcador = $('.cp-marcador', el), itens = $$('.cp-indice li', el);
    const [cima, baixo] = $$('.cp-placa', el);
    const n = tags.length;
    gsap.set(itens, { opacity: 0.65 });
    gsap.set(itens[0], { opacity: 1 });

    const tl = cena(el, `+=${70 + n * 45}%`);
    tl.fromTo($$('.cp-titulo .word', el), { xPercent: 105 }, { xPercent: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out' }, 0)
      .fromTo($$('.cp-lead .word', el), { xPercent: 105 }, { xPercent: 0, duration: 0.5, stagger: 0.02, ease: 'power3.out' }, 0.2)
      .fromTo(fio, { scaleY: 0, transformOrigin: '50% 0%' }, { scaleY: 1, duration: 0.5 }, 0.2)
      .fromTo(tags[0], { yPercent: -140, rotation: 8 }, { yPercent: 0, rotation: 0, duration: 0.9, ease: 'power2.out' }, 0.3)
      .to(tags[0], { rotation: -2, duration: 0.25, ease: 'sine.inOut' }, 1.2)
      .to(tags[0], { rotation: 0, duration: 0.25, ease: 'sine.inOut' }, 1.45);

    tags.slice(1).forEach((tag, i) => {
      const t = 1.9 + i * 1.3;
      tl.fromTo(tags[i], { rotationY: 0 }, { rotationY: 90, duration: 0.45, ease: 'power1.in', immediateRender: false }, t)
        .fromTo(tag, { rotationY: -90 }, { rotationY: 0, duration: 0.45, ease: 'power1.out' }, t + 0.45)
        .to(marcador, { y: () => itens[i + 1].offsetTop - itens[0].offsetTop, duration: 0.6, ease: 'power2.inOut' }, t + 0.2)
        .to(itens[i], { opacity: 0.65, duration: 0.3 }, t + 0.2)
        .to(itens[i + 1], { opacity: 1, duration: 0.3 }, t + 0.5);
    });

    // saída: duas placas fecham a tela e se encontram no picote
    tl.to({}, { duration: 0.5 }, 1.9 + (n - 1) * 1.3 + 0.9)
      .fromTo(cima, { yPercent: -101 }, { yPercent: 0, duration: 1, ease: 'power2.in' })
      .fromTo(baixo, { yPercent: 101 }, { yPercent: 0, duration: 1, ease: 'power2.in' }, '<');
  }

  /* ---------- 4. Cautela da Caixa: a linha do tempo avança e o valor se divide ---------- */

  function cautela(cel) {
    const el = $('#cautela'), conteudo = $('.ct-conteudo', el);
    const progresso = $('.ct-progresso', el), marcos = $$('.ct-marco', el);
    const total = $('.ct-total', el), caixa = $('.ct-caixa', el), voce = $('.ct-voce', el);
    const eixo = cel ? 'scaleY' : 'scaleX';

    const tl = cena(el, '+=240%');
    tl.fromTo($$('.ct-titulo .word', el), { yPercent: 105 }, { yPercent: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, 0)
      .fromTo($('.ct-lead', el), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.3);

    marcos.forEach((m, i) => {
      const t = 0.9 + i * 1.0;
      tl.fromTo(progresso, { [eixo]: i / 3 }, { [eixo]: (i + 1) / 3, duration: 0.7, ease: 'power1.inOut' }, t)
        .fromTo($('.ct-n', m), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, t + 0.35)
        .fromTo($$('h3, p', m), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.12 }, t + 0.5);
    });

    tl.fromTo([$('.ct-barra-titulo', el), total], { opacity: 0 }, { opacity: 1, duration: 0.3 }, 4.0)
      .fromTo(caixa, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power2.inOut' }, 4.2)
      .fromTo(voce, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power2.inOut' }, 4.9)
      .fromTo($$('.ct-nota, .ct-acao', el), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.2 }, 5.5)
      .to({}, { duration: 0.7 })
      // saída: a câmera recua e a cena se afasta no escuro
      .to(conteudo, { scale: 0.55, opacity: 0, transformOrigin: '50% 50%', duration: 1.3, ease: 'power2.in' });
    panorama(tl, el, conteudo, 0.6, 5.2);
  }

  /* ---------- 5. A domicílio: as regiões acendem no mapa (no celular, na lista) ---------- */

  function domicilio() {
    const el = $('#domicilio'), grade = $('.dm-grade', el), num = $('.dm-num', el);
    const pontos = $$('.mp-ponto', el), itens = $$('.dm-lista li', el), faixas = $$('.dm-pauta i', el);
    const passo = 0.35, inicio = 0.8;
    const conta = { v: 0 };
    gsap.set(faixas, { scaleX: 0 });

    const tl = cena(el, '+=220%');
    tl.fromTo($$('.dm-titulo .word', el), { scale: 0.6, opacity: 0, transformOrigin: '0% 100%' }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(1.6)' }, 0)
      .fromTo($$('.dm-lead, .dm-contador', el), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.15 }, 0.3)
      .fromTo(conta, { v: 0 }, { v: pontos.length, duration: pontos.length * passo, onUpdate: () => { num.textContent = Math.ceil(conta.v - 0.001); } }, inicio);

    pontos.forEach((p, i) => {
      const t = inicio + i * passo;
      const halo = $('.mp-halo', p);
      tl.fromTo($('.mp-luz', p), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.2, ease: 'back.out(2)' }, t)
        .fromTo(halo, { opacity: 0 }, { opacity: 0.9, duration: 0.01 }, t)
        .fromTo(halo, { scale: 1, transformOrigin: '50% 50%' }, { scale: 3.2, duration: 0.5, ease: 'power1.out' }, t)
        .to(halo, { opacity: 0, duration: 0.49 }, t + 0.01)
        .fromTo($('.mp-nome', p), { opacity: 0.35 }, { opacity: 1, duration: 0.2 }, t);
    });
    itens.forEach((li, i) => {
      const t = inicio + i * passo;
      tl.fromTo(li, { opacity: 0.35 }, { opacity: 1, duration: 0.2 }, t)
        .fromTo($('i', li), { scale: 0.3 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' }, t);
    });

    tl.fromTo($$('.dm-nota, .dm-legenda', el), { opacity: 0 }, { opacity: 1, duration: 0.4 }, inicio + pontos.length * passo)
      .to({}, { duration: 0.6 })
      // saída: linhas de pauta atravessam a tela e viram a folha das perguntas
      .to(faixas, { scaleX: 1, duration: 0.6, stagger: 0.06, ease: 'power2.inOut' });
    panorama(tl, el, grade, 0.4, 4.4);
  }

  /* ---------- 6. Perguntas: uma por vez, a resposta acende palavra por palavra ---------- */

  function perguntas(cel) {
    const el = $('#perguntas'), grade = $('.pq-grade', el), itens = $$('.pq-item', el), nivel = $('.pq-nivel', el);

    const tl = cena(el, `+=${60 + itens.length * 40}%`);
    tl.fromTo($$('.pq-titulo .word', el), { yPercent: -105 }, { yPercent: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, 0);
    if (!cel) tl.fromTo($$('.pq-q', el), { opacity: 0 }, { opacity: 0.55, duration: 0.4, stagger: 0.08 }, 0.3);

    itens.forEach((it, i) => {
      const t = 1.0 + i * 1.2;
      const q = $('.pq-q', it), a = $('.pq-a', it), palavras = $$('.pq-a .word', it);
      if (cel) {
        // celular: a pergunta seguinte cobre a anterior, de cima para baixo
        tl.fromTo(it, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4 }, t);
        if (i > 0) tl.to(itens[i - 1], { opacity: 0, duration: 0.3 }, t);
      } else {
        tl.to(q, { opacity: 1, duration: 0.25 }, t)
          .fromTo($('.pq-marca', it), { scaleX: 0 }, { scaleX: 1, duration: 0.3 }, t)
          .fromTo(a, { opacity: 0 }, { opacity: 1, duration: 0.05 }, t + 0.1);
        if (i > 0) {
          const ant = itens[i - 1];
          tl.to($('.pq-q', ant), { opacity: 0.55, duration: 0.25 }, t)
            .to($('.pq-marca', ant), { scaleX: 0, duration: 0.25 }, t)
            .to($('.pq-a', ant), { opacity: 0, duration: 0.2 }, t);
        }
      }
      tl.fromTo(palavras, { opacity: 0.15 }, { opacity: 1, duration: 0.25, stagger: 0.04 }, t + 0.2);
    });

    // saída: a tinta sobe como o nível numa proveta graduada
    tl.to({}, { duration: 0.6 })
      .fromTo(nivel, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power1.inOut' });
    panorama(tl, el, grade, 0.2, 1.0 + itens.length * 1.2);
  }

  /* ---------- 7. Contato: o convite final ---------- */

  function contato() {
    const el = $('#contato'), conteudo = $('.fi-conteudo', el);
    const tl = cena(el, '+=110%');
    tl.fromTo($$('.fi-cta-txt .word', el), { scale: 1.25, opacity: 0, transformOrigin: '0% 100%' }, { scale: 1, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 0)
      .fromTo($('.fi-cta-linha', el), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power2.inOut' }, 0.5)
      .fromTo($('.fi-sub', el), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.8)
      .fromTo($$('.fi-dados > div', el), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4, stagger: 0.08 }, 1.0)
      .fromTo($('.fi-rodape', el), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.4)
      .to({}, { duration: 0.6 });
    panorama(tl, el, conteudo, 0.5, 1.5);
  }
})();
