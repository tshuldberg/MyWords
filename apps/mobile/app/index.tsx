import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getMyWordsLanguages,
  lookupWord,
  type MyWordsLanguage,
  type MyWordsLookupResult,
  type MyWordsSense,
} from '@mywords/shared';

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
    <View key={key} style={[styles.senseWrap, depth > 0 ? { marginLeft: depth * 10 } : null]}>
      <Text style={styles.body}>{`${depth > 0 ? '◦' : '•'} ${sense.definition}`}</Text>
      {sense.tags.length > 0 && <Text style={styles.caption}>Usage: {sense.tags.join(', ')}</Text>}
      {sense.synonyms.length > 0 && (
        <Text style={styles.caption}>Sense synonyms: {sense.synonyms.join(', ')}</Text>
      )}
      {sense.antonyms.length > 0 && (
        <Text style={styles.caption}>Sense antonyms: {sense.antonyms.join(', ')}</Text>
      )}
      {sense.examples.map((example, index) => (
        <Text key={`${key}-example-${index}`} style={styles.caption}>Example: {example}</Text>
      ))}
      {sense.quotes.map((quote, index) => (
        <View key={`${key}-quote-${index}`} style={styles.quoteWrap}>
          <Text style={styles.caption}>“{quote.text}”</Text>
          {quote.reference ? <Text style={styles.captionMuted}>{quote.reference}</Text> : null}
        </View>
      ))}
      {sense.subsenses.map((subsense, index) => renderSense(subsense, `${key}-subsense-${index}`, depth + 1))}
    </View>
  );
}

export default function HomeScreen() {
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [languageCode, setLanguageCode] = useState('en');
  const [word, setWord] = useState('');
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
    const query = word.trim();
    if (!query) {
      setError('Enter a word.');
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await lookupWord({ languageCode, word: query });
      if (!data) {
        setResult(null);
        setError(`No entry found for "${query}" in ${selectedLanguage?.name ?? languageCode}.`);
      } else {
        setResult(data);
      }
    } catch (lookupError) {
      setResult(null);
      setError(lookupError instanceof Error ? lookupError.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.subheading}>MyWords (Standalone)</Text>
        <Text style={styles.caption}>Direct word lookup with expanded lexical context.</Text>

        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={word}
            onChangeText={setWord}
            placeholder="Search word"
            placeholderTextColor="#8A8A8A"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />

          <View style={styles.row}>
            {languages.slice(0, 10).map((lang) => {
              const selected = lang.code === languageCode;
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.langChip, selected ? styles.langChipSelected : null]}
                  onPress={() => setLanguageCode(lang.code)}
                >
                  <Text style={selected ? styles.langChipTextSelected : styles.langChipText}>
                    {lang.code}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.primaryButton} onPress={() => void runLookup()}>
            <Text style={styles.primaryButtonText}>{loading ? 'Searching...' : 'Look Up'}</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.subheading}>{result.word}</Text>
          <Text style={styles.caption}>
            {result.language.name} ({result.language.code.toUpperCase()})
          </Text>

          {pronunciationLabels.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Pronunciations</Text>
              <Text style={styles.body}>{pronunciationLabels.join(' • ')}</Text>
            </View>
          ) : null}

          {formLabels.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Word Forms</Text>
              <Text style={styles.body}>{formLabels.join(' • ')}</Text>
            </View>
          ) : null}

          {result.wordHistory.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Word History</Text>
              {result.wordHistory.map((line, index) => (
                <Text key={`history-${index}`} style={styles.caption}>• {line}</Text>
              ))}
            </View>
          ) : null}

          {result.firstKnownUse ? (
            <View style={styles.section}>
              <Text style={styles.label}>First Known Use</Text>
              <Text style={styles.caption}>{result.firstKnownUse}</Text>
            </View>
          ) : null}

          {result.didYouKnow ? (
            <View style={styles.section}>
              <Text style={styles.label}>Did You Know?</Text>
              <Text style={styles.caption}>{result.didYouKnow}</Text>
            </View>
          ) : null}

          {result.rhymes.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Rhymes</Text>
              <Text style={styles.caption}>{result.rhymes.join(', ')}</Text>
            </View>
          ) : null}

          {result.nearbyWords.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Nearby Words</Text>
              <Text style={styles.caption}>{result.nearbyWords.join(', ')}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>Synonyms</Text>
            <Text style={styles.body}>{result.synonyms.join(', ') || 'None'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Antonyms</Text>
            <Text style={styles.body}>{result.antonyms.join(', ') || 'None'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Definitions</Text>
            {result.entries.map((entry, i) => (
              <View key={`${entry.partOfSpeech}-${i}`} style={styles.entry}>
                <Text style={styles.entryPos}>{entry.partOfSpeech}</Text>
                <Text style={styles.caption}>
                  {entry.senses.length} sense{entry.senses.length === 1 ? '' : 's'}
                </Text>
                {entry.senses.map((sense, index) => renderSense(sense, `${i}-${index}`))}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#2B2B2B',
    borderRadius: 12,
    backgroundColor: '#171717',
    padding: 14,
  },
  subheading: {
    color: '#F3F3F3',
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    color: '#B5B5B5',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    color: '#F3F3F3',
    fontSize: 16,
  },
  caption: {
    color: '#B5B5B5',
    fontSize: 14,
  },
  captionMuted: {
    color: '#8C8C8C',
    fontSize: 12,
  },
  formGrid: {
    marginTop: 10,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2B2B2B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F3F3F3',
    backgroundColor: '#131313',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    borderWidth: 1,
    borderColor: '#2B2B2B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#131313',
  },
  langChipSelected: {
    borderColor: '#4AA8F8',
    backgroundColor: '#4AA8F8',
  },
  langChipText: {
    color: '#B5B5B5',
    fontSize: 13,
  },
  langChipTextSelected: {
    color: '#0E1720',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#4AA8F8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: '#0E1720',
    fontWeight: '700',
  },
  section: {
    marginTop: 12,
    gap: 5,
  },
  entry: {
    marginTop: 8,
    gap: 4,
  },
  entryPos: {
    color: '#4AA8F8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  senseWrap: {
    marginTop: 6,
    gap: 3,
  },
  quoteWrap: {
    marginTop: 1,
    gap: 2,
  },
  error: {
    color: '#FF6B6B',
    fontSize: 14,
  },
});
