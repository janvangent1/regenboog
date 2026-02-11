// Woordenlijst voor vlinders spel - alleen bekende dieren geschikt voor 2e leerjaar (7-8 jaar)
// Georganiseerd per moeilijkheidsgraad: makkelijk (ronde 1), moeilijker (ronde 2), moeilijkste (ronde 3)

const WORDS_BY_DIFFICULTY = {
  // Ronde 1: Makkelijke dieren (3-4 letters, zeer bekende dieren)
  easy: [
    'KAT', 'VIS', 'UIL', 'RAT', 'MOL', 'REE',
    'HOND', 'BEER', 'HAAS', 'EEND', 'KOE', 'GEIT', 'MUIS', 'KIP', 'HAAN',
    'GANS', 'DUIF', 'DAS', 'VOGEL', 'MUS', 'VOS', 'HERT'
  ],
  // Ronde 2: Moeilijkere dieren (4-5 letters, nog steeds bekende dieren)
  medium: [
    'VARKEN', 'SCHAAP', 'PAARD', 'EZEL', 'ZWAAN',
    'KONIJN', 'HAMSTER', 'OTTER', 'WEZEL', 'BEVER',
    'MEEUW', 'ZWALUW', 'MEREL', 'VINK', 'SPREEUW'
  ],
  // Ronde 3: Moeilijkste dieren (6+ letters, bekende dieren met meer letters)
  hard: [
    'OLIFANT', 'NEUSHOORN', 'CHEETAH', 'GIRAFFE',
    'KANGAROE', 'KROKODIL', 'DOLFIJN', 'WALVIS', 'ZEEHOND',
    'CHIMPANSEE', 'FLAMINGO', 'PAPEGAAI', 'STRUISVOGEL', 'PINGUIN'
  ]
};

// Flatten alle woorden in één lijst
const ALL_WORDS = [
  ...WORDS_BY_DIFFICULTY.easy,
  ...WORDS_BY_DIFFICULTY.medium,
  ...WORDS_BY_DIFFICULTY.hard
].filter((word, index, self) => self.indexOf(word) === index); // Remove duplicates

// Functie om 3 woorden te kiezen voor een specifieke ronde
function getWordsForRound(round) {
  let wordPool;
  if (round === 1) {
    wordPool = WORDS_BY_DIFFICULTY.easy;
  } else if (round === 2) {
    wordPool = WORDS_BY_DIFFICULTY.medium;
  } else {
    wordPool = WORDS_BY_DIFFICULTY.hard;
  }
  
  // Selecteer 3 unieke woorden
  const selected = [];
  const available = [...wordPool];
  
  for (let i = 0; i < 3 && available.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * available.length);
    selected.push(available[randomIndex]);
    available.splice(randomIndex, 1);
  }
  
  // Als er niet genoeg woorden zijn, vul aan met woorden uit andere moeilijkheidsniveaus
  while (selected.length < 3) {
    const fallbackPool = round === 1 ? WORDS_BY_DIFFICULTY.medium : 
                        round === 2 ? WORDS_BY_DIFFICULTY.easy : 
                        WORDS_BY_DIFFICULTY.medium;
    const fallbackWord = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    if (!selected.includes(fallbackWord)) {
      selected.push(fallbackWord);
    }
  }
  
  return selected;
}

// Functie om letters te shufflen - alleen de letters van het woord zelf
function prepareLetters(word, round) {
  const wordLetters = word.split('');
  const originalOrder = wordLetters.join('');
  
  // Shuffle alleen de letters van het woord zelf (geen extra letters)
  let shuffled = [...wordLetters];
  
  // Fisher-Yates shuffle - herhaal tot de volgorde anders is dan origineel
  let attempts = 0;
  const maxAttempts = 50;
  
  do {
    shuffled = [...wordLetters];
    
    // Fisher-Yates shuffle algoritme - meerdere keren shufflen voor betere randomisatie
    for (let shufflePass = 0; shufflePass < 3; shufflePass++) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    
    attempts++;
    
    // Als na veel pogingen nog steeds hetzelfde, forceer een andere volgorde
    if (attempts > 10 && shuffled.join('') === originalOrder) {
      // Reverse de volgorde als fallback
      shuffled = [...wordLetters].reverse();
      // Als reverse ook hetzelfde is (palindroom), swap eerste twee letters
      if (shuffled.join('') === originalOrder && shuffled.length >= 2) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
      }
    }
  } while (shuffled.join('') === originalOrder && attempts < maxAttempts);
  
  // Laatste check: als het nog steeds hetzelfde is, forceer een andere volgorde
  if (shuffled.join('') === originalOrder) {
    // Als het woord maar 2 letters heeft, swap ze
    if (shuffled.length === 2) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    } else {
      // Voor langere woorden: rotate de array (verplaats eerste letter naar einde)
      const first = shuffled.shift();
      shuffled.push(first);
    }
  }
  
  return {
    word: word,
    letters: shuffled,
    wordLength: word.length
  };
}

// Functie om een lijst van woorden voor te bereiden met geschudde letters
function prepareWords(words, round) {
  return words.map(word => prepareLetters(word, round));
}

module.exports = {
  getWordForRound: getWordsForRound, // Backward compatibility
  getWordsForRound,
  prepareLetters,
  prepareWords,
  ALL_WORDS,
  WORDS_BY_DIFFICULTY
};
