'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MyWordsLanguage, MyWordsLookupResult, MyWordsSense } from '@mywords/shared';
import { getMyWordsLanguages, lookupWord } from '@mywords/shared';

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

function getPronunciationLabels(result: MyWordsLookupResult | null): string[] {
  if (!result) return [];
  return dedupeLabels(
    result.entries.flatMap((entry) =>
      entry.pronunciations.map((pronunciation) => {
        const details = [pronunciation.type, ...pronunciation.tags].filter(Boolean).join(', ');
        return details ? `${pronunciation.text} (${details})` : pronunciation.text;
      }),
    ),
  );
}

function getFormLabels(result: MyWordsLookupResult | null): string[] {
  if (!result) return [];
  return dedupeLabels(
    result.entries.flatMap((entry) =>
      entry.forms.map((form) => {
        const details = form.tags.join(', ');
        return details ? `${form.word} (${details})` : form.word;
      }),
    ),
  );
}

function renderSense(sense: MyWordsSense, key: string, depth = 0): React.ReactNode {
  return (
    <li key={key} style={{ ...styles.senseItem, ...(depth > 0 ? styles.subsenseItem : {}) }}>
      <p style={styles.senseDefinition}>{sense.definition}</p>
      {sense.tags.length > 0 && <p style={styles.senseMeta}>Usage: {sense.tags.join(', ')}</p>}
      {sense.synonyms.length > 0 && <p style={styles.senseMeta}>Sense synonyms: {sense.synonyms.join(', ')}</p>}
      {sense.antonyms.length > 0 && <p style={styles.senseMeta}>Sense antonyms: {sense.antonyms.join(', ')}</p>}

      {sense.examples.length > 0 && (
        <ul style={styles.senseBulletList}>
          {sense.examples.map((example, index) => (
            <li key={`${key}-example-${index}`} style={styles.senseBulletItem}>
              {example}
            </li>
          ))}
        </ul>
      )}

      {sense.quotes.length > 0 && (
        <ul style={styles.senseBulletList}>
          {sense.quotes.map((quote, index) => (
            <li key={`${key}-quote-${index}`} style={styles.senseBulletItem}>
              <p style={styles.quoteText}>&ldquo;{quote.text}&rdquo;</p>
              {quote.reference && <p style={styles.quoteReference}>{quote.reference}</p>}
            </li>
          ))}
        </ul>
      )}

      {sense.subsenses.length > 0 && (
        <ol style={styles.subsenseList}>
          {sense.subsenses.map((subsense, index) => renderSense(subsense, `${key}-subsense-${index}`, depth + 1))}
        </ol>
      )}
    </li>
  );
}

