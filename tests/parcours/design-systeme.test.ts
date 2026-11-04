/**
 * Lot 5 — système de design (contrat, section Q ; libellés de la section B ; définition de « terminé »,
 * points 3, 5, 6 et 7). Suite STATIQUE : elle lit les sources avec fs et le compilateur TypeScript
 * (arbre syntaxique : les commentaires ne comptent jamais), sans aucun accès à la base.
 *  - tokens sémantiques en variables CSS dans app/globals.css (clair et .dark), branchés dans
 *    tailwind.config (configuration chargée et lue telle que Tailwind la voit) ;
 *  - rampe brand-50 à brand-900 en orange : teinte HSL de chaque nuance entre 12° et 40°, saturation
 *    ≥ 0,35, luminosité strictement décroissante ; --brand-decor = #FF5722 ;
 *  - contraste WCAG 2.x de --brand avec le blanc ≥ 4,5:1, et de --on-brand sur --brand ≥ 4,5:1 (clair,
 *    et sombre si .dark les redéfinit) ;
 *  - composants partagés de components/ui avec leurs exigences (Modal, ConfirmDialog, ReasonDialog,
 *    StatusBadge, KpiCard, Tabs, Pagination, PageHeader, IconButton, LinkButton, Field/TextInput/
 *    Textarea/Select, DataList, StatusBanner, LiveIndicator, EmptyState/ErrorState, Button) ;
 *  - EVENT_STATUS_META (lib/events/event-status.ts) : libellés et tons exacts du contrat B ;
 *  - design-system/event-village/MASTER.md versionné ;
 *  - fichiers migrés (tests/helpers/design-files.ts) : la liste contient au moins les écrans du lot et
 *    les composants partagés du lot, et tout fichier .tsx créé par le lot ; chaque fichier listé respecte
 *    les règles du contrat Q et les règles d'accessibilité et de mobile (DoD 3 et 7).
 *
 * Règle « text-xs » (tranchée ici, contrat Q : « text-xs réservé aux badges, aux horodatages secondaires
 * et aux légendes ») : dans un fichier migré, `text-xs` et tout `text-[N px]` < 14 px sont interdits ;
 * la seule petite taille admise est l'utilitaire `text-caption` (12 px, défini dans tailwind.config
 * `fontSize.caption` ou dans globals.css), et seulement :
 *    - dans les badges (components/ui/Badge.tsx, components/ui/StatusBadge.tsx) ;
 *    - sur un élément <time>, <small>, <figcaption>, <caption>, <legend>, ou <text>/<tspan> (SVG),
 *      la classe étant écrite dans l'attribut JSX de cet élément.
 *
 * Rouge avant correctif :
 *  - app/globals.css:6-53 : aucune variable --surface, --fg, --border, --ring, --brand, --on-brand,
 *    --success… (seulement --bg-main, --brand-primary…, non branchées sur Tailwind) ;
 *  - tailwind.config.ts:18-32 : brand-600 à brand-900 sont des rouges (#F44336 ≈ 4°, #C62828 = 0°),
 *    300 et 400 rosés (≈ 11°), luminosité non monotone (500 plus sombre que 600) ; aucune couleur
 *    sémantique ; aucun fontSize caption ; brand.DEFAULT #FF5722 ≈ 3,2:1 sur blanc ;
 *  - components/ui/Modal.tsx : ni role="dialog", ni aria-modal, ni aria-labelledby, ni piège de focus,
 *    ni restitution du focus ; bouton Fermer `p-1.5` (≈ 28 px, l.97-103) ;
 *  - components/ui/ConfirmDialog.tsx:8-18 : ni requireText ni children ;
 *  - ReasonDialog, StatusBadge (nouveau), KpiCard, Tabs, Pagination, PageHeader, IconButton, LinkButton,
 *    Field, TextInput, Textarea, Select, DataList, StatusBanner, LiveIndicator : absents de components/ui ;
 *  - components/ui/EmptyState.tsx:47 : onRetry optionnel ;
 *  - components/ui/Button.tsx:46-51 : tailles h-8, h-10 (sm:h-11), h-12, icône h-10 w-10 ; `sm:h-13`
 *    inexistant ; primaire en dégradé #FF6A3D → #FF3D68 (l.32) ;
 *  - lib/events/event-status.ts : pas d'EVENT_STATUS_META ;
 *  - design-system/ absent du dépôt ;
 *  - tests/helpers/design-files.ts:13 : MIGRATED_DESIGN_FILES vide.
 * Garde-fous (verts aujourd'hui) : auto-test du détecteur de règles, entrées de la liste existantes et
 * sans doublon, fichiers .tsx créés par le lot listés (aucun aujourd'hui).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { MIGRATED_DESIGN_FILES } from '../helpers/design-files';
import { importModule } from './paiement-helpers';

const ROOT = process.cwd();

// ── Lecture des sources (arbre syntaxique, commentaires exclus) ────────────

const printer = ts.createPrinter({ removeComments: true });
const sfCache = new Map<string, ts.SourceFile>();

function absPath(rel: string): string {
    return path.join(ROOT, ...rel.split('/'));
}

function isFile(rel: string): boolean {
    const p = absPath(rel);
    return fs.existsSync(p) && fs.statSync(p).isFile();
}

function readText(rel: string): string {
    return fs.readFileSync(absPath(rel), 'utf8');
}

function parseSource(rel: string, text: string): ts.SourceFile {
    return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function sourceOf(rel: string): ts.SourceFile {
    let sf = sfCache.get(rel);
    if (!sf) {
        sf = parseSource(rel, readText(rel));
        sfCache.set(rel, sf);
    }
    return sf;
}

/** Code du fichier sans aucun commentaire (réimprimé par le compilateur ; textes et accents conservés). */
function codeOf(rel: string): string {
    return printer.printFile(sourceOf(rel));
}

function listFiles(dirRel: string, re: RegExp): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        if (!fs.existsSync(absPath(d))) return;
        for (const entry of fs.readdirSync(absPath(d), { withFileTypes: true })) {
            const child = `${d}/${entry.name}`;
            if (entry.isDirectory()) walk(child);
            else if (entry.isFile() && re.test(entry.name)) out.push(child);
        }
    };
    walk(dirRel);
    return out.sort();
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

// ── Imports et exports ─────────────────────────────────────────────────────

function resolveImport(fromRel: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else return null;
    for (const cand of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
        if (isFile(cand)) return cand;
    }
    return null;
}

interface Binding {
    local: string;
    imported: string;
    from: string | null;
    spec: string;
}

function bindingsOf(rel: string): Binding[] {
    const out: Binding[] = [];
    for (const st of sourceOf(rel).statements) {
        if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause) continue;
        const spec = st.moduleSpecifier.text;
        const from = resolveImport(rel, spec);
        const clause = st.importClause;
        if (clause.name) out.push({ local: clause.name.text, imported: 'default', from, spec });
        const nb = clause.namedBindings;
        if (nb && ts.isNamedImports(nb)) {
            for (const el of nb.elements) out.push({ local: el.name.text, imported: (el.propertyName ?? el.name).text, from, spec });
        }
        if (nb && ts.isNamespaceImport(nb)) out.push({ local: nb.name.text, imported: '*', from, spec });
    }
    return out;
}

function exportedNames(rel: string): Set<string> {
    const out = new Set<string>();
    for (const st of sourceOf(rel).statements) {
        const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
        const exported = !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (exported && ts.isVariableStatement(st)) {
            for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
        }
        if (exported && (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) out.add(st.name.text);
        if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
            for (const el of st.exportClause.elements) out.add(el.name.text);
        }
    }
    return out;
}

const UI_DIR = 'components/ui';

/** Fichiers de components/ui (hors index) qui exportent `name`. */
function uiExporters(name: string): string[] {
    return listFiles(UI_DIR, /\.tsx?$/).filter((f) => !/\/index\.tsx?$/.test(f) && exportedNames(f).has(name));
}

/** Le StatusBadge du contrat Q : celui de components/ui qui lit EVENT_STATUS_META (l'ancien, Badge.tsx, ne compte pas). */
function newStatusBadgeFile(): string | null {
    return uiExporters('StatusBadge').find((f) => bindingsOf(f).some((b) => b.imported === 'EVENT_STATUS_META' && b.from === 'lib/events/event-status.ts')) ?? null;
}

function componentFile(name: string): string | null {
    if (name === 'StatusBadge') return newStatusBadgeFile();
    return uiExporters(name)[0] ?? null;
}

