(function () {
  const classes = window.REGENBOOG_CLASSES || [];
  const byGrade = {};
  classes.forEach((c) => {
    if (!byGrade[c.grade]) byGrade[c.grade] = [];
    byGrade[c.grade].push(c);
  });

  const containerIds = {
    'instap-1': 'classes-instap-1',
    '2-3-kleuter': 'classes-2-3-kleuter',
    '1e-leerjaar': 'classes-1e-leerjaar',
    '2e-leerjaar': 'classes-2e-leerjaar',
    '3e-leerjaar': 'classes-3e-leerjaar',
    '4e-leerjaar': 'classes-4e-leerjaar',
    '5e-leerjaar': 'classes-5e-leerjaar',
    '6e-leerjaar': 'classes-6e-leerjaar',
    'extra-spellen': 'classes-extra-spellen',
  };

  Object.keys(containerIds).forEach((grade) => {
    const list = byGrade[grade] || [];
    const el = document.getElementById(containerIds[grade]);
    if (!el) return;
    el.innerHTML = list
      .map(function (c) {
        var imgSrc = (c.id === 'dammen' || c.id === 'schaken' || c.id === 'vieropeenrij')
          ? '/assets/images/classes/' + c.id + '.svg'
          : '/assets/images/classes/' + c.id + '.png';
        var iconHtml = '<span class="class-card-icon" aria-hidden="true">' +
          '<img src="' + imgSrc + '" alt="" class="class-card-logo" loading="lazy">' +
          '</span>';
        var gameSubtitle = (c.game && c.game !== c.name) ? '<span class="class-game">' + c.game + '</span>' : '';
        return (
          '<a class="class-card" href="/games/' + c.id + '.html" title="' + c.name + (c.game && c.game !== c.name ? ' – ' + c.game : '') + '">' +
            iconHtml +
            '<span class="class-name">' + c.name + '</span>' +
            gameSubtitle +
          '</a>'
        );
      })
      .join('');
  });
})();
