/*
 * Données FICTIVES des maquettes : artistes, organisateurs et événements inventés, lieux réels du Sénégal.
 * Aucun chiffre sur la plateforme (pas de nombre de clients, de note ni de classement) : seulement ce qu'une
 * fiche d'événement afficherait. Affiches : compositions abstraites en SVG, en aplats (jamais de dégradé : décision du
 * 17/11/2026), aucune image externe.
 */
(function () {
  'use strict';

  var EVENEMENTS = [
    { id: 'sabar', titre: 'Nuit Sabar sur la Corniche', orga: 'Collectif Sabar Nuit', jour: '28', mois: 'nov.', date: 'sam. 28 nov. 2026 à 21:00',
      lieu: 'Esplanade de la Corniche Ouest', ville: 'Dakar', quartier: 'Fann', prix: '10 000 F CFA', court: '10 000 F', badge: ['warning', 'Dernières places'], affiche: 'geew', x: 44, y: 63 },
    { id: 'kora', titre: 'Kora et néons', orga: 'Ngor Sessions', jour: '04', mois: 'déc.', date: 'ven. 4 déc. 2026 à 20:00',
      lieu: 'Plage de Ngor', ville: 'Dakar', quartier: 'Ngor', prix: '7 500 F CFA', court: '7 500 F', affiche: 'kora', x: 27, y: 25 },
    { id: 'sunset', titre: 'Afro-house au coucher du soleil', orga: 'DJ Lamine K.', jour: '05', mois: 'déc.', date: 'sam. 5 déc. 2026 à 17:00',
      lieu: 'Pointe des Almadies', ville: 'Dakar', quartier: 'Almadies', prix: '5 000 F CFA', court: '5 000 F', affiche: 'coucher', x: 13, y: 36 },
    { id: 'jazz', titre: 'Jazz au bord du fleuve', orga: 'Atelier Cap-Vert', jour: '12', mois: 'déc.', date: 'sam. 12 déc. 2026 à 19:30',
      lieu: 'Quai des Arts', ville: 'Saint-Louis', quartier: 'Île de Saint-Louis', prix: '15 000 F CFA', court: '15 000 F', affiche: 'vague', x: 0, y: 0 },
    { id: 'theatre', titre: 'La Pirogue de Mère Coumba', orga: 'Sunu Scène', jour: '13', mois: 'déc.', date: 'dim. 13 déc. 2026 à 16:00',
      lieu: 'Théâtre de verdure', ville: 'Dakar', quartier: 'Plateau', prix: 'Gratuit', court: 'Gratuit', badge: ['success', 'Gratuit'], affiche: 'scene', x: 74, y: 78 },
    { id: 'marche', titre: 'Marché créatif de fin d’année', orga: 'Teranga Ateliers', jour: '19', mois: 'déc.', date: 'sam. 19 déc. 2026 à 10:00',
      lieu: 'Place du village artisanal', ville: 'Saly', quartier: 'Saly Portudal', prix: 'Gratuit', court: 'Gratuit', affiche: 'tisse', x: 58, y: 47 },
    { id: 'slam', titre: 'Slam et kora au jardin', orga: 'Collectif Kasa Slam', jour: '09', mois: 'janv.', date: 'sam. 9 janv. 2027 à 18:00',
      lieu: 'Jardin du centre culturel', ville: 'Ziguinchor', quartier: 'Escale', prix: '2 000 F CFA', court: '2 000 F', affiche: 'kora', x: 0, y: 0 },
  ];

  // ── Affiches abstraites (320 × 200, recadrées par preserveAspectRatio) ──────────────────────────────
  function affiche(style, id) {
    var g = 'g' + id;
    var debut = '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">';
    var fin = '</svg>';
    switch (style) {
      case 'geew': // cercles de points autour d'un foyer, sur un violet de nuit
        var pts = '';
        [[46, 12, 6], [74, 16, 5], [102, 20, 4]].forEach(function (r) {
          for (var i = 0; i < r[1]; i++) {
            var a = (i / r[1]) * Math.PI * 2;
            pts += '<circle cx="' + (160 + r[0] * Math.cos(a)).toFixed(1) + '" cy="' + (104 + r[0] * 0.62 * Math.sin(a)).toFixed(1) + '" r="' + r[2] + '"/>';
          }
        });
        return debut + '<rect width="320" height="200" fill="#2A1240"/><ellipse cx="160" cy="104" rx="120" ry="78" fill="#3D1A55"/><g fill="#FF8A3D" opacity="0.9">' + pts + '</g><circle cx="160" cy="104" r="20" fill="#F472B6"/>' + fin;
      case 'kora': // cordes et arc de kora, bleu nuit et néons
        var cordes = '';
        for (var k = 0; k < 11; k++) cordes += '<path d="M' + (96 + k * 13) + ' 30 L' + (128 + k * 6.5) + ' 180" stroke="' + (k % 2 ? '#38BDF8' : '#F472B6') + '" stroke-width="2.2" opacity="0.85"/>';
        return debut + '<rect width="320" height="200" fill="#13203F"/><ellipse cx="164" cy="168" rx="70" ry="34" fill="#FF8A3D" opacity="0.9"/>' + cordes +
          '<path d="M86 28 Q164 -6 240 28" fill="none" stroke="#FBBF24" stroke-width="5" stroke-linecap="round"/>' + fin;
      case 'coucher': // soleil couchant sur l'océan
        var lignes = '';
        for (var l = 0; l < 7; l++) lignes += '<rect x="' + (60 - l * 6) + '" y="' + (128 + l * 10) + '" width="' + (200 + l * 12) + '" height="4" rx="2" fill="#FFE1C7" opacity="' + (0.75 - l * 0.08).toFixed(2) + '"/>';
        return debut + '<rect width="320" height="200" fill="#E0612A"/><rect y="62" width="320" height="60" fill="#C43D5E"/><circle cx="160" cy="118" r="44" fill="#FFD9A8"/><rect y="122" width="320" height="78" fill="#3B0F5C" opacity="0.55"/>' + lignes + fin;
      case 'vague': // fleuve, vagues superposées
        var vagues = '';
        ['#0EA5E9', '#0284C7', '#075985', '#0C4A6E'].forEach(function (c, i) {
          var y = 70 + i * 32;
          vagues += '<path d="M0 ' + y + ' C 60 ' + (y - 24) + ' 110 ' + (y + 24) + ' 170 ' + y + ' S 280 ' + (y - 24) + ' 320 ' + y + ' V200 H0Z" fill="' + c + '"/>';
        });
        return debut + '<rect width="320" height="200" fill="#FDE68A"/><circle cx="246" cy="52" r="24" fill="#FB923C"/>' + vagues + fin;
      case 'scene': // rideau de scène et projecteurs
        return debut + '<rect width="320" height="200" fill="#2A0E14"/>' +
          '<path d="M0 0 H120 C 110 70 90 140 40 200 H0Z" fill="#9F1239"/><path d="M320 0 H200 C 210 70 230 140 280 200 H320Z" fill="#9F1239"/>' +
          '<path d="M160 0 L118 200 H202Z" fill="#FDE68A" opacity="0.28"/><circle cx="160" cy="150" r="22" fill="#FB923C"/><rect y="182" width="320" height="18" fill="#451A03"/>' + fin;
      default: // « tisse » : losanges des bandes tissées
        var motifs = '';
        for (var y2 = 0; y2 < 5; y2++) for (var x2 = 0; x2 < 9; x2++) {
          var cx = x2 * 40 + (y2 % 2 ? 20 : 0), cy = y2 * 44 + 10;
          motifs += '<path d="M' + cx + ' ' + (cy - 16) + ' L' + (cx + 16) + ' ' + cy + ' L' + cx + ' ' + (cy + 16) + ' L' + (cx - 16) + ' ' + cy + 'Z" fill="' + ((x2 + y2) % 3 === 0 ? '#DB2777' : (x2 + y2) % 3 === 1 ? '#1A1A1A' : '#FFF4EC') + '"/>';
        }
        return debut + '<rect width="320" height="200" fill="#EA580C"/>' + motifs + fin;
    }
  }

  // ── Icônes (traits sur grille de 24, dessinées pour ces maquettes) ─────────────────────────────────
  var I = {
    recherche: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    calendrier: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    lieu: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    billet: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M9.5 6.5v11" stroke-dasharray="1.6 2"/>',
    compas: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    carte: '<path d="M3.5 6.5l5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2z"/><path d="M8.5 4.5v13M15.5 7v13"/>',
    profil: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    retour: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    partager: '<circle cx="17" cy="5.5" r="2.5"/><circle cx="7" cy="12" r="2.5"/><circle cx="17" cy="18.5" r="2.5"/><path d="M9.2 10.8l5.6-3.4M9.2 13.2l5.6 3.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    moins: '<path d="M5 12h14"/>',
    filtres: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    liste: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
    viser: '<circle cx="12" cy="12" r="6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="1.6"/>',
    horloge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
    fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    agrandir: '<path d="M7 14l5-5 5 5"/>',
    reduire: '<path d="M7 10l5 5 5-5"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
    accessibilite: '<circle cx="12" cy="5" r="1.8"/><path d="M5 9l7 1.5L19 9M12 10.5V15l-3 5M12 15l3 5"/>',
  };
  function icone(nom, classe) {
    return '<svg class="' + (classe || 'icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + I[nom] + '</svg>';
  }

  // ── Carte d'événement (même rendu partout : accueil, carte, suggestions) ──────────────────────────
  function carte(e, n) {
    return '<a class="event-card" href="fiche.html">' +
      '<div class="poster">' + affiche(e.affiche, e.id + (n || '')) +
      (e.badge ? '<span class="badge badge-' + e.badge[0] + '">' + e.badge[1] + '</span>' : '') +
      '<span class="date-tag"><b class="num">' + e.jour + '</b><time>' + e.mois + '</time></span></div>' +
      '<div class="event-body"><h3 class="event-title">' + e.titre + '</h3>' +
      '<p class="event-meta">' + icone('calendrier', 'icon-sm') + '<span>' + e.date + '</span></p>' +
      '<p class="event-meta">' + icone('lieu', 'icon-sm') + '<span>' + e.lieu + ', ' + e.ville + '</span></p>' +
      '<p class="price-line"><span class="lead">' + e.orga + '</span><span class="price">' + (e.prix === 'Gratuit' ? 'Gratuit' : 'Dès ' + e.prix) + '</span></p></div></a>';
  }

  window.EVD = { evenements: EVENEMENTS, affiche: affiche, icone: icone, carte: carte };
})();
