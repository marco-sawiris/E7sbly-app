(function () {
  'use strict';
  let language = 'ar';
  try { if (localStorage.getItem('ehsably.language') === 'en') language = 'en'; } catch (_) {}
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
  document.documentElement.dataset.i18nPending = 'true';
  const api = window.EhsablyI18n = {
    language,
    catalog: {},
    text(value) { return language === 'en' ? (api.catalog[value] || value) : value; },
    setLanguage(value) {
      if (value !== 'ar' && value !== 'en') return;
      try { localStorage.setItem('ehsably.language', value); } catch (_) {}
      location.reload();
    }
  };
  api.ready = fetch('translations.json').then(response => {
    if (!response.ok) throw new Error('Translation catalog unavailable');
    return response.json();
  }).then(catalog => {
    api.catalog = catalog;
    if (language !== 'en') return;
    // Only the initial static document is translated. Product names and values
    // are rendered afterwards and are never passed through this traversal.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const raw = node.nodeValue;
      if (catalog[raw] !== undefined) node.nodeValue = catalog[raw];
      else if (catalog[raw.trim()] !== undefined) node.nodeValue = raw.replace(raw.trim(), catalog[raw.trim()]);
    });
    document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(element => {
      ['aria-label','placeholder','title'].forEach(attribute => {
        const value = element.getAttribute(attribute);
        if (value && catalog[value]) element.setAttribute(attribute, catalog[value]);
      });
    });
    document.title = 'E7sbly — Find the best value';
    document.querySelector('.about-app span').textContent = 'Version 2 · Made for easier comparisons';
  }).catch(() => { /* Static Arabic remains usable if the local catalog fails. */ })
    .finally(() => { delete document.documentElement.dataset.i18nPending; });
})();
