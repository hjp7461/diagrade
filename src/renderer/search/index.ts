export { escapeRegExp } from './escapeRegExp';
export { findMatches } from './findMatches';
export { chooseActiveIndex } from './chooseActiveIndex';
export { clearHighlights } from './clearHighlights';
export { searchOtherTabs, countMatches } from './searchOtherTabs';
export type {
  OtherTabResult,
  OtherTabInput,
  OtherTabSearchOptions,
  Fetcher
} from './searchOtherTabs';

export const SEARCH_MATCH_CLASS = 'diagrade-search-match';
export const SEARCH_MATCH_ACTIVE_CLASS = 'active';
export const SEARCH_BAR_CLASS = 'diagrade-search-bar';