/** Fichier et code (sans commentaires) du composant partagé, ou échec explicite. */
function requireComponent(name: string): { file: string; code: string; sf: ts.SourceFile } {
    const file = componentFile(name);
    assert.ok(file, `${name} : aucun fichier de ${UI_DIR} n'exporte ${name} (contrat Q)`
        + (name === 'StatusBadge' ? ' en lisant EVENT_STATUS_META de lib/events/event-status.ts' : ''));
    return { file, code: codeOf(file), sf: sourceOf(file) };
}

/** Chaîne littérale de la propriété `prop` d'un objet littéral affecté à la variable `varName` (ou n'importe où si varName est null). */
function objectStrings(sf: ts.SourceFile, varName: string | null): Map<string, string> | null {
    let found: Map<string, string> | null = null;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && (varName === null || node.name.text === varName)
            && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
            const m = new Map<string, string>();
            for (const p of node.initializer.properties) {
                if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
                    && (ts.isStringLiteral(p.initializer) || ts.isNoSubstitutionTemplateLiteral(p.initializer))) {
                    m.set(p.name.text, p.initializer.text);
                }
            }
            found = m;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
}

function allStringLiterals(sf: ts.SourceFile): string[] {
    const out: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

// ── Couleurs (CSS et WCAG) ─────────────────────────────────────────────────

type Rgb = [number, number, number];

function splitChannels(s: string): string[] {
    return s.split('/')[0].split(/[\s,]+/).filter(Boolean);
}

function hslToRgb(h: number, s: number, l: number): Rgb {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = (((h % 360) + 360) % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let rgb: [number, number, number] = [0, 0, 0];
    if (hp < 1) rgb = [c, x, 0];
    else if (hp < 2) rgb = [x, c, 0];
    else if (hp < 3) rgb = [0, c, x];
    else if (hp < 4) rgb = [0, x, c];
    else if (hp < 5) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    const m = l - c / 2;
    return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
}

function rgbChannels(s: string): Rgb | null {
    const p = splitChannels(s);
    if (p.length !== 3) return null;
    const n = p.map((x) => (x.endsWith('%') ? Math.round(parseFloat(x) * 2.55) : parseFloat(x)));
    if (n.some((x) => !Number.isFinite(x) || x < 0 || x > 255)) return null;
    return [n[0], n[1], n[2]];
}

function hslChannels(s: string): Rgb | null {
    const p = splitChannels(s);
    if (p.length !== 3) return null;
    const h = parseFloat(p[0].replace(/deg$/, ''));
    const sat = parseFloat(p[1]) / 100;
    const l = parseFloat(p[2]) / 100;
    if (![h, sat, l].every(Number.isFinite)) return null;
    return hslToRgb(h, sat, l);
}

/** Couleur CSS → RVB : #rgb, #rrggbb(aa), rgb()/rgba(), hsl()/hsla(), canaux nus « r g b » ou « h s% l% ». */
function parseColor(raw: string): Rgb | null {
    const v = raw.trim().replace(/\s*!important$/, '');
    const hex = /^#([0-9a-fA-F]{3,8})$/.exec(v);
    if (hex) {
        const h = hex[1];
        if (h.length === 3 || h.length === 4) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
        if (h.length === 6 || h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
        return null;
    }
    const rgbFn = /^rgba?\(\s*([^)]*)\)$/i.exec(v);
    if (rgbFn) return rgbChannels(rgbFn[1]);
    const hslFn = /^hsla?\(\s*([^)]*)\)$/i.exec(v);
    if (hslFn) return hslChannels(hslFn[1]);
    if (v.includes('%')) return hslChannels(v);
    return rgbChannels(v);
}

function rgbToHsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
    return { h: (h + 360) % 360, s, l };
}

function relativeLuminance([r, g, b]: Rgb): number {
    const ch = (c: number): number => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Rapport de contraste WCAG 2.x. */
function contrastRatio(a: Rgb, b: Rgb): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: Rgb = [255, 255, 255];

// ── app/globals.css : règles et variables ──────────────────────────────────

interface CssRule {
    selector: string;
    decls: Map<string, string>;
    props: Map<string, string>;
}

function parseCss(css: string): CssRule[] {
    const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules: CssRule[] = [];
    const stack: Array<{ selector: string; text: string }> = [];
    let buf = '';
    const toRule = (selector: string, text: string): CssRule => {
        const decls = new Map<string, string>();
        const props = new Map<string, string>();
        for (const part of text.split(';')) {
            const i = part.indexOf(':');
            if (i < 0) continue;
            const prop = part.slice(0, i).trim();
            const value = part.slice(i + 1).trim();
            if (prop.startsWith('--')) decls.set(prop, value);
            else if (prop) props.set(prop, value);
        }
        return { selector, decls, props };
    };
    for (const ch of src) {
        if (ch === '{') {
            stack.push({ selector: buf.trim(), text: '' });
            buf = '';
        } else if (ch === '}') {
            const top = stack.pop();
            if (top) {
                top.text += buf;
                rules.push(toRule(top.selector, top.text));
            }
            buf = '';
        } else if (ch === ';' && stack.length > 0) {
            stack[stack.length - 1].text += `${buf};`;
            buf = '';
        } else {
            buf += ch;
        }
    }
    return rules;
}

function selectorList(sel: string): string[] {
    return sel.split(',').map((s) => s.trim());
}

const DARK_SELECTOR = /^(?::root|html)?\.dark$/;

function cssVars(rules: CssRule[], pick: (selectors: string[]) => boolean): Map<string, string> {
    const out = new Map<string, string>();
    for (const r of rules) if (pick(selectorList(r.selector))) r.decls.forEach((v, k) => out.set(k, v));
    return out;
}

function resolveVarRefs(value: string, scopes: Array<Map<string, string>>, depth = 0): string {
    if (depth > 10) return value;
    return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_m: string, name: string, fallback?: string) => {
        for (const s of scopes) {
            const v = s.get(name);
            if (v !== undefined) return resolveVarRefs(v, scopes, depth + 1);
        }
        return fallback ?? '';
    });
}

const CSS_RULES = (): CssRule[] => parseCss(readText('app/globals.css'));
const ROOT_VARS = (): Map<string, string> => cssVars(CSS_RULES(), (s) => s.includes(':root'));
const DARK_VARS = (): Map<string, string> => cssVars(CSS_RULES(), (s) => s.some((x) => DARK_SELECTOR.test(x)));

const STATUS_TONES = ['success', 'warning', 'danger', 'info'];
const ROOT_TOKENS = [
    'surface', 'surface-raised', 'surface-sunken', 'fg', 'fg-muted', 'border', 'ring',
    'brand', 'brand-hover', 'on-brand', 'brand-decor',
    ...STATUS_TONES.flatMap((t) => [t, `${t}-bg`, `${t}-fg`, `${t}-border`]),
];
/** Tokens qui doivent basculer en sombre (la marque peut rester identique). */
const DARK_TOKENS = [
    'surface', 'surface-raised', 'surface-sunken', 'fg', 'fg-muted', 'border', 'ring',
    ...STATUS_TONES.flatMap((t) => [`${t}-bg`, `${t}-fg`, `${t}-border`]),
];

// ── tailwind.config (configuration chargée) ────────────────────────────────

async function loadTailwindConfig(): Promise<Record<string, unknown>> {
    const mod = await importModule('../../tailwind.config');
    let cfg: unknown = mod.default ?? mod;
    for (let i = 0; i < 3 && cfg && typeof cfg === 'object' && !('theme' in cfg) && 'default' in cfg; i++) {
        cfg = (cfg as { default: unknown }).default;
    }
    assert.ok(cfg && typeof cfg === 'object' && 'theme' in cfg, `tailwind.config : configuration illisible (${JSON.stringify(Object.keys(mod ?? {}))})`);
    return cfg as Record<string, unknown>;
}

function themeSection(cfg: Record<string, unknown>, key: string): Record<string, unknown> {
    const theme = (cfg.theme ?? {}) as Record<string, unknown>;
    const extend = (theme.extend ?? {}) as Record<string, unknown>;
    return { ...((theme[key] ?? {}) as Record<string, unknown>), ...((extend[key] ?? {}) as Record<string, unknown>) };
}

function flattenColors(obj: unknown, prefix = ''): Map<string, string> {
    const out = new Map<string, string>();
    if (!obj || typeof obj !== 'object') return out;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const key = k === 'DEFAULT' ? prefix : prefix ? `${prefix}-${k}` : k;
        if (typeof v === 'string') out.set(key, v);
        else if (typeof v === 'function') {
            const r = (v as (o: Record<string, unknown>) => unknown)({ opacityValue: '1', opacityVariable: '--tw-bg-opacity' });
            if (typeof r === 'string') out.set(key, r);
        } else flattenColors(v, key).forEach((val, kk) => out.set(kk, val));
    }
    return out;
}

