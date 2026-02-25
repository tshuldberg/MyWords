export type MyWordsProvider = 'freeDictionaryApi' | 'datamuse' | 'wiktionaryApi';

export interface MyWordsLanguage {
  code: string;
  name: string;
  words: number;
}

export interface MyWordsQuote {
  text: string;
  reference?: string;
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

export interface MyWordsSense {
  definition: string;
  tags: string[];
  examples: string[];
  quotes: MyWordsQuote[];
  synonyms: string[];
  antonyms: string[];
  subsenses: MyWordsSense[];
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

export interface LookupWordInput {
  languageCode: string;
  word: string;
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
  wordHistory: string[];
  firstKnownUse: string | null;
  didYouKnow: string | null;
  rhymes: string[];
  nearbyWords: string[];
  providers: MyWordsProvider[];
  attributions: MyWordsAttribution[];
}

function readEnv(name: string): string | undefined {
  const processRef = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const raw = processRef?.env?.[name];
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
}

const FREE_DICTIONARY_BASE =
  readEnv('MYWORDS_FREE_DICTIONARY_BASE_URL') || 'https://freedictionaryapi.com/api/v1';
const DATAMUSE_BASE = readEnv('MYWORDS_DATAMUSE_BASE_URL') || 'https://api.datamuse.com';
const WIKTIONARY_BASE =
  readEnv('MYWORDS_WIKTIONARY_API_BASE_URL') || 'https://en.wiktionary.org/w/api.php';

const LANG_CACHE_MS = 24 * 60 * 60 * 1000;
const LOOKUP_CACHE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

const FALLBACK_LANGUAGES: MyWordsLanguage[] = [
  { code: 'en', name: 'English', words: 1343902 },
  { code: 'es', name: 'Spanish', words: 759364 },
  { code: 'fr', name: 'French', words: 386156 },
  { code: 'de', name: 'German', words: 344102 },
  { code: 'pt', name: 'Portuguese', words: 404401 },
  { code: 'it', name: 'Italian', words: 586801 },
  { code: 'ru', name: 'Russian', words: 425090 },
  { code: 'zh', name: 'Chinese', words: 170344 },
];

const ATTR_FREE_DICTIONARY: MyWordsAttribution = {
  name: 'Free Dictionary API (Wiktionary-backed)',
  url: 'https://freedictionaryapi.com',
  license: 'Wiktionary content under CC BY-SA 4.0.',
};

const ATTR_DATAMUSE: MyWordsAttribution = {
  name: 'Datamuse API',
  url: 'https://www.datamuse.com/api/',
  license: 'Datamuse public API terms.',
};

const ATTR_WIKTIONARY: MyWordsAttribution = {
  name: 'Wiktionary API (MediaWiki)',
  url: 'https://en.wiktionary.org/w/api.php',
  license: 'Wiktionary content under CC BY-SA 4.0.',
};

let languageCache: { expiresAt: number; value: MyWordsLanguage[] } | null = null;
const lookupCache = new Map<string, { expiresAt: number; value: MyWordsLookupResult | null }>();

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const normalized = raw.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function dedupeQuotes(quotes: MyWordsQuote[]): MyWordsQuote[] {
  const seen = new Set<string>();
  const out: MyWordsQuote[] = [];
  for (const quote of quotes) {
    const text = quote.text.trim();
    const reference = quote.reference?.trim() ?? '';
    if (!text) continue;
    const key = `${text.toLocaleLowerCase()}::${reference.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reference ? { text, reference } : { text });
  }
  return out;
}

function cacheKey(input: LookupWordInput): string {
  return `${input.languageCode.trim().toLocaleLowerCase()}::${input.word.trim().toLocaleLowerCase()}`;
}

function normalizeSense(raw: unknown): MyWordsSense | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  const definition = typeof entry.definition === 'string' ? entry.definition.trim() : '';
  if (!definition) return null;

  const tags = Array.isArray(entry.tags) ? dedupe(entry.tags.filter((x): x is string => typeof x === 'string')) : [];
  const examples = Array.isArray(entry.examples)
    ? dedupe(entry.examples.filter((x): x is string => typeof x === 'string'))
    : [];
  const synonyms = Array.isArray(entry.synonyms)
    ? dedupe(entry.synonyms.filter((x): x is string => typeof x === 'string'))
    : [];
  const antonyms = Array.isArray(entry.antonyms)
    ? dedupe(entry.antonyms.filter((x): x is string => typeof x === 'string'))
    : [];

  const quotes = Array.isArray(entry.quotes)
    ? dedupeQuotes(
        entry.quotes
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map((quote) => {
            const text = typeof quote.text === 'string' ? quote.text.trim() : '';
            const reference = typeof quote.reference === 'string' ? quote.reference.trim() : '';
            return reference ? { text, reference } : { text };
          })
          .filter((quote) => quote.text.length > 0),
      )
    : [];

  const subsensesRaw = Array.isArray(entry.subsenses) ? entry.subsenses : [];
  const subsenses = subsensesRaw.map(normalizeSense).filter((sense): sense is MyWordsSense => Boolean(sense));

  return {
    definition,
    tags,
    examples,
    quotes,
    synonyms,
    antonyms,
    subsenses,
  };
}

function normalizeEntry(raw: unknown): { entry: MyWordsEntry; language: { code: string; name: string } } | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const language = value.language;
  const langCode = typeof (language as Record<string, unknown> | undefined)?.code === 'string'
    ? ((language as Record<string, unknown>).code as string).trim()
    : '';
  const langName = typeof (language as Record<string, unknown> | undefined)?.name === 'string'
    ? ((language as Record<string, unknown>).name as string).trim()
    : '';
  if (!langCode || !langName) return null;

  const partOfSpeech = typeof value.partOfSpeech === 'string' ? value.partOfSpeech.trim() || 'unknown' : 'unknown';

  const pronunciations = Array.isArray(value.pronunciations)
    ? value.pronunciations
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => {
          const text = typeof item.text === 'string' ? item.text.trim() : '';
          const type = typeof item.type === 'string' ? item.type.trim() : '';
          const tags = Array.isArray(item.tags) ? dedupe(item.tags.filter((x): x is string => typeof x === 'string')) : [];
          if (!text) return null;
          return type ? { text, type, tags } : { text, tags };
        })
        .filter((item): item is MyWordsPronunciation => Boolean(item))
    : [];

  const forms = Array.isArray(value.forms)
    ? value.forms
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => {
          const word = typeof item.word === 'string' ? item.word.trim() : '';
          const tags = Array.isArray(item.tags) ? dedupe(item.tags.filter((x): x is string => typeof x === 'string')) : [];
          if (!word) return null;
          return { word, tags };
        })
        .filter((item): item is MyWordsForm => Boolean(item))
    : [];

  const senses = Array.isArray(value.senses)
    ? value.senses.map(normalizeSense).filter((sense): sense is MyWordsSense => Boolean(sense))
    : [];
  if (senses.length === 0) return null;

  const synonyms = Array.isArray(value.synonyms)
    ? dedupe(value.synonyms.filter((x): x is string => typeof x === 'string'))
    : [];
  const antonyms = Array.isArray(value.antonyms)
    ? dedupe(value.antonyms.filter((x): x is string => typeof x === 'string'))
    : [];

  return {
    language: { code: langCode, name: langName },
    entry: {
      partOfSpeech,
      pronunciations,
      forms,
      senses,
      synonyms,
      antonyms,
    },
  };
}

function flattenSenses(senses: MyWordsSense[]): MyWordsSense[] {
  const out: MyWordsSense[] = [];
  for (const sense of senses) {
    out.push(sense);
    if (sense.subsenses.length > 0) {
      out.push(...flattenSenses(sense.subsenses));
    }
  }
  return out;
}

function inferFirstKnownUse(entries: MyWordsEntry[], wordHistory: string[]): string | null {
  const candidates: Array<{ score: number; label: string }> = [];
  const texts = [
    ...entries.flatMap((entry) => flattenSenses(entry.senses).map((sense) => sense.definition)),
    ...wordHistory,
  ];

  for (const text of texts) {
    const centuryMatches = Array.from(text.matchAll(/\bfrom\s+(\d{1,2})(?:st|nd|rd|th)\s*c(?:entury|\.)?/gi));
    for (const match of centuryMatches) {
      const century = Number(match[1]);
      if (!Number.isFinite(century) || century < 1 || century > 30) continue;
      const suffix = century % 10 === 1 && century % 100 !== 11
        ? 'st'
        : century % 10 === 2 && century % 100 !== 12
          ? 'nd'
          : century % 10 === 3 && century % 100 !== 13
            ? 'rd'
            : 'th';
      candidates.push({ score: century * 100, label: `${century}${suffix} century` });
    }
    const yearMatches = Array.from(text.matchAll(/\b(?:from|since)\s+(\d{4})\b/gi));
    for (const match of yearMatches) {
      const year = Number(match[1]);
      if (!Number.isFinite(year) || year < 500 || year > 2500) continue;
      candidates.push({ score: year, label: String(year) });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.score - b.score);
  return `${candidates[0]?.label ?? ''} (earliest attestation marker from Wiktionary data)`;
}

function ensureProviderAndAttribution(
  result: MyWordsLookupResult,
  provider: MyWordsProvider,
  attribution: MyWordsAttribution,
): void {
  if (!result.providers.includes(provider)) {
    result.providers.push(provider);
  }
  if (!result.attributions.some((item) => item.name === attribution.name && item.url === attribution.url)) {
    result.attributions.push(attribution);
  }
}

async function fetchJson(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWordsFromDatamuse(url: string): Promise<string[]> {
  const { status, data } = await fetchJson(url, 7000);
  if (status !== 200 || !Array.isArray(data)) return [];
  const words = data
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => (typeof item.word === 'string' ? item.word : ''))
    .filter((word) => word.trim().length > 0);
  return dedupe(words);
}

async function fetchEnglishThesaurusFromDatamuse(word: string): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const term = word.trim();
  if (!term) return { synonyms: [], antonyms: [] };
  const [synonyms, antonyms] = await Promise.all([
    fetchWordsFromDatamuse(`${DATAMUSE_BASE}/words?rel_syn=${encodeURIComponent(term)}&max=32`),
    fetchWordsFromDatamuse(`${DATAMUSE_BASE}/words?rel_ant=${encodeURIComponent(term)}&max=32`),
  ]);
  return { synonyms, antonyms };
}

async function fetchEnglishRhymesFromDatamuse(word: string): Promise<string[]> {
  const term = word.trim();
  if (!term) return [];
  return fetchWordsFromDatamuse(`${DATAMUSE_BASE}/words?rel_rhy=${encodeURIComponent(term)}&max=32`);
}

interface WiktionarySection {
  line: string;
  index: string;
  level: string;
  toclevel: number;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)));
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim();
}

async function fetchWiktionaryJson(params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const { status, data } = await fetchJson(`${WIKTIONARY_BASE}?${query.toString()}`);
  if (status !== 200) {
    throw new Error(`Wiktionary API returned ${status}.`);
  }
  return data;
}

async function fetchEnglishSections(word: string): Promise<WiktionarySection[]> {
  const raw = await fetchWiktionaryJson({
    action: 'parse',
    page: word,
    prop: 'sections',
    redirects: '1',
  });
  return (raw as { parse?: { sections?: WiktionarySection[] } }).parse?.sections ?? [];
}

async function fetchSectionHtml(word: string, index: string): Promise<string> {
  const raw = await fetchWiktionaryJson({
    action: 'parse',
    page: word,
    prop: 'text',
    section: index,
    disableeditsection: '1',
    redirects: '1',
  });
  return ((raw as { parse?: { text?: { '*': string } } }).parse?.text?.['*'] ?? '').trim();
}

function findEnglishSectionIndexes(sections: WiktionarySection[]): {
  etymology?: string;
  related: string[];
  derived: string[];
} {
  let inEnglish = false;
  let englishTocLevel = 0;
  let etymology: string | undefined;
  const related: string[] = [];
  const derived: string[] = [];

  for (const section of sections) {
    const line = stripHtml(section.line);
    const level = Number(section.level);

    if (section.toclevel === 1 && level === 2) {
      inEnglish = line.toLocaleLowerCase() === 'english';
      englishTocLevel = inEnglish ? section.toclevel : 0;
      continue;
    }

    if (!inEnglish) continue;
    if (section.toclevel <= englishTocLevel && level <= 2) {
      inEnglish = false;
      continue;
    }
    if (!etymology && /^Etymology(?:\s+\d+)?$/i.test(line)) {
      etymology = section.index;
      continue;
    }
    if (/^Related terms$/i.test(line)) {
      related.push(section.index);
      continue;
    }
    if (/^Derived terms$/i.test(line)) {
      derived.push(section.index);
    }
  }

  return { etymology, related, derived };
}

function extractParagraphs(html: string): string[] {
  return dedupe(
    Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
      .map((match) => stripHtml(match[1] ?? ''))
      .filter((line) => line.length > 0)
      .filter((line) => !/^Etymology$/i.test(line)),
  );
}

function extractLinkedTerms(html: string, word: string): string[] {
  return dedupe(
    Array.from(html.matchAll(/<a[^>]+href="\/wiki\/[^"#?]+[^>]*>([\s\S]*?)<\/a>/gi))
      .map((match) => stripHtml(match[1] ?? ''))
      .filter((item) => /^[A-Za-z][A-Za-z -]{1,50}$/.test(item))
      .filter((item) => item.toLocaleLowerCase() !== word.toLocaleLowerCase()),
  );
}

function toDidYouKnow(wordHistory: string[]): string | null {
  const base = wordHistory[0]?.trim();
  if (!base) return null;
  if (base.length <= 320) return base;
  return `${base.slice(0, 317)}...`;
}

async function fetchEnglishWordHistoryFromWiktionary(word: string): Promise<{
  wordHistory: string[];
  didYouKnow: string | null;
  nearbyWords: string[];
}> {
  const normalizedWord = word.trim();
  if (!normalizedWord) return { wordHistory: [], didYouKnow: null, nearbyWords: [] };

  const sections = await fetchEnglishSections(normalizedWord);
  const indexes = findEnglishSectionIndexes(sections);

  let wordHistory: string[] = [];
  if (indexes.etymology) {
    const etymologyHtml = await fetchSectionHtml(normalizedWord, indexes.etymology);
    wordHistory = extractParagraphs(etymologyHtml);
  }

  const relatedIndexes = [...indexes.related, ...indexes.derived].slice(0, 4);
  const relatedResults = await Promise.allSettled(
    relatedIndexes.map(async (index) => {
      const html = await fetchSectionHtml(normalizedWord, index);
      return extractLinkedTerms(html, normalizedWord);
    }),
  );

  const nearbyWords = dedupe(
    relatedResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
  ).slice(0, 24);

  return {
    wordHistory,
    didYouKnow: toDidYouKnow(wordHistory),
    nearbyWords,
  };
}

async function lookupWordInFreeDictionary(
  languageCode: string,
  word: string,
): Promise<{
  word: string;
  language: { code: string; name: string };
  entries: MyWordsEntry[];
  synonyms: string[];
  antonyms: string[];
} | null> {
  const code = languageCode.trim().toLocaleLowerCase();
  const term = word.trim();
  const { status, data } = await fetchJson(
    `${FREE_DICTIONARY_BASE}/entries/${encodeURIComponent(code)}/${encodeURIComponent(term)}?limit=24`,
  );

  if (status === 404) return null;
  if (status !== 200 || !data || typeof data !== 'object') {
    throw new Error(`Dictionary lookup failed with status ${status}.`);
  }

  const payload = data as Record<string, unknown>;
  const rawWord = typeof payload.word === 'string' ? payload.word.trim() : term;
  const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
  const normalized = rawEntries
    .map(normalizeEntry)
    .filter((item): item is { entry: MyWordsEntry; language: { code: string; name: string } } => Boolean(item));

  if (normalized.length === 0) return null;

  const entries = normalized.map((item) => item.entry);
  const language = normalized[0]?.language ?? { code, name: code.toUpperCase() };
  const allSenses = entries.flatMap((entry) => flattenSenses(entry.senses));

  return {
    word: rawWord,
    language,
    entries,
    synonyms: dedupe([...entries.flatMap((entry) => entry.synonyms), ...allSenses.flatMap((sense) => sense.synonyms)]),
    antonyms: dedupe([...entries.flatMap((entry) => entry.antonyms), ...allSenses.flatMap((sense) => sense.antonyms)]),
  };
}

export async function getMyWordsLanguages(): Promise<MyWordsLanguage[]> {
  const now = Date.now();
  if (languageCache && languageCache.expiresAt > now) return languageCache.value;

  try {
    const { status, data } = await fetchJson(`${FREE_DICTIONARY_BASE}/languages`);
    if (status !== 200 || !Array.isArray(data)) throw new Error('language fetch failed');
    const languages = data
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        code: typeof item.code === 'string' ? item.code.trim() : '',
        name: typeof item.name === 'string' ? item.name.trim() : '',
        words: typeof item.words === 'number' ? item.words : 0,
      }))
      .filter((item) => item.code.length > 0 && item.name.length > 0)
      .sort((a, b) => b.words - a.words);

    if (languages.length === 0) throw new Error('empty language list');
    languageCache = { expiresAt: now + LANG_CACHE_MS, value: languages };
    return languages;
  } catch {
    languageCache = { expiresAt: now + 15 * 60 * 1000, value: FALLBACK_LANGUAGES };
    return FALLBACK_LANGUAGES;
  }
}

export async function lookupWord(input: LookupWordInput): Promise<MyWordsLookupResult | null> {
  const languageCode = input.languageCode.trim().toLocaleLowerCase();
  const word = input.word.trim();
  if (!languageCode) throw new Error('Language code is required.');
  if (!word) throw new Error('Word is required.');

  const key = cacheKey({ languageCode, word });
  const now = Date.now();
  const cached = lookupCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const primary = await lookupWordInFreeDictionary(languageCode, word);
  if (!primary) {
    lookupCache.set(key, { expiresAt: now + LOOKUP_CACHE_MS, value: null });
    return null;
  }

  const result: MyWordsLookupResult = {
    ...primary,
    requestedLanguageCode: languageCode,
    wordHistory: [],
    firstKnownUse: null,
    didYouKnow: null,
    rhymes: [],
    nearbyWords: [],
    providers: ['freeDictionaryApi'],
    attributions: [ATTR_FREE_DICTIONARY],
  };

  if (languageCode === 'en' && (result.synonyms.length < 6 || result.antonyms.length < 3)) {
    try {
      const fallback = await fetchEnglishThesaurusFromDatamuse(word);
      const mergedSynonyms = dedupe([...result.synonyms, ...fallback.synonyms]);
      const mergedAntonyms = dedupe([...result.antonyms, ...fallback.antonyms]);
      if (mergedSynonyms.length > result.synonyms.length || mergedAntonyms.length > result.antonyms.length) {
        result.synonyms = mergedSynonyms;
        result.antonyms = mergedAntonyms;
        ensureProviderAndAttribution(result, 'datamuse', ATTR_DATAMUSE);
      }
    } catch {
      // no-op fallback error
    }
  }

  if (languageCode === 'en') {
    try {
      const enrichment = await fetchEnglishWordHistoryFromWiktionary(word);
      result.wordHistory = enrichment.wordHistory;
      result.didYouKnow = enrichment.didYouKnow;
      result.nearbyWords = dedupe([...(result.nearbyWords ?? []), ...enrichment.nearbyWords]).slice(0, 24);
      if (result.wordHistory.length > 0 || result.didYouKnow || result.nearbyWords.length > 0) {
        ensureProviderAndAttribution(result, 'wiktionaryApi', ATTR_WIKTIONARY);
      }
    } catch {
      // no-op enrichment error
    }

    try {
      const rhymes = await fetchEnglishRhymesFromDatamuse(word);
      if (rhymes.length > 0) {
        result.rhymes = dedupe([...(result.rhymes ?? []), ...rhymes]).slice(0, 24);
        ensureProviderAndAttribution(result, 'datamuse', ATTR_DATAMUSE);
      }
    } catch {
      // no-op rhymes error
    }
  }

  result.firstKnownUse = inferFirstKnownUse(result.entries, result.wordHistory);

  lookupCache.set(key, { expiresAt: now + LOOKUP_CACHE_MS, value: result });
  return result;
}

export function __resetMyWordsCacheForTests(): void {
  languageCache = null;
  lookupCache.clear();
}
