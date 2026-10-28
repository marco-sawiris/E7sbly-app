"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const calculator = require("../app/src/main/assets/calculator.js");
const { normalizeNumber, compareProducts, compareTarget } = calculator;

function product(weight, price, unit = "g", name = "") {
  return { weight, price, unit, name };
}

test('whole packs can reverse the unit-price winner for a one-kilogram need', () => {
  const inputs = [product(320, 25), product(1, 80, 'kg')];
  assert.equal(compareProducts(inputs).cheapest.index, 0);
  const result = compareTarget(inputs, '١', 'kg');
  assert.equal(result.ok, true);
  assert.equal(result.cheapest.index, 1);
  assert.equal(result.purchaseSavings, 20);
  assert.deepEqual(result.ranked.map(p => [p.requiredPacks, p.purchaseGrams, p.purchaseCost, p.extraGrams]), [[1, 1000, 80, 0], [4, 1280, 100, 280]]);
  assert.equal(compareTarget(inputs, 320, 'g').cheapest.index, 0);
});

test('exact decimal targets do not round up to a spurious pack', () => {
  const result = compareTarget([product('0.07', 2, 'kg'), product(100, 4)], '0.21', 'kg');
  assert.equal(result.ok, true);
  assert.equal(result.ranked.find(p => p.index === 0).requiredPacks, 3);
  const above = compareTarget([product('0.07', 2, 'kg'), product(100, 4)], '210.01', 'g');
  assert.equal(above.ranked.find(p => p.index === 0).requiredPacks, 4);
});

test('target cost ties share rank and prefer less excess; manual counts are independent', () => {
  const result = compareTarget([{...product(1200, 80), quantity: 99}, product(1, 80, 'kg'), product(250, 30)], 1, 'kg');
  assert.equal(result.ok, true);
  assert.deepEqual(result.ranked.map(p => p.index), [1, 0, 2]);
  assert.deepEqual(result.ranked.map(p => p.rank), [1, 1, 3]);
  assert.equal(result.ranked[1].requiredPacks, 1);
  assert.equal(result.ranked[1].purchaseCost, 80);
});

test('target validation rejects blank, invalid units, nonpositive and unsafe counts', () => {
  const inputs = [product(320, 25), product(1, 80, 'kg')];
  for (const value of ['', 0, -1, 'bad']) {
    const result = compareTarget(inputs, value, 'kg');
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.field === 'target'));
  }
  assert.equal(compareTarget(inputs, 1, 'lb').ok, false);
  assert.equal(compareTarget([product('0.000000001', 1), product(1, 1)], '100000000000', 'kg').ok, false);
});

test("300g for 30 vs 450g for 40 ranks by unit price and computes savings", () => {
  const result = compareProducts([product(300, 30, "g", "صغير"), product(450, 40, "g", "كبير")]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.ranked.map(row => row.name), ["كبير", "صغير"]);
  assert.ok(Math.abs(result.cheapest.pricePerKg - 88.8888888889) < 1e-8);
  assert.equal(result.mostExpensive.pricePerKg, 100);
  assert.ok(Math.abs(result.savingsPercent - 11.1111111111) < 1e-8);
  assert.equal(result.ranked[1].savingsPercent, 0);
  assert.ok(Math.abs(result.savingsPerKg - 11.1111111111) < 1e-8);
  assert.equal(result.ranked[1].savingsPerKg, 0);
});

test("grams and kilograms share the same basis; the input stays unchanged", () => {
  const input = [product("0.5", "45", "kg"), product("400", "40", "g")];
  const original = JSON.stringify(input);
  const result = compareProducts(input);
  assert.equal(result.ok, true);
  assert.equal(result.cheapest.weightKg, 0.5);
  assert.equal(result.cheapest.pricePerKg, 90);
  assert.equal(result.cheapest.pricePer100g, 9);
  assert.equal(result.cheapest.name, "المنتج 1");
  assert.equal(JSON.stringify(input), original);
});

test("normalizes Arabic, Persian and Latin digits and decimal/thousands separators", () => {
  for (const [input, expected] of [
    [" ١٢٣٫٤٥ ", 123.45], ["۱۲۳٫۴۵", 123.45], ["١٬٢٣٤٫٥", 1234.5],
    ["1,234.50", 1234.5], [".5", 0.5], ["٫٥", 0.5], ["−٢", -2],
    ["\u200f١٢٫٥", 12.5], [0, 0], [32.25, 32.25]
  ]) assert.equal(normalizeNumber(input), expected, String(input));
  const result = compareProducts([product("٣٠٠", "٣٠٫٥"), product("۰٫۴۵", "٤٠", "kg")]);
  assert.equal(result.ok, true);
  assert.equal(result.cheapest.index, 1);
});

test("rejects incomplete, nonnumeric and malformed numbers without partial parsing", () => {
  for (const input of ["", "  ", null, undefined, true, false, {}, [], NaN, Infinity,
    "NaN", "Infinity", "12abc", "1,5", "1,00", "1.2.3", "1.234,5", "1e3", "٣٠ جنيه"]) {
    assert.ok(Number.isNaN(normalizeNumber(input)), String(input));
  }
});

test("zero, negatives and NaN are rejected with the exact affected field", () => {
  for (const value of [0, -1, NaN, Infinity, "٠", "-٢", "bad"]) {
    const weightResult = compareProducts([product(value, 5), product(200, 20)]);
    assert.equal(weightResult.ok, false);
    assert.ok(weightResult.errors.some(error => error.index === 0 && error.field === "weight"));
    const priceResult = compareProducts([product(100, value), product(200, 20)]);
    assert.equal(priceResult.ok, false);
    assert.ok(priceResult.errors.some(error => error.index === 0 && error.field === "price"));
  }
});

