/**
 * Finition 2a — écrans (sans base) : textes exacts et comportements visibles de la carte, du formulaire, de la fiche admin
 * et de l'onglet Infos du pilotage. Les captures 390 et 1440 px (clair, sombre) montrent le rendu ; ce contrôle empêche
 * les textes de dériver.
 *  - Carte (MapPicker) : aucun repère tant que rien n'est choisi, « Position choisie » (plus « Position enregistrée »),
 *    sur téléphone un doigt fait défiler la page (glisser désactivé au toucher, « Déplacer la carte » pour l'activer).
 *  - Villes de la liste : un centre fixe chacune, au Sénégal.
 *  - Formulaire : « Rechercher un lieu », bouton « Rechercher », « © contributeurs OpenStreetMap », texte de la recherche
 *    indisponible ; « Fin retenue : » et son aide ; format conseillé de l'affiche (16:10, celui des cartes) et aperçu du
 *    recadrage ; réduction de l'image avant l'envoi sur la page de création seulement.
 *  - Fiche admin et onglet Infos du pilotage : petite carte et « Voir l’itinéraire ».
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p: string): string => fs.readFileSync(p, 'utf8');

describe('Finition 2a — écrans', () => {
    test('carte : aucun repère par défaut, « Position choisie », défilement de la page au doigt', () => {
        const map = read('components/ui/MapPicker.tsx');
        assert.ok(map.includes('Position choisie'), 'MapPicker sans « Position choisie »');
        assert.ok(!map.includes('Position enregistrée'), 'MapPicker affiche encore « Position enregistrée »');
        assert.ok(!/DEFAULT_(POSITION|MARKER)|defaultPosition/.test(map), 'MapPicker pose encore un repère par défaut');
        assert.ok(/dragging\.disable\(\)/.test(map) && /Déplacer la carte/.test(map), 'au toucher, la carte capte encore le défilement de la page');
    });

    test('villes de la liste : un centre fixe chacune, au Sénégal', async () => {
        const mod = await import('../../lib/events/senegal-cities');
        const centers = (mod as Record<string, unknown>).SENEGAL_CITY_CENTERS as Record<string, { latitude: number; longitude: number }> | undefined;
        assert.ok(centers, 'SENEGAL_CITY_CENTERS absent');
        for (const city of mod.SENEGAL_CITIES) {
            const c = centers[city];
            assert.ok(c, `centre absent : ${city}`);
            assert.ok(c.latitude >= 12.2 && c.latitude <= 16.8 && c.longitude >= -17.6 && c.longitude <= -11.3, `${city} hors du Sénégal`);
        }
    });

    test('formulaire : recherche de lieu, fin retenue, format conseillé de l’affiche', () => {
        const form = read('components/events/EventForm.tsx') + read('components/ui/MapPicker.tsx') + read('components/ui/ImageUpload.tsx');
        for (const t of ['Rechercher un lieu', 'Fin retenue : ', 'Format conseillé']) {
            assert.ok(form.includes(t), `texte absent : « ${t} »`);
        }
        // « © » écrit en entité HTML (&copy;) dans le JSX, comme la mention des tuiles : la règle « emoji » du système de
        // design (design-systeme) lit le caractère © comme pictogramme ; même rendu à l'écran
        assert.ok(/(©|&copy;) contributeurs OpenStreetMap/.test(form), 'texte absent : « © contributeurs OpenStreetMap »');
        assert.ok(/>\s*Rechercher\s*</.test(form) || /'Rechercher'/.test(form), 'bouton « Rechercher » absent');
        assert.ok(/aspect-\[16\/10\]/.test(read('components/ui/ImageUpload.tsx')), 'aperçu du recadrage 16:10 absent');
        assert.ok(/downscale/.test(read('components/events/EventForm.tsx')), 'réduction de l’image avant l’envoi absente du formulaire');
    });

    test('fiche admin et onglet Infos du pilotage : petite carte et « Voir l’itinéraire »', () => {
        const admin = read('app/admin/events/[id]/page.tsx');
        const pilotage = read('components/partner/pilotage/InfosTab.tsx');
        for (const [name, src] of [['fiche admin', admin], ['onglet Infos', pilotage]] as const) {
            assert.ok(/EventMap/.test(src), `${name} sans carte`);
            assert.ok(src.includes('Voir l’itinéraire'), `${name} sans « Voir l’itinéraire »`);
        }
        const page = read('app/partner/events/[id]/page.tsx');
        assert.ok(/id: 'infos', label: 'Infos'/.test(page), 'onglet « Infos » absent du pilotage');
    });
});
