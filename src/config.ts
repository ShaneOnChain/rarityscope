/**
 * config.ts — the app's typed handle on the root `collection.config.ts`.
 * Import from here (`@/config`) anywhere in src/ so there's a single import path.
 * To retarget RarityScope at a different collection, edit ../collection.config.ts (not this file).
 */
export { config, assertConfig } from '../collection.config'
export type { CollectionConfig, RarityMethod, GradeTier } from '../collection.config'
