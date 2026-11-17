/*
 * Event Village — script commun des maquettes (design phase 0). Aucun appel réseau.
 *  - Bascules : ?theme=clair|sombre, ?boutons=a|b, ?capture=1 (masque la barre d'outils, fige les animations) ;
 *    sans paramètre, le thème suit le téléphone.
 *  - EV.toast(...) : le système unique de retours (règle de direction.md, section 6).
 */
(function () {
  'use strict';
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);

  function appliquerTheme(t) {
    if (t === 'sombre' || t === 'dark') html.setAttribute('data-theme', 'dark');
    else if (t === 'clair' || t === 'light') html.setAttribute('data-theme', 'light');
    else html.removeAttribute('data-theme');
  }
  function appliquerBoutons(b) { html.setAttribute('data-btn', b === 'b' ? 'b' : 'a'); }
  appliquerTheme(params.get('theme'));
  appliquerBoutons(params.get('boutons'));
  if (params.get('capture') === '1') html.setAttribute('data-capture', '');

  function themeActuel() {
    var t = html.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ── Barre d'outils de la maquette (hors application) ──────────────────────
  function barre() {
    if (html.hasAttribute('data-capture')) return;
    var bar = document.createElement('div');
    bar.className = 'proto-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Réglages de la maquette');
    function bouton(libelle, actif, action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = libelle;
      b.setAttribute('aria-pressed', String(actif()));
      b.addEventListener('click', function () { action(); maj(); });
      bar.appendChild(b);
      return { el: b, actif: actif };
    }
    var titre1 = document.createElement('span'); titre1.textContent = 'Thème'; bar.appendChild(titre1);
    var boutons = [
      bouton('Clair', function () { return themeActuel() === 'light'; }, function () { appliquerTheme('clair'); }),
      bouton('Sombre', function () { return themeActuel() === 'dark'; }, function () { appliquerTheme('sombre'); }),
    ];
    var titre2 = document.createElement('span'); titre2.textContent = 'Boutons'; bar.appendChild(titre2);
    boutons.push(
      bouton('A', function () { return html.getAttribute('data-btn') === 'a'; }, function () { appliquerBoutons('a'); }),
      bouton('B', function () { return html.getAttribute('data-btn') === 'b'; }, function () { appliquerBoutons('b'); })
    );
    function maj() {
      boutons.forEach(function (x) { x.el.setAttribute('aria-pressed', String(x.actif())); });
      var u = new URL(location.href);
      u.searchParams.set('theme', themeActuel() === 'dark' ? 'sombre' : 'clair');
      u.searchParams.set('boutons', html.getAttribute('data-btn'));
      history.replaceState(null, '', u);
    }
    document.body.appendChild(bar);
  }

  // ── Toasts : un seul système, trois au plus ───────────────────────────────
  var ICONES = {
    success: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    error: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.6v.1"/></svg>',
    info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.4v.1"/></svg>',
  };
  var FERMER = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function region() {
    var r = document.querySelector('.toast-region');
    if (r) return r;
    r = document.createElement('section');
    r.className = 'toast-region';
    r.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(r);
    return r;
  }

  /**
   * EV.toast({ type: 'success' | 'error' | 'info', titre, texte, action: { libelle, fn }, duree })
   *  - success : se ferme seul (4 s, mis en pause au survol ou au focus) ;
   *  - error   : reste jusqu'à ce qu'on le ferme ou qu'on clique « Réessayer » ;
   *  - action « Annuler » : 6 s pour changer d'avis.
   */
  function toast(o) {
    var r = region();
    while (r.children.length >= 3) r.removeChild(r.firstElementChild); // trois au plus : le plus ancien part
    var t = document.createElement('div');
    var type = o.type || 'success';
    t.className = 'toast toast-' + type;
    // Réussite et information : annoncées poliment ; erreur : tout de suite.
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.setAttribute('aria-atomic', 'true');
    var duree = o.duree != null ? o.duree : type === 'error' ? 0 : o.action ? 6000 : 4000;
    t.innerHTML =
      '<span class="toast-icon">' + (ICONES[type] || ICONES.info) + '</span>' +
      '<div><p class="toast-title"></p><p class="toast-text"></p><div class="toast-actions"></div></div>' +
      '<button type="button" class="toast-close" aria-label="Fermer la notification">' + FERMER + '</button>' +
      (duree ? '<div class="toast-timer" aria-hidden="true"><span style="animation-duration:' + duree + 'ms;animation-play-state:paused"></span></div>' : '');
    t.querySelector('.toast-title').textContent = o.titre || '';
    t.querySelector('.toast-text').textContent = o.texte || '';
    var actions = t.querySelector('.toast-actions');
    if (o.action) {
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'btn ' + (type === 'error' ? 'btn-primary' : 'btn-secondary');
      a.textContent = o.action.libelle;
      a.addEventListener('click', function () { partir(); if (o.action.fn) o.action.fn(); });
      actions.appendChild(a);
    } else actions.remove();
    var minuterie = null;
    var reste = duree;
    var debut = 0;
    function lancer() {
      if (!duree || html.hasAttribute('data-capture')) return;
      debut = Date.now();
      minuterie = setTimeout(partir, reste);
      var barreTemps = t.querySelector('.toast-timer span');
      if (barreTemps) barreTemps.style.animationPlayState = 'running';
    }
    function pause() {
      if (!minuterie) return;
      clearTimeout(minuterie); minuterie = null; reste -= Date.now() - debut;
      var barreTemps = t.querySelector('.toast-timer span');
      if (barreTemps) barreTemps.style.animationPlayState = 'paused';
    }
    function partir() {
      clearTimeout(minuterie);
      t.setAttribute('data-leaving', '');
      setTimeout(function () { t.remove(); }, 160);
    }
    t.addEventListener('mouseenter', pause);
    t.addEventListener('mouseleave', lancer);
    t.addEventListener('focusin', pause);
    t.addEventListener('focusout', lancer);
    t.querySelector('.toast-close').addEventListener('click', partir);
    r.appendChild(t);
    lancer();
    return { fermer: partir };
  }

  window.EV = { toast: toast, theme: themeActuel };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', barre);
  else barre();
})();
