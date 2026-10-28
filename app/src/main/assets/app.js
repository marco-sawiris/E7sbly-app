(async function () {
  'use strict';
  await window.EhsablyI18n.ready;
  const en = window.EhsablyI18n.language === 'en';
  const t = value => window.EhsablyI18n.text(value);
  const calculator = window.EhsablyCalculator;
  const STORAGE_KEY = 'ehsably.products.v1';
  const TARGET_KEY = 'ehsably.target.v1';
  const names = [t('المنتج ١'), t('المنتج ٢'), t('المنتج ٣'), t('المنتج ٤'), t('المنتج ٥')];
  const $ = (id) => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat(en ? 'en-US' : 'ar-EG', { maximumFractionDigits: 2 });
  let nextId = 1;
  let products = restoreProducts();
  let hasResults = false;
  let toastTimer;
  let iconLibrary;
  const trimAnimations = new WeakMap();

  function drawIcon(svg, delay = 0) {
    if (!svg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse').forEach((stroke, index) => {
      if (typeof stroke.getTotalLength !== 'function' || !stroke.animate) return;
      let length;
      try { length = stroke.getTotalLength(); } catch (_) { return; }
      if (!length) return;
      const previous = trimAnimations.get(stroke);
      if (previous) previous.cancel();
      stroke.style.strokeDasharray = `${length} ${length}`;
      stroke.style.strokeDashoffset = '0';
      const filled = getComputedStyle(stroke).fill !== 'none';
      const animation = stroke.animate([
        { strokeDashoffset: String(length), ...(filled ? { fillOpacity: 0 } : {}) },
        { strokeDashoffset: '0', ...(filled ? { fillOpacity: 1 } : {}) }
      ], { duration: 2000, delay: delay + index * 65, easing: 'linear', fill: 'backwards', iterations: Infinity, direction: 'alternate' });
      trimAnimations.set(stroke, animation);
    });
  }

  function hydrateIcons(root = document) {
    if (!iconLibrary) iconLibrary = fetch('sketch-icons.svg').then(response => {
      if (!response.ok) throw new Error('Local icon library unavailable');
      return response.text();
    }).then(source => new DOMParser().parseFromString(source, 'image/svg+xml'));
    iconLibrary.then(library => {
      root.querySelectorAll('use[href^="sketch-icons.svg#"]').forEach(use => {
        const symbol = library.getElementById(use.getAttribute('href').split('#')[1]);
        if (!symbol) return;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        Array.from(symbol.children).forEach(child => group.appendChild(document.importNode(child, true)));
        use.replaceWith(group);
      });
      root.querySelectorAll('svg:not([data-trim-ready])').forEach((svg, index) => {
        svg.dataset.trimReady = 'true';
        drawIcon(svg, 220 + Math.min(index, 8) * 70);
      });
    }).catch(() => { /* External SVG use elements remain a working static fallback. */ });
  }

  function appear(element, delay = 0) {
    if (!element || !element.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    element.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 800, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  }

  function fitAbout() {
    const dialog = $('about-dialog');
    if (!dialog.open || !dialog.offsetHeight) return;
    const scale = Math.min(.8, (window.innerHeight - 24) / dialog.offsetHeight);
    dialog.style.setProperty('--about-scale', String(Math.max(.1, scale)));
  }

  function revealAbout() {
    const dialog = $('about-dialog');
    if (!dialog.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const elements = ['.about-dialog-heading', '.about-app', '.about-description', '.developer-label', '.developer-heading h3', '.developer-heading p', '.developer-card', '.developer-bio', '.developer-photo', '.developer-website', '.about-dismiss'];
    elements.forEach((selector, index) => {
      const element = dialog.querySelector(selector);
      if (!element) return;
      element.getAnimations().forEach(animation => animation.cancel());
      element.animate([
        { opacity: 0, transform: `translate${selector === '.developer-photo' ? 'X(24px)' : 'Y(26px)'} scale(.92)` },
        { opacity: 1, transform: 'translate(0,0) scale(1)' }
      ], { duration: 850, delay: 100 + index * 105, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    });
  }

  function number(value) { return numberFormat.format(value); }
  function unitPrice(value) {
    if (value > 0 && value < 0.01) return t('< ٠٫٠١');
    return number(value);
  }
  function escape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }
  function blankProduct() { return { id: nextId++, name: '', weight: '', unit: 'g', price: '', quantity: 1 }; }
  function restoreProducts() {
    return [blankProduct(), blankProduct()];
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); } catch (_) { /* Calculations still work without storage. */ }
    try { localStorage.setItem(TARGET_KEY, JSON.stringify({ enabled: $('target-weight').value.trim() !== '', weight: $('target-weight').value, unit: $('target-unit').value })); } catch (_) {}
  }
  function hasData() { return products.some((p) => p.name.trim() || p.weight.trim() || p.price.trim()) || $('target-weight').value.trim(); }
  function renderProducts(focusId) {
    $('products-list').innerHTML = products.map((p, index) => `
      <article class="product-card" data-id="${p.id}" aria-label="${names[index]}">
        <div class="product-card-header">
          <span class="product-number" aria-hidden="true">${number(index + 1)}</span>
          <input class="product-name" data-field="name" type="text" maxlength="45" placeholder="${t("اسم ")}${names[index]}${t(" (اختيارى)")}" value="${escape(p.name)}" aria-label="${t("اسم ")}${names[index]}${t("، اختيارى")}" autocomplete="off">
          <div class="header-qty-stepper">
            <button type="button" data-input-qty-id="${p.id}" data-delta="-1" aria-label="${t("تقليل عدد عبوات ")}${escape(p.name || names[index])}" ${p.quantity <= 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke-width:2.5" fill="none" stroke="currentColor"><path d="M5 12h14"/></svg></button>
            <output aria-label="${t("عدد عبوات ")}${escape(p.name || names[index])}">${number(p.quantity || 1)}</output>
            <button type="button" data-input-qty-id="${p.id}" data-delta="1" aria-label="${t("زيادة عدد عبوات ")}${escape(p.name || names[index])}" ${p.quantity >= 99 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke-width:2.5" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>
          <button class="remove-button" type="button" data-remove="${p.id}" aria-label="${t("حذف ")}${escape(p.name || names[index])}" ${products.length <= 2 ? 'disabled' : ''}><svg viewBox="0 0 32 32" aria-hidden="true"><use href="sketch-icons.svg#trash"/></svg></button>
        </div>
        <div class="product-fields">
          <div class="field" data-for="weight"><label for="weight-${p.id}"><svg class="field-sketch" viewBox="0 0 32 32" aria-hidden="true"><use href="sketch-icons.svg#weight"/></svg>${t("وزن العبوة")}</label><div class="input-wrap"><input id="weight-${p.id}" data-field="weight" type="text" inputmode="decimal" maxlength="18" placeholder="${t("مثال: ٣٠٠")}" value="${escape(p.weight)}" autocomplete="off" aria-label="${t("وزن ")}${escape(p.name || names[index])}"><select data-field="unit" aria-label="${t("وحدة وزن ")}${escape(p.name || names[index])}"><option value="g" ${p.unit === 'g' ? 'selected' : ''}>${t("جرام")}</option><option value="kg" ${p.unit === 'kg' ? 'selected' : ''}>${t("كيلو")}</option><option value="l" ${p.unit === 'l' ? 'selected' : ''}>${t("لتر")}</option></select></div><p class="field-error" id="weight-error-${p.id}" hidden></p></div>
          <div class="field" data-for="price"><label for="price-${p.id}"><svg class="field-sketch" viewBox="0 0 32 32" aria-hidden="true"><use href="sketch-icons.svg#price"/></svg>${t("سعر العبوة")}</label><div class="input-wrap"><input id="price-${p.id}" data-field="price" type="text" inputmode="decimal" maxlength="18" placeholder="${t("مثال: ٣٠")}" value="${escape(p.price)}" autocomplete="off" aria-label="${t("سعر ")}${escape(p.name || names[index])}"><span class="currency">${t("ج.م")}</span></div><p class="field-error" id="price-error-${p.id}" hidden></p></div>
        </div>
      </article>`).join('');
    $('product-count').textContent = `${number(products.length)} / ${number(5)}`;
    $('add-button').disabled = products.length >= 5;
    $('add-button').querySelector('span:nth-child(2)').textContent = products.length >= 5 ? t('وصلت لـ ٥ منتجات') : t('إضافة منتج');
    if (focusId) document.querySelector(`[data-id="${focusId}"] .product-name`).focus();
    hydrateIcons($('products-list'));
  }
  function clearErrors() {
    document.querySelectorAll('.field.has-error').forEach((field) => field.classList.remove('has-error'));
    document.querySelectorAll('.field-error').forEach((field) => { field.hidden = true; field.textContent = ''; });
    document.querySelectorAll('[aria-invalid]').forEach((input) => { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); });
    $('form-errors').hidden = true;
    $('form-errors').textContent = '';
  }
  function invalidateResults() {
    document.querySelector('.compare-button span').textContent = t('احسب الأوفر');
    $('results-panel').classList.remove('has-comparison');
    if (hasResults) {
      $('comparison-results').hidden = true;
      $('empty-results').hidden = false;
      $('empty-message').innerHTML = t('عدّلت البيانات؟ اضغط «احسب الأوفر»<br>عشان تشوف الترتيب الجديد.');
      hasResults = false;
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
  }
  function showErrors(errors) {
    let firstInvalid;
    const generalErrors = [];
    errors.forEach((error) => {
      if (error.field === 'target') {
        $('target-weight').setAttribute('aria-invalid', 'true');
        if (!firstInvalid) firstInvalid = $('target-weight');
        generalErrors.push(t(error.message));
        return;
      }
      const p = products[error.index];
      const input = p && $(error.field + '-' + p.id);
      if (input && (error.field === 'weight' || error.field === 'price')) {
        const field = input.closest('.field');
        const message = $(error.field + '-error-' + p.id);
        field.classList.add('has-error');
        message.textContent = t(error.message);
        message.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', message.id);
        if (!firstInvalid) firstInvalid = input;
      } else generalErrors.push(t(error.message));
    });
    $('form-errors').textContent = generalErrors.length ? [...new Set(generalErrors)].join(' ') : t('راجع الوزن والسعر المكتوبين تحت قبل ما نحسب.');
    $('form-errors').hidden = false;
    if (firstInvalid) firstInvalid.focus();
  }
  function compare(scrollToResults, animate = true) {
    clearErrors();
    const input = products.map((p, index) => ({ ...p, name: p.name.trim() || (p.weight.trim() || p.price.trim() ? names[index] : '') }));
    const targetMode = $('target-weight').value.trim() !== '';
    const result = targetMode ? calculator.compareTarget(input, $('target-weight').value, $('target-unit').value) : calculator.compareProducts(input);
    if (!result.ok) { invalidateResults(); showErrors(result.errors); return false; }
    $('results-title').textContent = targetMode ? t('أقل تكلفة لاحتياجك') : t('الترتيب من الأوفر');
    $('results-basis').textContent = targetMode ? t('عبوات كاملة') : t('لكل ١ كيلو');
    $('results-note').textContent = targetMode ? t('كل اختيار من منتج واحد، بعبوات كاملة تغطّى الوزن المطلوب. عند تساوى التكلفة بنعرض الوزن الزيادة الأقل أولًا.') : t('الترتيب حسب سعر الكيلو. جودة المنتج واختيارك ليهم دور برضه.');
    const winners = result.ranked.filter((p) => p.isCheapest);
    const tied = winners.length > 1;
    const allEqual = winners.length === result.ranked.length;
    const roundedSavings = number(result.savingsPercent);
    const savingsLabel = result.savingsPercent > 0 && result.savingsPercent < 0.01 ? t('أقل من ٠٫٠١٪') : `${roundedSavings}${t("٪")}`;
    const savings = targetMode ? result.purchaseSavings : result.savingsPerKg;
    const cashLabel = savings > 0 && savings < 0.01 ? t('أقل من ٠٫٠١') : number(savings);
    const winnerLabel = tied ? t('الاختيارات الأوفر') : escape(result.cheapest.name);
    const savingsIcon = '<span class="savings-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M24 8 8 24M8 12v12h12"/></svg></span>';
    $('savings-banner').innerHTML = `${savingsIcon}<div class="savings-copy"><strong>${allEqual ? t('كل الاختيارات بنفس سعر الكيلو') : `${winnerLabel}${t(" أوفر بـ ")}${cashLabel}${t(" ج")}`}</strong><p>${allEqual ? t('اختار الحجم والجودة الأنسب ليك.') : `${t("مقارنة موحّدة على أساس ١ كيلو · توفير ")}${savingsLabel}${tied ? t(' · الأوفر بالتساوى') : ''}`}</p></div>`;
    if (targetMode) $('savings-banner').innerHTML = `${savingsIcon}<div class="savings-copy"><strong>${allEqual ? t('كل الاختيارات بنفس إجمالى التكلفة') : `${winnerLabel}${t(" أوفر بـ ")}${cashLabel}${t(" ج")}`}</strong><p>${t("لتغطية ")}${number(result.targetGrams)}${t(" جرام على الأقل · ")}${allEqual ? t('بنفس المبلغ المدفوع') : t('مقارنة بأغلى اختيار بالعبوات الكاملة')}</p></div>`;
    $('ranked-products').innerHTML = result.ranked.map((p) => {
      const isBest = p.isCheapest;
      let diffHtml = '';
      if (isBest) {
        const altSavings = [];
        result.ranked.forEach((alt) => {
          if (alt.id !== p.id && alt.pricePerKg > p.pricePerKg) {
            const diff = number(alt.pricePerKg - p.pricePerKg);
            altSavings.push(`<p class="alt-savings-item">${t("يوفر ")}${diff}${t(" ج")}${t(" مقارنة بـ ")}${escape(alt.name)}</p>`);
          }
        });
        diffHtml = altSavings.join('');
      } else {
        const diff = number(p.pricePerKg - result.cheapest.pricePerKg);
        diffHtml = `<p class="alt-diff-item">+ ${diff}${t(" ج مقارنة بالأوفر")}</p>`;
      }
      const unitLabel = p.unit === 'l' ? t("ج.م / لتر") : t("ج.م / كيلو");
      const subLabel = p.unit === 'l' ? t("ج.م / ١٠٠ مل") : t("ج.م / ١٠٠ جرام");
      const subPrice = number(p.pricePerKg / 10);
      const weightUnit = p.unit === 'l' ? t('لتر') : (p.unit === 'kg' ? t('كيلو') : t('جرام'));
      return `<article class="ranked-card ${isBest ? 'is-best' : ''}" aria-label="${escape(p.name)}, ${number(p.pricePerKg)}${p.unit === 'l' ? '' : t(" جنيه للكيلو")}${isBest ? t('، الأوفر') : ''}">
        <div class="ranked-header">
          <span class="rank-number">${number(p.rank)}</span>
          <span class="ranked-name">${escape(p.name)}</span>
          ${isBest ? `<span class="best-tag">${tied ? t('الأوفر بالتساوى') : t('الأوفر قيمة')}</span>` : ''}
        </div>
        ${diffHtml}
        <div class="ranked-body">
          <div class="pack-details">${number(p.weight)} ${weightUnit}<br><strong>${t("العبوة بـ ")}${number(p.price)}${en ? '' : t(" جنيه")}</strong></div>
          <div class="unit-price"><span class="value" dir="ltr">${escape(unitPrice(p.pricePerKg))}</span><span class="unit">${unitLabel}</span></div>
        </div>
        <div style="font-size:10px;color:var(--muted);text-align:end;margin-top:2px">${subPrice} ${subLabel}</div>
      </article>`;
    }).join('');
    $('ranked-products').querySelectorAll('.ranked-card').forEach((card, index) => {
      const p = result.ranked[index];
      if (targetMode) {
        card.setAttribute('aria-label', `${p.name}${t("، إجمالى ")}${number(p.purchaseCost)}${t(" جنيه")}`);
        card.querySelector('.unit-price').innerHTML = `<span class="value" dir="ltr">${escape(unitPrice(p.purchaseCost))}</span><span class="unit">${t("ج.م إجمالى")}</span>`;
        const totals = document.createElement('p');
        totals.className = 'purchase-summary';
        totals.textContent = `${number(p.requiredPacks)}${t(" عبوة × ")}${number(p.price)}${t(" ج")}${t(" · إجمالى ")}${number(p.purchaseGrams)}${t(" جرام")}${t(" · زيادة ")}${number(p.extraGrams)}${t(" جرام")}`;
        card.appendChild(totals);
      }
    });
    hydrateIcons($('comparison-results'));
    $('empty-results').hidden = true;
    $('comparison-results').hidden = false;
    $('results-panel').classList.add('has-comparison');
    if (animate) {
      appear($('savings-banner'));
      document.querySelectorAll('.ranked-card').forEach((card, index) => appear(card, 140 + index * 170));
    }
    hasResults = true;
    document.querySelector('.compare-button span').textContent = t('تعديل المنتجات');
    persist();
    if (scrollToResults) {
      $('results-panel').focus({ preventScroll: true });
      $('results-panel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
    return true;
  }
  function reset() {
    products = [blankProduct(), blankProduct()];
    $('target-weight').value = '';
    $('target-unit').value = 'kg';
    clearErrors();
    invalidateResults();
    renderProducts();
    $('empty-message').innerHTML = t('دخل وزن وسعر منتجين على الأقل،<br>وهنرتبهم لك حسب سعر الكيلو.');
    persist();
    $('reset-dialog').close();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(t('جاهزين لحسبة جديدة'));
  }
  function loadExample() {
    $('target-weight').value = '';
    products = [
      { id: nextId++, name: t('عبوة صغيرة'), weight: t('٣٠٠'), unit: 'g', price: t('٣٠') },
      { id: nextId++, name: t('عبوة كبيرة'), weight: t('٤٥٠'), unit: 'g', price: t('٤٠') }
    ];
    $('example-dialog').close();
    renderProducts();
    compare(true);
    toast(t('مثال: ٣٠٠ جرام و٤٥٠ جرام'));
  }
  $('comparison-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (hasResults) {
      invalidateResults();
      $('products-title').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    } else compare(true);
  });
  ['target-weight', 'target-unit'].forEach(id => $(id).addEventListener(id === 'target-unit' ? 'change' : 'input', () => { clearErrors(); invalidateResults(); persist(); }));
  $('products-list').addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    const card = event.target.closest('[data-id]');
    if (!field || !card) return;
    const product = products.find((p) => p.id === Number(card.dataset.id));
    product[field] = event.target.value;
    clearErrors();
    invalidateResults();
    persist();
  });
  $('products-list').addEventListener('change', (event) => {
    if (event.target.dataset.field === 'unit') {
      const p = products.find((item) => item.id === Number(event.target.closest('[data-id]').dataset.id));
      p.unit = event.target.value;
      clearErrors(); invalidateResults(); persist();
    }
  });
  $('products-list').addEventListener('click', (event) => {
    const qtyBtn = event.target.closest('[data-input-qty-id]');
    if (qtyBtn) {
      const p = products.find(item => item.id === Number(qtyBtn.dataset.inputQtyId));
      if (p) {
        p.quantity = Math.max(1, Math.min(99, (p.quantity || 1) + Number(qtyBtn.dataset.delta)));
        renderProducts();
        persist();
      }
      return;
    }
    const button = event.target.closest('[data-remove]');
    if (!button || products.length <= 2) return;
    products = products.filter((p) => p.id !== Number(button.dataset.remove));
    clearErrors(); invalidateResults(); renderProducts(); persist();
    toast(t('اتحذف المنتج'));
  });
  $('add-button').addEventListener('click', () => {
    if (products.length >= 5) return;
    const p = blankProduct();
    products.push(p);
    clearErrors(); invalidateResults(); renderProducts(p.id); persist();
    appear(document.querySelector(`[data-id="${p.id}"]`));
  });
  $('ranked-products').addEventListener('click', event => {
    const control = event.target.closest('[data-quantity-id]');
    if (!control) return;
    const product = products.find(p => p.id === Number(control.dataset.quantityId));
    if (!product) return;
    product.quantity = Math.max(1, Math.min(99, (product.quantity || 1) + Number(control.dataset.quantityDelta)));
    persist();
    compare(false, false);
    const replacement = $('ranked-products').querySelector(`[data-quantity-id="${control.dataset.quantityId}"][data-quantity-delta="${control.dataset.quantityDelta}"]`);
    if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
  });
  $('about-button').addEventListener('click', () => {
    $('about-dialog').showModal();
    fitAbout();
    document.querySelector('.about-scroll').scrollTop = 0;
    revealAbout();
    $('about-dialog').querySelectorAll('svg').forEach(svg => drawIcon(svg, 300));
  });
  let websiteScrollTimer;
  window.addEventListener('resize', fitAbout);
  if (window.ResizeObserver) new ResizeObserver(fitAbout).observe($('about-dialog'));
  document.querySelector('.about-scroll').addEventListener('scroll', () => {
    clearTimeout(websiteScrollTimer);
    websiteScrollTimer = setTimeout(() => {
      $('about-dialog').querySelectorAll('.developer-website svg').forEach(svg => drawIcon(svg));
    }, 180);
  }, { passive: true });
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('simple-mode-link').addEventListener('click', (event) => {
    if (location.hostname !== 'appassets.androidplatform.net') {
      event.preventDefault();
      toast(t('العرض المبسّط متاح فى نسخة أندرويد'));
    }
  });
  $('reset-button').addEventListener('click', () => { if (hasData()) $('reset-dialog').showModal(); else reset(); });
  $('form-reset-button').addEventListener('click', () => { if (hasData()) $('reset-dialog').showModal(); else reset(); });
  $('clear-all-button').addEventListener('click', () => { if (hasData()) $('reset-dialog').showModal(); else reset(); });
  $('confirm-reset').addEventListener('click', reset);
  $('example-button').addEventListener('click', () => { if (hasData()) $('example-dialog').showModal(); else loadExample(); });
  $('confirm-example').addEventListener('click', loadExample);
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
  document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest('button');
    if (button) button.querySelectorAll('svg').forEach(svg => drawIcon(svg));
  });
  document.addEventListener('focusin', event => {
    const field = event.target.closest('.field');
    if (field) field.querySelectorAll('svg').forEach(svg => drawIcon(svg));
    if (event.target && event.target.tagName === 'INPUT' && (event.target.type === 'text' || event.target.inputMode === 'decimal')) {
      try { event.target.select(); } catch (_) {}
    }
  });

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('ehsably.theme', theme); } catch (_) {}
    const lightBtn = $('theme-light-btn');
    const darkBtn = $('theme-dark-btn');
    if (lightBtn) lightBtn.classList.toggle('active', theme === 'light');
    if (darkBtn) darkBtn.classList.toggle('active', theme === 'dark');
  }
  const currentTheme = localStorage.getItem('ehsably.theme') || 'light';
  applyTheme(currentTheme);

  const menuBtn = $('menu-button');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      $('side-drawer').hidden = false;
      $('drawer-backdrop').hidden = false;
    });
  }
  const hideDrawer = () => {
    const drawer = $('side-drawer');
    const backdrop = $('drawer-backdrop');
    if (drawer) drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
  };
  $('drawer-close')?.addEventListener('click', hideDrawer);
  $('drawer-backdrop')?.addEventListener('click', hideDrawer);
  $('theme-light-btn')?.addEventListener('click', () => applyTheme('light'));
  $('theme-dark-btn')?.addEventListener('click', () => applyTheme('dark'));
  $('lang-ar-btn')?.addEventListener('click', () => {
    hideDrawer();
    window.EhsablyI18n.setLanguage('ar');
  });
  $('lang-en-btn')?.addEventListener('click', () => {
    hideDrawer();
    window.EhsablyI18n.setLanguage('en');
  });
  $('drawer-about-btn')?.addEventListener('click', () => {
    hideDrawer();
    $('about-dialog').showModal();
    fitAbout();
    revealAbout();
  });
  $('results-back-btn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    invalidateResults();
  });
  $('results-restart-btn')?.addEventListener('click', reset);
  try {
    const target = JSON.parse(localStorage.getItem(TARGET_KEY));
    if (target && typeof target.weight === 'string') {
      $('target-weight').value = target.enabled === false ? '' : target.weight.slice(0, 18);
      $('target-unit').value = target.unit === 'g' ? 'g' : 'kg';
    }
  } catch (_) {}
  document.querySelectorAll('[data-language]').forEach(choice => {
    choice.setAttribute('aria-pressed', String(choice.dataset.language === (en ? 'en' : 'ar')));
    choice.addEventListener('click', () => {
      $('language-dialog').close();
      if (choice.dataset.language === (en ? 'en' : 'ar')) return;
      persist();
      window.EhsablyI18n.setLanguage(choice.dataset.language);
    });
  });
  $('language-button').addEventListener('click', () => {
    $('language-dialog').showModal();
    $('language-dialog').querySelector('[aria-pressed="true"]').focus();
  });
  renderProducts();
  hydrateIcons();
  appear(document.querySelector('.topbar'));
  appear(document.querySelector('.hero'), 140);
  document.querySelectorAll('.product-card').forEach((card, index) => appear(card, 220 + index * 150));
})();
