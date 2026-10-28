package com.ehsably.app;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** JVM-only regression checks; no Android runtime or third-party test library. */
public final class NativeCalculatorTest {
    private static int passed;

    public static void main(String[] args) {
        check("300g / 30 vs 450g / 40", NativeCalculatorTest::sampleComparison);
        check("grams and kilograms share one basis", NativeCalculatorTest::unitConversion);
        check("Arabic, Persian and Latin numeric forms", NativeCalculatorTest::localizedNumbers);
        check("blank, malformed and nonnumeric values rejected", NativeCalculatorTest::invalidNumbers);
        check("zero and negative amounts rejected", NativeCalculatorTest::nonpositiveNumbers);
        check("two to five products required", NativeCalculatorTest::productCount);
        check("exact price ties preserve original indices", NativeCalculatorTest::stableTies);
        check("distinct decimal prices retain precise ordering", NativeCalculatorTest::preciseOrdering);
        check("savings measured against highest unit price", NativeCalculatorTest::savingsAgainstMaximum);
        check("all tied products have zero savings", NativeCalculatorTest::zeroSavings);
        check("cash savings retain small differences between large unit prices", NativeCalculatorTest::preciseCashSavings);
        check("sorting does not mutate source collection", NativeCalculatorTest::doesNotMutate);
        check("product name trimming and default", NativeCalculatorTest::productNames);
        check("quantity multiplies pack totals and preserves unit value", NativeCalculatorTest::quantities);
        check("whole packs reverse the winner for a kilogram need", NativeCalculatorTest::targetPurchase);
        check("exact decimal targets and pack boundaries", NativeCalculatorTest::targetDecimals);
        check("target ties prefer less excess and ignore manual counts", NativeCalculatorTest::targetTies);
        check("target weight must be positive", NativeCalculatorTest::invalidTarget);
        check("liter products comparison and savings", NativeCalculatorTest::literComparison);
        check("rejects comparing weight and volume without density", NativeCalculatorTest::incompatibleUnits);
        System.out.println("All " + passed + " native calculator checks passed.");
    }

    private static NativeCalculator.Product product(int index, String weight, boolean kg, String price) {
        return new NativeCalculator.Product(index, "", NativeCalculator.positiveNumber(weight), kg,
                NativeCalculator.positiveNumber(price));
    }

    private static void sampleComparison() {
        NativeCalculator.Product small = product(0, "300", false, "30");
        NativeCalculator.Product large = product(1, "450", false, "40");
        List<NativeCalculator.Product> result = NativeCalculator.ranked(Arrays.asList(small, large));
        same(large, result.get(0), "450g pack should be cheaper per kg");
        decimal("100", small.pricePerKg());
        close("88.88888888888888888888888888888889", large.pricePerKg(), "0.00000000000000000000000000001");
        close("11.11111111111111111111111111111111",
                NativeCalculator.savingsPercent(large, small), "0.00000000000000000000000000001");
        close("11.11111111111111111111111111111111",
                NativeCalculator.savingsPerKg(large, small), "0.00000000000000000000000000001");
    }

    private static void unitConversion() {
        NativeCalculator.Product halfKg = product(0, "0.5", true, "45");
        NativeCalculator.Product grams = product(1, "400", false, "40");
        decimal("500", halfKg.grams);
        decimal("90", halfKg.pricePerKg());
        decimal("100", grams.pricePerKg());
        same(halfKg, NativeCalculator.ranked(Arrays.asList(grams, halfKg)).get(0), "kg conversion");
        equal(0, NativeCalculator.comparePrice(product(0, "0.3", true, "30"), product(1, "300", false, "30")), "equivalent units tie");
    }

    private static void localizedNumbers() {
        String[][] cases = {
                {" ١٢٣٫٤٥ ", "123.45"}, {"۱۲۳٫۴۵", "123.45"},
                {"١٬٢٣٤٫٥", "1234.5"}, {"1,234.50", "1234.5"},
                {"١٬٢٣٤٬٥٦٧٫٨٩", "1234567.89"}, {".5", "0.5"},
                {"٫٥", "0.5"}, {"+2", "2"}, {"\u200f١٢٫٥", "12.5"},
                {"\u061c۱۲\u200e", "12"}, {"5.", "5"}
        };
        for (String[] item : cases) decimal(item[1], NativeCalculator.positiveNumber(item[0]));
    }

    private static void invalidNumbers() {
        for (String value : new String[]{"", " ", "NaN", "Infinity", "1e3", "12abc", "٣٠ جنيه",
                "1,5", "1,00", "12,34,567", "1.234,5", "1.2.3", ".", "١٫٢٫٣",
                "12345678901234567890123456789012345678901"}) {
            rejects(() -> NativeCalculator.positiveNumber(value), "must reject " + value);
        }
        // The limit allows realistic pasted amounts and prevents unbounded arithmetic.
        decimal("1234567890123456789012345678901234567890",
                NativeCalculator.positiveNumber("1234567890123456789012345678901234567890"));
    }