function referencesVar(value: string, token: string): boolean {
    return new RegExp(`var\\(\\s*--${token.replace(/-/g, '\\-')}\\s*[),]`).test(value);
}

// ── Règles des fichiers migrés (contrat Q, DoD 3, 5, 6, 7) ─────────────────

interface DesignViolation {
    rule: string;
    line: number;
    excerpt: string;
}

const EVENT_ENUM_RE = new RegExp('(?<![\\p{L}\\p{N}_])(BROUILLON|EN_ATTENTE|VALIDE|PUBLIE|SUSPENDU|TERMINE|ANNULE)(?![\\p{L}\\p{N}_])', 'u');
const HEX_RE = new RegExp('#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])');
const COLOR_FN_RE = new RegExp('\\b(?:rgba?|hsla?)\\(\\s*[\\d.]');
const PALETTE = 'slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTILITIES = 'bg|text|border(?:-[xytrblse])?|from|via|to|ring(?:-offset)?|shadow|fill|stroke|divide|placeholder|outline|decoration|accent|caret';
const PALETTE_RE = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*!?(?:${UTILITIES})-(?:${PALETTE})-(?:50|[1-9]00|950)(?![\\w-])`);
const TEXT_XS_RE = new RegExp('(?<![\\w-])(?:[\\w-]+:)*text-xs(?![\\w-])');
const ARBITRARY_TEXT_RE = new RegExp('(?<![\\w-])(?:[\\w-]+:)*text-\\[(\\d*\\.?\\d+)(px|rem|em)\\]', 'g');
const CAPTION_RE = new RegExp('(?<![\\w-])(?:[\\w-]+:)*text-caption(?![\\w-])');
const FIXED_WIDTH_RE = new RegExp('(?<![\\w-])(?:[\\w-]+:)*(?:min-)?w-\\[(\\d+)px\\]', 'g');
const FIXED_INSET_RE = new RegExp('(?<![\\w-])fixed(?![\\w-])[^]*(?<![\\w-])inset-0(?![\\w-])|(?<![\\w-])inset-0(?![\\w-])[^]*(?<![\\w-])fixed(?![\\w-])');
const EMOJI_RE = new RegExp('\\p{Extended_Pictographic}', 'u');

const CAPTION_TAGS = new Set(['time', 'small', 'figcaption', 'caption', 'legend', 'text', 'tspan']);
const BADGE_FILES = new Set(['components/ui/Badge.tsx', 'components/ui/StatusBadge.tsx']);
/** Attributs JSX dont la valeur est affichée ou lue (un enum y est un enum affiché). */
const DISPLAY_ATTRS = new Set([
    'title', 'aria-label', 'aria-description', 'placeholder', 'label', 'alt', 'message', 'description', 'subtitle',
    'hint', 'confirmLabel', 'cancelLabel', 'emptyLabel', 'helperText', 'error', 'children',
]);
const LINK_TAGS = new Set(['Link', 'a']);
const BUTTON_TAGS = new Set(['Button', 'IconButton', 'button']);
const FIELD_TAGS = new Set(['input', 'textarea', 'select']);
/** Écran mobile de 390 px moins les gouttières de 16 px. */
const MAX_FIXED_WIDTH_PX = 358;

function tagOf(el: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
    return el.tagName.getText();
}

function attrsOf(el: ts.JsxOpeningElement | ts.JsxSelfClosingElement): Map<string, ts.JsxAttribute> {
    const m = new Map<string, ts.JsxAttribute>();
    for (const p of el.attributes.properties) if (ts.isJsxAttribute(p)) m.set(p.name.getText(), p);
    return m;
}

function attrString(attr: ts.JsxAttribute | undefined): string | null {
    if (!attr?.initializer) return null;
    if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
    if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isStringLiteralLike(attr.initializer.expression)) {
        return attr.initializer.expression.text;
    }
    return null;
}

/** L'attribut JSX qui contient ce nœud (classe composée par cn(), ternaire…), ou null. */
function enclosingJsxAttribute(node: ts.Node): ts.JsxAttribute | null {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
        if (ts.isJsxAttribute(cur)) return cur;
        if (ts.isJsxElement(cur) || ts.isJsxSelfClosingElement(cur) || ts.isJsxFragment(cur) || ts.isFunctionLike(cur)
            || ts.isBlock(cur) || ts.isVariableDeclaration(cur) || ts.isSourceFile(cur)) return null;
        cur = cur.parent;
    }
    return null;
}

/** Le nœud est-il rendu tel quel : enfant JSX, ou valeur d'un attribut JSX (nom renvoyé) ? */
function renderedInJsx(node: ts.Node): 'child' | { attr: string } | null {
    let cur: ts.Node = node;
    for (;;) {
        const parent: ts.Node | undefined = cur.parent;
        if (!parent) return null;
        if (ts.isParenthesizedExpression(parent) || ts.isTemplateSpan(parent) || ts.isTemplateExpression(parent)
            || ts.isAsExpression(parent) || ts.isNonNullExpression(parent)) {
            cur = parent;
            continue;
        }
        if (ts.isConditionalExpression(parent)) {
            if (parent.condition === cur) return null;
            cur = parent;
            continue;
        }
        if (ts.isBinaryExpression(parent)) {
            const op = parent.operatorToken.kind;
            const passes = op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.PlusToken
                || (op === ts.SyntaxKind.AmpersandAmpersandToken && parent.right === cur);
            if (!passes) return null;
            cur = parent;
            continue;
        }
        if (ts.isJsxExpression(parent)) {
            const gp = parent.parent;
            if (ts.isJsxElement(gp) || ts.isJsxFragment(gp)) return 'child';
            if (ts.isJsxAttribute(gp)) return { attr: gp.name.getText() };
            return null;
        }
        if (ts.isJsxAttribute(parent)) return { attr: parent.name.getText() };
        return null;
    }
}

function isDisplayed(r: ReturnType<typeof renderedInJsx>): boolean {
    return r === 'child' || (r !== null && DISPLAY_ATTRS.has(r.attr));
}

function isModuleSpecifier(node: ts.Node): boolean {
    const p = node.parent;
    return !!p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p));
}

function hasDescendant(node: ts.Node, pred: (n: ts.Node) => boolean): boolean {
    let found = false;
    const visit = (n: ts.Node): void => {
        if (found) return;
        if (n !== node && pred(n)) {
            found = true;
            return;
        }
        ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
}

function isJsxTag(n: ts.Node, tags: Set<string>): boolean {
    return (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && tags.has(tagOf(n));
}

/**
 * Règles du contrat Q sur un fichier migré : couleurs codées en dur, tailles de texte, « § », emoji,
 * enum de statut affiché, <Link> qui enveloppe un bouton. Seuls les littéraux et le texte JSX comptent :
 * les commentaires sont hors de l'arbre.
 */
function designViolations(rel: string, text: string): DesignViolation[] {
    const sf = parseSource(rel, text);
    const out: DesignViolation[] = [];
    const add = (rule: string, node: ts.Node, excerpt: string): void => {
        out.push({ rule, line: lineOf(sf, node), excerpt: excerpt.replace(/\s+/g, ' ').trim().slice(0, 100) });
    };
    const visit = (node: ts.Node): void => {
        const isLiteral = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)
            || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
        if ((isLiteral && !isModuleSpecifier(node)) || ts.isJsxText(node)) {
            const value = (node as ts.LiteralLikeNode).text;
            if (HEX_RE.test(value)) add('couleur #hex', node, value);
            if (COLOR_FN_RE.test(value)) add('couleur rgb()/hsl()', node, value);
            if (PALETTE_RE.test(value)) add('palette Tailwind brute', node, value);
            if (TEXT_XS_RE.test(value)) add('text-xs (utiliser text-caption sur <time>, <small>…, ou 14 px)', node, value);
            for (const m of Array.from(value.matchAll(ARBITRARY_TEXT_RE))) {
                const n = parseFloat(m[1]);
                const px = m[2] === 'px' ? n : n * 16;
                if (px < 14) add(`taille de texte ${m[0]} < 14 px`, node, value);
            }
            if (value.includes('§')) add('référence « § »', node, value);
            if (EMOJI_RE.test(value)) add('emoji', node, value);
            if (CAPTION_RE.test(value) && !BADGE_FILES.has(rel)) {
                const attr = enclosingJsxAttribute(node);
                const el = attr ? attr.parent.parent : null;
                const tag = el ? tagOf(el) : null;
                if (!tag || !CAPTION_TAGS.has(tag)) {
                    add(`text-caption hors d'un badge ou d'un élément <time>/<small>/<figcaption>/<caption>/<legend>/<text> (élément : ${tag ?? 'aucun'})`, node, value);
                }
            }
        }
        if (ts.isJsxText(node) && EVENT_ENUM_RE.test(node.text)) add('enum de statut dans le texte JSX', node, node.text);
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && EVENT_ENUM_RE.test(node.text) && isDisplayed(renderedInJsx(node))) {
            add('enum de statut affiché (littéral JSX)', node, node.text);
        }
        if ((ts.isPropertyAccessExpression(node) && node.name.text === 'status') || (ts.isIdentifier(node) && node.text === 'status' && !ts.isPropertyAccessExpression(node.parent))) {
            if (isDisplayed(renderedInJsx(node))) add('statut brut affiché ({….status})', node, node.getText(sf));
        }
        if (ts.isJsxElement(node) && LINK_TAGS.has(tagOf(node.openingElement))
            && hasDescendant(node, (n) => isJsxTag(n, BUTTON_TAGS))) {
            add('<Link> ou <a> qui enveloppe un bouton (utiliser LinkButton)', node, node.openingElement.getText(sf));
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

/**
 * Règles d'accessibilité et de mobile (DoD 3 et 7) sur un fichier migré : bouton icône sans aria-label,
 * champ sans label lié, modale écrite à la main (fixed inset-0) hors du composant Modal, largeur fixe
 * > 358 px, <table> hors de DataList.
 */
function accessibilityViolations(rel: string, text: string): DesignViolation[] {
    const sf = parseSource(rel, text);
    const out: DesignViolation[] = [];
    const add = (rule: string, node: ts.Node, excerpt: string): void => {
        out.push({ rule, line: lineOf(sf, node), excerpt: excerpt.replace(/\s+/g, ' ').trim().slice(0, 100) });
    };
    // Lot 7 (7.2, signalé au rapport) : exception nommée pour le verdict plein écran du scanner, qui n'est pas une
    // modale (aucun piège de focus, fermeture automatique) et dont le plein écran est exigé par scanner-combat-ui.
    const sharedShell = rel.startsWith('components/ui/') || rel.startsWith('components/layout/')
        || rel === 'components/scan/CombatFlashOverlay.tsx';
    const labelled = (attrs: Map<string, ts.JsxAttribute>): boolean => attrs.has('aria-label') || attrs.has('aria-labelledby');
    const insideLabel = (node: ts.Node): boolean => {
        let cur: ts.Node | undefined = node.parent;
        while (cur) {
            if (ts.isJsxElement(cur) && tagOf(cur.openingElement) === 'label') return true;
            cur = cur.parent;
        }
        return false;
    };
    const visit = (node: ts.Node): void => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tag = tagOf(node);
            const attrs = attrsOf(node);
            if (ts.isJsxSelfClosingElement(node) && BUTTON_TAGS.has(tag) && (tag === 'IconButton' || attrString(attrs.get('size')) === 'icon') && !labelled(attrs)) {
                add('bouton icône sans aria-label', node, node.getText(sf));
            }
            if (FIELD_TAGS.has(tag) && attrString(attrs.get('type')) !== 'hidden'
                && !attrs.has('id') && !labelled(attrs) && !insideLabel(node)) {
                add(`<${tag}> sans label lié (id + htmlFor, aria-label ou <label> englobant)`, node, node.getText(sf));
            }
            if (tag === 'table' && rel !== componentFile('DataList')) add('<table> hors de DataList (cartes sous md)', node, node.getText(sf));
        }
        if (ts.isJsxElement(node)) {
            const tag = tagOf(node.openingElement);
            const attrs = attrsOf(node.openingElement);
            if (tag === 'label' && !attrs.has('htmlFor') && !hasDescendant(node, (n) => isJsxTag(n, FIELD_TAGS))) {
                add('<label> sans htmlFor ni champ englobé', node, node.openingElement.getText(sf));
            }
            if (BUTTON_TAGS.has(tag) && !labelled(attrs)) {
                const meaningful = node.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));
                const iconOnly = meaningful.length > 0 && meaningful.every((c) => (ts.isJsxSelfClosingElement(c) || ts.isJsxElement(c))
                    && /^[A-Z]/.test(ts.isJsxElement(c) ? tagOf(c.openingElement) : tagOf(c)));
                if (tag === 'IconButton' || attrString(attrs.get('size')) === 'icon' || iconOnly) {
                    add('bouton icône sans aria-label', node, node.openingElement.getText(sf));
                }
            }
        }
        const isLiteral = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)
            || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
        if (isLiteral && !isModuleSpecifier(node)) {
            const value = (node as ts.LiteralLikeNode).text;
            if (!sharedShell && FIXED_INSET_RE.test(value)) add('modale écrite à la main (fixed inset-0) : utiliser Modal', node, value);
            for (const m of Array.from(value.matchAll(FIXED_WIDTH_RE))) {
                if (Number(m[1]) > MAX_FIXED_WIDTH_PX) add(`largeur fixe ${m[0]} > ${MAX_FIXED_WIDTH_PX} px (défilement horizontal à 390 px)`, node, value);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

function formatViolations(rel: string, v: DesignViolation[]): string {
    return v.map((x) => `${rel}:${x.line} [${x.rule}] ${x.excerpt}`).join('\n');
}

// ── Listes attendues ───────────────────────────────────────────────────────

/** Écrans du lot (contrat Q, consigne 5.1) : ils doivent exister et figurer dans MIGRATED_DESIGN_FILES. */
const EXPECTED_SCREENS = [
    'app/admin/events/page.tsx',
    'app/admin/events/[id]/page.tsx',
    'app/partner/events/page.tsx',
    'app/partner/events/[id]/page.tsx',
    'components/events/EventForm.tsx',
    'app/events/[id]/page.tsx',
    'app/explore/page.tsx',
    'app/page.tsx',
    'app/tickets/page.tsx',
];

/** Anciennes pages devenues onglets du pilotage (contrat I : elles redirigent) : listées tant qu'elles existent. */
const FORMER_TAB_PAGES = [
    'app/partner/events/[id]/caisse/page.tsx',
    'app/partner/events/[id]/team/page.tsx',
];

/** Composants partagés créés ou corrigés par le lot (contrat Q). */
const SHARED_COMPONENTS = [
    'Modal', 'ConfirmDialog', 'ReasonDialog', 'StatusBadge', 'KpiCard', 'Tabs', 'Pagination', 'PageHeader', 'IconButton',
    'LinkButton', 'Field', 'TextInput', 'Textarea', 'Select', 'DataList', 'StatusBanner', 'LiveIndicator', 'EmptyState',
    'ErrorState', 'Button',
];

/** Fichiers .tsx d'app/ et de components/ présents au départ du lot 5 (HEAD 640153a) : tout autre fichier .tsx est créé par le lot. */
const PRE_LOT5_UI_FILES = new Set<string>([
    'app/admin/audit/page.tsx',
    'app/admin/communications/page.tsx',
    'app/admin/dashboard/page.tsx',
    'app/admin/finance-settings/page.tsx',
    'app/admin/finance/page.tsx',
    'app/admin/page.tsx',
    'app/admin/pricing/page.tsx',
    'app/admin/referral/page.tsx',
    'app/admin/services/page.tsx',
    'app/admin/users/page.tsx',
    'app/controller/layout.tsx',
    'app/controller/profile/page.tsx',
    'app/controller/scanner/page.tsx',
    'app/controller/setup/page.tsx',
    'app/error.tsx',
    'app/events/[id]/loading.tsx',
    'app/events/[id]/page.tsx',
    'app/explore/loading.tsx',
    'app/explore/page.tsx',
    'app/forgot-password/page.tsx',
    'app/global-error.tsx',
    'app/halls/[id]/page.tsx',
    'app/halls/page.tsx',
    'app/layout.tsx',
    'app/login/page.tsx',
    'app/not-found.tsx',
    'app/notifications/page.tsx',
    'app/orders/loading.tsx',
    'app/orders/page.tsx',
    'app/page.tsx',
    'app/paiement/[id]/page.tsx',
    'app/partner/calendar/page.tsx',
    'app/partner/dashboard/loading.tsx',
    'app/partner/dashboard/page.tsx',
    'app/partner/events/[id]/caisse/page.tsx',
    'app/partner/events/[id]/edit/page.tsx',
    'app/partner/events/[id]/team/page.tsx',
    'app/partner/events/new/page.tsx',
    'app/partner/events/page.tsx',
    'app/partner/finance/page.tsx',
    'app/partner/halls/[id]/edit/page.tsx',
    'app/partner/halls/new/page.tsx',
    'app/partner/halls/page.tsx',
    'app/partner/layout.tsx',
    'app/partner/orders/page.tsx',
    'app/partner/page.tsx',
    'app/partner/products/new/page.tsx',
    'app/partner/products/page.tsx',
    'app/partner/profile/page.tsx',
    'app/partner/register/page.tsx',
    'app/partner/scan/page.tsx',
    'app/partner/stats/page.tsx',
    'app/partner/subscription/page.tsx',
    'app/partner/tables/page.tsx',
    'app/partner/team/page.tsx',
    'app/profile/loading.tsx',
    'app/profile/page.tsx',
    'app/register/page.tsx',
    'app/reset-password/page.tsx',
    'app/restaurants/[id]/menu/page.tsx',
    'app/restaurants/[id]/tables/page.tsx',
    'app/scan/page.tsx',
    'app/template.tsx',
    'app/tickets/claim/[token]/page.tsx',
    'app/tickets/loading.tsx',
    'app/tickets/page.tsx',
    'app/wallet/loading.tsx',
    'app/wallet/page.tsx',
    'components/auth/OtpInput.tsx',
    'components/auth/PasswordStrengthChecklist.tsx',
    'components/events/AdjustTicketQuotaModal.tsx',
    'components/events/CategoryFilters.tsx',
    'components/events/EventCalendar.tsx',
    'components/events/EventCancelModal.tsx',
    'components/events/EventCancellationBanner.tsx',
    'components/events/EventCard.tsx',
    'components/events/FeaturedEventCard.tsx',
    'components/layout/AppLayout.tsx',
    'components/layout/AppLayoutHeader.tsx',
    'components/notifications/NotificationBell.tsx',
    'components/partner/ClosingReportModal.tsx',
    'components/payment/PaymentModal.tsx',
    'components/providers/AuthProvider.tsx',
    'components/providers/ThemeProvider.tsx',
    'components/pwa/ServiceWorkerRegister.tsx',
    'components/scan/CameraQrScanner.tsx',
    'components/scan/CombatFlashOverlay.tsx',
    'components/scan/ManualEntryForm.tsx',
    'components/scan/ScanResultPanel.tsx',
    'components/shifts/ShiftModals.tsx',
    'components/tickets/TicketCard.tsx',
    'components/tickets/TransferExplainerModal.tsx',
    'components/tickets/TransferModal.tsx',
    'components/ui/Badge.tsx',
    'components/ui/Button.tsx',
    'components/ui/ConfirmDialog.tsx',
    'components/ui/EmptyState.tsx',
    'components/ui/EventMap.tsx',
    'components/ui/ImageUpload.tsx',
    'components/ui/Input.tsx',
    'components/ui/LoadingSkeleton.tsx',
    'components/ui/Logo.tsx',
    'components/ui/MapPicker.tsx',
    'components/ui/Modal.tsx',
    'components/ui/Skeleton.tsx',
    'components/ui/ThemeToggle.tsx',
    'components/ui/Toast.tsx',
]);

// ── B. EVENT_STATUS_META ───────────────────────────────────────────────────

interface StatusMeta {
    label?: unknown;
    tone?: unknown;
    description?: unknown;
}

const STATUS_META_EXPECTED: Record<string, { label: string; tone: string }> = {
    BROUILLON: { label: 'Brouillon', tone: 'neutral' },
    EN_ATTENTE: { label: 'En attente de validation', tone: 'warning' },
    VALIDE: { label: 'Validé', tone: 'info' },
    PUBLIE: { label: 'Publié', tone: 'success' },
    SUSPENDU: { label: 'Suspendu', tone: 'warning-strong' },
    TERMINE: { label: 'Terminé', tone: 'muted' },
    ANNULE: { label: 'Annulé', tone: 'danger' },
};

describe('B — EVENT_STATUS_META, seule source des libellés de statut', () => {
    test('lib/events/event-status.ts exporte EVENT_STATUS_META : les 7 statuts, libellés et tons exacts du contrat B, description en français', async () => {
        const mod = await importModule('../../lib/events/event-status');
        const meta: Record<string, StatusMeta> | undefined = mod.EVENT_STATUS_META;
        assert.ok(meta && typeof meta === 'object', `EVENT_STATUS_META absent de lib/events/event-status.ts (exports : ${Object.keys(mod).join(', ')})`);
        assert.deepEqual(Object.keys(meta).sort(), Object.keys(STATUS_META_EXPECTED).sort(), 'EVENT_STATUS_META : exactement les 7 statuts de l’enum event_status');
        for (const [status, expected] of Object.entries(STATUS_META_EXPECTED)) {
            const m: StatusMeta = meta[status] ?? {};
            assert.equal(m.label, expected.label, `${status} : libellé « ${String(m.label)} », attendu « ${expected.label} »`);
            assert.equal(m.tone, expected.tone, `${status} : ton ${String(m.tone)}, attendu ${expected.tone}`);
            assert.equal(typeof m.description, 'string', `${status} : description absente`);
            const description = String(m.description);
            assert.ok(description.trim().length >= 10, `${status} : description trop courte (« ${description} »)`);
            assert.doesNotMatch(description, EVENT_ENUM_RE, `${status} : la description affiche un enum brut (« ${description} »)`);
        }
    });

    test('StatusBadge (components/ui) lit EVENT_STATUS_META, a un domaine « event », sans majuscules forcées', () => {
        const { file, code, sf } = requireComponent('StatusBadge');
        assert.match(code, /\bdomain\??\s*:/, `${file} : pas de prop domain (contrat Q : domaine event)`);
        assert.match(code, /['"]event['"]/, `${file} : le domaine « event » n'apparaît pas`);
        const upper = allStringLiterals(sf).filter((s) => /(?<![\w-])uppercase(?![\w-])/.test(s));
        assert.deepEqual(upper, [], `${file} : la classe uppercase transforme les libellés en enum (contrat B : casse de phrase)`);
        for (const { label } of Object.values(STATUS_META_EXPECTED)) {
            assert.ok(!code.includes(`'${label}'`) && !code.includes(`"${label}"`), `${file} : libellé « ${label} » recopié en dur au lieu d'être lu dans EVENT_STATUS_META`);
        }
    });
});

