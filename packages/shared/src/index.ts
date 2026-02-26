export {
  getMyWordsLanguages,
  lookupWord,
  browseWordsAlphabetically,
  suggestWordReplacements,
  __resetMyWordsServiceCacheForTests,
} from './service';

export type {
  BrowseAlphabeticalWordsInput,
  LookupWordInput,
  WordHelperInput,
  MyWordsProvider,
  MyWordsLanguage,
  MyWordsPronunciation,
  MyWordsForm,
  MyWordsQuote,
  MyWordsSense,
  MyWordsEntry,
  MyWordsAttribution,
  MyWordsAlphabeticalBrowseResult,
  MyWordsWordHelperSuggestion,
  MyWordsWordHelperResult,
  MyWordsLookupResult,
} from './types';
