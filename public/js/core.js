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
  },

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
};