// ── Q. Tokens ──────────────────────────────────────────────────────────────

describe('Q — tokens sémantiques (globals.css, tailwind.config)', () => {
    test('app/globals.css : chaque token sémantique est une variable CSS de :root', () => {
        const root = ROOT_VARS();
        const missing = ROOT_TOKENS.filter((t) => !root.has(`--${t}`));
        assert.deepEqual(missing, [], `variables absentes de :root : ${missing.map((t) => `--${t}`).join(', ')}`);
    });

    test('app/globals.css : le thème sombre (.dark) redéfinit surfaces, textes, bordures, anneau et tons', () => {
        const dark = DARK_VARS();
        const root = ROOT_VARS();
        const missing = DARK_TOKENS.filter((t) => !dark.has(`--${t}`));
        assert.deepEqual(missing, [], `variables absentes de .dark : ${missing.map((t) => `--${t}`).join(', ')}`);
        for (const t of ['surface', 'fg', 'border']) {
            assert.notEqual(dark.get(`--${t}`), root.get(`--${t}`), `--${t} identique en clair et en sombre : le token ne bascule pas`);
        }
    });

    test('tailwind.config : couleurs branchées sur les variables (bg-surface, text-fg, bg-brand, text-on-brand, bg-success-bg…)', async () => {
        const colors = flattenColors(themeSection(await loadTailwindConfig(), 'colors'));
        const problems: string[] = [];
        for (const t of ROOT_TOKENS) {
            const v = colors.get(t);
            if (v === undefined) problems.push(`${t} : absent des couleurs Tailwind`);
            else if (!referencesVar(v, t)) problems.push(`${t} = ${v} : ne lit pas var(--${t})`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });

    test('tailwind.config : utilitaire text-caption à 12 px (seule petite taille admise, voir la règle text-xs)', async () => {
        const sizes = themeSection(await loadTailwindConfig(), 'fontSize');
        const raw = sizes.caption;
        const fromConfig = Array.isArray(raw) ? raw[0] : raw;
        const cssRule = CSS_RULES().find((r) => selectorList(r.selector).includes('.text-caption'));
        const value = typeof fromConfig === 'string' ? fromConfig : cssRule?.props.get('font-size');
        assert.ok(value, 'text-caption absent : ni theme.extend.fontSize.caption ni règle .text-caption dans globals.css');
        assert.ok(['0.75rem', '12px'].includes(value.trim()), `text-caption = ${value}, attendu 12 px (0.75rem)`);
    });

    test('rampe brand-50 à brand-900 en orange : teinte 12°–40°, saturation ≥ 0,35, luminosité décroissante', async () => {
        const colors = flattenColors(themeSection(await loadTailwindConfig(), 'colors'));
        const scopes = [ROOT_VARS()];
        const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
        const problems: string[] = [];
        let prevL = Infinity;
        for (const s of shades) {
            const raw = colors.get(`brand-${s}`);
            if (raw === undefined) {
                problems.push(`brand-${s} : absent`);
                continue;
            }
            const rgb = parseColor(resolveVarRefs(raw, scopes));
            if (!rgb) {
                problems.push(`brand-${s} = ${raw} : couleur illisible`);
                continue;
            }
            const { h, s: sat, l } = rgbToHsl(rgb);
            if (h < 12 || h > 40) problems.push(`brand-${s} = ${raw} : teinte ${h.toFixed(1)}° hors de l'orange (12°–40°)`);
            if (sat < 0.35) problems.push(`brand-${s} = ${raw} : saturation ${sat.toFixed(2)} < 0,35`);
            if (!(l < prevL)) problems.push(`brand-${s} = ${raw} : luminosité ${l.toFixed(3)} non décroissante`);
            prevL = l;
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });

    test('contraste WCAG : --brand avec le blanc ≥ 4,5:1, --on-brand sur --brand ≥ 4,5:1 (clair et sombre) ; --brand-decor = #FF5722', async () => {
        const root = ROOT_VARS();
        const dark = DARK_VARS();
        const colors = flattenColors(themeSection(await loadTailwindConfig(), 'colors'));
        const brandRaw = root.get('--brand') ?? colors.get('brand');
        assert.ok(brandRaw, 'ni --brand dans :root ni brand dans tailwind.config');
        const brand = parseColor(resolveVarRefs(brandRaw, [root]));
        assert.ok(brand, `--brand = ${brandRaw} : couleur illisible`);
        const white = contrastRatio(brand, WHITE);
        assert.ok(white >= 4.5, `--brand = ${brandRaw} : contraste avec le blanc ${white.toFixed(2)}:1 < 4,5:1 (texte blanc des boutons primaires)`);

        const onBrandRaw = root.get('--on-brand');
        assert.ok(onBrandRaw, '--on-brand absent de :root');
        const onBrand = parseColor(resolveVarRefs(onBrandRaw, [root]));
        assert.ok(onBrand, `--on-brand = ${onBrandRaw} : couleur illisible`);
        const pair = contrastRatio(brand, onBrand);
        assert.ok(pair >= 4.5, `clair : --on-brand sur --brand ${pair.toFixed(2)}:1 < 4,5:1`);

        if (dark.has('--brand') || dark.has('--on-brand')) {
            const scopes = [dark, root];
            const db = parseColor(resolveVarRefs(dark.get('--brand') ?? brandRaw, scopes));
            const dob = parseColor(resolveVarRefs(dark.get('--on-brand') ?? onBrandRaw, scopes));
            assert.ok(db && dob, 'sombre : --brand ou --on-brand illisible');
            const darkPair = contrastRatio(db, dob);
            assert.ok(darkPair >= 4.5, `sombre : --on-brand sur --brand ${darkPair.toFixed(2)}:1 < 4,5:1`);
        }

        const decorRaw = root.get('--brand-decor');
        assert.ok(decorRaw, '--brand-decor absent de :root');
        assert.deepEqual(parseColor(resolveVarRefs(decorRaw, [root])), [255, 87, 34], `--brand-decor = ${decorRaw}, attendu #FF5722 (décor seulement)`);
    });
});

// ── Q. Composants partagés ─────────────────────────────────────────────────

describe('Q — composants partagés (components/ui)', () => {
    test('Button : au moins 44 px à toutes les tailles (min-h-11, icône min-w-11), primaire plein bg-brand et text-on-brand', () => {
        const file = 'components/ui/Button.tsx';
        const sf = sourceOf(file);
        const literals = allStringLiterals(sf);
        const base = literals.find((s) => /(?<![\w-])inline-flex(?![\w-])/.test(s) && /(?<![\w-])min-h-11(?![\w-])/.test(s));
        const sizes = objectStrings(sf, 'sizes');
        if (!base) {
            assert.ok(sizes && sizes.size > 0, `${file} : ni classe de base avec min-h-11, ni objet sizes lisible`);
            const short = Array.from(sizes.entries()).filter(([, cls]) => !/(?<![\w-])min-h-11(?![\w-])/.test(cls));
            assert.deepEqual(short.map(([k, cls]) => `${k}: ${cls}`), [], `${file} : tailles sans min-h-11 (44 px)`);
        }
        const icon = sizes?.get('icon');
        if (icon !== undefined) assert.match(icon, /(?<![\w-])(?:min-w-11|w-11|w-12|w-14)(?![\w-])/, `${file} : taille icon < 44 px de large (${icon})`);
        assert.ok(!literals.some((s) => /(?<![\w-])sm:h-13(?![\w-])/.test(s)), `${file} : sm:h-13 n'existe pas dans l'échelle Tailwind`);
        const primary = objectStrings(sf, 'variants')?.get('primary');
        assert.ok(primary !== undefined, `${file} : variante primary introuvable`);
        assert.match(primary, /(?<![\w-])bg-brand(?![\w-])/, `${file} : primaire sans fond plein bg-brand (${primary})`);
        assert.match(primary, /(?<![\w-])text-on-brand(?![\w-])/, `${file} : primaire sans text-on-brand (${primary})`);
        assert.doesNotMatch(primary, /bg-gradient|from-|to-\[/, `${file} : primaire encore en dégradé (${primary})`);
    });

    test('Modal : role dialog, aria-modal, aria-labelledby, Escape, piège de focus, focus restitué, bouton Fermer de 44 px avec aria-label', () => {
        const { file, code } = requireComponent('Modal');
        const checks: Array<[string, boolean]> = [
            ['role="dialog" (ou alertdialog)', /role\s*[=:]\s*\{?\s*["'](?:alert)?dialog["']/.test(code)],
            ['aria-modal', /aria-modal/.test(code)],
            ['aria-labelledby', /aria-labelledby/.test(code)],
            ['fermeture par Escape', /["']Escape["']/.test(code)],
            ['piège de focus (touche Tab et éléments focalisables)', /["']Tab["']/.test(code) && /querySelectorAll|focusable/i.test(code)],
            ['restitution du focus (document.activeElement puis .focus())', /document\.activeElement/.test(code) && /\.focus\(/.test(code)],
            ['bouton Fermer avec aria-label', /(?:aria-label|label)\s*=\s*\{?\s*["']Fermer["']/.test(code)],
            ['bouton Fermer de 44 px (IconButton, ou h-11 et w-11)', /<IconButton\b/.test(code)
                || (/(?<![\w-])(?:min-)?h-11(?![\w-])/.test(code) && /(?<![\w-])(?:min-)?w-11(?![\w-])/.test(code))],
        ];
        const missing = checks.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${file} : exigences manquantes : ${missing.join(' ; ')}`);
    });

    test('ConfirmDialog : children, requireText (saisie comparée, champ étiqueté) et isLoading', () => {
        const { file, code } = requireComponent('ConfirmDialog');
        const checks: Array<[string, boolean]> = [
            ['prop requireText: string', /requireText\??\s*:\s*string/.test(code)],
            ['prop children (contenu : impact de l’annulation)', /children\??\s*:\s*(?:React\.)?ReactNode/.test(code)],
            ['prop isLoading: boolean', /isLoading\??\s*:\s*boolean/.test(code)],
            ['saisie comparée à requireText', /requireText[^;\n]*(?:===|!==)|(?:===|!==)[^;\n]*requireText/.test(code)],
            ['champ de saisie étiqueté (TextInput/Field, ou input + htmlFor)', /<(?:TextInput|Field)\b/.test(code) || (/<input\b/.test(code) && /htmlFor/.test(code))],
            ['construit sur Modal', /<Modal\b/.test(code)],
        ];
        const missing = checks.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${file} : exigences manquantes : ${missing.join(' ; ')}`);
    });

    test('ReasonDialog : motif obligatoire (au moins 3 caractères), champ étiqueté, sur Modal ou ConfirmDialog', () => {
        const { file, code } = requireComponent('ReasonDialog');
        const checks: Array<[string, boolean]> = [
            ['onConfirm reçoit le motif', /onConfirm\??\s*:\s*\(\s*\w+\s*:\s*string/.test(code)],
            ['longueur minimale du motif (3)', /minLength|MIN_REASON|\.trim\(\)\.length\s*(?:<|>=)\s*3\b/.test(code)],
            ['champ étiqueté (Textarea/Field, ou textarea + htmlFor)', /<(?:Textarea|Field)\b/.test(code) || (/<textarea\b/.test(code) && /htmlFor/.test(code))],
            ['construit sur Modal ou ConfirmDialog', /<(?:Modal|ConfirmDialog)\b/.test(code)],
        ];
        const missing = checks.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${file} : exigences manquantes : ${missing.join(' ; ')}`);
    });

    test('KpiCard et KpiCardSkeleton : label, value, hint, tone, icon, loading', () => {
        const { file, code } = requireComponent('KpiCard');
        assert.ok(componentFile('KpiCardSkeleton'), 'KpiCardSkeleton absent de components/ui');
        const missing = ['label', 'value', 'hint', 'tone', 'icon', 'loading'].filter((p) => !new RegExp(`\\b${p}\\??\\s*:`).test(code));
        assert.deepEqual(missing, [], `${file} : props manquantes : ${missing.join(', ')}`);
    });

    test('Tabs : role tablist et tab, aria-selected, flèches gauche et droite, compteur par onglet', () => {
        const { file, code } = requireComponent('Tabs');
        const checks: Array<[string, boolean]> = [
            ['role="tablist"', /["']tablist["']/.test(code)],
            ['role="tab"', /role\s*=\s*\{?\s*["']tab["']/.test(code)],
            ['aria-selected', /aria-selected/.test(code)],
            ['ArrowRight', /["']ArrowRight["']/.test(code)],
            ['ArrowLeft', /["']ArrowLeft["']/.test(code)],
            ['compteur (count: number)', /\bcount\??\s*:\s*number/.test(code)],
        ];
        const missing = checks.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${file} : exigences manquantes : ${missing.join(' ; ')}`);
    });

    test('Pagination : <nav aria-label>, Précédent, Suivant, « Page X sur Y », cibles de 44 px', () => {
        const { file, code } = requireComponent('Pagination');
        const checks: Array<[string, boolean]> = [
            ['<nav aria-label>', /<nav\b[^>]*aria-label/.test(code)],
            ['Précédent', /Précédent/.test(code)],
            ['Suivant', /Suivant/.test(code)],
            ['« Page X sur Y »', /[Pp]age\s*\$?\{[^}]+\}\s*sur\s*\$?\{[^}]+\}/.test(code)],
            ['cibles de 44 px (Button, IconButton, LinkButton ou min-h-11)', /<(?:Button|IconButton|LinkButton)\b/.test(code) || /(?<![\w-])min-h-11(?![\w-])/.test(code)],
        ];
        const missing = checks.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${file} : exigences manquantes : ${missing.join(' ; ')}`);
    });

    test('PageHeader : <h1>, title, description, actions qui passent à la ligne (flex-wrap)', () => {
        const { file, code } = requireComponent('PageHeader');
        const checks: Array<[string, boolean]> = [
            ['<h1>', /<h1\b/.test(code)],
            ['prop title', /\btitle\??\s*:/.test(code)],
            ['prop description', /\bdescription\??\s*:/.test(code)],
            ['prop actions', /\bactions\??\s*:/.test(code)],
            ['flex-wrap', /(?<![\w-])flex-wrap(?![\w-])/.test(code)],
        ];
        const missing = checks.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${file} : exigences manquantes : ${missing.join(' ; ')}`);
    });

    test('IconButton : aria-label obligatoire dans le type, 44 × 44 px', () => {
        const { file, code } = requireComponent('IconButton');
        assert.match(code, /["']aria-label["']\s*:\s*string/, `${file} : 'aria-label' n'est pas une prop obligatoire (string sans « ? ») du type`);
        const ownSize = /(?<![\w-])(?:min-)?h-11(?![\w-])/.test(code) && /(?<![\w-])(?:min-)?w-11(?![\w-])/.test(code);
        const viaButton = /<Button\b/.test(code) && /size\s*=\s*["']icon["']/.test(code);
        assert.ok(ownSize || viaButton, `${file} : cible < 44 px (ni h-11/w-11, ni Button size="icon")`);
    });

    test('LinkButton : next/link stylé en bouton, sans <button> imbriqué, 44 px', () => {
        const { file, code } = requireComponent('LinkButton');
        assert.ok(bindingsOf(file).some((b) => b.spec === 'next/link'), `${file} : n'utilise pas next/link`);
        assert.doesNotMatch(code, /<(?:button|Button)\b/, `${file} : rend un bouton dans le lien (HTML invalide)`);
        const sized = /(?<![\w-])min-h-11(?![\w-])/.test(code) || bindingsOf(file).some((b) => b.from === 'components/ui/Button.tsx' && b.imported !== 'Button');
        assert.ok(sized, `${file} : ni min-h-11 ni classes partagées de Button.tsx`);
    });

    test('Field, TextInput, Textarea, Select : label lié (htmlFor, id), aide et erreur reliées (aria-describedby), aria-invalid', () => {
        const files = new Set<string>();
        const absent: string[] = [];
        for (const name of ['Field', 'TextInput', 'Textarea', 'Select']) {
            const f = componentFile(name);
            if (f) files.add(f);
            else absent.push(name);
        }
        assert.deepEqual(absent, [], `composants de champ absents de components/ui : ${absent.join(', ')}`);
        const code = Array.from(files).map(codeOf).join('\n');
        const checks: Array<[string, boolean]> = [
            ['htmlFor', /htmlFor/.test(code)],
            ['identifiant du champ (useId ou id)', /useId\(|\bid\s*=\s*\{/.test(code)],
            ['aria-describedby', /aria-describedby/.test(code)],
            ['aria-invalid', /aria-invalid/.test(code)],
        ];
        const missing = checks.filter(([, ok]) => !ok).map(([what]) => what);
        assert.deepEqual(missing, [], `${Array.from(files).join(', ')} : exigences manquantes : ${missing.join(' ; ')}`);
    });

    test('DataList : tableau à partir de md, cartes en dessous', () => {
        const { file, code } = requireComponent('DataList');
        assert.match(code, /<table\b/, `${file} : pas de <table>`);
        assert.match(code, /(?<![\w-])md:hidden(?![\w-])/, `${file} : pas de vue cartes masquée à partir de md (md:hidden)`);
        assert.match(code, /(?<![\w-])hidden(?![\w-])[^"'`]*(?<![\w-])md:(?:block|table)(?![\w-])|(?<![\w-])md:(?:block|table)(?![\w-])[^"'`]*(?<![\w-])hidden(?![\w-])/,
            `${file} : tableau non masqué sous md (hidden md:block / md:table)`);
    });

    test('StatusBanner : annoncé aux lecteurs d’écran (role status ou alert, ou aria-live)', () => {
        const { file, code } = requireComponent('StatusBanner');
        assert.ok((/role\s*=/.test(code) && /["'](?:status|alert)["']/.test(code)) || /aria-live/.test(code), `${file} : ni role status/alert ni aria-live`);
    });

    test('LiveIndicator : « En direct » et « Hors ligne », annoncé (role status ou aria-live)', () => {
        const { file, code } = requireComponent('LiveIndicator');
        assert.match(code, /En direct/, `${file} : libellé « En direct » absent`);
        assert.match(code, /Hors ligne/, `${file} : libellé « Hors ligne » absent`);
        assert.ok(/aria-live/.test(code) || (/role\s*=/.test(code) && /["']status["']/.test(code)), `${file} : ni aria-live ni role status`);
    });

    test('ErrorState : onRetry obligatoire et bouton « Réessayer » ; EmptyState présent', () => {
        const { file, code } = requireComponent('ErrorState');
        assert.match(code, /\bonRetry\s*:\s*\(/, `${file} : onRetry optionnel (contrat Q : ErrorState toujours avec « Réessayer »)`);
        assert.match(code, /Réessayer/, `${file} : libellé « Réessayer » absent`);
        assert.ok(componentFile('EmptyState'), 'EmptyState absent de components/ui');
    });
});

// ── Q. MASTER.md ───────────────────────────────────────────────────────────

describe('Q — design-system/event-village/MASTER.md', () => {
    test('versionné, généré puis complété des règles du lot (brand-decor, text-caption)', () => {
        const file = 'design-system/event-village/MASTER.md';
        assert.ok(isFile(file), `${file} absent (contrat Q : généré avec ui-ux-pro-max --persist, puis versionné)`);
        const md = readText(file);
        assert.ok(md.split(/\r?\n/).filter((l) => l.trim()).length >= 30, `${file} : moins de 30 lignes utiles`);
        assert.match(md, /Event Village/i, `${file} : le projet n'est pas nommé`);
        assert.match(md, /brand-decor/, `${file} : la règle brand-decor (décor seulement) n'est pas consignée`);
        assert.match(md, /text-caption/, `${file} : la règle text-caption (petite taille réservée) n'est pas consignée`);
    });
});

// ── Q. Fichiers migrés ─────────────────────────────────────────────────────

describe('Q — fichiers migrés (tests/helpers/design-files.ts)', () => {
    test('garde-fou du détecteur : un fichier fautif est signalé règle par règle, les commentaires sont ignorés', () => {
        const bad = [
            "'use client';",
            "import Link from 'next/link';",
            "import { Button } from '@/components/ui/Button';",
            '// commentaire ignoré : #FF5722 bg-slate-100 text-xs § 12 BROUILLON',
            '/* bloc ignoré : text-[11px] PUBLIE */',
            'export function Mauvais({ ev }: { ev: { status: string } }) {',
            '    return (',
            '        <div className="bg-[#FF5722] text-slate-600 dark:bg-zinc-900 text-xs">',
            '            {/* PUBLIE ignoré */}',
            '            <p className="text-[11px]">Soumettre (§31) 🔴</p>',
            '            <span>BROUILLON</span>',
            '            <span>{ev.status}</span>',
            '            <span title="EN_ATTENTE">x</span>',
            '            <span className="text-caption">légende</span>',
            '            <Link href="/x"><Button>Ouvrir</Button></Link>',
            "            <div style={{ color: 'rgba(255, 87, 34, 0.4)' }} />",
            '        </div>',
            '    );',
            '}',
        ].join('\n');
        const v = designViolations('app/exemple/mauvais.tsx', bad);
        const rules = (prefix: string): number[] => v.filter((x) => x.rule.startsWith(prefix)).map((x) => x.line);
        assert.deepEqual(rules('couleur #hex'), [8], formatViolations('mauvais', v));
        assert.deepEqual(rules('couleur rgb()'), [16], formatViolations('mauvais', v));
        assert.deepEqual(rules('palette Tailwind brute'), [8], formatViolations('mauvais', v));
        assert.deepEqual(rules('text-xs'), [8], formatViolations('mauvais', v));
        assert.deepEqual(rules('taille de texte'), [10], formatViolations('mauvais', v));
        assert.deepEqual(rules('référence « § »'), [10], formatViolations('mauvais', v));
        assert.deepEqual(rules('emoji'), [10], formatViolations('mauvais', v));
        assert.deepEqual(rules('enum de statut dans le texte JSX'), [11], formatViolations('mauvais', v));
        assert.deepEqual(rules('statut brut affiché'), [12], formatViolations('mauvais', v));
        assert.deepEqual(rules('enum de statut affiché'), [13], formatViolations('mauvais', v));
        assert.deepEqual(rules('text-caption hors'), [14], formatViolations('mauvais', v));
        assert.deepEqual(rules('<Link>'), [15], formatViolations('mauvais', v));

        const a11yBad = [
            'export function A() {',
            '    return (',
            '        <section>',
            '            <div className="fixed inset-0 z-50 bg-surface" />',
            '            <label>Motif</label>',
            '            <textarea />',
            '            <button onClick={() => null}><XIcon /></button>',
            '            <Button size="icon"><XIcon /></Button>',
            '            <div className="w-[420px]" />',
            '            <table><tbody /></table>',
            '        </section>',
            '    );',
            '}',
        ].join('\n');
        const a = accessibilityViolations('app/exemple/a11y.tsx', a11yBad);
        const arules = (prefix: string): number[] => a.filter((x) => x.rule.startsWith(prefix)).map((x) => x.line);
        assert.deepEqual(arules('modale écrite à la main'), [4], formatViolations('a11y', a));
        assert.deepEqual(arules('<label>'), [5], formatViolations('a11y', a));
        assert.deepEqual(arules('<textarea>'), [6], formatViolations('a11y', a));
        assert.deepEqual(arules('bouton icône'), [7, 8], formatViolations('a11y', a));
        assert.deepEqual(arules('largeur fixe'), [9], formatViolations('a11y', a));
        assert.deepEqual(arules('<table>'), [10], formatViolations('a11y', a));
    });

    test('garde-fou du détecteur : un fichier conforme ne déclenche aucune règle', () => {
        const good = [
            "import { LinkButton } from '@/components/ui/LinkButton';",
            "import { StatusBadge } from '@/components/ui/StatusBadge';",
            "import { TextInput } from '@/components/ui/Field';",
            'export function Bon({ ev }: { ev: { status: string; at: string } }) {',
            '    return (',
            '        <section className="bg-surface text-fg border-border">',
            '            <StatusBadge domain="event" status={ev.status} />',
            "            {ev.status === 'PUBLIE' ? <p className=\"text-sm text-fg-muted\">Billetterie ouverte</p> : null}",
            '            <time className="text-caption text-fg-muted" dateTime={ev.at}>sam. 15 nov. 2026 à 20:00</time>',
            '            <LinkButton href="/partner/events">Retour à la liste</LinkButton>',
            '            <a href="#contenu">Aller au contenu</a>',
            '            <label htmlFor="motif">Motif</label>',
            '            <textarea id="motif" />',
            '            <TextInput label="Titre" />',
            '            <button type="button" aria-label="Fermer"><XIcon /></button>',
            '        </section>',
            '    );',
            '}',
        ].join('\n');
        const v = [...designViolations('app/exemple/bon.tsx', good), ...accessibilityViolations('app/exemple/bon.tsx', good)];
        assert.deepEqual(v, [], formatViolations('bon', v));
    });

    test('garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine', () => {
        const bad = MIGRATED_DESIGN_FILES.filter((f) => f.includes('\\') || f.startsWith('./') || f.startsWith('/') || !isFile(f));
        assert.deepEqual(bad, [], `entrées invalides ou fichiers absents : ${bad.join(', ')}`);
        const dup = MIGRATED_DESIGN_FILES.filter((f, i) => MIGRATED_DESIGN_FILES.indexOf(f) !== i);
        assert.deepEqual(dup, [], `doublons : ${dup.join(', ')}`);
    });

    test('la liste contient les écrans du lot (admin, liste et pilotage partenaire, formulaire, page publique, catalogue, accueil, mes billets, anciennes pages caisse et équipe)', () => {
        const listed = new Set(MIGRATED_DESIGN_FILES);
        const missing = EXPECTED_SCREENS.filter((f) => !listed.has(f));
        const absent = EXPECTED_SCREENS.filter((f) => !isFile(f));
        const formerMissing = FORMER_TAB_PAGES.filter((f) => isFile(f) && !listed.has(f));
        assert.deepEqual(absent, [], `écrans du lot absents du dépôt : ${absent.join(', ')}`);
        assert.deepEqual([...missing, ...formerMissing], [], `écrans du lot absents de MIGRATED_DESIGN_FILES (${MIGRATED_DESIGN_FILES.length} entrée(s)) : ${[...missing, ...formerMissing].join(', ')}`);
    });

    test('la liste contient les composants partagés créés ou corrigés par le lot', () => {
        const listed = new Set(MIGRATED_DESIGN_FILES);
        const problems: string[] = [];
        for (const name of SHARED_COMPONENTS) {
            const f = componentFile(name);
            if (!f) problems.push(`${name} : absent de components/ui`);
            else if (!listed.has(f)) problems.push(`${name} : ${f} absent de la liste`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });

    test('garde-fou : tout fichier .tsx créé par le lot dans app/ ou components/ figure dans la liste', () => {
        const listed = new Set(MIGRATED_DESIGN_FILES);
        const created = [...listFiles('app', /\.tsx$/), ...listFiles('components', /\.tsx$/)].filter((f) => !PRE_LOT5_UI_FILES.has(f));
        const missing = created.filter((f) => !listed.has(f));
        assert.deepEqual(missing, [], `fichiers créés par le lot hors de MIGRATED_DESIGN_FILES : ${missing.join(', ')}`);
    });

    for (const file of MIGRATED_DESIGN_FILES) {
        test(`règles du contrat Q : ${file}`, () => {
            assert.ok(isFile(file), `${file} absent`);
            const v = designViolations(file, readText(file));
            assert.deepEqual(v, [], `${v.length} écart(s) au système de design :\n${formatViolations(file, v)}`);
        });

        test(`accessibilité et mobile (DoD 3 et 7) : ${file}`, () => {
            assert.ok(isFile(file), `${file} absent`);
            const v = accessibilityViolations(file, readText(file));
            assert.deepEqual(v, [], `${v.length} écart(s) d'accessibilité :\n${formatViolations(file, v)}`);
        });
    }
});
