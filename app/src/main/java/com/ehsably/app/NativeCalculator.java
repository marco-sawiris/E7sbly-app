package com.ehsably.app;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/** Android-free calculation logic used when a device cannot start WebView. */
final class NativeCalculator {
    private static final BigDecimal THOUSAND = new BigDecimal("1000");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    static final class Product {
        final int index;
        final String name;
        final BigDecimal grams;
        final BigDecimal price;
        final boolean isVolume;
        final String unit;
        final int quantity;

        Product(int index, String name, BigDecimal weight, boolean kilograms, BigDecimal price) {
            this(index, name, weight, kilograms, price, 1);
        }

        Product(int index, String name, BigDecimal weight, boolean kilograms, BigDecimal price, int quantity) {
            this(index, name, weight, kilograms ? "kg" : "g", price, quantity);
        }

        Product(int index, String name, BigDecimal amount, String unit, BigDecimal price, int quantity) {
            if (quantity < 1 || quantity > 99) throw new IllegalArgumentException("Quantity must be 1 to 99");
            this.index = index;
            this.name = name.trim().isEmpty() ? "المنتج " + (index + 1) : name.trim();
            this.price = price;
            this.quantity = quantity;
            String normalizedUnit = unit == null ? "g" : unit.trim().toLowerCase();
            this.unit = normalizedUnit;
            if ("l".equals(normalizedUnit) || "liter".equals(normalizedUnit) || "لتر".equals(normalizedUnit)) {
                this.isVolume = true;
                this.grams = amount; // holds liters for volume products
            } else if ("kg".equals(normalizedUnit) || "كجم".equals(normalizedUnit) || "كيلو".equals(normalizedUnit)) {
                this.isVolume = false;
                this.grams = amount.multiply(THOUSAND);
            } else {
                this.isVolume = false;
                this.grams = amount;
            }
        }

        BigDecimal totalGrams() { return grams.multiply(BigDecimal.valueOf(quantity)); }
        BigDecimal totalPrice() { return price.multiply(BigDecimal.valueOf(quantity)); }

        BigDecimal pricePerKg() {
            if (isVolume) {
                return price.divide(grams, MathContext.DECIMAL128); // price per liter
            }
            return price.multiply(THOUSAND).divide(grams, MathContext.DECIMAL128);
        }
    }

    static BigDecimal positiveNumber(String input) {
        StringBuilder normalized = new StringBuilder();
        for (char c : input.trim().toCharArray()) {
            if (c >= '\u0660' && c <= '\u0669') c = (char) ('0' + c - '\u0660');
            else if (c >= '\u06f0' && c <= '\u06f9') c = (char) ('0' + c - '\u06f0');
            else if (c == '\u066b') c = '.';
            else if (c == '\u066c') c = ',';
            else if (c == '\u2212') c = '-';
            if (c != '\u200e' && c != '\u200f' && c != '\u061c') normalized.append(c);
        }
        String value = normalized.toString();
        if (value.length() > 40) throw new IllegalArgumentException("number too long");
        if (value.contains(",")) {
            if (!value.matches("[+-]?[0-9]{1,3}(,[0-9]{3})+(\\.[0-9]*)?")) {
                throw new IllegalArgumentException("invalid grouping");
            }
            value = value.replace(",", "");
        }
        if (!value.matches("[+-]?([0-9]+(\\.[0-9]*)?|\\.[0-9]+)")) {
            throw new IllegalArgumentException("invalid number");
        }
        BigDecimal number = new BigDecimal(value);
        if (number.signum() <= 0) throw new IllegalArgumentException("number must be positive");
        return number;
    }

    static int comparePrice(Product first, Product second) {
        if (first.isVolume != second.isVolume) {
            throw new IllegalArgumentException("Cannot compare weight and volume units without density");
        }
        // Cross multiplication avoids rounding errors during sorting and ties.
        return first.price.multiply(second.grams).compareTo(second.price.multiply(first.grams));
    }

    static List<Product> ranked(List<Product> products) {
        if (products.size() < 2 || products.size() > 5) {
            throw new IllegalArgumentException("Compare 2 to 5 products");
        }
        boolean hasVolume = false, hasWeight = false;
        for (Product p : products) {
            if (p.isVolume) hasVolume = true;
            else hasWeight = true;
        }
        if (hasVolume && hasWeight) {
            throw new IllegalArgumentException("Cannot compare weight and volume units without density");
        }
        List<Product> sorted = new ArrayList<>(products);
        Collections.sort(sorted, new Comparator<Product>() {
            @Override public int compare(Product first, Product second) {
                int result = comparePrice(first, second);
                return result != 0 ? result : Integer.compare(first.index, second.index);
            }
        });
        return sorted;
    }

    static BigDecimal savingsPercent(Product cheapest, Product mostExpensive) {
        if (cheapest.isVolume != mostExpensive.isVolume) {
            throw new IllegalArgumentException("Cannot compare weight and volume units without density");
        }
        BigDecimal first = cheapest.price.multiply(mostExpensive.grams);
        BigDecimal last = mostExpensive.price.multiply(cheapest.grams);
        return last.subtract(first).multiply(HUNDRED).divide(last, MathContext.DECIMAL128);
    }

    static BigDecimal savingsPerKg(Product product, Product mostExpensive) {
        if (product.isVolume != mostExpensive.isVolume) {
            throw new IllegalArgumentException("Cannot compare weight and volume units without density");
        }
        // Subtract exact cross-products before rounding, so even large amounts
        // preserve a small cash difference. Both prices refer to the same 1 kg (or 1 liter).
        BigDecimal difference = mostExpensive.price.multiply(product.grams)
                .subtract(product.price.multiply(mostExpensive.grams));
        if (difference.signum() <= 0) return BigDecimal.ZERO;
        if (product.isVolume) {
            return difference.divide(product.grams.multiply(mostExpensive.grams), MathContext.DECIMAL128);
        }
        return difference.multiply(THOUSAND)
                .divide(product.grams.multiply(mostExpensive.grams), MathContext.DECIMAL128);
    }

    static final class Purchase {
        final Product product;
        final BigDecimal packs, grams, cost, extra;

        Purchase(Product product, BigDecimal targetGrams) {
            this.product = product;
            packs = targetGrams.divide(product.grams, 0, java.math.RoundingMode.CEILING);
            grams = product.grams.multiply(packs);
            cost = product.price.multiply(packs);
            extra = grams.subtract(targetGrams);
        }
    }

    /** Whole packs of each alternative; manual quantity does not change the need. */
    static List<Purchase> forTarget(List<Product> products, BigDecimal targetGrams) {
        if (targetGrams == null || targetGrams.signum() <= 0)
            throw new IllegalArgumentException("Target weight must be positive");
        ranked(products); // Enforce the same 2–5 product rule and unit compatibility.
        List<Purchase> purchases = new ArrayList<>();
        for (Product product : products) purchases.add(new Purchase(product, targetGrams));
        Collections.sort(purchases, new Comparator<Purchase>() {
            @Override public int compare(Purchase first, Purchase second) {
                int cost = first.cost.compareTo(second.cost);
                if (cost != 0) return cost;
                int excess = first.extra.compareTo(second.extra);
                return excess != 0 ? excess : Integer.compare(first.product.index, second.product.index);
            }
        });
        return purchases;
    }
}
