(function (root, factory) {
  "use strict";
  var calculator = factory();
  if (typeof module === "object" && module.exports) module.exports = calculator;
  if (root) root.EhsablyCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_PRODUCTS = 5;
  var RELATIVE_TOLERANCE = 1e-9;

  /** Read a complete number, including Arabic/Persian digits and Arabic separators. */
  function normalizeNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value !== "string") return NaN;

    var text = value.trim().replace(/[\u200e\u200f\u061c]/g, "")
      .replace(/[\u0660-\u0669]/g, function (digit) { return String(digit.charCodeAt(0) - 0x0660); })
      .replace(/[\u06f0-\u06f9]/g, function (digit) { return String(digit.charCodeAt(0) - 0x06f0); })
      .replace(/\u066b/g, ".")
      .replace(/\u066c/g, ",")
      .replace(/\u2212/g, "-");

    // Commas must form complete groups of three, so a mistyped 1,5 is not read as 15.
    if (text.indexOf(",") !== -1) {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(text)) return NaN;
      text = text.replace(/,/g, "");
    }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return NaN;
    var number = Number(text);
    return Number.isFinite(number) ? number : NaN;
  }

  function isBlank(value) {
    return value === null || value === undefined ||
      (typeof value === "string" && value.trim() === "");
  }

  function pricesTie(a, b) {
    return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * RELATIVE_TOLERANCE;
  }

  function compareProducts(products) {
    var errors = [];
    var valid = [];
    var count = 0;

    function addError(index, field, code, message) {
      errors.push({ index: index, field: field, code: code, message: message });
    }

    if (!Array.isArray(products)) {
      addError(null, "products", "invalid", "أدخل قائمة المنتجات للمقارنة.");
      return result([]);
    }

    products.forEach(function (product, index) {
      if (product === null || product === undefined) return;
      if (typeof product !== "object" || Array.isArray(product)) {
        count += 1;
        addError(index, "product", "invalid", "بيانات المنتج غير صالحة.");
        return;
      }
      if (isBlank(product.name) && isBlank(product.weight) && isBlank(product.price)) return;
      count += 1;
      var previousErrors = errors.length;
      var weight = normalizeNumber(product.weight);
      var price = normalizeNumber(product.price);
      var unit = isBlank(product.unit) ? "g" : String(product.unit).trim().toLowerCase();
      var quantity = isBlank(product.quantity) ? 1 : normalizeNumber(product.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
        addError(index, "quantity", "range", "عدد العبوات من ١ إلى ٩٩.");

      if (isBlank(product.weight)) {
        addError(index, "weight", "required", "أدخل وزن المنتج.");
      } else if (!Number.isFinite(weight) || weight <= 0) {
        addError(index, "weight", "positive", "الوزن لازم يكون رقم أكبر من صفر.");
      }
      if (isBlank(product.price)) {
        addError(index, "price", "required", "أدخل سعر المنتج.");
      } else if (!Number.isFinite(price) || price <= 0) {
        addError(index, "price", "positive", "السعر لازم يكون رقم أكبر من صفر.");
      }
      if (unit !== "g" && unit !== "kg" && unit !== "l") {
        addError(index, "unit", "invalid", "اختار جرام أو كيلوجرام أو لتر.");
      }
      if (errors.length !== previousErrors) return;

      var isVolume = unit === "l" || unit === "ml";
      var normalizedAmount = isVolume
        ? (unit === "l" ? weight : weight / 1000)
        : (unit === "kg" ? weight : weight / 1000);
      var pricePerKg = price / normalizedAmount;
      if (!Number.isFinite(pricePerKg) || pricePerKg <= 0 || normalizedAmount <= 0
          || !Number.isFinite(weight * quantity) || !Number.isFinite(price * quantity)) {
        addError(index, "product", "range", "الأرقام كبيرة أو صغيرة جدًا للحساب، راجع الوزن والسعر.");
        return;
      }
      valid.push({
        id: product.id === null || product.id === undefined ? String(index) : product.id,
        index: index,
        name: isBlank(product.name) ? "المنتج " + (index + 1) : String(product.name).trim(),
        weight: weight,
        unit: unit,
        isVolume: isVolume,
        price: price,
        quantity: quantity,
        totalWeight: weight * quantity,
        totalPrice: price * quantity,
        weightKg: normalizedAmount,
        pricePerKg: pricePerKg,
        pricePer100g: pricePerKg / 10
      });
    });

    if (count < 2) addError(null, "products", "minimum", "أدخل منتجين على الأقل للمقارنة.");
    if (count > MAX_PRODUCTS) addError(null, "products", "maximum", "تقدر تقارن لحد ٥ منتجات فقط.");

    var hasWeight = false;
    var hasVolume = false;
    valid.forEach(function (p) {
      if (p.isVolume) hasVolume = true;
      else hasWeight = true;
    });
    if (hasWeight && hasVolume) {
      addError(null, "unit", "incompatible", "لا يمكن مقارنة الوزن (كيلوجرام/جرام) بالحجم (لتر) مباشرة بدون معرفة الكثافة. يرجى توحيد نوع الوحدة.");
      return result([]);
    }

    // Sort exactly first, then group prices within tolerance. Anchored groups avoid
    // a non-transitive approximate comparator and preserve original order for ties.
    valid.sort(function (a, b) { return a.pricePerKg - b.pricePerKg || a.index - b.index; });
    var ranked = [];
    var mostExpensivePrice = valid.length ? valid[valid.length - 1].pricePerKg : 0;
    for (var start = 0; start < valid.length;) {
      var end = start + 1;
      while (end < valid.length && pricesTie(valid[start].pricePerKg, valid[end].pricePerKg)) end += 1;
      var group = valid.slice(start, end).sort(function (a, b) { return a.index - b.index; });
      group.forEach(function (product) {
        product.rank = start + 1;
        product.isCheapest = start === 0;
        product.savingsPercent = pricesTie(product.pricePerKg, mostExpensivePrice)
          ? 0 : (mostExpensivePrice - product.pricePerKg) / mostExpensivePrice * 100;
        product.savingsPerKg = pricesTie(product.pricePerKg, mostExpensivePrice)
          ? 0 : Math.max(0, mostExpensivePrice - product.pricePerKg);
        ranked.push(product);
      });
      start = end;
    }
    return result(ranked);

    function result(rankedProducts) {
      var cheapest = rankedProducts.length ? rankedProducts[0] : null;
      var mostExpensive = rankedProducts.length ? rankedProducts.reduce(function (highest, product) {
        return product.pricePerKg > highest.pricePerKg ? product : highest;
      }) : null;
      return {
        ok: errors.length === 0,
        errors: errors,
        ranked: rankedProducts,
        cheapest: cheapest,
        mostExpensive: mostExpensive,
        savingsPercent: cheapest ? cheapest.savingsPercent : 0,
        savingsPerKg: cheapest ? cheapest.savingsPerKg : 0
      };
    }
  }

  // Exact decimal ratios prevent a spurious extra pack (e.g. 0.21 / 0.07).
  function fraction(value) {
    var parts = String(value).toLowerCase().split('e');
    var digits = parts[0].split('.');
    var scale = (digits[1] || '').length - Number(parts[1] || 0);
    var numerator = BigInt(digits.join(''));
    return scale < 0 ? [numerator * 10n ** BigInt(-scale), 1n]
      : [numerator, 10n ** BigInt(scale)];
  }

  function compareTarget(products, weight, unit) {
    var result = compareProducts(products);
    var target = normalizeNumber(weight);
    var targetUnit = isBlank(unit) ? 'g' : String(unit).trim().toLowerCase();
    if (!Number.isFinite(target) || target <= 0 || (targetUnit !== 'g' && targetUnit !== 'kg' && targetUnit !== 'l')) {
      result.errors.push({ index: null, field: 'target', code: 'positive', message: 'أدخل الوزن المطلوب أكبر من صفر، واختار جرام أو كيلو.' });
      result.ok = false;
    }
    if (!result.ok) return result;
    var isVolume = result.ranked.length && result.ranked[0].isVolume;
    if (isVolume && targetUnit !== 'l') {
      result.errors.push({ index: null, field: 'target', code: 'unit', message: 'الوحدة المطلوبة لازم تتوافق مع نوع المنتجات (لتر للحجم، أو جرام/كيلو للوزن).' });
      result.ok = false;
      return result;
    }
    if (!isVolume && targetUnit === 'l') {
      result.errors.push({ index: null, field: 'target', code: 'unit', message: 'الوحدة المطلوبة لازم تتوافق مع نوع المنتجات (لتر للحجم، أو جرام/كيلو للوزن).' });
      result.ok = false;
      return result;
    }
    var targetRatio = fraction(target);
    if (targetUnit === 'kg') targetRatio[0] *= 1000n;
    var targetGrams = target * (targetUnit === 'kg' ? 1000 : 1);
    var ranked = result.ranked.map(function (product) {
      var ratio = fraction(product.weight);
      if (product.unit === 'kg') ratio[0] *= 1000n;
      var numerator = targetRatio[0] * ratio[1];
      var denominator = targetRatio[1] * ratio[0];
      var packs = Number((numerator + denominator - 1n) / denominator);
      var totalGrams = product.weight * (product.unit === 'kg' ? 1000 : 1) * packs;
      var cost = product.price * packs;
      if (!Number.isSafeInteger(packs) || !Number.isFinite(totalGrams) || !Number.isFinite(cost)) {
        result.errors.push({ index: product.index, field: 'target', code: 'range', message: 'الأرقام كبيرة جدًا لحساب العبوات، راجع الوزن المطلوب.' });
      }
      return Object.assign({}, product, { requiredPacks: packs, purchaseGrams: totalGrams, purchaseCost: cost, extraGrams: Math.max(0, totalGrams - targetGrams) });
    });
    if (result.errors.length || !Number.isFinite(targetGrams)) {
      result.ok = false;
      return result;
    }
    ranked.sort(function (a, b) { return a.purchaseCost - b.purchaseCost || a.extraGrams - b.extraGrams || a.index - b.index; });
    var highest = ranked[ranked.length - 1].purchaseCost;
    ranked.forEach(function (product, index) {
      product.rank = index && pricesTie(product.purchaseCost, ranked[index - 1].purchaseCost) ? ranked[index - 1].rank : index + 1;
      product.isCheapest = pricesTie(product.purchaseCost, ranked[0].purchaseCost);
      product.purchaseSavings = pricesTie(product.purchaseCost, highest) ? 0 : highest - product.purchaseCost;
    });
    return Object.assign({}, result, { mode: 'target', targetGrams: targetGrams, ranked: ranked, cheapest: ranked[0], mostExpensive: ranked[ranked.length - 1], purchaseSavings: ranked[0].purchaseSavings });
  }

  return Object.freeze({
    MAX_PRODUCTS: MAX_PRODUCTS,
    normalizeNumber: normalizeNumber,
    compareProducts: compareProducts,
    compareTarget: compareTarget
  });
});