export default function MyWordsStandalonePage() {
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [languageCode, setLanguageCode] = useState('en');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<MyWordsLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedLanguage = useMemo(
    () => languages.find((lang) => lang.code === languageCode),
    [languages, languageCode],
  );
  const pronunciationLabels = useMemo(() => getPronunciationLabels(result), [result]);
  const formLabels = useMemo(() => getFormLabels(result), [result]);

  useEffect(() => {
    let active = true;
    void getMyWordsLanguages()
      .then((langs) => {
        if (!active) return;
        setLanguages(langs);
        if (!langs.some((lang) => lang.code === 'en') && langs[0]) {
          setLanguageCode(langs[0].code);
        }
      })
      .catch(() => {
        if (active) setError('Could not load languages.');
      });

    return () => {
      active = false;
    };
  }, []);

  const runLookup = async () => {
    const word = query.trim();
    if (!word) {
      setError('Enter a word.');
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await lookupWord({ languageCode, word });
      if (!next) {
        setResult(null);
        setError(`No entry found for "${word}" in ${selectedLanguage?.name ?? languageCode}.`);
      } else {
        setResult(next);
      }
    } catch (lookupError) {
      setResult(null);
      setError(lookupError instanceof Error ? lookupError.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>MyWords (Standalone)</h1>
      <p style={styles.subtitle}>Dictionary + thesaurus with richer word history context.</p>

      <div style={styles.controls}>
        <select
          value={languageCode}
          onChange={(event) => setLanguageCode(event.target.value)}
          style={styles.select}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.code})
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search word"
          autoComplete="off"
          spellCheck={false}
          style={styles.input}
        />

        <button type="button" style={styles.button} onClick={() => void runLookup()} disabled={loading}>
          {loading ? 'Searching...' : 'Look Up'}
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {result && (
        <section style={styles.card}>
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

          {result.wordHistory.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Word History</h3>
              <ul style={styles.historyList}>
                {result.wordHistory.map((item, index) => (
                  <li key={`history-${index}`} style={styles.historyItem}>
                    {item}
                  </li>
                ))}
              </ul>
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

          {result.rhymes.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Rhymes</h3>
              <p style={styles.tags}>{result.rhymes.join(', ')}</p>
            </>
          )}

          {result.nearbyWords.length > 0 && (
            <>
              <h3 style={styles.sectionTitle}>Nearby Words</h3>
              <p style={styles.tags}>{result.nearbyWords.join(', ')}</p>
            </>
          )}

          <h3 style={styles.sectionTitle}>Synonyms</h3>
          <p style={styles.tags}>{result.synonyms.join(', ') || 'None'}</p>

          <h3 style={styles.sectionTitle}>Antonyms</h3>
          <p style={styles.tags}>{result.antonyms.join(', ') || 'None'}</p>

          <h3 style={styles.sectionTitle}>Definitions</h3>
          {result.entries.map((entry, i) => (
            <div key={`${entry.partOfSpeech}-${i}`} style={styles.entry}>
              <p style={styles.pos}>{entry.partOfSpeech}</p>
              <p style={styles.entryMeta}>
                {entry.senses.length} sense{entry.senses.length === 1 ? '' : 's'}
              </p>
              {entry.synonyms.length > 0 && <p style={styles.entryDetail}>Entry synonyms: {entry.synonyms.join(', ')}</p>}
              {entry.antonyms.length > 0 && <p style={styles.entryDetail}>Entry antonyms: {entry.antonyms.join(', ')}</p>}
              <ol style={styles.list}>{entry.senses.map((sense, idx) => renderSense(sense, `${i}-${idx}`))}</ol>
            </div>
          ))}

          <h3 style={styles.sectionTitle}>Sources</h3>
          <ul style={styles.sourceList}>
            {result.attributions.map((source, index) => (
              <li key={`${source.name}-${index}`} style={styles.sourceItem}>
                <span>{source.name}</span>{' '}
                <a href={source.url} target="_blank" rel="noreferrer" style={styles.link}>
                  {source.url}
                </a>{' '}
                <span style={styles.sourceLicense}>({source.license})</span>
              </li>
            ))}
          </ul>

          {selectedLanguage && (
            <p style={styles.attribution}>
              Requested language: {selectedLanguage.name} ({selectedLanguage.code.toUpperCase()})
            </p>
          )}
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: '0 auto', padding: '2rem' },
  title: { margin: 0, fontSize: '1.9rem' },
  subtitle: { margin: '0.4rem 0 1rem', color: 'var(--muted)' },
  controls: { display: 'grid', gridTemplateColumns: '220px 1fr auto', gap: '0.7rem', alignItems: 'center' },
  select: {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.65rem 0.7rem',
  },
  input: {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.65rem 0.7rem',
  },
  button: {
    background: 'var(--accent)',
    color: '#0b1016',
    border: '1px solid var(--accent)',
    borderRadius: 10,
    padding: '0.65rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: { color: 'var(--danger)', marginTop: '0.6rem' },
  card: {
    marginTop: '1rem',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '1rem',
  },
  word: { margin: 0 },
  meta: { margin: '0.25rem 0 0.75rem', color: 'var(--muted)' },
  sectionTitle: { margin: '0.8rem 0 0.35rem' },
  tags: { margin: 0, color: 'var(--muted)' },
  infoBlock: {
    margin: 0,
    color: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.65rem',
    background: 'var(--surface)',
  },
  historyList: { margin: 0, paddingLeft: '1.1rem' },
  historyItem: { color: 'var(--muted)', marginBottom: '0.35rem' },
  entry: { marginTop: '0.75rem' },
  pos: { margin: 0, color: 'var(--accent)', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.08em' },
  entryMeta: { margin: '0.2rem 0 0', color: 'var(--muted)', fontSize: '0.82rem' },
  entryDetail: { margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.86rem' },
  list: { margin: '0.45rem 0 0', paddingLeft: '1.1rem' },
  senseItem: { marginBottom: '0.65rem' },
  subsenseItem: { marginBottom: '0.5rem' },
  senseDefinition: { margin: 0 },
  senseMeta: { margin: '0.18rem 0 0', color: 'var(--muted)', fontSize: '0.84rem' },
  senseBulletList: { margin: '0.28rem 0 0', paddingLeft: '1.1rem', color: 'var(--muted)' },
  senseBulletItem: { marginBottom: '0.2rem' },
  quoteText: { margin: 0, color: 'var(--muted)' },
  quoteReference: { margin: '0.1rem 0 0', color: 'var(--muted)', fontSize: '0.78rem' },
  subsenseList: { margin: '0.3rem 0 0', paddingLeft: '1.05rem' },
  sourceList: { margin: 0, paddingLeft: '1.1rem' },
  sourceItem: { color: 'var(--muted)', marginBottom: '0.2rem' },
  sourceLicense: { color: 'var(--muted)' },
  attribution: { marginTop: '0.8rem', color: 'var(--muted)', fontSize: '0.82rem' },
  link: { color: 'var(--accent)' },
};
