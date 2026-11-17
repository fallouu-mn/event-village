/*
 * Event Village — script commun des maquettes (design phase 0). Aucun appel réseau.
 *  - Thème (décision du 17/11/2026) : celui du téléphone par défaut ; le choix « Clair » ou « Sombre » est mémorisé
 *    (localStorage « ev-theme » : system | light | dark, comme l'application). ?theme=clair|sombre l'impose pour une
 *    capture ; ?capture=1 masque la barre d'outils et fige les toasts.
 *  - Boutons : B (orange profond) en clair, A (orange vif) en sombre : plus de bascule, c'est décidé.
 *  - EV.toast(...) : le système unique de retours (règle de direction.md, section 6).
 */
(function () {
  'use strict';
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);
  var CLE = 'ev-theme';

  function lire() { try { return localStorage.getItem(CLE); } catch (e) { return null; } }
  function ecrire(v) { try { localStorage.setItem(CLE, v); } catch (e) { /* navigation privée : le choix vaut pour la page */ } }
  function appliquer(choix) {
    if (choix === 'dark') html.setAttribute('data-theme', 'dark');
    else if (choix === 'light') html.setAttribute('data-theme', 'light');
    else html.removeAttribute('data-theme'); // system : suit le téléphone (prefers-color-scheme)
  }
  var impose = params.get('theme');
  appliquer(impose === 'sombre' ? 'dark' : impose === 'clair' ? 'light' : lire() || 'system');
  if (params.get('capture') === '1') html.setAttribute('data-capture', '');

  function themeActuel() {
    var t = html.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ── Barre d'outils de la maquette (hors application) : Système, Clair, Sombre ──
  function barre() {
    if (html.hasAttribute('data-capture')) return;
    var bar = document.createElement('div');
    bar.className = 'proto-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Thème');
    var titre = document.createElement('span'); titre.textContent = 'Thème'; bar.appendChild(titre);
    var choix = [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']];
    var boutons = choix.map(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = c[1];
      b.addEventListener('click', function () { ecrire(c[0]); appliquer(c[0]); maj(); });
      bar.appendChild(b);
      return { el: b, v: c[0] };
    });
    function maj() {
      var courant = impose ? (impose === 'sombre' ? 'dark' : 'light') : lire() || 'system';
      if (html.getAttribute('data-theme') !== (courant === 'system' ? null : courant)) courant = html.getAttribute('data-theme') || 'system';
      boutons.forEach(function (x) { x.el.setAttribute('aria-pressed', String(x.v === courant)); });
    }
    maj();
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