    private static void nonpositiveNumbers() {
        for (String value : new String[]{"0", "٠", "۰", "0.00", "-0", "-1", "-٢", "−٢", "-۰٫۵"}) {
            rejects(() -> NativeCalculator.positiveNumber(value), "must reject " + value);
        }
    }

    private static void productCount() {
        rejects(() -> NativeCalculator.ranked(Collections.emptyList()), "zero products");
        rejects(() -> NativeCalculator.ranked(Collections.singletonList(product(0, "100", false, "10"))), "one product");
        List<NativeCalculator.Product> products = new ArrayList<>();
        for (int index = 0; index < 5; index++) products.add(product(index, "100", false, Integer.toString(index + 1)));
        equal(5, NativeCalculator.ranked(products).size(), "five products allowed");
        products.add(product(5, "100", false, "7"));
        rejects(() -> NativeCalculator.ranked(products), "six products");
    }

    private static void stableTies() {
        NativeCalculator.Product first = product(0, "1000", false, "100");
        NativeCalculator.Product second = product(1, "0.5", true, "50");
        NativeCalculator.Product third = product(2, "300", false, "30");
        List<NativeCalculator.Product> sorted = NativeCalculator.ranked(Arrays.asList(third, first, second));
        same(first, sorted.get(0), "first original index wins tie ordering");
        same(second, sorted.get(1), "second original index");
        same(third, sorted.get(2), "third original index");
        equal(0, NativeCalculator.comparePrice(first, second), "equal price per kg");
    }

    private static void preciseOrdering() {
        NativeCalculator.Product slightlyHigher = product(0, "1", true, "100.00000001");
        NativeCalculator.Product lower = product(1, "1", true, "100");
        same(lower, NativeCalculator.ranked(Arrays.asList(slightlyHigher, lower)).get(0), "distinct exact decimals should sort by actual price");

        // Division for display uses DECIMAL128. The sorting comparison must retain
        // differences beyond that precision by comparing cross-products exactly.
        NativeCalculator.Product hugeHigher = product(0, "1000", false, "100000000000000000000000000000000001");
        NativeCalculator.Product hugeLower = product(1, "1000", false, "100000000000000000000000000000000000");
        equal(0, hugeHigher.pricePerKg().compareTo(hugeLower.pricePerKg()), "display rounds these two extreme values alike");
        same(hugeLower, NativeCalculator.ranked(Arrays.asList(hugeHigher, hugeLower)).get(0), "cross-product comparison preserves the difference");
    }

    private static void savingsAgainstMaximum() {
        List<NativeCalculator.Product> sorted = NativeCalculator.ranked(Arrays.asList(
                product(0, "1", true, "100"), product(1, "400", false, "50"), product(2, "200", false, "16")));
        decimal("80", sorted.get(0).pricePerKg());
        decimal("125", sorted.get(2).pricePerKg());
        decimal("36", NativeCalculator.savingsPercent(sorted.get(0), sorted.get(2)));
        decimal("45", NativeCalculator.savingsPerKg(sorted.get(0), sorted.get(2)));
        decimal("25", NativeCalculator.savingsPerKg(sorted.get(1), sorted.get(2)));
    }

    private static void zeroSavings() {
        NativeCalculator.Product first = product(0, "300", false, "30");
        NativeCalculator.Product second = product(1, "500", false, "50");
        decimal("0", NativeCalculator.savingsPercent(first, second));
        decimal("0", NativeCalculator.savingsPerKg(first, second));
    }

    private static void preciseCashSavings() {
        NativeCalculator.Product higher = product(0, "1000", false, "100000000000000000000000000000000001");
        NativeCalculator.Product lower = product(1, "1", true, "100000000000000000000000000000000000");
        decimal("1", NativeCalculator.savingsPerKg(lower, higher));
    }

    private static void doesNotMutate() {
        NativeCalculator.Product first = product(0, "100", false, "20");
        NativeCalculator.Product second = product(1, "100", false, "10");
        List<NativeCalculator.Product> source = Collections.unmodifiableList(Arrays.asList(first, second));
        List<NativeCalculator.Product> sorted = NativeCalculator.ranked(source);
        same(first, source.get(0), "source order unchanged");
        same(second, sorted.get(0), "returned order sorted");
    }

    private static void productNames() {
        NativeCalculator.Product named = new NativeCalculator.Product(0, "  عبوة كبيرة  ", new BigDecimal("450"), false, new BigDecimal("40"));
        if (!"عبوة كبيرة".equals(named.name)) throw new AssertionError("name should be trimmed");
        if (!"المنتج 3".equals(product(2, "100", false, "10").name)) throw new AssertionError("blank name should have original index default");
    }

    private static void quantities() {
        NativeCalculator.Product doubled = new NativeCalculator.Product(0, "", new BigDecimal("400"), false, new BigDecimal("30"), 2);
        decimal("800", doubled.totalGrams());
        decimal("60", doubled.totalPrice());
        decimal("75", doubled.pricePerKg());
        NativeCalculator.Product kilo = product(1, "1", true, "70");
        same(kilo, NativeCalculator.ranked(Arrays.asList(doubled, kilo)).get(0), "quantities preserve fair unit comparison");
        rejects(() -> new NativeCalculator.Product(0, "", BigDecimal.ONE, false, BigDecimal.ONE, 0), "quantity zero");
        rejects(() -> new NativeCalculator.Product(0, "", BigDecimal.ONE, false, BigDecimal.ONE, 100), "quantity above limit");
    }

