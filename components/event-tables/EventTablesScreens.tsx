'use client';

/**
 * Lot 11c-c — écrans lourds des tables d'un événement (éditeur et plan, pilotage), réunis dans UN module chargé par UN
 * seul import() (load.ts) : un seul morceau pour l'éditeur, le plan partagé et le pilotage, à l'ouverture de l'onglet
 * (leçon du lot poids : chaque import() écrit ailleurs ajoute une variante du morceau à la table de toutes les pages).
 */
export { TablesEditor } from './TablesEditor';
export { TablesPilotage } from './TablesPilotage';
