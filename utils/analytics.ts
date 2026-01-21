export interface TextStats {
  words: number;
  chars: number;
  charsNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingTime: string;
  speakingTime: string;
  uniqueWords: number;
  avgWordLength: number;
  readabilityScore: number; // 0-100 (Flesch Reading Ease)
  readabilityLabel: string;
}

export const analyzeText = (text: string): TextStats => {
  const cleanText = text.trim();
  if (!cleanText) {
    return {
      words: 0,
      chars: 0,
      charsNoSpaces: 0,
      sentences: 0,
      paragraphs: 0,
      readingTime: '0 sec',
      speakingTime: '0 sec',
      uniqueWords: 0,
      avgWordLength: 0,
      readabilityScore: 0,
      readabilityLabel: 'N/A',
    };
  }

  // Basic Counts
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const charCount = text.length;
  const charCountNoSpaces = text.replace(/\s/g, '').length;
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  const syllables = countSyllablesInText(words);

  // Time calculations
  const wpmRead = 200;
  const wpmSpeak = 130;
  const readMin = wordCount / wpmRead;
  const speakMin = wordCount / wpmSpeak;

  // Averages
  const avgWordLength = wordCount > 0 ? parseFloat((charCountNoSpaces / wordCount).toFixed(1)) : 0;
  
  // Unique words
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))).size;

  // Readability (Flesch Reading Ease)
  // Formula: 206.835 - 1.015(total words / total sentences) - 84.6(total syllables / total words)
  const avgWordsPerSentence = wordCount / sentences;
  const avgSyllablesPerWord = syllables / wordCount;
  let readabilityScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  readabilityScore = Math.max(0, Math.min(100, Math.round(readabilityScore)));

  let readabilityLabel = 'Unknown';
  if (readabilityScore >= 90) readabilityLabel = 'Very Easy (5th grade)';
  else if (readabilityScore >= 80) readabilityLabel = 'Easy (6th grade)';
  else if (readabilityScore >= 70) readabilityLabel = 'Fairly Easy (7th grade)';
  else if (readabilityScore >= 60) readabilityLabel = 'Standard (8th-9th grade)';
  else if (readabilityScore >= 50) readabilityLabel = 'Fairly Difficult (10th-12th)';
  else if (readabilityScore >= 30) readabilityLabel = 'Difficult (College)';
  else readabilityLabel = 'Very Difficult (Grad)';

  return {
    words: wordCount,
    chars: charCount,
    charsNoSpaces: charCountNoSpaces,
    sentences,
    paragraphs,
    readingTime: formatTime(readMin),
    speakingTime: formatTime(speakMin),
    uniqueWords,
    avgWordLength,
    readabilityScore,
    readabilityLabel,
  };
};

function formatTime(minutes: number): string {
  if (minutes < 1) {
    const sec = Math.round(minutes * 60);
    return `${sec} sec`;
  }
  const min = Math.floor(minutes);
  const sec = Math.round((minutes - min) * 60);
  if (sec === 0) return `${min} min`;
  return `${min}m ${sec}s`;
}

function countSyllablesInText(words: string[]): number {
  let count = 0;
  words.forEach(word => {
    count += countSyllables(word);
  });
  return count;
}

function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const found = word.match(/[aeiouy]{1,2}/g);
  return found ? found.length : 1;
}
