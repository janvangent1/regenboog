/**
 * Soft-colored cartoon animal icons matching the Regenboog header style.
 * Each SVG: viewBox 0 0 64 64, rounded shapes, muted palette.
 */
window.REGENBOOG_ANIMAL_ICONS = (function () {
  const v = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"';
  const soft = {
    brown: '#b8956e',
    brownDark: '#9a7b52',
    grey: '#8b9aab',
    greyDark: '#6b7a8a',
    white: '#f5f2ed',
    orange: '#e8a85c',
    orangeDark: '#c98b42',
    yellow: '#f0d878',
    black: '#3d3d3d',
    pink: '#e8b4a0',
    green: '#7ba872',
    blue: '#7ba3c4',
    red: '#c87a7a',
  };

  return {
    konijnen:
      '<svg ' + v + '><ellipse cx="32" cy="38" rx="14" ry="12" fill="' + soft.brown + '"/><ellipse cx="32" cy="36" rx="10" ry="9" fill="' + soft.brown + '"/><ellipse cx="24" cy="20" rx="6" ry="10" fill="' + soft.brown + '"/><ellipse cx="40" cy="20" rx="6" ry="10" fill="' + soft.brown + '"/><ellipse cx="32" cy="32" rx="4" ry="3" fill="' + soft.black + '"/><ellipse cx="38" cy="31" rx="4" ry="3" fill="' + soft.black + '"/><path d="M32 38 Q28 44 32 48 Q36 44 32 38" fill="' + soft.pink + '"/></svg>',
    muizen:
      '<svg ' + v + '><ellipse cx="32" cy="36" rx="16" ry="14" fill="' + soft.grey + '"/><ellipse cx="32" cy="34" rx="12" ry="10" fill="' + soft.grey + '"/><ellipse cx="26" cy="28" rx="5" ry="6" fill="' + soft.black + '"/><ellipse cx="38" cy="28" rx="5" ry="6" fill="' + soft.black + '"/><path d="M18 32 Q12 32 10 36" stroke="' + soft.greyDark + '" stroke-width="2" fill="none"/><path d="M46 32 Q52 32 54 36" stroke="' + soft.greyDark + '" stroke-width="2" fill="none"/></svg>',
    pinguins:
      '<svg ' + v + '><ellipse cx="32" cy="40" rx="14" ry="16" fill="' + soft.black + '"/><ellipse cx="32" cy="38" rx="10" ry="12" fill="' + soft.white + '"/><ellipse cx="32" cy="28" rx="10" ry="12" fill="' + soft.black + '"/><ellipse cx="28" cy="26" rx="3" ry="4" fill="' + soft.black + '"/><ellipse cx="36" cy="26" rx="3" ry="4" fill="' + soft.black + '"/><path d="M20 50 L16 58 L24 56 Z" fill="' + soft.black + '"/><path d="M44 50 L48 58 L40 56 Z" fill="' + soft.black + '"/><ellipse cx="32" cy="54" rx="6" ry="3" fill="' + soft.orange + '"/></svg>',
    eenden:
      '<svg ' + v + '><ellipse cx="32" cy="38" rx="16" ry="12" fill="' + soft.white + '" stroke="' + soft.grey + '" stroke-width="1"/><ellipse cx="32" cy="36" rx="12" ry="9" fill="' + soft.white + '"/><path d="M44 28 Q56 24 58 30 Q56 36 48 34 Z" fill="' + soft.orange + '"/><ellipse cx="50" cy="30" rx="4" ry="3" fill="' + soft.black + '"/><path d="M20 44 L24 52 L28 44" fill="' + soft.orange + '"/><path d="M36 44 L40 52 L44 44" fill="' + soft.orange + '"/></svg>',
    dolfijnen:
      '<svg ' + v + '><path d="M12 36 Q20 20 32 28 Q44 20 52 32 Q44 44 32 40 Q20 44 12 36 Z" fill="' + soft.grey + '"/><path d="M16 34 Q26 24 32 30 Q38 24 48 34" fill="' + soft.white + '" opacity="0.6"/><ellipse cx="28" cy="30" rx="4" ry="3" fill="' + soft.black + '"/><path d="M48 28 L56 32 L48 36 Z" fill="' + soft.grey + '"/></svg>',
    nijlpaarden:
      '<svg ' + v + '><ellipse cx="32" cy="42" rx="20" ry="14" fill="' + soft.grey + '"/><ellipse cx="32" cy="38" rx="14" ry="10" fill="' + soft.grey + '"/><ellipse cx="24" cy="34" rx="5" ry="4" fill="' + soft.black + '"/><ellipse cx="40" cy="34" rx="5" ry="4" fill="' + soft.black + '"/><path d="M16 44 Q8 48 10 52 L22 50 Q20 46 16 44 Z" fill="' + soft.greyDark + '"/><path d="M48 44 Q56 48 54 52 L42 50 Q44 46 48 44 Z" fill="' + soft.greyDark + '"/></svg>',
    lieveheersbeestjes:
      '<svg ' + v + '><ellipse cx="32" cy="36" rx="14" ry="12" fill="' + soft.red + '"/><path d="M32 24 L32 48" stroke="' + soft.black + '" stroke-width="2"/><circle cx="24" cy="28" r="4" fill="' + soft.black + '"/><circle cx="40" cy="28" r="4" fill="' + soft.black + '"/><circle cx="24" cy="40" r="4" fill="' + soft.black + '"/><circle cx="40" cy="40" r="4" fill="' + soft.black + '"/><ellipse cx="32" cy="32" rx="2" ry="3" fill="' + soft.black + '"/></svg>',
    uilen:
      '<svg ' + v + '><ellipse cx="32" cy="36" rx="18" ry="16" fill="' + soft.brown + '"/><ellipse cx="32" cy="34" rx="14" ry="12" fill="' + soft.brownDark + '"/><ellipse cx="26" cy="30" rx="6" ry="8" fill="' + soft.white + '"/><ellipse cx="38" cy="30" rx="6" ry="8" fill="' + soft.white + '"/><circle cx="26" cy="30" r="3" fill="' + soft.black + '"/><circle cx="38" cy="30" r="3" fill="' + soft.black + '"/><path d="M28 22 L32 18 L36 22" fill="' + soft.brownDark + '"/><path d="M20 38 L44 38" stroke="' + soft.brownDark + '" stroke-width="1"/></svg>',
    kangoeroes:
      '<svg ' + v + '><ellipse cx="32" cy="40" rx="12" ry="14" fill="' + soft.brown + '"/><ellipse cx="32" cy="38" rx="8" ry="10" fill="' + soft.brown + '"/><path d="M22 28 Q18 20 20 14 Q24 18 22 28 Z" fill="' + soft.brown + '"/><path d="M42 28 Q46 20 44 14 Q40 18 42 28 Z" fill="' + soft.brown + '"/><path d="M24 48 L20 62 L28 60 Z" fill="' + soft.brownDark + '"/><path d="M40 48 L44 62 L36 60 Z" fill="' + soft.brownDark + '"/><ellipse cx="28" cy="28" rx="3" ry="4" fill="' + soft.black + '"/><ellipse cx="36" cy="28" rx="3" ry="4" fill="' + soft.black + '"/></svg>',
    vossen:
      '<svg ' + v + '><ellipse cx="32" cy="38" rx="14" ry="12" fill="' + soft.orange + '"/><ellipse cx="32" cy="36" rx="10" ry="8" fill="' + soft.white + '"/><path d="M18 20 Q20 8 32 12 Q44 8 46 20 Q44 28 32 24 Q20 28 18 20 Z" fill="' + soft.orange + '"/><ellipse cx="26" cy="30" rx="4" ry="3" fill="' + soft.black + '"/><ellipse cx="38" cy="30" rx="4" ry="3" fill="' + soft.black + '"/><path d="M32 48 Q24 58 28 62 Q32 56 36 62 Q40 58 32 48 Z" fill="' + soft.orange + '"/></svg>',
    draken:
      '<svg ' + v + '><path d="M32 12 Q40 8 48 16 Q44 28 32 32 Q20 28 16 16 Q24 8 32 12 Z" fill="' + soft.green + '"/><path d="M32 32 L32 52 L28 60 L36 60 L32 52 Z" fill="' + soft.green + '"/><path d="M12 36 L20 32 L16 42 Z" fill="' + soft.green + '"/><path d="M52 36 L44 32 L48 42 Z" fill="' + soft.green + '"/><ellipse cx="28" cy="22" rx="4" ry="3" fill="' + soft.black + '"/><ellipse cx="36" cy="22" rx="4" ry="3" fill="' + soft.black + '"/><path d="M32 26 L32 30" stroke="' + soft.black + '" stroke-width="1"/></svg>',
    beren:
      '<svg ' + v + '><circle cx="32" cy="28" r="14" fill="' + soft.brown + '"/><ellipse cx="32" cy="42" rx="16" ry="14" fill="' + soft.brown + '"/><circle cx="26" cy="26" r="4" fill="' + soft.black + '"/><circle cx="38" cy="26" r="4" fill="' + soft.black + '"/><ellipse cx="32" cy="32" rx="3" ry="2" fill="' + soft.brownDark + '"/><path d="M22 44 L18 56 L26 54 Z" fill="' + soft.brown + '"/><path d="M42 44 L46 56 L38 54 Z" fill="' + soft.brown + '"/></svg>',
    leeuwen:
      '<svg ' + v + '><circle cx="32" cy="30" r="16" fill="' + soft.yellow + '"/><path d="M16 24 Q20 12 32 14 Q44 12 48 24 Q44 20 32 22 Q20 20 16 24 Z" fill="' + soft.orange + '"/><ellipse cx="32" cy="38" rx="14" ry="12" fill="' + soft.orange + '"/><ellipse cx="26" cy="28" rx="4" ry="3" fill="' + soft.black + '"/><ellipse cx="38" cy="28" rx="4" ry="3" fill="' + soft.black + '"/></svg>',
    vlinders:
      '<svg ' + v + '><ellipse cx="32" cy="34" rx="4" ry="12" fill="' + soft.brown + '"/><path d="M32 22 Q12 18 8 28 Q14 32 32 30 Z" fill="' + soft.blue + '"/><path d="M32 22 Q52 18 56 28 Q50 32 32 30 Z" fill="' + soft.blue + '"/><path d="M32 30 Q12 34 10 44 Q16 40 32 38 Z" fill="' + soft.blue + '"/><path d="M32 30 Q52 34 54 44 Q48 40 32 38 Z" fill="' + soft.blue + '"/><circle cx="28" cy="26" r="2" fill="' + soft.black + '"/><circle cx="36" cy="26" r="2" fill="' + soft.black + '"/></svg>',
    egels:
      '<svg ' + v + '><ellipse cx="32" cy="40" rx="16" ry="12" fill="' + soft.brown + '"/><path d="M16 36 L20 20 L24 32 L28 22 L32 34 L36 24 L40 32 L44 20 L48 36" stroke="' + soft.brownDark + '" stroke-width="2" fill="none"/><ellipse cx="28" cy="36" rx="3" ry="2" fill="' + soft.black + '"/><ellipse cx="36" cy="36" rx="3" ry="2" fill="' + soft.black + '"/></svg>',
    wolven:
      '<svg ' + v + '><ellipse cx="32" cy="38" rx="14" ry="12" fill="' + soft.grey + '"/><ellipse cx="32" cy="36" rx="10" ry="8" fill="' + soft.white + '" opacity="0.8"/><path d="M20 24 Q22 14 32 16 Q42 14 44 24" fill="' + soft.grey + '"/><ellipse cx="26" cy="30" rx="4" ry="3" fill="' + soft.black + '"/><ellipse cx="38" cy="30" rx="4" ry="3" fill="' + soft.black + '"/><path d="M32 48 Q26 56 28 60 Q32 54 36 60 Q38 56 32 48 Z" fill="' + soft.grey + '"/></svg>',
    koalas:
      '<svg ' + v + '><circle cx="32" cy="32" r="14" fill="' + soft.grey + '"/><circle cx="32" cy="30" r="10" fill="' + soft.grey + '"/><circle cx="26" cy="28" r="4" fill="' + soft.black + '"/><circle cx="38" cy="28" r="4" fill="' + soft.black + '"/><ellipse cx="32" cy="34" rx="3" ry="2" fill="' + soft.greyDark + '"/><path d="M20 24 Q16 20 18 16 Q22 20 20 24 Z" fill="' + soft.grey + '"/><path d="M44 24 Q48 20 46 16 Q42 20 44 24 Z" fill="' + soft.grey + '"/></svg>',
    olifanten:
      '<svg ' + v + '><ellipse cx="32" cy="44" rx="18" ry="12" fill="' + soft.grey + '"/><path d="M14 40 Q8 32 12 24 Q16 28 14 40 Z" fill="' + soft.grey + '"/><path d="M50 40 Q56 32 52 24 Q48 28 50 40 Z" fill="' + soft.grey + '"/><path d="M40 20 Q48 12 50 20 Q48 28 38 24 Z" fill="' + soft.grey + '"/><ellipse cx="28" cy="38" rx="4" ry="3" fill="' + soft.black + '"/><ellipse cx="36" cy="38" rx="4" ry="3" fill="' + soft.black + '"/></svg>',
    giraffen:
      '<svg ' + v + '><path d="M32 56 L28 24 L32 8 L36 24 L32 56 Z" fill="' + soft.yellow + '" stroke="' + soft.brownDark + '" stroke-width="1"/><ellipse cx="32" cy="12" rx="6" ry="5" fill="' + soft.yellow + '"/><circle cx="30" cy="10" r="2" fill="' + soft.black + '"/><circle cx="34" cy="10" r="2" fill="' + soft.black + '"/><rect x="30" y="28" width="4" height="8" fill="' + soft.brownDark + '"/><rect x="30" y="40" width="4" height="8" fill="' + soft.brownDark + '"/></svg>',
    zebras:
      '<svg ' + v + '><path d="M20 56 L24 24 L28 8 L32 24 L36 8 L40 24 L44 56 Z" fill="' + soft.white + '" stroke="' + soft.black + '" stroke-width="2"/><path d="M24 32 L26 28 M28 40 L30 36 M32 48 L34 44" stroke="' + soft.black + '" stroke-width="1.5" fill="none"/><ellipse cx="30" cy="12" rx="4" ry="5" fill="' + soft.white + '" stroke="' + soft.black + '"/><circle cx="28" cy="10" r="1.5" fill="' + soft.black + '"/><circle cx="32" cy="10" r="1.5" fill="' + soft.black + '"/></svg>',
    pandas:
      '<svg ' + v + '><circle cx="32" cy="32" r="14" fill="' + soft.white + '" stroke="' + soft.black + '" stroke-width="2"/><path d="M20 20 Q18 28 24 30 Q22 24 20 20 Z" fill="' + soft.black + '"/><path d="M44 20 Q46 28 40 30 Q42 24 44 20 Z" fill="' + soft.black + '"/><circle cx="28" cy="30" r="3" fill="' + soft.black + '"/><circle cx="36" cy="30" r="3" fill="' + soft.black + '"/><ellipse cx="32" cy="38" rx="4" ry="2" fill="' + soft.black + '"/></svg>',
    zwaluwen:
      '<svg ' + v + '><path d="M32 18 Q40 22 44 30 Q40 38 32 42 Q24 38 20 30 Q24 22 32 18 Z" fill="' + soft.black + '"/><path d="M32 24 Q28 30 32 36 Q36 30 32 24 Z" fill="' + soft.white + '" opacity="0.5"/><path d="M44 30 L52 26 L48 32 L54 36 Z" fill="' + soft.black + '"/><path d="M20 30 L12 26 L16 32 L10 36 Z" fill="' + soft.black + '"/><circle cx="30" cy="28" r="2" fill="' + soft.black + '"/><circle cx="34" cy="28" r="2" fill="' + soft.black + '"/></svg>',
  };
})();
