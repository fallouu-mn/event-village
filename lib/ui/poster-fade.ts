/**
 * Design 1d (point 2) — fondu des affiches des cartes, SANS îlot par carte : la carte montre d'abord la couleur de
 * l'affiche, puis l'image apparaît en fondu (CSS de app/globals.css, `img[data-ev-fade]`) quand elle est chargée.
 * Script bloquant de quelques octets posé dans <head> (app/layout.tsx), avant toute image : il écoute les événements
 * `load` en phase de capture (ils ne remontent pas) et marque l'image (`data-ev-loaded`). Filets de sécurité : un passage
 * sur les images déjà complètes à la fin de l'analyse du document et au chargement de la page. Une image qui ne se charge
 * pas laisse la couleur (aucune icône d'image cassée). Sans JavaScript : CSS `scripting: none`, image affichée.
 */
export const POSTER_FADE_ATTR = 'data-ev-fade';

export const POSTER_FADE_BOOT_SCRIPT = `(function(){try{var d=document,a='data-ev-fade',s=function(i){if(i&&i.tagName==='IMG'&&i.hasAttribute(a))i.setAttribute('data-ev-loaded','')},w=function(){var l=d.querySelectorAll('img['+a+']:not([data-ev-loaded])');for(var k=0;k<l.length;k++)if(l[k].complete&&l[k].naturalWidth>0)s(l[k])};d.addEventListener('load',function(e){s(e.target)},true);d.addEventListener('DOMContentLoaded',w);window.addEventListener('load',w)}catch(e){}})();`;