test("blank rows are ignored but partial rows produce required-field errors", () => {
  const blankResult = compareProducts([{}, null, product("", ""), product(100, 10), product(200, 15)]);
  assert.equal(blankResult.ok, true);
  assert.equal(blankResult.ranked.length, 2);
  const partialResult = compareProducts([product(100, ""), { name: "زيت" }, product(200, 15)]);
  assert.equal(partialResult.ok, false);
  assert.deepEqual(partialResult.errors.map(error => [error.index, error.field, error.code]), [
    [0, "price", "required"], [1, "weight", "required"], [1, "price", "required"]
  ]);
});

test("requires 2 nonblank rows and accepts up to 5", () => {
  for (const input of [[], [{}], [product(100, 10)]]) {
    const result = compareProducts(input);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === "minimum"));
  }
  const five = Array.from({ length: 5 }, (_, i) => product(100, i + 1));
  assert.equal(compareProducts(five).ok, true);
  const six = compareProducts([...five, product(100, 7)]);
  assert.equal(six.ok, false);
  assert.ok(six.errors.some(error => error.code === "maximum"));
  assert.equal(compareProducts([...five, {}]).ok, true);
});

test("ties and near-ties keep input order and share ranks", () => {
  const result = compareProducts([
    product(1000, 100.00000001, "g", "أول"),
    product(1, 100, "kg", "ثاني"),
    product(500, 50, "g", "ثالث"),
    product(1000, 120, "g", "رابع")
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.ranked.map(row => row.name), ["أول", "ثاني", "ثالث", "رابع"]);
  assert.deepEqual(result.ranked.map(row => row.rank), [1, 1, 1, 4]);
  assert.deepEqual(result.ranked.map(row => row.isCheapest), [true, true, true, false]);
  const allTied = compareProducts([product(300, 30), product(500, 50)]);
  assert.equal(allTied.savingsPercent, 0);
  assert.ok(allTied.ranked.every(row => row.savingsPercent === 0));
  assert.equal(allTied.savingsPerKg, 0);
});

test("cash savings compare the same kilogram against the highest unit price", () => {
  const result = compareProducts([product(1, 100, 'kg'), product(400, 50), product(200, 16)]);
  assert.equal(result.savingsPerKg, 45);
  assert.deepEqual(result.ranked.map(row => row.savingsPerKg), [45, 25, 0]);
  const mixed = compareProducts([product(0.5, 45, 'kg'), product(400, 40)]);
  assert.equal(mixed.savingsPerKg, 10);
});

test("two 400g packs total 800g and twice the price without changing unit value", () => {
  const result = compareProducts([{...product(400, 30), quantity: 2}, product(1, 70, 'kg')]);
  assert.equal(result.ok, true);
  const doubled = result.ranked.find(row => row.index === 0);
  assert.equal(doubled.totalWeight, 800);
  assert.equal(doubled.totalPrice, 60);
  assert.equal(doubled.pricePerKg, 75);
  assert.equal(result.cheapest.index, 1);
  for (const quantity of [0, 100, 1.5, 'bad'])
    assert.equal(compareProducts([{...product(400, 30), quantity}, product(1, 70, 'kg')]).ok, false);
});

test("meaningfully different prices are not treated as ties", () => {
  const result = compareProducts([product(1, 100.001, "kg"), product(1, 100, "kg")]);
  assert.equal(result.cheapest.index, 1);
  assert.deepEqual(result.ranked.map(row => row.rank), [1, 2]);
});

test("rejects unsupported units, malformed rows and unsafe arithmetic ranges", () => {
  assert.ok(compareProducts([product(1, 5, "lb"), product(100, 10)]).errors
    .some(error => error.field === "unit"));
  assert.equal(compareProducts("bad").ok, false);
  assert.ok(compareProducts([42, product(100, 10)]).errors.some(error => error.field === "product"));
  assert.ok(compareProducts([product(Number.MIN_VALUE, 10), product(100, 10)]).errors
    .some(error => error.code === "range"));
});

test("also exposes the same dependency-free API as a browser global", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve("../app/src/main/assets/calculator.js"), "utf8"), context);
  assert.equal(context.EhsablyCalculator.normalizeNumber("١٢"), 12);
  assert.equal(context.EhsablyCalculator.compareProducts([
    product(300, 30), product(450, 40)
  ]).cheapest.index, 1);
});

test("supports comparing liter units and calculates savings per liter", () => {
  const result = compareProducts([
    { weight: 1, price: 30, unit: "l", name: "زجاجة صغيرة" },
    { weight: 2.5, price: 60, unit: "l", name: "زجاجة كبيرة" }
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.cheapest.index, 1);
  assert.equal(result.cheapest.pricePerKg, 24); // 60 / 2.5 = 24 EGP per L
  assert.equal(result.mostExpensive.pricePerKg, 30); // 30 / 1 = 30 EGP per L
  assert.equal(result.savingsPerKg, 6); // 30 - 24 = 6 EGP saved per L
  assert.equal(result.savingsPercent, 20); // 6 / 30 * 100 = 20%
});

test("rejects direct comparison between weight (kg/g) and volume (L) without density", () => {
  const result = compareProducts([
    product(500, 40, "g", "سمنة"),
    { weight: 1, price: 70, unit: "l", name: "زيت" }
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.code === "incompatible"));
});

