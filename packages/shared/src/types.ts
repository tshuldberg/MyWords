export type MyWordsProvider = 'freeDictionaryApi' | 'datamuse' | 'wiktionaryApi';

export interface MyWordsLanguage {
  code: string;
  name: string;
  words: number;
}

export interface MyWordsSense {
  definition: string;
  tags: string[];
  examples: string[];
  quotes: MyWordsQuote[];
  synonyms: string[];
  antonyms: string[];
  subsenses: MyWordsSense[];
}

export interface MyWordsPronunciation {
  text: string;
  type?: string;
  tags: string[];
}

export interface MyWordsForm {
  word: string;
  tags: string[];
}

export interface MyWordsQuote {
  text: string;
  reference?: string;
}

export interface MyWordsEntry {
  partOfSpeech: string;
  pronunciations: MyWordsPronunciation[];
  forms: MyWordsForm[];
  senses: MyWordsSense[];
  synonyms: string[];
  antonyms: string[];
}

export interface MyWordsAttribution {
  name: string;
  url: string;
  license: string;
}

export interface MyWordsLookupResult {
  word: string;
  requestedLanguageCode: string;
  language: {
    code: string;
    name: string;
  };
  entries: MyWordsEntry[];
  synonyms: string[];
  antonyms: string[];
  wordHistory?: string[];
  chronology?: string[];
  firstKnownUse?: string | null;
  didYouKnow?: string | null;
  wordFamily?: string[];
  rhymes?: string[];
  nearbyWords?: string[];
  providers: MyWordsProvider[];
  attributions: MyWordsAttribution[];
}

export interface LookupWordInput {
  languageCode: string;
  word: string;
}

export interface BrowseAlphabeticalWordsInput {
  languageCode: string;
  letter: string;
  page?: number;
  pageSize?: number;
}

export interface MyWordsAlphabeticalBrowseResult {
  languageCode: string;
  letter: string;
  page: number;
  pageSize: number;
  total: number;
  words: string[];
  supported: boolean;
  message?: string;
}

export interface WordHelperInput {
  languageCode: string;
  sentence: string;
  targetWord: string;
  maxSuggestions?: number;
}

export interface MyWordsWordHelperSuggestion {
  replacement: string;
  replacedSentence: string;
  score: number;
  relevance: 'high' | 'medium' | 'related';
  contextMatch: boolean;
}

export interface MyWordsWordHelperResult {
  languageCode: string;
  sentence: string;
  targetWord: string;
  normalizedTargetWord: string;
  suggestions: MyWordsWordHelperSuggestion[];
  supported: boolean;
  message?: string;
  providers: MyWordsProvider[];
  attributions: MyWordsAttribution[];
}
