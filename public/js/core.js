/**
 * De Regenboog – gedeelde spellogica (rondes, score, reset, afbeeldingen).
 * Alle spellen: 3 rondes; elke game kan Core gebruiken voor consistente UI.
 *
 * Dierenlogo’s: gebruik getAnimalImageUrl(classId) of createAnimalImage();
 * afbeeldingen staan in /assets/images/classes/{id}.png (achtergrond verwijderd).
 * UI-tekst: Nederlands (i18n in dit bestand).
 */
window.RegenboogCore = {
  /** Aantal rondes per spel */
  TOTAL_ROUNDS: 3,

  /** Nederlandse teksten */
  i18n: {
    ronde: 'Ronde',
    van: 'van',
    volgendeRonde: 'Volgende ronde',
    rondeKlaar: 'Ronde klaar!',
    totaal: 'Totaal',
    nogEenKeer: 'Nog een keer',
    alleRondesKlaar: 'Alle rondes klaar!',
    score: 'Score',
    tijd: 'Tijd',
    sec: 'sec',
    autoVolgendeRonde: 'Volgende ronde start automatisch over',
  },

  /** Duidelijke intro-uitleg per spel */
  introGuidance: {
    beren: [
      'Programmeer met pijltjes een route naar de honingpot.',
      'Klik Start om je stappen uit te voeren.',
      'Vermijd muren en plan zo efficiënt mogelijk.'
    ],
    dolfijnen: [
      'Beweeg op/neer met je muis en stuur de dolfijn door de baan.',
      'Pak hoepels en visjes voor punten.',
      'Vermijd obstakels, die kosten punten.'
    ],
    draken: [
      'Klik op rode doelen om punten te verdienen.',
      'Groene doelen geven strafpunten.',
      'In latere rondes bewegen doelen sneller.'
    ],
    eenden: [
      'Sleep elk item naar de eend met dezelfde kleur.',
      'Correct sorteren levert punten op.',
      'Fouten geven strafpunten en in latere rondes verschuiven de doelen.'
    ],
    egels: [
      'Beweeg met de pijltjestoetsen over de weg.',
      'Steek veilig over om vooruitgang te maken.',
      'Vermijd verkeer: botsingen kosten punten.'
    ],
    giraffen: [
      'Beweeg en draai blokken met de pijltjestoetsen.',
      'Maak volle rijen om punten te scoren.',
      'Meerdere rijen tegelijk geven bonuspunten.'
    ],
    kangoeroes: [
      'Klik het juiste antwoord om naar de juiste steen te springen.',
      'Los alle sommen per ronde op.',
      'Foute antwoorden geven strafpunten.'
    ],
    koalas: [
      'Beweeg je paddle met pijltjes omhoog/omlaag of W/S.',
      'Houd de bal in het spel en scoor tegen de computer.',
      'Elke ronde wordt sneller en moeilijker.'
    ],
    konijnen: [
      'Klik zo snel mogelijk op elke wortel die verschijnt.',
      'Sneller reageren geeft een hogere score.',
      'Elke volgende ronde gaat sneller.'
    ],
    leeuwen: [
      'Stel met pijltjes een route samen naar de prooi.',
      'Klik Start om de route uit te voeren.',
      'Bereik de prooi zonder tegen muren te lopen.'
    ],
    lieveheersbeestjes: [
      'Beweeg links/rechts om het lieveheersbeestje te sturen.',
      'Vang bloemen voor punten.',
      'Vermijd vlinders, uilen en muizen: die kosten punten.'
    ],
    muizen: [
      'Draai telkens 2 kaarten om en zoek gelijke paren.',
      'Vind alle paren om door te gaan naar de volgende ronde.',
      'Minder zetten geeft een betere eindscore.'
    ],
    nijlpaarden: [
      'Tel goed hoeveel gevraagde items je ziet.',
      'Kies het juiste aantal uit de antwoordknoppen.',
      'Sneller en met minder fouten geeft meer punten.'
    ],
    olifanten: [
      'Onthoud het pad dat kort wordt getoond.',
      'Klik daarna exact dezelfde route in de juiste volgorde.',
      'Fouten kosten punten, nauwkeurig spelen loont.'
    ],
    pandas: [
      'Beweeg met links/rechts of de knoppen onderaan.',
      'Schiet bellen kapot zodat dieren veilig vallen.',
      'Grotere dieren vragen vaker raken, laat geen doelen ontsnappen.'
    ],
    pinguins: [
      'Klik op vallende vissen om punten te verdienen.',
      'Klik niet op schoenen: die kosten punten.',
      'In latere rondes vallen objecten sneller.'
    ],
    uilen: [
      'Draai kaarten om en zoek dezelfde nachtdieren.',
      'Vind alle paren om de ronde te voltooien.',
      'Hoe minder zetten, hoe beter je score.'
    ],
    vlinders: [
      'Sleep letters naar de juiste vakjes om dierennamen te maken.',
      'Alleen correcte letters blijven staan en tellen mee.',
      'Hints helpen, maar kosten punten.'
    ],
    vossen: [
      'Beweeg de vos met pijltjestoetsen door het doolhof.',
      'Zoek de weg naar het hol.',
      'Minder zetten geeft een hogere score.'
    ],
    wolven: [
      'Stuur de roedel met pijltjestoetsen.',
      'Eet prooien om de roedel te laten groeien.',
      'Bots niet tegen jezelf of muren; dat kost je voortgang of eindigt het spel.'
    ],
    zebras: [
      'Kies het juiste volgende getal in het patroon.',
      'Gebruik hints alleen als het nodig is.',
      'Hints en foute antwoorden kosten punten.'
    ],
    zwaluwen: [
      'Vlieg met pijltjestoetsen of richtingsknoppen door het doolhof.',
      'Verzamel alle bolletjes per ronde.',
      'Vermijd roofvogels, anders verlies je punten.'
    ]
  },

  /** Auto-next delay voor ronde-overgangen (ms) */
  AUTO_NEXT_DELAY_MS: 2000,

  /**
   * URL van het klaslogo (achtergrond verwijderd, van schoolwebsite).
   * Gebruik in spellen; fallback naar emoji bij onerror.
   */
  getAnimalImageUrl(classId) {
    return '/assets/images/classes/' + (classId || '').toLowerCase() + '.png';
  },

  /**
   * Maak een img-element voor het dier, met emoji-fallback.
   * @param {string} classId - bv. 'konijnen', 'beren'
   * @param {string} alt - toegankelijkheidstekst
   * @param {string} [className] - optionele CSS-class
   * @param {string} [emojiFallback] - bv. '🐰' als afbeelding faalt
   */
  createAnimalImage(classId, alt, className, emojiFallback) {
    const img = document.createElement('img');
    img.src = this.getAnimalImageUrl(classId);
    img.alt = alt || '';
    if (className) img.className = className;
    img.loading = 'lazy';
    const fallback = emojiFallback || '🐾';
    img.onerror = function () {
      const span = document.createElement('span');
      span.className = (className || '') + ' core-emoji-fallback';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = fallback;
      if (img.parentNode) img.parentNode.replaceChild(span, img);
    };
    return img;
  },

  /**
   * Initiële rondestaat voor een spel (3 rondes).
   */
  createRoundState() {
    return { currentRound: 1, totalScore: 0 };
  },

  /**
   * Reset rondestaat (bij "Nog een keer").
   */
  resetRoundState(state) {
    if (!state) return;
    state.currentRound = 1;
    state.totalScore = 0;
  },

  /**
   * Toon "Ronde klaar" + knop Volgende ronde.
   * @param {HTMLElement} area - game-area
   * @param {number} roundScore - score van deze ronde
   * @param {number} totalScore - cumulatieve score
   * @param {string} nextButtonId - id voor de knop (uniek per spel)
   * @param {function} onNext - callback bij klik op Volgende ronde
   */
  showRoundDone(area, roundScore, totalScore, nextButtonId, onNext) {
    if (!area) return;
    const t = this.i18n;
    area.innerHTML =
      '<p class="game-score">' + t.rondeKlaar + ' ' + t.score + ': ' + roundScore + '. ' + t.totaal + ': ' + totalScore + '</p>' +
      '<button type="button" id="' + (nextButtonId || 'core-next-round') + '" class="btn-next-round">' + t.volgendeRonde + '</button>';
    const btn = document.getElementById(nextButtonId);
    if (btn && typeof onNext === 'function') btn.addEventListener('click', onNext);
  },

  /**
   * Toon einde spel (alle rondes) + optioneel submitformulier ranglijst.
   * @param {HTMLElement} area - game-area
   * @param {number} totalScore - eindscore
   * @param {string} message - bv. "Alle 3 rondes klaar! Totaal 450 punten."
   * @param {string} [className] - voor Leaderboard.showSubmitForm
   * @param {HTMLElement} [leaderboardEl] - container ranglijst
   * @param {function} [onDone] - na submit/annuleren
   */
  showGameDone(area, totalScore, message, className, leaderboardEl, onDone) {
    if (!area) return;
    const t = this.i18n;
    const text = message || (t.alleRondesKlaar + ' ' + t.score + ': ' + totalScore);
    area.innerHTML = '<p class="game-score">' + text + '</p>';
    if (className && window.Leaderboard && window.Leaderboard.showSubmitForm) {
      window.Leaderboard.showSubmitForm(className, totalScore, function () {
        if (leaderboardEl && window.Leaderboard && window.Leaderboard.render) {
          window.Leaderboard.render(leaderboardEl, className);
        }
        if (typeof onDone === 'function') onDone();
      });
    } else if (typeof onDone === 'function') {
      onDone();
    }
  },

  /**
   * Tekst voor "Ronde X/3" in de UI.
   */
  roundLabel(currentRound) {
    const t = this.i18n;
    return t.ronde + ' ' + currentRound + '/' + this.TOTAL_ROUNDS;
  },

  /**
   * Maak een consistente HUD (Heads-Up Display) voor score, tijd en ronde.
   * @param {string} gameId - unieke ID voor dit spel (bijv. 'konijnen', 'pinguins')
   * @param {number} currentRound - huidige ronde (1-based)
   * @param {number} totalRounds - totaal aantal rondes
   * @param {boolean} showTimer - of timer moet worden getoond
   * @param {boolean} showScore - of score moet worden getoond
   * @returns {string} HTML string voor de HUD
   */
  createHUD(gameId, currentRound, totalRounds, showTimer = true, showScore = true) {
    let html = '<div id="' + gameId + '-hud" class="game-hud" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.9); border-radius: 8px; font-weight: 600; margin-bottom: 1rem;">';
    
    if (showScore) {
      html += '<div style="font-size: 1.3rem;">Score: <span id="' + gameId + '-score-value" style="color: #2a9d8f;">0</span></div>';
    }
    
    if (showTimer) {
      html += '<div style="font-size: 1.3rem;"><span id="' + gameId + '-timer" style="color: #e63946;">Tijd: 0:00</span></div>';
    }
    
    html += '<div style="font-size: 1rem; color: #666;">Ronde <span id="' + gameId + '-round">' + currentRound + '</span>/' + totalRounds + '</div>';
    html += '</div>';
    
    return html;
  },

  /**
   * Update timer in HUD (voor countdown of elapsed time).
   * @param {string} gameId - unieke ID voor dit spel
   * @param {number} timeValue - tijd in seconden (voor countdown) of elapsed time
   * @param {boolean} isCountdown - true voor countdown, false voor elapsed time
   */
  updateHUDTimer(gameId, timeValue, isCountdown = false) {
    const timerEl = document.getElementById(gameId + '-timer');
    if (!timerEl) return;
    
    if (isCountdown) {
      timerEl.textContent = 'Tijd: ' + Math.max(0, Math.ceil(timeValue)) + 's';
      if (timeValue <= 5) {
        timerEl.style.color = '#e63946';
        timerEl.style.fontWeight = '700';
      } else {
        timerEl.style.color = '#e63946';
        timerEl.style.fontWeight = '600';
      }
    } else {
      const mins = Math.floor(timeValue / 60);
      const secs = Math.floor(timeValue % 60);
      timerEl.textContent = 'Tijd: ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
  },

  /**
   * Update score in HUD.
   * @param {string} gameId - unieke ID voor dit spel
   * @param {number} score - score waarde
   */
  updateHUDScore(gameId, score) {
    const scoreEl = document.getElementById(gameId + '-score-value');
    if (scoreEl) {
      scoreEl.textContent = score;
    }
  },

  /**
   * Update ronde nummer in HUD.
   * @param {string} gameId - unieke ID voor dit spel
   * @param {number} round - ronde nummer
   */
  updateHUDRound(gameId, round) {
    const roundEl = document.getElementById(gameId + '-round');
    if (roundEl) {
      roundEl.textContent = round;
    }
  },

  /**
   * Herken knoppen die een nieuwe ronde starten.
   */
  isAutoNextRoundButton(button) {
    if (!button || button.tagName !== 'BUTTON') return false;
    const text = (button.textContent || '').trim().toLowerCase();
    if (!text) return false;
    return text.includes('volgende ronde') || text.startsWith('start ronde');
  },

  /**
   * Alleen starten als knop zichtbaar en bruikbaar is.
   */
  canScheduleAutoNext(button) {
    if (!this.isAutoNextRoundButton(button)) return false;
    if (button.dataset.autoNextScheduled === '1') return false;
    if (button.disabled) return false;
    const style = window.getComputedStyle(button);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  },

  /**
   * Voeg visuele countdown toe en klik automatisch na delay.
   */
  scheduleAutoNext(button) {
    if (!this.canScheduleAutoNext(button)) return;
    button.dataset.autoNextScheduled = '1';

    const notice = document.createElement('p');
    notice.className = 'core-auto-next-notice';
    notice.style.margin = '0.5rem 0 0';
    notice.style.fontWeight = '600';
    notice.style.color = '#4b5563';
    notice.style.fontSize = '0.95rem';

    const totalSeconds = Math.ceil(this.AUTO_NEXT_DELAY_MS / 1000);
    let secondsLeft = totalSeconds;
    const setNoticeText = () => {
      notice.textContent = this.i18n.autoVolgendeRonde + ' ' + secondsLeft + 's...';
    };
    setNoticeText();
    button.insertAdjacentElement('afterend', notice);

    const intervalId = setInterval(() => {
      secondsLeft = Math.max(0, secondsLeft - 1);
      if (secondsLeft > 0) setNoticeText();
    }, 1000);

    const cleanup = () => {
      clearInterval(intervalId);
      if (notice.parentNode) notice.parentNode.removeChild(notice);
    };

    button.addEventListener('click', cleanup, { once: true });
    setTimeout(() => {
      if (!document.contains(button)) {
        cleanup();
        return;
      }
      if (!button.disabled) button.click();
      cleanup();
    }, this.AUTO_NEXT_DELAY_MS);
  },

  /**
   * Zoek in game-area naar rondeknoppen en plan auto-next.
   */
  scanAndScheduleAutoNext(root) {
    if (!root) return;
    const buttons = root.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
      this.scheduleAutoNext(buttons[i]);
    }
  },

  /**
   * Observeer game-area zodat alle spellen automatisch doorgaan na 2s.
   */
  initAutoNextObserver() {
    if (this._autoNextInitialized) return;
    this._autoNextInitialized = true;

    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;

    this.scanAndScheduleAutoNext(gameArea);

    const observer = new MutationObserver(() => {
      this.scanAndScheduleAutoNext(gameArea);
    });
    observer.observe(gameArea, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'disabled', 'hidden']
    });
    this._autoNextObserver = observer;
  },

  /**
   * Zoek intro-schermen met startknop en geef consistente styling.
   */
  getIntroStepIcon(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return '✨';
    if (t.includes('vermijd') || t.includes('bots') || t.includes('fout') || t.includes('straf')) return '⚠️';
    if (t.includes('hint')) return '💡';
    if (t.includes('sleep')) return '🧩';
    if (t.includes('klik')) return '🖱️';
    if (t.includes('beweeg') || t.includes('pijlt') || t.includes('toets') || t.includes('richting')) return '🎮';
    if (t.includes('verzamel') || t.includes('pak') || t.includes('red') || t.includes('vind') || t.includes('bereik')) return '🎯';
    if (t.includes('score') || t.includes('punten')) return '⭐';
    if (t.includes('ronde') || t.includes('level') || t.includes('moeilijk')) return '🏁';
    return '✨';
  },

  decorateIntroCard(cardEl) {
    if (!cardEl) return;
    const lines = cardEl.querySelectorAll('p, li');
    for (let i = 0; i < lines.length; i++) {
      const lineEl = lines[i];
      if (lineEl.dataset.coreIntroDecorated === '1') continue;
      lineEl.removeAttribute('style');
      const raw = (lineEl.textContent || '').trim();
      if (!raw) continue;
      if (raw.toLowerCase().startsWith('hoe te spelen')) continue;

      let clean = raw.startsWith('-') ? raw.replace(/^-+\s*/, '') : raw;
      // Verwijder bestaande voorloop-icoontjes/symbolen om dubbele iconen te vermijden.
      clean = clean.replace(/^[^\p{L}\p{N}]+/u, '').trim();
      const icon = this.getIntroStepIcon(clean);
      lineEl.textContent = icon + ' ' + clean;
      lineEl.classList.add('core-intro-step');
      lineEl.dataset.coreIntroDecorated = '1';
    }
  },

  applyIntroGuidance(classId, cardEl) {
    if (!cardEl) return;
    const lines = this.introGuidance[classId];
    if (!lines || !lines.length) return;

    const lists = cardEl.querySelectorAll('ul, ol');
    for (let i = 0; i < lists.length; i++) {
      lists[i].remove();
    }

    const existing = cardEl.querySelectorAll('p, li');
    for (let i = 0; i < existing.length; i++) {
      const p = existing[i];
      const text = (p.textContent || '').trim().toLowerCase();
      if (text.startsWith('hoe te spelen')) continue;
      p.remove();
    }

    for (let i = 0; i < lines.length; i++) {
      const p = document.createElement('p');
      p.textContent = lines[i];
      cardEl.appendChild(p);
    }
  },

  normalizeGameIntros(root) {
    if (!root) return;
    const startButtons = root.querySelectorAll('button[id$="-start"]');
    for (let i = 0; i < startButtons.length; i++) {
      const btn = startButtons[i];
      let introRoot = btn.parentElement;
      while (introRoot && introRoot.parentElement !== root) {
        introRoot = introRoot.parentElement;
      }
      if (!introRoot || introRoot.parentElement !== root) continue;
      if (introRoot.dataset.coreIntroNormalized === '1') continue;

      const hasTitle = !!introRoot.querySelector('h3');
      if (!hasTitle) continue;

      introRoot.classList.add('core-intro');
      introRoot.removeAttribute('style');

      const titleEl = introRoot.querySelector('h3');
      if (titleEl) {
        titleEl.classList.add('core-intro-title');
      }

      const subtitleEl = introRoot.querySelector('p');
      if (subtitleEl) {
        subtitleEl.classList.add('core-intro-subtitle');
        subtitleEl.removeAttribute('style');
      }

      const directDivs = Array.from(introRoot.children).filter(function (el) {
        return el.tagName === 'DIV';
      });
      if (directDivs.length > 0) {
        directDivs[0].classList.add('core-intro-card');
        directDivs[0].removeAttribute('style');
        const classId = (btn.id || '').replace(/-start$/, '');
        this.applyIntroGuidance(classId, directDivs[0]);
        this.decorateIntroCard(directDivs[0]);
      }
      if (directDivs.length > 1) {
        directDivs[1].classList.add('core-intro-actions');
        directDivs[1].removeAttribute('style');
      }

      btn.classList.add('core-intro-start');
      if (btn.textContent !== 'Start spel') {
        btn.textContent = 'Start spel';
      }
      btn.removeAttribute('style');
      introRoot.dataset.coreIntroNormalized = '1';
    }
  },

  /**
   * Houd intro-schermen in alle spellen visueel consistent.
   */
  initIntroNormalizer() {
    if (this._introNormalizerInitialized) return;
    this._introNormalizerInitialized = true;

    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;

    this.normalizeGameIntros(gameArea);

    const observer = new MutationObserver(() => {
      this.normalizeGameIntros(gameArea);
    });
    observer.observe(gameArea, {
      childList: true,
      subtree: true
    });
    this._introObserver = observer;
  },
};

// Activeer globale auto-next voor alle rondeknoppen in games.
window.RegenboogCore.initAutoNextObserver();
// Uniformeer intro-schermen met startknop.
window.RegenboogCore.initIntroNormalizer();
