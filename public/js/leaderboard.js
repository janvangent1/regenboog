window.Leaderboard = {
  apiBase: '',

  getList(className) {
    const url = this.apiBase + '/api/leaderboard/' + encodeURIComponent(className);
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Ranglijst niet bereikbaar');
        return r.json();
      })
      .then(function (data) {
        return Array.isArray(data) ? data : [];
      });
  },

  submit(className, playerName, studentClass, score) {
    return fetch(this.apiBase + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_name: className,
        player_name: playerName,
        student_class: studentClass,
        score: score,
      }),
    }).then(function (r) {
      if (!r.ok) throw new Error('Opslaan mislukt');
      return r.json();
    });
  },

  render(containerEl, className) {
    if (!containerEl) return;
    containerEl.innerHTML = '<p>Laden...</p>';
    this.getList(className).then(
      function (rows) {
        if (!rows || !rows.length) {
          containerEl.innerHTML = '<p>Nog geen scores.</p>';
          return;
        }
        containerEl.innerHTML =
          '<table class="leaderboard-table"><thead><tr><th>#</th><th>Naam</th><th>Klas</th><th>Score</th></tr></thead><tbody>' +
          rows
            .map(function (r, i) {
              var name = (r && r.player_name != null) ? String(r.player_name) : '';
              var studentClass = (r && r.student_class) ? String(r.student_class) : '-';
              var scoreVal = (r && r.score != null) ? Number(r.score) : 0;
              return '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(name) + '</td><td>' + escapeHtml(studentClass) + '</td><td>' + escapeHtml(String(scoreVal)) + '</td></tr>';
            })
            .join('') +
          '</tbody></table>';
      },
      function () {
        containerEl.innerHTML = '<p>Ranglijst kon niet worden geladen.</p>';
      }
    );
  },

  showSubmitForm(className, score, onDone) {
    // Toon formulier in een vaste overlay (buiten #game-area) zodat game render() het niet overschrijft
    const overlay = document.createElement('div');
    overlay.className = 'score-submit-overlay';
    overlay.setAttribute('style',
      'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;'
    );

    // Haal dierennamen op uit REGENBOOG_CLASSES, of gebruik fallback lijst
    let classes = [{ value: '', label: '-- Selecteer klas --' }];
    
    if (window.REGENBOOG_CLASSES && Array.isArray(window.REGENBOOG_CLASSES)) {
      // Gebruik dierennamen uit classes.js
      const uniqueClasses = new Map();
      window.REGENBOOG_CLASSES.forEach(cls => {
        if (cls.name && !uniqueClasses.has(cls.name)) {
          uniqueClasses.set(cls.name, cls.name);
        }
      });
      // Sorteer alfabetisch
      const sortedNames = Array.from(uniqueClasses.values()).sort();
      classes = classes.concat(sortedNames.map(name => ({ value: name, label: name })));
    } else {
      // Fallback: gebruik dierennamen als classes.js niet beschikbaar is
      classes = classes.concat([
        { value: 'Beren', label: 'Beren' },
        { value: 'Dolfijnen', label: 'Dolfijnen' },
        { value: 'Draken', label: 'Draken' },
        { value: 'Eenden', label: 'Eenden' },
        { value: 'Egels', label: 'Egels' },
        { value: 'Giraffen', label: 'Giraffen' },
        { value: 'Kangoeroes', label: 'Kangoeroes' },
        { value: "Koala's", label: "Koala's" },
        { value: 'Konijnen', label: 'Konijnen' },
        { value: 'Leeuwen', label: 'Leeuwen' },
        { value: 'Lieveheersbeestjes', label: 'Lieveheersbeestjes' },
        { value: 'Muizen', label: 'Muizen' },
        { value: 'Nijlpaarden', label: 'Nijlpaarden' },
        { value: 'Olifanten', label: 'Olifanten' },
        { value: "Panda's", label: "Panda's" },
        { value: 'Pinguïns', label: 'Pinguïns' },
        { value: 'Vlinders', label: 'Vlinders' },
        { value: 'Vossen', label: 'Vossen' },
        { value: 'Uilen', label: 'Uilen' },
        { value: 'Wolven', label: 'Wolven' },
        { value: "Zebra's", label: "Zebra's" },
        { value: 'Zwaluwen', label: 'Zwaluwen' }
      ]);
    }

    const formHtml = `
      <div class="score-submit-form" style="max-width: 500px; margin: 2rem auto; padding: 1.5rem; background: #f8f6f2; border-radius: 12px; border: 2px solid var(--border);">
        <h3 style="margin-top: 0; color: var(--rainbow-5);">Score opslaan</h3>
        <p style="margin-bottom: 1rem;">Je score: <strong>${score}</strong></p>
        <form id="score-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label for="player-name" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Naam:</label>
            <input type="text" id="player-name" name="player-name" required 
                   style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: 8px; font-size: 1rem; box-sizing: border-box;"
                   placeholder="Voer je naam in" autofocus>
          </div>
          <div>
            <label for="student-class" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Klas:</label>
            <select id="student-class" name="student-class" 
                    style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: 8px; font-size: 1rem; box-sizing: border-box; background: white;">
              ${classes.map(c => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join('')}
            </select>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="submit" 
                    style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, var(--rainbow-4), var(--rainbow-5)); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">
              Opslaan
            </button>
            <button type="button" id="cancel-score" 
                    style="flex: 1; padding: 0.75rem; background: #e0e0e0; color: #333; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">
              Overslaan
            </button>
          </div>
        </form>
        <div id="score-error" style="display: none; margin-top: 1rem; padding: 0.75rem; background: #ffebee; color: #c62828; border-radius: 8px;"></div>
      </div>
    `;

    const formContainer = document.createElement('div');
    formContainer.innerHTML = formHtml;
    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);

    const form = document.getElementById('score-form');
    const nameInput = document.getElementById('player-name');
    const classSelect = document.getElementById('student-class');
    const errorDiv = document.getElementById('score-error');
    const cancelBtn = document.getElementById('cancel-score');

    function cleanup() {
      overlay.remove();
      if (onDone) onDone();
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) cleanup();
    });

    const self = this;
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        errorDiv.textContent = 'Voer een naam in';
        errorDiv.style.display = 'block';
        nameInput.focus();
        return;
      }

      const studentClass = classSelect.value.trim() || null;
      
      // Disable form tijdens submit
      form.querySelector('button[type="submit"]').disabled = true;
      form.querySelector('button[type="submit"]').textContent = 'Opslaan...';
      errorDiv.style.display = 'none';

      self.submit(className, name, studentClass, score).then(
        function () {
          cleanup();
        },
        function (err) {
          errorDiv.textContent = 'Score kon niet worden opgeslagen. Controleer je internetverbinding.';
          errorDiv.style.display = 'block';
          form.querySelector('button[type="submit"]').disabled = false;
          form.querySelector('button[type="submit"]').textContent = 'Opslaan';
        }
      );
    });

    cancelBtn.addEventListener('click', function() {
      cleanup();
    });
  },
};

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
