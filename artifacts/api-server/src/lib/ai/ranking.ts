export function rrf(rank: number, k = 60): number {
  return 1 / (k + rank);
}

export function rankChunks(
  semanticChunks: any[],
  keywordChunks: any[],
  keywords: string[],
  phrases: string[]
) {
  const scored = new Map<
    string,
    any & {
      score: number;
      semanticRank?: number;
      keywordRank?: number;
    }
  >();

  const SEMANTIC_WEIGHT = 0.7;
  const KEYWORD_WEIGHT = 1.3;

  // Semantic ranking
  semanticChunks.forEach((chunk, index) => {
    scored.set(chunk.id, {
      ...chunk,
      score: rrf(index + 1) * SEMANTIC_WEIGHT,
      semanticRank: index + 1,
    });
  });

  // Keyword ranking
  keywordChunks.forEach((chunk, index) => {
    if (scored.has(chunk.id)) {
      const existing = scored.get(chunk.id)!;
      existing.score += rrf(index + 1) * KEYWORD_WEIGHT;
      existing.keywordRank = index + 1;
    } else {
      scored.set(chunk.id, {
        ...chunk,
        score: rrf(index + 1) * KEYWORD_WEIGHT,
        keywordRank: index + 1,
      });
    }
  });

  const rankedChunks = [...scored.values()].sort(
    (a, b) => b.score - a.score
  );

  // ----------------------------
  // Lexical bonus
  // ----------------------------
  for (const chunk of rankedChunks) {
    const text = String(chunk.content).toLowerCase();

    let bonus = 0;

    const IMPORTANT_TERMS = keywords
      .map((k) => k.toLowerCase())
      .filter((k) => k.length >= 3);

    for (const term of IMPORTANT_TERMS) {
      if (text.includes(term)) bonus += 0.002;
    }

    for (const phrase of phrases) {
      if (text.includes(phrase.toLowerCase())) {
        bonus += 0.01;
      }
    }

    if (text.includes("table")) bonus += 0.005;
    if (text.includes("clause")) bonus += 0.005;
    if (text.includes("figure")) bonus += 0.003;
    if (text.includes("note")) bonus += 0.003;

    if (/table\s+\d+/i.test(text)) bonus += 0.01;
    if (/clause\s+\d+(\.\d+)*/i.test(text)) bonus += 0.01;
    if (/m\d+/i.test(text)) bonus += 0.005;

    bonus = Math.min(bonus, 0.015);
    chunk.score += bonus;
  }

  rankedChunks.sort((a, b) => b.score - a.score);

  return rankedChunks;
}