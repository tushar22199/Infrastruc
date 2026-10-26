const STOP_WORDS = new Set([
  "what",
  "which",
  "where",
  "when",
  "according",
  "about",
  "their",
  "there",
  "with",
  "from",
  "have",
  "does",
  "into",
  "this",
  "that",
  "shall",
  "would",
  "could",
  "should",
  "the",
  "and",
  "for",
  "are",
  "was",
  "were",
  "who",
  "why",
  "how",
  "is",
  "to",
  "in",
  "on",
  "at",
  "by",
]);

const PHRASE_STOP_WORDS = new Set([
  "what",
  "which",
  "where",
  "when",
  "why",
  "how",
  "the",
  "is",
  "are",
  "was",
  "were",
  "to",
  "according",
]);

export function extractSearchTerms(question: string) {
  const rawWords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const keywords = [
    ...new Set(
      rawWords.filter(
        (word) =>
          word.length > 2 &&
          !STOP_WORDS.has(word) &&
          !/^\d+$/.test(word)
      )
    ),
  ];

  const rawPhrases = new Set<string>();

  for (let i = 0; i < rawWords.length - 1; i++) {
    rawPhrases.add(`${rawWords[i]} ${rawWords[i + 1]}`);
  }

  for (let i = 0; i < rawWords.length - 2; i++) {
    rawPhrases.add(
      `${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`
    );
  }

  const phrases = [...rawPhrases].filter((phrase) => {
    const words = phrase.split(" ");

    if (PHRASE_STOP_WORDS.has(words[0])) {
      return false;
    }

    if (words.every((word) => /^\d+$/.test(word))) {
      return false;
    }

    const meaningfulWords = words.filter(
      (word) =>
        !PHRASE_STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
    );

    return meaningfulWords.length >= 2;
  });

  return { keywords, phrases };
}
