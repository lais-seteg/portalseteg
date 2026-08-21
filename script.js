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

    /* ─── 5. Visualizador de informativos ───
       Abre o informativo de um sistema para leitura dentro do portal. Cada
       página é uma imagem em images/informativos/<sistema>-<n>.webp: não há
       arquivo do documento no servidor, então não há o que baixar.

       O que o leitor pode fazer é ler, ampliar e fechar. Os caminhos que
       levariam o documento para fora (salvar, imprimir, arrastar a imagem,
       menu de contexto) ficam bloqueados enquanto o visualizador está aberto.
       Não é uma barreira criptográfica — quem quiser fotografar a tela
       consegue; o objetivo é que a opção de download simplesmente não exista. */
    (function informativos() {
        var vw       = document.getElementById('vw');
        var scrim    = document.getElementById('vwScrim');
        var doc      = document.getElementById('vwDoc');
        var area     = document.getElementById('vwBody');
        var titulo   = document.getElementById('vwTitle');
        var contador = document.getElementById('vwCount');
        var nivel    = document.getElementById('vwLevel');
        var btFechar = document.getElementById('vwClose');
        var btMais   = document.getElementById('vwIn');
        var btMenos  = document.getElementById('vwOut');
        var gatilhos = document.querySelectorAll('[data-inf]');
        if (!vw || !scrim || !doc || !area || !gatilhos.length) return;

        var ZOOMS  = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];
        var PADRAO = 1;                 // índice de 100%
        var iZoom  = PADRAO;
        var aberto = false;
        var origem = null;              // quem abriu, para devolver o foco
        var atual  = '';                // informativo já montado

        /* ─ Zoom ─ */
        function aplicarZoom() {
            vw.style.setProperty('--vw-z', ZOOMS[iZoom]);
            if (nivel)   nivel.textContent = Math.round(ZOOMS[iZoom] * 100) + '%';
            if (btMenos) btMenos.disabled = iZoom === 0;
            if (btMais)  btMais.disabled  = iZoom === ZOOMS.length - 1;
        }
        function mudarZoom(passo) {
            var novo = Math.min(ZOOMS.length - 1, Math.max(0, iZoom + passo));
            if (novo === iZoom) return;
            iZoom = novo;
            aplicarZoom();
        }

        /* ─ Monta as páginas do documento ─ */
        function montar(slug, nome, paginas) {
            doc.textContent = '';
            for (var p = 1; p <= paginas; p++) {
                var folha = document.createElement('div');
                folha.className = 'vw-page';

                var img = document.createElement('img');
                img.src = 'images/informativos/' + slug + '-' + p + '.webp';
                img.alt = 'Informativo ' + nome + ' — página ' + p + ' de ' + paginas;
                // As medidas reais evitam que o layout salte antes do carregamento.
                img.width = 1224; img.height = 1584;
                // A primeira página é o que aparece ao abrir; as outras só
                // baixam quando chegam perto da tela.
                img.loading  = p === 1 ? 'eager' : 'lazy';
                img.decoding = 'async';
                img.draggable = false;

                folha.appendChild(img);
                doc.appendChild(folha);
            }
        }

        /* ─ "3 / 4": a página que está sendo lida ─ */
        function aoRolar() {
            if (!contador) return;
            var folhas = doc.children;
            if (!folhas.length) return;
            // offsetTop é relativo ao .vw (que é posicionado); descontar o topo
            // do documento devolve a distância dentro da área que rola.
            var base = doc.offsetTop;
            var meio = area.scrollTop + area.clientHeight * 0.4;
            var n = 1;
            for (var i = 0; i < folhas.length; i++) {
                if (folhas[i].offsetTop - base <= meio) n = i + 1;
            }
            contador.textContent = n + ' / ' + folhas.length;
        }

        /* ─ Abrir e fechar ─ */
        function abrir(gatilho) {
            var slug = gatilho.getAttribute('data-inf');
            if (!slug) return;
            var nome    = gatilho.getAttribute('data-inf-title') || 'Informativo';
            var paginas = parseInt(gatilho.getAttribute('data-inf-pages'), 10) || 1;

            origem = gatilho;
            if (titulo) titulo.textContent = nome;

            // Remonta só quando o documento muda: reabrir o mesmo informativo
            // aproveita as imagens já em cache.
            if (slug !== atual) {
                atual = slug;
                iZoom = PADRAO;
                montar(slug, nome, paginas);
                area.scrollTop = 0;
            }
            aplicarZoom();

            aberto = true;
            vw.hidden = false; scrim.hidden = false;
            // Um quadro entre exibir e animar, senão a transição não roda.
            requestAnimationFrame(function () {
                vw.classList.add('is-open');
                scrim.classList.add('is-open');
            });
            document.body.style.overflow = 'hidden';
            if (btFechar) btFechar.focus({ preventScroll: true });
            aoRolar();
        }

        function fechar() {
            if (!aberto) return;
            aberto = false;
            vw.classList.remove('is-open');
            scrim.classList.remove('is-open');
            document.body.style.overflow = '';
            window.setTimeout(function () {
                if (!aberto) { vw.hidden = true; scrim.hidden = true; }
            }, semMovimento ? 0 : 260);
            if (origem) { origem.focus({ preventScroll: true }); origem = null; }
        }

        /* ─ Ligações ─ */
        gatilhos.forEach(function (g) {
            g.addEventListener('click', function (e) {
                // No card de sistema o link "Acessar" está esticado por baixo:
                // o clique para aqui em vez de virar navegação.
                e.preventDefault();
                e.stopPropagation();
                abrir(g);
            });
        });

        scrim.addEventListener('click', fechar);
        if (btFechar) btFechar.addEventListener('click', fechar);
        if (btMais)   btMais.addEventListener('click',  function () { mudarZoom(1); });
        if (btMenos)  btMenos.addEventListener('click', function () { mudarZoom(-1); });
        area.addEventListener('scroll', aoRolar, { passive: true });

        // Nem menu de contexto, nem arrastar a página para fora do navegador.
        vw.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        vw.addEventListener('dragstart',   function (e) { e.preventDefault(); });

        document.addEventListener('keydown', function (e) {
            if (!aberto) return;

            if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
            if (e.key === '+' || e.key === '=') { e.preventDefault(); mudarZoom(1);  return; }
            if (e.key === '-' || e.key === '_') { e.preventDefault(); mudarZoom(-1); return; }

            // Salvar e imprimir são as saídas de download que o teclado ainda
            // oferece com o visualizador aberto.
            if ((e.ctrlKey || e.metaKey) &&
                (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                return;
            }

            // Foco preso: o Tab circula entre os controles do visualizador.
            if (e.key !== 'Tab') return;
            var focaveis = vw.querySelectorAll('button:not([disabled])');
            if (!focaveis.length) return;
            var primeiro = focaveis[0];
            var ultimo   = focaveis[focaveis.length - 1];
            if (e.shiftKey && document.activeElement === primeiro) {
                e.preventDefault(); ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault(); primeiro.focus();
            }
        });
    })();

})();
