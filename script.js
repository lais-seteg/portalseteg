/* ══════════════════════════════════════════════════════════════════════
   PORTAL SETEG · comportamento da interface
   Sem bibliotecas: cinco blocos independentes, cada um protegido contra a
   ausência do seu elemento — se um trecho da página mudar, os outros
   seguem funcionando.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Marca que o script assumiu: só então o CSS esconde os elementos que
    // serão revelados na rolagem. Sem isto, uma falha aqui deixaria a página
    // em branco.
    document.documentElement.classList.add('js');

    // Rede de segurança: se em 3s algum elemento ainda não tiver sido
    // revelado (observer que não disparou, aba aberta em segundo plano…),
    // mostra tudo. Melhor sem animação do que invisível.
    window.setTimeout(function () {
        var presos = document.querySelectorAll('.reveal:not(.is-in)');
        for (var i = 0; i < presos.length; i++) presos[i].classList.add('is-in');
    }, 3000);

    /* ─── 1. Header: ganha traço e sombra assim que a página sai do topo ─── */
    (function header() {
        var hdr = document.getElementById('hdr');
        if (!hdr) return;
        var preso = false;
        function aoRolar() {
            var deve = window.scrollY > 8;
            if (deve !== preso) { preso = deve; hdr.classList.toggle('is-stuck', deve); }
        }
        // passive: o listener não chama preventDefault, então o navegador não
        // precisa esperar por ele para rolar.
        window.addEventListener('scroll', aoRolar, { passive: true });
        aoRolar();
    })();

    /* ─── 2. Menu mobile ─── */
    (function menu() {
        var burger = document.getElementById('burger');
        var nav    = document.getElementById('mobileNav');
        var scrim  = document.getElementById('scrim');
        var fechar = document.getElementById('mnavClose');
        if (!burger || !nav || !scrim) return;

        var aberto = false;

        function abrir() {
            aberto = true;
            nav.hidden = false; scrim.hidden = false;
            // Um quadro entre exibir e animar, senão a transição não roda.
            requestAnimationFrame(function () {
                nav.classList.add('is-open');
                scrim.classList.add('is-open');
            });
            burger.classList.add('is-open');
            burger.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            var primeiro = nav.querySelector('.mnav-link');
            if (primeiro) primeiro.focus({ preventScroll: true });
        }

        function fecha() {
            if (!aberto) return;
            aberto = false;
            nav.classList.remove('is-open');
            scrim.classList.remove('is-open');
            burger.classList.remove('is-open');
            burger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            window.setTimeout(function () {
                if (!aberto) { nav.hidden = true; scrim.hidden = true; }
            }, semMovimento ? 0 : 260);
        }

        burger.addEventListener('click', function () { aberto ? fecha() : abrir(); });
        scrim.addEventListener('click', fecha);
        if (fechar) fechar.addEventListener('click', function () { fecha(); burger.focus(); });
        nav.addEventListener('click', function (e) { if (e.target.closest('a')) fecha(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && aberto) { fecha(); burger.focus(); } });
        // Ao voltar para o desktop o painel não pode ficar preso aberto.
        window.addEventListener('resize', function () { if (window.innerWidth > 900) fecha(); });
    })();

    /* ─── 3. Entrada dos elementos + contagem dos indicadores ───
       Um observer só para as duas coisas: cada elemento é revelado uma vez
       e depois deixa de ser observado. */
    (function entrada() {
        var alvos = document.querySelectorAll('.reveal, [data-count]');
        if (!alvos.length) return;

        function contar(el) {
            var destino = parseInt(el.getAttribute('data-count'), 10);
            if (isNaN(destino)) return;
            var doisDigitos = function (n) { return n < 10 ? '0' + n : String(n); };
            if (semMovimento) { el.textContent = doisDigitos(destino); return; }
            var inicio = null, dur = 900;
            function passo(ts) {
                if (inicio === null) inicio = ts;
                var p = Math.min((ts - inicio) / dur, 1);
                // desaceleração no fim, para o número "assentar"
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = doisDigitos(Math.round(destino * eased));
                if (p < 1) requestAnimationFrame(passo);
            }
            requestAnimationFrame(passo);
        }

        if (!('IntersectionObserver' in window)) {
            alvos.forEach(function (el) {
                el.classList.add('is-in');
                var n = el.hasAttribute('data-count') ? el : el.querySelector('[data-count]');
                if (n) contar(n);
            });
            return;
        }

        var obs = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (e) {
                if (!e.isIntersecting) return;
                var el = e.target;
                el.classList.add('is-in');
                var n = el.hasAttribute('data-count') ? el : el.querySelector('[data-count]');
                if (n && !n.dataset.done) { n.dataset.done = '1'; contar(n); }
                obs.unobserve(el);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        alvos.forEach(function (el, i) {
            // Escalona levemente os cards de uma mesma faixa.
            if (!semMovimento) el.style.transitionDelay = (i % 4) * 60 + 'ms';
            obs.observe(el);
        });
    })();

    /* ─── 4. Scroll-spy: marca no menu a seção que está sendo lida ─── */
    (function spy() {
        var links = document.querySelectorAll('[data-spy]');
        if (!links.length || !('IntersectionObserver' in window)) return;

        var secoes = [];
        links.forEach(function (l) {
            var s = document.getElementById(l.getAttribute('data-spy'));
            if (s && secoes.indexOf(s) === -1) secoes.push(s);
        });
        if (!secoes.length) return;

        var atual = '';
        function marcar(id) {
            if (id === atual) return;
            atual = id;
            links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('data-spy') === id); });
        }

        var obs = new IntersectionObserver(function (entradas) {
            // Entre as seções visíveis, vale a que estiver mais acima.
            var visiveis = entradas.filter(function (e) { return e.isIntersecting; });
            if (!visiveis.length) return;
            visiveis.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
            marcar(visiveis[0].target.id);
        }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

        secoes.forEach(function (s) { obs.observe(s); });
    })();

})();
