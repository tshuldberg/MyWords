'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  MyWordsAlphabeticalBrowseResult,
  MyWordsLanguage,
  MyWordsLookupResult,
  MyWordsSense,
  MyWordsWordHelperResult,
} from '@mywords/shared';
import {
  browseWordsAlphabetically,
  getMyWordsLanguages,
  lookupWord,
  suggestWordReplacements,
} from '@mywords/shared';

type MyWordsTab = 'search' | 'dictionary' | 'thesaurus' | 'helper';

const TABS: Array<{ key: MyWordsTab; label: string; subtitle: string }> = [
  { key: 'search', label: 'Search', subtitle: 'Direct word lookup' },
  { key: 'dictionary', label: 'Dictionary A-Z', subtitle: 'Browse words by letter' },
  { key: 'thesaurus', label: 'Thesaurus A-Z', subtitle: 'Browse words, then open synonyms/antonyms' },
  { key: 'helper', label: 'Word Helper', subtitle: 'Replace a selected word in sentence context' },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const BROWSE_PAGE_SIZE = 60;

function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const normalized = label.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function extractSelectableWords(sentence: string): string[] {
  const matches = sentence.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  return dedupeLabels(matches).slice(0, 120);
}

function getPronunciationLabels(result: MyWordsLookupResult | null): string[] {
  if (!result) return [];
  return dedupeLabels(
    result.entries.flatMap((entry) =>
      (entry.pronunciations ?? []).map((pronunciation) => {
        const details = [pronunciation.type, ...(pronunciation.tags ?? [])].filter(Boolean).join(', ');
        return details ? `${pronunciation.text} (${details})` : pronunciation.text;
      }),
    ),
  );
}

function getFormLabels(result: MyWordsLookupResult | null): string[] {
  if (!result) return [];
  return dedupeLabels(
    result.entries.flatMap((entry) =>
      (entry.forms ?? []).map((form) => {
        const details = (form.tags ?? []).join(', ');
        return details ? `${form.word} (${details})` : form.word;
      }),
    ),
  );
}

function renderSense(sense: MyWordsSense, key: string, depth = 0): React.ReactNode {
  const tags = sense.tags ?? [];
  const synonyms = sense.synonyms ?? [];
  const antonyms = sense.antonyms ?? [];
  const examples = sense.examples ?? [];
  const quotes = sense.quotes ?? [];
  const subsenses = sense.subsenses ?? [];

  return (
    <li key={key} style={{ ...styles.senseItem, ...(depth > 0 ? styles.subsenseItem : {}) }}>
      <p style={styles.senseDefinition}>{sense.definition}</p>
      {tags.length > 0 && <p style={styles.senseMeta}>Usage: {tags.join(', ')}</p>}
      {synonyms.length > 0 && <p style={styles.senseMeta}>Sense synonyms: {synonyms.join(', ')}</p>}
      {antonyms.length > 0 && <p style={styles.senseMeta}>Sense antonyms: {antonyms.join(', ')}</p>}

      {examples.length > 0 && (
        <div style={styles.senseBlock}>
          <p style={styles.senseBlockTitle}>Examples</p>
          <ul style={styles.senseBulletList}>
            {examples.map((example, index) => (
              <li key={`${key}-example-${index}`} style={styles.senseBulletItem}>
                {example}
              </li>
            ))}
          </ul>
        </div>
      )}

      {quotes.length > 0 && (
        <div style={styles.senseBlock}>
          <p style={styles.senseBlockTitle}>Citations</p>
          <ul style={styles.senseBulletList}>
            {quotes.map((quote, index) => (
              <li key={`${key}-quote-${index}`} style={styles.senseBulletItem}>
                <p style={styles.quoteText}>&ldquo;{quote.text}&rdquo;</p>
                {quote.reference && <p style={styles.quoteReference}>{quote.reference}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {subsenses.length > 0 && (
        <div style={styles.senseBlock}>
          <p style={styles.senseBlockTitle}>Sub-senses</p>
          <ol style={styles.subsenseList}>
            {subsenses.map((subsense, index) => renderSense(subsense, `${key}-subsense-${index}`, depth + 1))}
          </ol>
        </div>
      )}
    </li>
  );
}

export default function MyWordsPage() {
  const [tab, setTab] = useState<MyWordsTab>('search');
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [languageCode, setLanguageCode] = useState('en');
  const [word, setWord] = useState('');
  const [result, setResult] = useState<MyWordsLookupResult | null>(null);

  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [browseLetter, setBrowseLetter] = useState('A');
  const [browsePage, setBrowsePage] = useState(1);
  const [browseResult, setBrowseResult] = useState<MyWordsAlphabeticalBrowseResult | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  const [helperSentence, setHelperSentence] = useState('');
  const [helperTargetWord, setHelperTargetWord] = useState('');
  const [helperResult, setHelperResult] = useState<MyWordsWordHelperResult | null>(null);
  const [helperError, setHelperError] = useState<string | null>(null);
  const [helperLoading, setHelperLoading] = useState(false);

  const selectedLanguage = useMemo(
    () => languages.find((lang) => lang.code === languageCode),
    [languages, languageCode],
  );
  const pronunciationLabels = useMemo(() => getPronunciationLabels(result), [result]);
  const formLabels = useMemo(() => getFormLabels(result), [result]);
  const resultWordHistory = result?.wordHistory ?? [];
  const resultChronology = result?.chronology ?? [];
  const resultWordFamily = result?.wordFamily ?? [];
  const resultRhymes = result?.rhymes ?? [];
  const resultNearbyWords = result?.nearbyWords ?? [];
  const helperSelectableWords = useMemo(
    () => extractSelectableWords(helperSentence),
    [helperSentence],
  );

  const totalBrowsePages = useMemo(() => {
    if (!browseResult || browseResult.pageSize < 1) return 1;
    return Math.max(1, Math.ceil(browseResult.total / browseResult.pageSize));
  }, [browseResult]);

  useEffect(() => {
    let alive = true;
    void getMyWordsLanguages()
      .then((data) => {
        if (!alive) return;
        setLanguages(data);
        if (!data.some((lang) => lang.code === 'en') && data[0]) {
          setLanguageCode(data[0].code);
        }
      })
      .catch(() => {
        if (alive) setSearchError('Could not load language list.');
      });
    return () => {
      alive = false;
    };
  }, []);

  const runLookup = useCallback(
    async (query: string, lookupLanguageCode: string): Promise<void> => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchError('Enter a word.');
        setResult(null);
        return;
      }

      setSearchLoading(true);
      setSearchError(null);
      try {
        const data = await lookupWord({ languageCode: lookupLanguageCode, word: trimmed });
        if (!data) {
          const languageName =
            languages.find((lang) => lang.code === lookupLanguageCode)?.name ?? lookupLanguageCode;
          setSearchError(`No entry found for "${trimmed}" in ${languageName}.`);
          setResult(null);
        } else {
          setResult(data);
        }
      } catch (err) {
        setResult(null);
        setSearchError(err instanceof Error ? err.message : 'Lookup failed.');
      } finally {
        setSearchLoading(false);
      }
    },
    [languages],
  );

  const loadBrowse = useCallback(
    async (nextLanguageCode: string, nextLetter: string, nextPage: number): Promise<void> => {
      setBrowseLoading(true);
      setBrowseError(null);
      try {
        const data = await browseWordsAlphabetically({
          languageCode: nextLanguageCode,
          letter: nextLetter,
          page: nextPage,
          pageSize: BROWSE_PAGE_SIZE,
        });
        setBrowseResult(data);
      } catch (err) {
        setBrowseResult(null);
        setBrowseError(err instanceof Error ? err.message : 'Browse failed.');
      } finally {
        setBrowseLoading(false);
      }
    },
    [],
  );

  const runWordHelper = useCallback(async (): Promise<void> => {
    const sentence = helperSentence.trim();
    const targetWord = helperTargetWord.trim();
    if (!sentence) {
      setHelperError('Enter a sentence.');
      setHelperResult(null);
      return;
    }
    if (!targetWord) {
      setHelperError('Select or enter a word to replace.');
      setHelperResult(null);
      return;
    }

    setHelperLoading(true);
    setHelperError(null);
    try {
      const data = await suggestWordReplacements({
        languageCode,
        sentence,
        targetWord,
      });
      setHelperResult(data);
      if (!data.supported && data.message) {
        setHelperError(data.message);
      }
    } catch (err) {
      setHelperResult(null);
      setHelperError(err instanceof Error ? err.message : 'Word helper failed.');
    } finally {
      setHelperLoading(false);
    }
  }, [helperSentence, helperTargetWord, languageCode]);

  useEffect(() => {
    if (tab !== 'dictionary' && tab !== 'thesaurus') return;
    void loadBrowse(languageCode, browseLetter, browsePage);
  }, [tab, languageCode, browseLetter, browsePage, loadBrowse]);

  const onSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runLookup(word, languageCode);
  };

  const onHelperSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runWordHelper();
  };

  const onOpenWordFromBrowse = async (selectedWord: string) => {
    setWord(selectedWord);
    setTab('search');
    await runLookup(selectedWord, languageCode);
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>MyWords</h1>
      <p style={styles.subtitle}>Dictionary + thesaurus with direct search and A-Z browse.</p>

      <div style={styles.tabRow}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                ...styles.tabButton,
                ...(active ? styles.tabButtonActive : {}),
              }}
            >
              <span style={styles.tabLabel}>{item.label}</span>
              <span style={styles.tabSubtitle}>{item.subtitle}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.controlsRow}>
        <select
          value={languageCode}
          onChange={(event) => {
            setLanguageCode(event.target.value);
            setBrowsePage(1);
          }}
          style={styles.select}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.code})
            </option>
          ))}
        </select>

        {tab === 'search' && (
          <form onSubmit={(event) => void onSearchSubmit(event)} style={styles.form}>
            <input
              value={word}
              onChange={(event) => setWord(event.target.value)}
              placeholder="Search word"
              style={styles.input}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" style={styles.button} disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Look Up'}
            </button>
          </form>
        )}
      </div>

      {(tab === 'dictionary' || tab === 'thesaurus') && (
        <div style={styles.browseWrap}>
          <div style={styles.letterGrid}>
            {LETTERS.map((letter) => {
              const active = browseLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => {
                    setBrowseLetter(letter);
                    setBrowsePage(1);
                  }}
                  style={{
                    ...styles.letterButton,
                    ...(active ? styles.letterButtonActive : {}),
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          <div style={styles.paginationRow}>
            <button
              type="button"
              style={styles.pageButton}
              onClick={() => setBrowsePage((current) => Math.max(1, current - 1))}
              disabled={browseLoading || browsePage <= 1}
            >
              Previous
            </button>
            <p style={styles.paginationText}>
              Page {browsePage} of {totalBrowsePages}
            </p>
            <button
              type="button"
              style={styles.pageButton}
              onClick={() => setBrowsePage((current) => Math.min(totalBrowsePages, current + 1))}
              disabled={browseLoading || browsePage >= totalBrowsePages}
            >
              Next
            </button>
          </div>

          <div style={styles.browseCard}>
            {tab === 'thesaurus' && (
              <p style={styles.hint}>
                Pick a word below to open its thesaurus view (synonyms + antonyms).
              </p>
            )}
            {browseLoading && <p style={styles.muted}>Loading {browseLetter} words...</p>}
            {browseError && <p style={styles.error}>{browseError}</p>}
            {browseResult && !browseResult.supported && (
              <p style={styles.muted}>{browseResult.message ?? 'Alphabetical browse is not supported for this language.'}</p>
            )}
            {browseResult?.supported && (
              <>
                <p style={styles.muted}>
                  {browseResult.total.toLocaleString()} words found for "{browseResult.letter.toUpperCase()}".
                </p>
                <div style={styles.wordGrid}>
                  {browseResult.words.map((item) => (
                    <button
                      key={item}
                      type="button"
                      style={styles.wordButton}
                      onClick={() => void onOpenWordFromBrowse(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {browseResult.words.length === 0 && (
                  <p style={styles.muted}>No words found on this page.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'helper' && (
        <div style={styles.helperWrap}>
          <form onSubmit={(event) => void onHelperSubmit(event)} style={styles.helperForm}>
            <textarea
              value={helperSentence}
              onChange={(event) => setHelperSentence(event.target.value)}
              placeholder="Enter a sentence, e.g. The bright sun warmed the room."
              style={styles.helperTextarea}
              rows={4}
            />
            <div style={styles.helperWordRow}>
              <input
                value={helperTargetWord}
                onChange={(event) => setHelperTargetWord(event.target.value)}
                placeholder="Word to replace"
                style={styles.input}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" style={styles.button} disabled={helperLoading}>
                {helperLoading ? 'Finding Options...' : 'Suggest Replacements'}
              </button>
            </div>

            {helperSelectableWords.length > 0 && (
              <div style={styles.helperWordChips}>
                {helperSelectableWords.map((item) => {
                  const active = helperTargetWord.trim().toLocaleLowerCase() === item.toLocaleLowerCase();
                  return (
                    <button
                      key={`helper-word-${item}`}
                      type="button"
                      onClick={() => setHelperTargetWord(item)}
                      style={{
                        ...styles.helperWordChip,
                        ...(active ? styles.helperWordChipActive : {}),
                      }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            )}
          </form>

          {helperError && <p style={styles.error}>{helperError}</p>}

          {helperResult && (
            <div style={styles.helperResultCard}>
              {helperResult.message && <p style={styles.muted}>{helperResult.message}</p>}
              <p style={styles.muted}>
                {helperResult.suggestions.length} option{helperResult.suggestions.length === 1 ? '' : 's'} for "{helperResult.targetWord}".
              </p>
              <div style={styles.helperSuggestionList}>
                {helperResult.suggestions.map((item) => (
                  <div key={`${item.replacement}-${item.replacedSentence}`} style={styles.helperSuggestionItem}>
                    <div style={styles.helperSuggestionHeader}>
                      <button
                        type="button"
                        style={styles.helperReplacementButton}
                        onClick={() => void onOpenWordFromBrowse(item.replacement)}
                      >
                        {item.replacement}
                      </button>
                      <span style={styles.helperSuggestionMeta}>
                        {item.relevance}{item.contextMatch ? ' • context match' : ''}
                      </span>
                    </div>
                    <p style={styles.helperSentencePreview}>{item.replacedSentence}</p>
                  </div>
                ))}
              </div>
              {helperResult.suggestions.length === 0 && (
                <p style={styles.muted}>No replacement options found for this sentence.</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'search' && searchError && <p style={styles.error}>{searchError}</p>}

      {result && (
        <div style={styles.resultWrap}>
          <h2 style={styles.word}>{result.word}</h2>
          <p style={styles.meta}>
            {result.language.name} ({result.language.code.toUpperCase()})
          </p>

          {pronunciationLabels.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Pronunciations</h3>
              <p style={styles.tags}>{pronunciationLabels.join(' • ')}</p>
            </>
          )}

          {formLabels.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Word Forms</h3>
              <p style={styles.tags}>{formLabels.join(' • ')}</p>
            </>
          )}

          {resultWordHistory.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Word History</h3>
              <ul style={styles.historyList}>
                {resultWordHistory.map((item, index) => (
                  <li key={`history-${index}`} style={styles.historyItem}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {resultChronology.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Chronology</h3>
              <p style={styles.tags}>{resultChronology.join(' • ')}</p>
            </>
          )}

          {result.firstKnownUse && (
            <>
              <h3 style={styles.sectionTitle}>First Known Use</h3>
              <p style={styles.tags}>{result.firstKnownUse}</p>
            </>
          )}

          {result.didYouKnow && (
            <>
              <h3 style={styles.sectionTitle}>Did You Know?</h3>
              <p style={styles.infoBlock}>{result.didYouKnow}</p>
            </>
          )}

          {resultRhymes.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Rhymes</h3>
              <p style={styles.tags}>{resultRhymes.join(', ')}</p>
            </>
          )}

          {resultWordFamily.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Word Family</h3>
              <p style={styles.tags}>{resultWordFamily.join(', ')}</p>
            </>
          )}

          {resultNearbyWords.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Nearby Words</h3>
              <div style={styles.relatedWordGrid}>
                {resultNearbyWords.map((item) => (
                  <button
                    key={`nearby-${item}`}
                    type="button"
                    style={styles.relatedWordButton}
                    onClick={() => void onOpenWordFromBrowse(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}

          <h3 style={styles.sectionTitle}>Synonyms</h3>
          <p style={styles.tags}>{result.synonyms.join(', ') || 'None'}</p>

          <h3 style={styles.sectionTitle}>Antonyms</h3>
          <p style={styles.tags}>{result.antonyms.join(', ') || 'None'}</p>

          <h3 style={styles.sectionTitle}>Definitions</h3>
          {result.entries.map((entry, i) => {
            const senses = entry.senses ?? [];
            const entrySynonyms = entry.synonyms ?? [];
            const entryAntonyms = entry.antonyms ?? [];
            return (
              <div key={`${entry.partOfSpeech}-${i}`} style={styles.entry}>
                <p style={styles.pos}>{entry.partOfSpeech}</p>
                <p style={styles.entryMeta}>{senses.length} sense{senses.length === 1 ? '' : 's'}</p>
                {entrySynonyms.length > 0 && (
                  <p style={styles.entryDetail}>Entry synonyms: {entrySynonyms.join(', ')}</p>
                )}
                {entryAntonyms.length > 0 && (
                  <p style={styles.entryDetail}>Entry antonyms: {entryAntonyms.join(', ')}</p>
                )}
                <ol style={styles.list}>
                  {senses.map((sense, idx) => renderSense(sense, `${i}-${idx}`))}
                </ol>
              </div>
            );
          })}

          {(result.attributions ?? []).length > 0 && (
            <div style={styles.sourceWrap}>
              <h3 style={styles.sectionTitle}>Sources</h3>
              <ul style={styles.sourceList}>
                {(result.attributions ?? []).map((source, idx) => (
                  <li key={`${source.name}-${idx}`} style={styles.sourceItem}>
                    <span>{source.name}</span>{' '}
                    <a href={source.url} target="_blank" rel="noreferrer" style={styles.sourceLink}>
                      {source.url}
                    </a>{' '}
                    <span style={styles.sourceLicense}>({source.license})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedLanguage && (
            <p style={styles.attribution}>
              Requested language: {selectedLanguage.name} ({selectedLanguage.code.toUpperCase()})
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 980, margin: '0 auto' },
  title: { margin: 0, fontSize: '1.8rem', color: 'var(--text)' },
  subtitle: { margin: '0.4rem 0 1rem', color: 'var(--text-secondary)' },
  tabRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '1rem' },
  tabButton: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface)',
    color: 'var(--text)',
    textAlign: 'left',
    padding: '0.7rem 0.8rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  tabButtonActive: {
    borderColor: 'var(--accent-words)',
    background: 'rgba(14, 165, 233, 0.14)',
  },
  tabLabel: { fontSize: '0.95rem', fontWeight: 700 },
  tabSubtitle: { fontSize: '0.78rem', color: 'var(--text-secondary)' },
  controlsRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' },
  form: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: '1 1 380px' },
  input: {
    flex: '1 1 260px',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.6rem 0.7rem',
  },
  select: {
    flex: '0 1 230px',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.6rem 0.7rem',
  },
  button: {
    border: '1px solid var(--accent-words)',
    background: 'var(--accent-words)',
    color: '#0E0C09',
    borderRadius: 'var(--radius-sm)',
    padding: '0.6rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  browseWrap: { display: 'grid', gap: '0.8rem', marginBottom: '1rem' },
  letterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(36px, 1fr))',
    gap: '0.35rem',
  },
  letterButton: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.45rem 0.2rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  letterButtonActive: {
    borderColor: 'var(--accent-words)',
    color: 'var(--accent-words)',
    background: 'rgba(14, 165, 233, 0.14)',
  },
  paginationRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem' },
  pageButton: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.45rem 0.7rem',
    cursor: 'pointer',
  },
  paginationText: { margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' },
  browseCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface-elevated)',
    padding: '0.85rem',
  },
  helperWrap: { display: 'grid', gap: '0.85rem', marginBottom: '1rem' },
  helperForm: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface-elevated)',
    padding: '0.85rem',
    display: 'grid',
    gap: '0.75rem',
  },
  helperTextarea: {
    width: '100%',
    minHeight: '112px',
    resize: 'vertical',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.6rem 0.7rem',
    fontFamily: 'inherit',
    lineHeight: 1.45,
  },
  helperWordRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' },
  helperWordChips: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  helperWordChip: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    padding: '0.35rem 0.52rem',
    cursor: 'pointer',
  },
  helperWordChipActive: {
    borderColor: 'var(--accent-words)',
    color: 'var(--accent-words)',
    background: 'rgba(14, 165, 233, 0.14)',
  },
  helperResultCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface-elevated)',
    padding: '0.85rem',
    display: 'grid',
    gap: '0.6rem',
  },
  helperSuggestionList: { display: 'grid', gap: '0.55rem' },
  helperSuggestionItem: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    padding: '0.6rem 0.65rem',
    display: 'grid',
    gap: '0.35rem',
  },
  helperSuggestionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem' },
  helperReplacementButton: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--accent-words)',
    padding: '0.2rem 0.45rem',
    cursor: 'pointer',
  },
  helperSuggestionMeta: { color: 'var(--text-tertiary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  helperSentencePreview: { margin: 0, color: 'var(--text-secondary)', lineHeight: 1.45 },
  hint: { margin: '0 0 0.5rem', color: 'var(--text-secondary)' },
  wordGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.5rem',
    marginTop: '0.65rem',
  },
  wordButton: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    color: 'var(--text)',
    padding: '0.45rem 0.55rem',
    textAlign: 'left',
    cursor: 'pointer',
  },
  relatedWordGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '0.45rem',
  },
  relatedWordButton: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    color: 'var(--text)',
    padding: '0.42rem 0.52rem',
    textAlign: 'left',
    cursor: 'pointer',
  },
  error: { color: 'var(--danger)', marginTop: '0.4rem' },
  muted: { color: 'var(--text-secondary)', margin: 0 },
  resultWrap: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface-elevated)',
    padding: '1rem',
    marginTop: '0.8rem',
  },
  word: { margin: 0, color: 'var(--text)' },
  meta: { margin: '0.25rem 0 0.75rem', color: 'var(--text-secondary)' },
  sectionTitle: { margin: '0.75rem 0 0.35rem', color: 'var(--text)' },
  tags: { margin: 0, color: 'var(--text-secondary)' },
  infoBlock: {
    margin: 0,
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.55rem 0.65rem',
    background: 'var(--surface)',
  },
  historyList: { margin: 0, paddingLeft: '1.1rem' },
  historyItem: { color: 'var(--text-secondary)', marginBottom: '0.35rem' },
  entry: { marginTop: '0.75rem' },
  entryMeta: { margin: '0.15rem 0 0', color: 'var(--text-tertiary)', fontSize: '0.8rem' },
  entryDetail: { margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.86rem' },
  pos: { margin: 0, color: 'var(--accent-words)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' },
  list: { margin: '0.45rem 0 0', paddingLeft: '1.1rem', color: 'var(--text)' },
  senseItem: { marginBottom: '0.65rem' },
  subsenseItem: { marginBottom: '0.5rem' },
  senseDefinition: { margin: 0, color: 'var(--text)' },
  senseMeta: { margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.84rem' },
  senseBlock: { marginTop: '0.38rem' },
  senseBlockTitle: { margin: '0 0 0.22rem', color: 'var(--text-tertiary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' },
  senseBulletList: { margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)' },
  senseBulletItem: { marginBottom: '0.22rem' },
  quoteText: { margin: 0, color: 'var(--text-secondary)' },
  quoteReference: { margin: '0.12rem 0 0', color: 'var(--text-tertiary)', fontSize: '0.76rem' },
  subsenseList: { margin: '0.3rem 0 0', paddingLeft: '1.05rem' },
  sourceWrap: { marginTop: '0.8rem' },
  sourceList: { margin: 0, paddingLeft: '1.1rem' },
  sourceItem: { color: 'var(--text-secondary)', marginBottom: '0.22rem' },
  sourceLink: { color: 'var(--accent-words)' },
  sourceLicense: { color: 'var(--text-tertiary)' },
  attribution: { marginTop: '0.8rem', color: 'var(--text-tertiary)', fontSize: '0.82rem' },
};
