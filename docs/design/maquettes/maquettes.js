/*
 * Rendu commun des maquettes : icônes, cartes d'événement, affiches, fond de carte schématique de Dakar.
 * Le fond de carte est DESSINÉ (aucune tuile, aucun appel réseau) ; il n'est pas à l'échelle.
 */
(function () {
  'use strict';
  var D = window.EVD;

  document.querySelectorAll('[data-icone]').forEach(function (el) {
    el.outerHTML = D.icone(el.getAttribute('data-icone'), el.getAttribute('data-taille') || 'icon');
  });
  document.querySelectorAll('[data-cartes]').forEach(function (el) {
    el.innerHTML = el.getAttribute('data-cartes').split(',').map(function (i) { return D.carte(D.evenements[Number(i)], 'c' + i); }).join('');
  });
  // Rangée « À la une » : la première carte, plus grande, porte le seul grand bouton de la page. Le défilement est en CSS.
  document.querySelectorAll('[data-une]').forEach(function (el) {
    el.innerHTML = el.getAttribute('data-une').split(',').map(function (i, n) {
      var e = D.evenements[Number(i)];
      if (n > 0) return '<li>' + D.carte(e, 'u' + i) + '</li>';
      return '<li class="une-grande"><article class="event-card"><div class="poster">' + D.affiche(e.affiche, 'ug') +
        (e.badge ? '<span class="badge badge-' + e.badge[0] + '">' + e.badge[1] + '</span>' : '') +
        '<span class="date-tag"><b class="num">' + e.jour + '</b><time>' + e.mois + '</time></span></div>' +
        '<div class="event-body"><h2 class="une-titre"><a href="fiche.html">' + e.titre + '</a></h2>' +
        '<p class="event-meta">' + D.icone('calendrier', 'icon-sm') + '<span>' + e.date + '</span></p>' +
        '<p class="event-meta">' + D.icone('lieu', 'icon-sm') + '<span>' + e.lieu + ', ' + e.ville + '</span></p>' +
        '<div class="une-bas"><p class="price-line" style="margin:0"><span class="lead">Dès</span>&nbsp;<span class="price">' + e.prix + '</span></p>' +
        '<a class="btn-cta" href="fiche.html">Choisir mes billets</a></div></div></article></li>';
    }).join('');
  });
  document.querySelectorAll('[data-affiche]').forEach(function (el, n) {
    el.insertAdjacentHTML('afterbegin', D.affiche(el.getAttribute('data-affiche'), 'h' + n));
  });

  /** Repère de carte (forme « Repère ») : { texte, une, groupe, bouton }. */
  function repere(o) {
    var b = document.createElement(o.bouton ? 'button' : 'span');
    if (o.bouton) b.type = 'button';
    b.className = 'marker' + (o.une ? ' marker-une' : '') + (o.groupe ? ' marker-groupe' : '');
    b.innerHTML = o.groupe
      ? '<span class="pile"></span><span class="pile"></span><span class="billet-m"><b>' + o.groupe + '</b> événements</span>'
      : o.une ? '<span class="billet-m"><span><small>À la une</small>' + o.texte + '</span></span>' : '<span class="billet-m">' + o.texte + '</span>';
    return b;
  }

  /** Fond de carte schématique de la presqu'île du Cap-Vert (repère 600 × 600). */
  function fondDakar(sombre) {
    var c = sombre
      ? { mer: '#0D1B26', merTrait: '#12283A', terre: '#1C1C1C', bord: '#2C2C2C', route: '#343434', grande: '#4A3A2E', texte: '#8C8C8C', vert: '#16261A' }
      : { mer: '#CFE8F3', merTrait: '#BCDDEB', terre: '#F5F2EC', bord: '#E2DCD0', route: '#FFFFFF', grande: '#FFD8B5', texte: '#7A7368', vert: '#DCEBD3' };
    var terre = 'M600 140C480 150 330 150 260 168C200 182 150 170 120 190C90 205 50 205 40 235C35 260 80 270 120 290C170 320 220 360 260 395C300 430 330 470 365 478C395 485 410 455 440 440C500 420 560 430 600 425Z';
    var etiquettes = [['Almadies', 74, 222], ['Ngor', 150, 214], ['Yoff', 300, 196], ['Ouakam', 168, 284], ['Mermoz', 236, 300],
      ['Fann', 262, 352], ['Médina', 330, 392], ['Plateau', 372, 440], ['Grand Yoff', 392, 262], ['Parcelles', 470, 196]];
    return '<rect width="600" height="600" fill="' + c.mer + '"/>' +
      '<g fill="none" stroke="' + c.merTrait + '" stroke-width="2"><path d="M0 120C80 110 120 130 200 118"/><path d="M0 330C60 350 90 380 150 400"/><path d="M380 560C440 540 500 560 600 540"/></g>' +
      '<path d="' + terre + '" fill="' + c.terre + '" stroke="' + c.bord + '" stroke-width="3"/>' +
      '<circle cx="112" cy="160" r="9" fill="' + c.terre + '" stroke="' + c.bord + '" stroke-width="2"/>' +
      '<ellipse cx="430" cy="522" rx="10" ry="6" fill="' + c.terre + '" stroke="' + c.bord + '" stroke-width="2"/>' +
      '<path d="M300 300C330 290 350 310 345 330C340 350 300 352 292 330Z" fill="' + c.vert + '"/>' +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M600 252C500 250 360 246 250 250S150 262 118 262" stroke="' + c.grande + '" stroke-width="9"/>' +
      '<path d="M600 336C540 340 470 372 420 410S372 450 362 462" stroke="' + c.grande + '" stroke-width="9"/>' +
      '<g stroke="' + c.route + '" stroke-width="5"><path d="M122 292C180 328 222 362 262 398S330 464 362 470"/><path d="M250 250C252 300 258 340 262 398"/>' +
      '<path d="M330 248C334 300 336 350 340 410"/><path d="M420 160C410 210 404 250 396 300"/><path d="M180 196C200 230 210 260 214 300"/></g></g>' +
      '<g font-family="Plus Jakarta Sans, Jakarta Repli, sans-serif" font-size="13" font-weight="700" fill="' + c.texte + '" text-anchor="middle">' +
      etiquettes.map(function (e) { return '<text x="' + e[1] + '" y="' + e[2] + '">' + e[0] + '</text>'; }).join('') + '</g>';
  }

  /** Pose un fond de carte dans `boite` et place ses repères (coordonnées du repère 600 × 600). */
  function carte(boite, reperes, options) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fond');
    svg.setAttribute('viewBox', options && options.vue ? options.vue : '0 0 600 600');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = fondDakar(window.EV.theme() === 'dark');
    boite.insertBefore(svg, boite.firstChild);
    function placer() {
      var ctm = svg.getScreenCTM();
      var r = boite.getBoundingClientRect();
      if (!ctm) return;
      reperes.forEach(function (m) {
        var p = svg.createSVGPoint();
        p.x = m.x; p.y = m.y;
        var q = p.matrixTransform(ctm);
        m.el.style.left = (q.x - r.left) + 'px';
        m.el.style.top = (q.y - r.top) + 'px';
      });
    }
    placer();
    addEventListener('resize', placer);
    return { placer: placer };
  }

  // Aperçu de carte de l'accueil.
  document.querySelectorAll('[data-map-teaser]').forEach(function (boite) {
    var reperes = [[250, 372, '10 000 F', true], [128, 196, '7 500 F'], [362, 452, 'Gratuit'], [296, 202, '3 000 F']].map(function (r) {
      var b = repere({ texte: r[2], une: r[3] });
      b.setAttribute('aria-hidden', 'true');
      boite.appendChild(b);
      return { x: r[0], y: r[1], el: b };
    });
    carte(boite, reperes, { vue: '40 140 440 360' });
  });

  window.EVM = { carte: carte, repere: repere };
})();