    private static void decimal(String expected, BigDecimal actual) {
        if (new BigDecimal(expected).compareTo(actual) != 0) throw new AssertionError("expected " + expected + ", got " + actual);
    }

    private static void targetPurchase() {
        List<NativeCalculator.Product> inputs = Arrays.asList(product(0, "320", false, "25"), product(1, "1", true, "80"));
        same(inputs.get(0), NativeCalculator.ranked(inputs).get(0), "small pack wins per kg");
        List<NativeCalculator.Purchase> result = NativeCalculator.forTarget(inputs, new BigDecimal("1000"));
        same(inputs.get(1), result.get(0).product, "kilo wins whole-pack cost");
        decimal("80", result.get(0).cost); decimal("1", result.get(0).packs);
        decimal("4", result.get(1).packs); decimal("1280", result.get(1).grams);
        decimal("280", result.get(1).extra);
        decimal("20", result.get(1).cost.subtract(result.get(0).cost));
        same(inputs.get(0), NativeCalculator.forTarget(inputs, new BigDecimal("320")).get(0).product, "smaller need changes winner");
    }

    private static void targetDecimals() {
        List<NativeCalculator.Product> inputs = Arrays.asList(product(0, "0.07", true, "2"), product(1, "100", false, "4"));
        decimal("3", NativeCalculator.forTarget(inputs, new BigDecimal("210")).get(0).packs);
        decimal("4", NativeCalculator.forTarget(inputs, new BigDecimal("210.01")).get(0).packs);
    }

    private static void targetTies() {
        NativeCalculator.Product oversized = new NativeCalculator.Product(0, "", new BigDecimal("1200"), false, new BigDecimal("80"), 99);
        NativeCalculator.Product exact = product(1, "1", true, "80");
        List<NativeCalculator.Purchase> result = NativeCalculator.forTarget(Arrays.asList(oversized, exact), new BigDecimal("1000"));
        same(exact, result.get(0).product, "equal cost prefers less surplus");
        decimal("80", result.get(1).cost); decimal("1", result.get(1).packs);
        decimal("200", result.get(1).extra);
    }

    private static void invalidTarget() {
        List<NativeCalculator.Product> inputs = Arrays.asList(product(0, "100", false, "10"), product(1, "200", false, "15"));
        rejects(() -> NativeCalculator.forTarget(inputs, BigDecimal.ZERO), "zero target");
        rejects(() -> NativeCalculator.forTarget(inputs, BigDecimal.ONE.negate()), "negative target");
        rejects(() -> NativeCalculator.forTarget(inputs, null), "null target");
    }

    private static void literComparison() {
        NativeCalculator.Product small = new NativeCalculator.Product(0, "عصير ١ لتر", new BigDecimal("1"), "l", new BigDecimal("25"), 1);
        NativeCalculator.Product large = new NativeCalculator.Product(1, "عصير ٢ لتر", new BigDecimal("2"), "l", new BigDecimal("40"), 1);
        List<NativeCalculator.Product> ranked = NativeCalculator.ranked(Arrays.asList(small, large));
        same(large, ranked.get(0), "2L pack at 40 (20/L) is cheaper than 1L at 25 (25/L)");
        decimal("20", large.pricePerKg());
        decimal("25", small.pricePerKg());
        decimal("20", NativeCalculator.savingsPercent(large, small));
        decimal("5", NativeCalculator.savingsPerKg(large, small));
    }

    private static void incompatibleUnits() {
        NativeCalculator.Product weightProd = product(0, "500", false, "50");
        NativeCalculator.Product volumeProd = new NativeCalculator.Product(1, "زيت", new BigDecimal("1"), "l", new BigDecimal("70"), 1);
        rejects(() -> NativeCalculator.ranked(Arrays.asList(weightProd, volumeProd)), "mixed weight and volume units");
        rejects(() -> NativeCalculator.comparePrice(weightProd, volumeProd), "cannot compare price between weight and volume");
    }

    private static void close(String expected, BigDecimal actual, String tolerance) {
        if (new BigDecimal(expected).subtract(actual).abs().compareTo(new BigDecimal(tolerance)) > 0)
            throw new AssertionError("expected approximately " + expected + ", got " + actual);
    }

    private static void same(Object expected, Object actual, String message) {
        if (expected != actual) throw new AssertionError(message);
    }

    private static void equal(int expected, int actual, String message) {
        if (expected != actual) throw new AssertionError(message + ": expected " + expected + ", got " + actual);
    }

    private static void rejects(Runnable action, String message) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError(message);
    }

    private static void check(String name, Runnable action) {
        action.run();
        passed++;
        System.out.println("PASS " + name);
    }
}
