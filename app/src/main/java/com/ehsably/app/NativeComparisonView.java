package com.ehsably.app;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;

/** Native Android calculator with modern results, side navigation drawer, and unit conversions. */
final class NativeComparisonView extends LinearLayout {
    private final int blue;
    private final int sky;
    private final int bg;
    private final int cardBg;
    private final int border;
    private final int muted;
    private final boolean dark;

    private final LinearLayout form;
    private final LinearLayout rows;
    private final ScrollView viewport;
    private final TextView message;
    private final Button addButton;
    private final List<ProductRow> products = new ArrayList<>();
    private final SharedPreferences preferences;
    private Typeface regular;
    private Typeface bold;
    private boolean restoring;
    private AlertDialog resultDialog;
    private ScrollView resultViewport;
    private Button primaryAction;
    private final EditText targetWeight;
    private final Button targetUnit;
    private final LinearLayout targetFields;
    private String targetUnitVal = "kg"; // "kg", "g", "l"
    private final boolean compact;

    NativeComparisonView(Context context, final Runnable diagnostics) {
        super(context);
        compact = getResources().getConfiguration().screenHeightDp < 740;
        dark = AppTheme.isDark(context);

        blue = dark ? 0xfff8fafc : 0xff1f347d;
        sky = dark ? 0xff60a5fa : 0xff3c89bd;
        bg = dark ? 0xff0f172a : 0xfff5f8fd;
        cardBg = dark ? 0xff1e293b : 0xffffffff;
        border = dark ? 0xff334155 : 0xffd5e2f2;
        muted = dark ? 0xff94a3b8 : 0xff617999;

        setOrientation(LinearLayout.VERTICAL);
        setLayoutDirection(AppLanguage.direction(context));
        setBackgroundColor(bg);
        preferences = context.getSharedPreferences("native_comparison", Context.MODE_PRIVATE);

        try {
            regular = Typeface.createFromAsset(context.getAssets(), "fonts/montserrat-arabic-regular.otf");
            bold = Typeface.createFromAsset(context.getAssets(), "fonts/montserrat-arabic-bold.otf");
        } catch (RuntimeException unavailableFont) {
            regular = Typeface.create("sans-serif", Typeface.NORMAL);
            bold = Typeface.create("sans-serif", Typeface.BOLD);
        }

        viewport = new ScrollView(context);
        viewport.setFillViewport(true);
        viewport.setVerticalScrollBarEnabled(false);
        viewport.setHorizontalScrollBarEnabled(false);
        addView(viewport, new LinearLayout.LayoutParams(-1, 0, 1));

        form = column();
        form.setPadding(dp(12), dp(compact ? 4 : 8), dp(12), dp(compact ? 2 : 4));
        viewport.addView(form, new ScrollView.LayoutParams(-1, -2));

        // Topbar with Side Menu Button and Brand
        LinearLayout topbar = new LinearLayout(context);
        topbar.setGravity(Gravity.CENTER_VERTICAL);

        final android.widget.ImageButton menuBtn = new android.widget.ImageButton(context);
        final SketchIconDrawable menuIcon = new SketchIconDrawable(context, SketchIconDrawable.Kind.MENU);
        menuBtn.setImageDrawable(menuIcon);
        menuBtn.setScaleType(android.widget.ImageView.ScaleType.CENTER_INSIDE);
        menuBtn.setPadding(dp(9), dp(9), dp(9), dp(9));
        menuBtn.setBackground(shape(cardBg, border));
        menuBtn.setContentDescription(t("القائمة الجانبية"));
        pressFeedback(menuBtn);
        menuBtn.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) { showSideMenu(); }
        });
        topbar.addView(menuBtn, new LinearLayout.LayoutParams(dp(44), dp(44)));

        TextView brand = label(t("احسبلى"), 18, true);
        brand.setPadding(dp(10), 0, dp(10), 0);
        brand.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        android.graphics.drawable.Drawable brandIcon = context.getDrawable(R.drawable.brand_logo);
        if (brandIcon != null) {
            brandIcon.setBounds(0, 0, dp(28), dp(28));
            brand.setCompoundDrawablePadding(dp(7));
            brand.setCompoundDrawablesRelative(brandIcon, null, null, null);
        }
        topbar.addView(brand, new LinearLayout.LayoutParams(0, dp(44), 1));

        final android.widget.ImageButton language = new android.widget.ImageButton(context);
        final SketchIconDrawable languageGlobe = new SketchIconDrawable(context, SketchIconDrawable.Kind.WEBSITE);
        language.setImageDrawable(languageGlobe);
        language.setScaleType(android.widget.ImageView.ScaleType.CENTER_INSIDE);
        language.setPadding(dp(9), dp(9), dp(9), dp(9));
        language.setBackground(shape(cardBg, border));
        language.setContentDescription(t("لغة التطبيق"));
        pressFeedback(language);
        language.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                new AlertDialog.Builder(getContext()).setTitle(t("لغة التطبيق"))
                        .setSingleChoiceItems(new String[]{"العربية", "English"}, AppLanguage.isEnglish(getContext()) ? 1 : 0,
                                new android.content.DialogInterface.OnClickListener() {
                                    @Override public void onClick(android.content.DialogInterface dialog, int which) {
                                        dialog.dismiss();
                                        if (AppLanguage.isEnglish(getContext()) == (which == 1)) return;
                                        AppLanguage.setEnglish(getContext(), which == 1);
                                        ((android.app.Activity) getContext()).recreate();
                                    }
                                }).setNegativeButton(t("إلغاء"), null).show();
            }
        });
        topbar.addView(language, new LinearLayout.LayoutParams(dp(44), dp(44)));
        form.addView(topbar);

        android.text.SpannableString headline = new android.text.SpannableString(t("نفس المنتج، أنهى أوفر؟"));
        headline.setSpan(new android.text.style.ForegroundColorSpan(sky),
                headline.toString().indexOf(t("أنهى")), headline.length(),
                android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        TextView hero = label(headline.toString(), 22, true);
        hero.setText(headline);
        hero.setMaxLines(1);
        hero.setAutoSizeTextTypeUniformWithConfiguration(14, 22, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
        hero.setPadding(0, dp(4), 0, 0);
        form.addView(hero);

        TextView intro = label(t("قارن السعر لكل كيلو فى لحظة."), 12, false);
        intro.setTextColor(muted);
        intro.setPadding(0, 0, 0, dp(4));
        intro.setVisibility(compact ? GONE : VISIBLE);
        form.addView(intro);

        targetFields = column();
        targetFields.setPadding(0, dp(compact ? 3 : 6), 0, dp(compact ? 3 : 6));
        targetFields.addView(label(t("محتاج وزن محدد؟ (اختيارى)"), compact ? 14 : 15, true));

        LinearLayout targetAmounts = new LinearLayout(context);
        targetWeight = input(t("الوزن المطلوب"), "", true);
        targetAmounts.addView(targetWeight, new LinearLayout.LayoutParams(0, dp(compact ? 40 : 44), 1));

        targetUnit = button(t("كيلو"), false);
        LinearLayout.LayoutParams targetUnitParams = new LinearLayout.LayoutParams(dp(76), dp(compact ? 40 : 44));
        targetUnitParams.setMarginStart(dp(8));
        targetAmounts.addView(targetUnit, targetUnitParams);
        targetFields.addView(targetAmounts);

        TextView targetHint = label(t("هنحسب أقل تكلفة بالعبوات الكاملة لكل منتج."), 11, false);
        targetHint.setTextColor(muted);
        targetHint.setVisibility(compact ? GONE : VISIBLE);
        targetFields.addView(targetHint);
        form.addView(targetFields);

        updateTarget();

        targetUnit.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if ("kg".equals(targetUnitVal)) targetUnitVal = "g";
                else if ("g".equals(targetUnitVal)) targetUnitVal = "l";
                else targetUnitVal = "kg";
                updateTarget();
                changed();
            }
        });

        targetWeight.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { changed(); }
            @Override public void afterTextChanged(Editable value) {}
        });

        rows = column();
        form.addView(rows);

        addButton = button(t("أضف منتج"), false);
        icon(addButton, SketchIconDrawable.Kind.PLUS, 20, false);
        addButton.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if (products.size() < 5) {
                    addRow("", "", "", "g");
                    changed();
                    viewport.post(new Runnable() {
                        @Override public void run() { viewport.smoothScrollTo(0, rows.getBottom()); }
                    });
                }
            }
        });

        LinearLayout actions = new LinearLayout(context);
        actions.setPadding(0, dp(2), 0, 0);
        actions.addView(addButton, new LinearLayout.LayoutParams(-1, dp(44)));
        form.addView(actions);

        // Footer with Calculate button and Clear action
        LinearLayout footer = column();
        footer.setPadding(dp(12), dp(compact ? 4 : 6), dp(12), dp(compact ? 4 : 6));
        footer.setBackgroundColor(bg);
        footer.setElevation(dp(5));

        message = label("", 12, false);
        message.setTextColor(0xffef4444);
        message.setMaxLines(2);
        message.setVisibility(GONE);
        footer.addView(message);

        Button compare = button(t("احسب الأوفر"), true);
        primaryAction = compare;
        icon(compare, SketchIconDrawable.Kind.CALCULATOR, 22, true);
        compare.setTextSize(16);
        compare.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) { calculate(); }
        });
        footer.addView(compare, new LinearLayout.LayoutParams(-1, dp(compact ? 46 : 48)));

        TextView clearAll = label(t("مسح كل القيم"), 11, true);
        clearAll.setGravity(Gravity.CENTER);
        clearAll.setTextColor(sky);
        clearAll.setContentDescription(t("مسح أسماء المنتجات والأوزان والأسعار بالكامل"));
        clearAll.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                new AlertDialog.Builder(getContext()).setTitle(t("مسح المقارنة؟"))
                        .setMessage(t("هيتم مسح بيانات المنتجات الحالية."))
                        .setNegativeButton(t("إلغاء"), null)
                        .setPositiveButton(t("امسح"), new android.content.DialogInterface.OnClickListener() {
                            @Override public void onClick(android.content.DialogInterface dialog, int which) {
                                resetToEmpty();
                            }
                        }).show();
            }
        });
        pressFeedback(clearAll);
        form.addView(clearAll, new LinearLayout.LayoutParams(-1, dp(compact ? 28 : 32)));

        TextView about = label(t("عن التطبيق والمطور"), 11, true);
        about.setGravity(Gravity.CENTER);
        about.setTextColor(sky);
        about.setPadding(0, dp(5), 0, dp(5));
        about.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) { AboutDeveloperDialog.show(getContext(), regular, bold); }
        });
        pressFeedback(about);
        footer.addView(about, new LinearLayout.LayoutParams(-1, dp(compact ? 26 : 32)));

        addView(footer, new LinearLayout.LayoutParams(-1, -2));

        if (diagnostics != null) {
            brand.setOnLongClickListener(new OnLongClickListener() {
                @Override public boolean onLongClick(View view) { diagnostics.run(); return true; }
            });
        }

        // Requirement 2: Start with empty inputs on launch!
        restore();
    }

    /** Requirement 2: Always start with clean empty rows without automatic previous inputs. */
    private void restore() {
        restoring = true;
        resetToEmpty();
        restoring = false;
        updateButtons();
    }

    private void resetToEmpty() {
        products.clear();
        rows.removeAllViews();
        addRow("", "", "", "g");
        addRow("", "", "", "g");
        targetWeight.setText("");
        targetUnitVal = "kg";
        updateTarget();
        if (message != null) message.setVisibility(GONE);
        updateButtons();
    }

    /** Requirement 6: Side Navigation Menu Drawer */
    private void showSideMenu() {
        LinearLayout menuContent = column();
        menuContent.setPadding(dp(16), dp(12), dp(16), dp(16));
        menuContent.setBackgroundColor(bg);

        TextView menuTitle = label(t("القائمة الجانبية"), 18, true);
        menuTitle.setPadding(0, 0, 0, dp(12));
        menuContent.addView(menuTitle);

        // Theme Selection Item
        TextView themeHeader = label(t("مظهر التطبيق"), 14, true);
        themeHeader.setPadding(0, dp(8), 0, dp(4));
        menuContent.addView(themeHeader);

        LinearLayout themeRow = new LinearLayout(getContext());
        Button lightBtn = button(t("الوضع الفاتح"), !dark);
        Button darkBtn = button(t("الوضع الداكن"), dark);
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(0, dp(42), 1);
        themeRow.addView(lightBtn, btnParams);
        btnParams = new LinearLayout.LayoutParams(0, dp(42), 1);
        btnParams.setMarginStart(dp(8));
        themeRow.addView(darkBtn, btnParams);
        menuContent.addView(themeRow);

        lightBtn.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if (dark) {
                    AppTheme.setDark(getContext(), false);
                    ((android.app.Activity) getContext()).recreate();
                }
            }
        });
        darkBtn.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if (!dark) {
                    AppTheme.setDark(getContext(), true);
                    ((android.app.Activity) getContext()).recreate();
                }
            }
        });

        // Language Selection Item
        TextView langHeader = label(t("لغة التطبيق"), 14, true);
        langHeader.setPadding(0, dp(14), 0, dp(4));
        menuContent.addView(langHeader);

        LinearLayout langRow = new LinearLayout(getContext());
        boolean isEn = AppLanguage.isEnglish(getContext());
        Button arBtn = button("العربية", !isEn);
        Button enBtn = button("English", isEn);
        LinearLayout.LayoutParams langParams = new LinearLayout.LayoutParams(0, dp(42), 1);
        langRow.addView(arBtn, langParams);
        langParams = new LinearLayout.LayoutParams(0, dp(42), 1);
        langParams.setMarginStart(dp(8));
        langRow.addView(enBtn, langParams);
        menuContent.addView(langRow);

        arBtn.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if (AppLanguage.isEnglish(getContext())) {
                    AppLanguage.setEnglish(getContext(), false);
                    ((android.app.Activity) getContext()).recreate();
                }
            }
        });
        enBtn.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if (!AppLanguage.isEnglish(getContext())) {
                    AppLanguage.setEnglish(getContext(), true);
                    ((android.app.Activity) getContext()).recreate();
                }
            }
        });

        // Developer Info Item
        Button devBtn = button(t("عن التطبيق والمطور"), false);
        devBtn.setPadding(dp(12), dp(8), dp(12), dp(8));
        LinearLayout.LayoutParams devParams = new LinearLayout.LayoutParams(-1, dp(44));
        devParams.topMargin = dp(16);
        devBtn.setLayoutParams(devParams);
        menuContent.addView(devBtn);

        final AlertDialog menuDialog = new AlertDialog.Builder(getContext())
                .setView(menuContent)
                .setNegativeButton(t("إغلاق"), null)
                .create();

        devBtn.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                menuDialog.dismiss();
                AboutDeveloperDialog.show(getContext(), regular, bold);
            }
        });

        menuDialog.show();
    }

    private void changed() {
        if (restoring) return;
        if (resultDialog != null && resultDialog.isShowing()) resultDialog.dismiss();
        message.setVisibility(GONE);
        updateButtons();
    }

    private void updateTarget() {
        if ("l".equals(targetUnitVal)) targetUnit.setText(t("لتر"));
        else if ("g".equals(targetUnitVal)) targetUnit.setText(t("جرام"));
        else targetUnit.setText(t("كيلو"));
        targetUnit.setContentDescription(t("وحدة الوزن المطلوب، ") + targetUnit.getText());
        targetWeight.setError(null);
    }

    private void updateButtons() {
        addButton.setEnabled(products.size() < 5);
        setButtonLabel(addButton, products.size() < 5 ? t("أضف منتج") : t("الحد: ٥ منتجات"));
        addButton.setAlpha(products.size() < 5 ? 1f : 0.5f);
        for (int index = 0; index < products.size(); index++) {
            ProductRow row = products.get(index);
            row.name.setHint(t("اسم المنتج ") + arabic(index + 1) + t(" (اختيارى)"));
            row.name.setContentDescription(t("اسم المنتج ") + arabic(index + 1) + t(" (اختيارى)"));
            row.remove.setContentDescription(t("حذف المنتج ") + arabic(index + 1));
            row.remove.setVisibility(products.size() > 2 ? VISIBLE : GONE);
        }
    }

    private void addRow(String name, String weight, String price, String unit) {
        ProductRow row = new ProductRow(name, weight, price, unit);
        products.add(row);
        rows.addView(row.container);
        if (!restoring) { updateButtons(); }
    }

    /** Requirement 1 & 5 & 7 & 8: Calculate with Liter support, enlarged best-value card, and navigation buttons */
    private void calculate() {
        LinearLayout results = column();
        results.setPadding(dp(16), dp(4), dp(16), dp(12));
        List<NativeCalculator.Product> valid = new ArrayList<>();
        EditText firstInvalid = null;

        for (int index = 0; index < products.size(); index++) {
            ProductRow row = products.get(index);
            row.weight.setError(null); row.price.setError(null);
            String name = row.name.getText().toString().trim();
            String weight = row.weight.getText().toString().trim();
            String price = row.price.getText().toString().trim();
            if (name.isEmpty() && weight.isEmpty() && price.isEmpty()) continue;

            BigDecimal parsedWeight = null;
            BigDecimal parsedPrice = null;
            try { parsedWeight = NativeCalculator.positiveNumber(weight); }
            catch (IllegalArgumentException invalid) {
                row.weight.setError(t("أدخل وزن صحيح أكبر من صفر"));
                if (firstInvalid == null) firstInvalid = row.weight;
            }
            try { parsedPrice = NativeCalculator.positiveNumber(price); }
            catch (IllegalArgumentException invalid) {
                row.price.setError(t("أدخل سعر صحيح أكبر من صفر"));
                if (firstInvalid == null) firstInvalid = row.price;
            }
            if (parsedWeight != null && parsedPrice != null) {
                valid.add(new NativeCalculator.Product(index, name.isEmpty() ? t("المنتج ") + arabic(index + 1) : name,
                        parsedWeight, row.unit, parsedPrice, row.quantity));
            }
        }

        if (firstInvalid != null) {
            message.setText(t("راجع الوزن والسعر فى الحقول المحددة."));
            message.setVisibility(VISIBLE);
            firstInvalid.requestFocus();
            return;
        }
        if (valid.size() < 2) {
            message.setText(t("أدخل وزن وسعر منتجين على الأقل."));
            message.setVisibility(VISIBLE);
            return;
        }

        // Requirement 7: Check compatibility between weight and volume units
        int weightCount = 0;
        int volumeCount = 0;
        for (NativeCalculator.Product p : valid) {
            if (p.isVolume) volumeCount++;
            else weightCount++;
        }
        if (weightCount > 0 && volumeCount > 0) {
            message.setText(t("لا يمكن مقارنة الوزن (كيلوجرام/جرام) بالحجم (لتر) مباشرة بدون معرفة الكثافة. يرجى توحيد نوع الوحدة."));
            message.setVisibility(VISIBLE);
            return;
        }

        final boolean isVolume = volumeCount > 0;
        final String unitLabel = isVolume ? t("لتر") : t("كيلو");
        final String unitPerLabel = isVolume ? t("ج.م / لتر") : t("ج.م / كيلو");
        final String subPerLabel = isVolume ? t("ج.م / ١٠٠ مل") : t("ج.م / ١٠٠ جرام");

        if (!targetWeight.getText().toString().trim().isEmpty()) {
            try {
                BigDecimal required = NativeCalculator.positiveNumber(targetWeight.getText().toString());
                if (isVolume && !"l".equals(targetUnitVal)) {
                    message.setText(t("الوحدة المطلوبة لازم تتوافق مع نوع المنتجات (لتر للحجم، أو جرام/كيلو للوزن)."));
                    message.setVisibility(VISIBLE);
                    return;
                }
                if (!isVolume && "l".equals(targetUnitVal)) {
                    message.setText(t("الوحدة المطلوبة لازم تتوافق مع نوع المنتجات (لتر للحجم، أو جرام/كيلو للوزن)."));
                    message.setVisibility(VISIBLE);
                    return;
                }
                BigDecimal targetInBasis = "kg".equals(targetUnitVal) ? required.multiply(new BigDecimal("1000")) : required;
                showTargetResults(valid, targetInBasis, isVolume);
                return;
            } catch (IllegalArgumentException invalidTarget) {
                targetWeight.setError(t("أدخل الوزن المطلوب أكبر من صفر"));
                targetWeight.requestFocus();
                message.setText(t("راجع الوزن المطلوب."));
                message.setVisibility(VISIBLE);
                return;
            }
        }

        List<NativeCalculator.Product> sorted = NativeCalculator.ranked(valid);
        NativeCalculator.Product cheapest = sorted.get(0);
        NativeCalculator.Product mostExpensive = sorted.get(sorted.size() - 1);
        int cheapestCount = 0;
        for (NativeCalculator.Product item : sorted) {
            if (NativeCalculator.comparePrice(item, cheapest) == 0) cheapestCount++;
        }

        // Summary Headline Banner
        if (NativeCalculator.comparePrice(cheapest, mostExpensive) == 0) {
            results.addView(savingsHeading(isVolume ? t("كل المنتجات متساوية فى السعر لكل لتر") : t("كل المنتجات متساوية فى السعر لكل كيلو")));
        } else {
            String winner = cheapestCount > 1 ? t("الاختيارات الأوفر") : cheapest.name;
            results.addView(savingsHeading(winner + t(" أوفر بـ ")
                    + format(NativeCalculator.savingsPerKg(cheapest, mostExpensive)) + t(" ج")));
            results.addView(label((isVolume ? t("مقارنة موحّدة على أساس ١ لتر · توفير ") : t("مقارنة موحّدة على أساس ١ كيلو · توفير "))
                    + format(NativeCalculator.savingsPercent(cheapest, mostExpensive)) + t("٪"), 12, false));
        }

        // Product Results Cards (Requirement 5: Enlarged Best-Value Product Card)
        int rank = 1;
        for (int index = 0; index < sorted.size(); index++) {
            final NativeCalculator.Product product = sorted.get(index);
            final boolean isBest = NativeCalculator.comparePrice(product, cheapest) == 0;
            if (index > 0 && NativeCalculator.comparePrice(product, sorted.get(index - 1)) != 0) rank = index + 1;

            LinearLayout card = column();
            card.setPadding(dp(isBest ? 16 : 12), dp(isBest ? 16 : 12), dp(isBest ? 16 : 12), dp(isBest ? 16 : 12));
            int cardFill = isBest ? (dark ? 0xff1e3a5f : 0xffe8f0fc) : cardBg;
            int cardStroke = isBest ? (dark ? 0xff60a5fa : sky) : border;
            card.setBackground(shape(cardFill, cardStroke));

            LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
            cardParams.topMargin = dp(isBest ? 12 : 8);
            card.setLayoutParams(cardParams);

            // Card Header
            LinearLayout header = rankHeading(rank, product.name, isBest);
            card.addView(header);

            if (isBest) {
                TextView bestBadge = label("★ " + (cheapestCount > 1 ? t("الأوفر بالتساوى") : t("الأوفر قيمة")), 13, true);
                bestBadge.setTextColor(dark ? 0xff93c5fd : sky);
                bestBadge.setPadding(0, dp(4), 0, dp(4));
                card.addView(bestBadge);

                // Requirement 1: Explicit savings in Egyptian pounds compared to each alternative
                for (NativeCalculator.Product alt : sorted) {
                    if (NativeCalculator.comparePrice(product, alt) < 0) {
                        BigDecimal diff = alt.pricePerKg().subtract(product.pricePerKg());
                        TextView altSavings = label(t("يوفر ") + format(diff) + t(" ج") + t(" مقارنة بـ ") + alt.name, 12, true);
                        altSavings.setTextColor(dark ? 0xff86efac : 0xff15803d);
                        card.addView(altSavings);
                    }
                }
            } else {
                BigDecimal diff = product.pricePerKg().subtract(cheapest.pricePerKg());
                TextView diffLabel = label("+ " + format(diff) + t(" ج مقارنة بالأوفر"), 12, false);
                diffLabel.setTextColor(muted);
                card.addView(diffLabel);
            }

            // Normalized Price per comparable unit
            card.addView(label(format(product.pricePerKg()) + " " + unitPerLabel, isBest ? 23 : 20, true));
            card.addView(label(format(product.pricePerKg().divide(BigDecimal.TEN)) + " " + subPerLabel, 12, false));

            // Quantity Section without animations
            LinearLayout quantities = new LinearLayout(getContext());
            quantities.setGravity(Gravity.CENTER_VERTICAL);
            quantities.setPadding(0, dp(8), 0, 0);
            TextView quantityLabel = label(t("عدد العبوات"), 12, false);
            quantityLabel.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
            quantities.addView(quantityLabel, new LinearLayout.LayoutParams(0, dp(40), 1));

            Button less = quantityButton(product, -1);
            quantities.addView(less, new LinearLayout.LayoutParams(dp(38), dp(38)));

            TextView count = label(arabic(product.quantity), 16, true);
            count.setGravity(Gravity.CENTER);
            quantities.addView(count, new LinearLayout.LayoutParams(dp(36), dp(38)));

            Button more = quantityButton(product, 1);
            quantities.addView(more, new LinearLayout.LayoutParams(dp(38), dp(38)));
            card.addView(quantities);

            DecimalFormat compactFmt = new DecimalFormat("#,##0.###", DecimalFormatSymbols.getInstance(AppLanguage.locale(getContext())));
            String packUnit = isVolume ? t("لتر") : t("جرام");
            card.addView(label(t("الإجمالى: ") + compactFmt.format(product.totalGrams()) + " " + packUnit + t(" · ")
                    + format(product.totalPrice()) + t(" ج"), 12, true));

            results.addView(card);
        }

        results.addView(label(t("زيادة العدد تضاعف الوزن والسعر معًا. الترتيب حسب سعر نفس الوزن."), 11, false));
        results.addView(label(t("استخدم نفس العملة لكل المنتجات. الأرقام المعروضة مقربة لرقمين عشريين؛ الترتيب بالحساب الكامل."), 11, false));

        // Requirement 8: Result Navigation Buttons (Back to Menu & Start Over)
        addResultNavButtons(results);

        showResults(results, t("من الأرخص للأغلى"));
    }

    private void showTargetResults(List<NativeCalculator.Product> valid, BigDecimal required, boolean isVolume) {
        List<NativeCalculator.Purchase> purchases = NativeCalculator.forTarget(valid, required);
        NativeCalculator.Purchase best = purchases.get(0);
        BigDecimal highest = purchases.get(purchases.size() - 1).cost;
        BigDecimal savings = highest.subtract(best.cost);
        int winners = 0;
        for (NativeCalculator.Purchase item : purchases) if (item.cost.compareTo(best.cost) == 0) winners++;

        LinearLayout results = column();
        results.setPadding(dp(16), dp(4), dp(16), dp(12));
        results.addView(savingsHeading(savings.signum() == 0 ? t("كل الاختيارات بنفس إجمالى التكلفة")
                : (winners > 1 ? t("الاختيارات الأوفر") : best.product.name) + t(" أوفر بـ ") + format(savings) + t(" ج")));
        String unitStr = isVolume ? t(" لتر على الأقل · مقارنة بأغلى اختيار بالعبوات الكاملة") : t(" جرام على الأقل · مقارنة بأغلى اختيار بالعبوات الكاملة");
        results.addView(label(t("لتغطية ") + compact(required) + unitStr, 12, false));

        int rank = 1;
        for (int index = 0; index < purchases.size(); index++) {
            NativeCalculator.Purchase item = purchases.get(index);
            boolean isBest = item.cost.compareTo(best.cost) == 0;
            if (index > 0 && item.cost.compareTo(purchases.get(index - 1).cost) != 0) rank = index + 1;

            LinearLayout card = column();
            card.setPadding(dp(isBest ? 16 : 12), dp(isBest ? 16 : 12), dp(isBest ? 16 : 12), dp(isBest ? 16 : 12));
            int cardFill = isBest ? (dark ? 0xff1e3a5f : 0xffe8f0fc) : cardBg;
            int cardStroke = isBest ? (dark ? 0xff60a5fa : sky) : border;
            card.setBackground(shape(cardFill, cardStroke));

            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
            params.topMargin = dp(isBest ? 12 : 8);
            results.addView(card, params);

            card.addView(rankHeading(rank, item.product.name, isBest));
            if (isBest) card.addView(label("★ " + (winners > 1 ? t("الأوفر بالتساوى") : t("الأوفر لاحتياجك")), 12, true));
            card.addView(label(format(item.cost) + t(" ج.م إجمالى"), isBest ? 23 : 20, true));
            card.addView(label(compact(item.packs) + t(" عبوة × ") + format(item.product.price) + t(" ج"), 13, true));
            String unitWord = isVolume ? t("لتر") : t("جرام");
            card.addView(label((isVolume ? t("إجمالى الحجم: ") : t("إجمالى الوزن: ")) + compact(item.grams) + " " + unitWord, 12, false));
            card.addView(label((isVolume ? t("الحجم الزيادة: ") : t("الوزن الزيادة: ")) + compact(item.extra) + " " + unitWord, 12, false));
        }

        results.addView(label(t("كل اختيار من منتج واحد، بعبوات كاملة تغطّى الوزن المطلوب. عند تساوى التكلفة بنعرض الوزن الزيادة الأقل أولًا."), 11, false));

        // Requirement 8: Navigation Buttons
        addResultNavButtons(results);

        showResults(results, t("أقل تكلفة لاحتياجك"));
    }

    /** Requirement 8: Add Result Navigation Buttons: Back to Menu and Start Over */
    private void addResultNavButtons(LinearLayout results) {
        LinearLayout navBar = new LinearLayout(getContext());
        navBar.setOrientation(LinearLayout.HORIZONTAL);
        navBar.setPadding(0, dp(14), 0, dp(4));

        Button backToMenu = button(t("الرجوع للقائمة"), false);
        Button startOver = button(t("ابدأ من جديد"), true);

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(0, dp(46), 1);
        navBar.addView(backToMenu, btnParams);

        btnParams = new LinearLayout.LayoutParams(0, dp(46), 1);
        btnParams.setMarginStart(dp(10));
        navBar.addView(startOver, btnParams);

        backToMenu.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if (resultDialog != null) resultDialog.dismiss();
            }
        });

        startOver.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                if (resultDialog != null) resultDialog.dismiss();
                resetToEmpty();
                viewport.post(new Runnable() {
                    @Override public void run() { viewport.smoothScrollTo(0, 0); }
                });
            }
        });

        results.addView(navBar);
    }

    private String compact(BigDecimal value) {
        return new DecimalFormat("#,##0.###", DecimalFormatSymbols.getInstance(AppLanguage.locale(getContext()))).format(value);
    }

    private LinearLayout rankHeading(int rank, String name, boolean best) {
        LinearLayout heading = new LinearLayout(getContext());
        heading.setGravity(Gravity.CENTER_VERTICAL);
        TextView badge = label(arabic(rank), 14, true);
        badge.setGravity(Gravity.CENTER);
        badge.setTextColor(best ? 0xffffffff : (dark ? 0xff94a3b8 : 0xff617999));
        badge.setBackground(shape(best ? sky : (dark ? 0xff334155 : 0xffe3eef8), best ? sky : (dark ? 0xff334155 : 0xffe3eef8)));
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(dp(26), dp(26));
        badgeParams.setMarginEnd(dp(8));
        heading.addView(badge, badgeParams);
        heading.addView(label(name, 20, true), new LinearLayout.LayoutParams(0, -2, 1));
        return heading;
    }

    private TextView savingsHeading(String text) {
        TextView heading = label(text, 18, true);
        heading.setTextColor(dark ? 0xff60a5fa : sky);
        heading.setPadding(0, 0, 0, dp(4));
        return heading;
    }

    private void showResults(LinearLayout results, String title) {
        if (resultDialog != null && resultDialog.isShowing()) {
            final int scrollPosition = resultViewport != null ? resultViewport.getScrollY() : 0;
            resultViewport.removeAllViews();
            resultViewport.addView(results, new ScrollView.LayoutParams(-1, -2));
            resultViewport.post(new Runnable() { @Override public void run() { resultViewport.scrollTo(0, scrollPosition); } });
            return;
        }

        resultViewport = new ScrollView(getContext());
        resultViewport.setVerticalScrollBarEnabled(false);
        resultViewport.setHorizontalScrollBarEnabled(false);
        resultViewport.setBackgroundColor(bg);
        resultViewport.addView(results, new ScrollView.LayoutParams(-1, -2));

        TextView resultTitle = label(title, 19, true);
        resultTitle.setPadding(dp(16), dp(14), dp(16), dp(6));
        resultTitle.setBackgroundColor(bg);

        resultDialog = new AlertDialog.Builder(getContext())
                .setCustomTitle(resultTitle)
                .setView(resultViewport)
                .setPositiveButton(t("تعديل المنتجات"), null)
                .create();

        resultDialog.show();
        primaryAction.setVisibility(INVISIBLE);
        resultDialog.setOnDismissListener(new android.content.DialogInterface.OnDismissListener() {
            @Override public void onDismiss(android.content.DialogInterface dialog) { primaryAction.setVisibility(VISIBLE); }
        });
        resultDialog.getButton(AlertDialog.BUTTON_POSITIVE).setTypeface(bold);
        resultDialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(sky);
    }

    private Button quantityButton(final NativeCalculator.Product product, final int delta) {
        Button control = button(delta > 0 ? "+" : "-", false);
        control.setContentDescription((delta > 0 ? t("زيادة") : t("تقليل")) + t(" عدد عبوات ") + product.name);
        control.setEnabled(delta > 0 ? product.quantity < 99 : product.quantity > 1);
        control.setAlpha(control.isEnabled() ? 1f : 0.4f);
        control.setTextSize(16);
        control.setPadding(0, 0, 0, 0);
        control.setOnClickListener(new OnClickListener() {
            @Override public void onClick(View view) {
                ProductRow row = products.get(product.index);
                row.quantity = Math.max(1, Math.min(99, row.quantity + delta));
                calculate();
            }
        });
        return control;
    }

    /** Product Row with Package Quantity Controls moved to the top header */
    private final class ProductRow {
        final LinearLayout container;
        final android.widget.ImageButton remove;
        final EditText name;
        final EditText weight;
        final EditText price;
        final Button unitBtn;
        String unit = "g"; // "g", "kg", "l"
        int quantity = 1;

        ProductRow(String initialName, String initialWeight, String initialPrice, String initialUnit) {
            unit = initialUnit != null ? initialUnit : "g";
            container = column();
            container.setPadding(dp(12), dp(compact ? 6 : 8), dp(12), dp(compact ? 6 : 8));
            container.setBackground(shape(cardBg, border));

            LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
            cardParams.bottomMargin = dp(compact ? 6 : 8);
            container.setLayoutParams(cardParams);

            // Requirement 4: Top header with product name, quantity controls, and delete button
            LinearLayout header = new LinearLayout(getContext());
            header.setGravity(Gravity.CENTER_VERTICAL);

            name = input(t("المنتج"), initialName, false);
            name.setTextSize(14);
            name.setTypeface(bold);
            name.setBackgroundColor(android.graphics.Color.TRANSPARENT);
            name.setPadding(0, dp(5), 0, dp(5));
            name.setTextDirection(View.TEXT_DIRECTION_FIRST_STRONG);
            name.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
            header.addView(name, new LinearLayout.LayoutParams(0, dp(compact ? 30 : 36), 1));

            // Plus & Minus Quantity Controls moved to the top of the product card
            LinearLayout qtyLayout = new LinearLayout(getContext());
            qtyLayout.setGravity(Gravity.CENTER_VERTICAL);
            final TextView qtyDisplay = label(arabic(quantity), 14, true);
            qtyDisplay.setGravity(Gravity.CENTER);

            Button minusBtn = button("-", false);
            minusBtn.setPadding(0, 0, 0, 0);
            minusBtn.setTextSize(14);
            minusBtn.setOnClickListener(new OnClickListener() {
                @Override public void onClick(View v) {
                    if (quantity > 1) {
                        quantity--;
                        qtyDisplay.setText(arabic(quantity));
                        changed();
                    }
                }
            });

            Button plusBtn = button("+", false);
            plusBtn.setPadding(0, 0, 0, 0);
            plusBtn.setTextSize(14);
            plusBtn.setOnClickListener(new OnClickListener() {
                @Override public void onClick(View v) {
                    if (quantity < 99) {
                        quantity++;
                        qtyDisplay.setText(arabic(quantity));
                        changed();
                    }
                }
            });

            qtyLayout.addView(minusBtn, new LinearLayout.LayoutParams(dp(32), dp(32)));
            qtyLayout.addView(qtyDisplay, new LinearLayout.LayoutParams(dp(26), dp(32)));
            qtyLayout.addView(plusBtn, new LinearLayout.LayoutParams(dp(32), dp(32)));

            LinearLayout.LayoutParams qtyParams = new LinearLayout.LayoutParams(-2, -2);
            qtyParams.setMarginEnd(dp(6));
            header.addView(qtyLayout, qtyParams);

            remove = new android.widget.ImageButton(getContext());
            final SketchIconDrawable removeIcon = new SketchIconDrawable(getContext(), SketchIconDrawable.Kind.TRASH);
            remove.setImageDrawable(removeIcon);
            remove.setScaleType(android.widget.ImageView.ScaleType.CENTER_INSIDE);
            remove.setPadding(dp(10), dp(10), dp(10), dp(10));
            remove.setBackground(shape(dark ? 0xff334155 : 0xffe7f0fa, border));
            header.addView(remove, new LinearLayout.LayoutParams(dp(40), dp(40)));
            container.addView(header);

            // Product fields (Weight/Volume, Unit, Price)
            LinearLayout amounts = new LinearLayout(getContext());
            amounts.setPadding(0, dp(compact ? 2 : 4), 0, 0);
            amounts.setBaselineAligned(false);

            weight = input(t("الوزن"), initialWeight, true);
            price = input(t("السعر"), initialPrice, true);
            unitBtn = button(formatUnit(unit), false);

            LinearLayout weightField = column();
            TextView weightLabel = fieldLabel(t("الوزن"));
            icon(weightLabel, SketchIconDrawable.Kind.WEIGHT, 20, false);
            weightField.addView(weightLabel);
            weightField.addView(weight);

            LinearLayout unitField = column();
            unitField.addView(fieldLabel(t("الوحدة")));
            unitField.addView(unitBtn, new LinearLayout.LayoutParams(-1, dp(compact ? 40 : 44)));

            LinearLayout priceField = column();
            TextView priceLabel = fieldLabel(t("السعر"));
            icon(priceLabel, SketchIconDrawable.Kind.PRICE, 20, false);
            priceField.addView(priceLabel);
            priceField.addView(price);

            LinearLayout.LayoutParams weightParams = new LinearLayout.LayoutParams(0, -2, 1);
            weightParams.setMarginEnd(dp(8));
            amounts.addView(weightField, weightParams);

            LinearLayout.LayoutParams unitParams = new LinearLayout.LayoutParams(dp(64), -2);
            unitParams.setMarginEnd(dp(8));
            amounts.addView(unitField, unitParams);

            amounts.addView(priceField, new LinearLayout.LayoutParams(0, -2, 1));
            container.addView(amounts);

            // Unit button cycles g -> kg -> l -> g
            unitBtn.setContentDescription(t("وحدة الوزن أو الحجم، اضغط لتغيير الجرام والكيلوجرام واللتر"));
            unitBtn.setOnClickListener(new OnClickListener() {
                @Override public void onClick(View view) {
                    if ("g".equals(unit)) unit = "kg";
                    else if ("kg".equals(unit)) unit = "l";
                    else unit = "g";
                    unitBtn.setText(formatUnit(unit));
                    changed();
                }
            });

            remove.setOnClickListener(new OnClickListener() {
                @Override public void onClick(View view) {
                    if (products.size() > 2 && remove.isEnabled()) {
                        products.remove(ProductRow.this);
                        remove.setEnabled(false);
                        changed();
                        rows.removeView(container);
                    }
                }
            });

            TextWatcher watcher = new TextWatcher() {
                @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
                @Override public void onTextChanged(CharSequence s, int start, int before, int count) { changed(); }
                @Override public void afterTextChanged(Editable editable) {}
            };
            name.addTextChangedListener(watcher);
            weight.addTextChangedListener(watcher);
            price.addTextChangedListener(watcher);
        }

        private String formatUnit(String u) {
            if ("l".equals(u)) return t("لتر");
            if ("kg".equals(u)) return t("كجم");
            return t("جرام");
        }
    }

    private LinearLayout column() {
        LinearLayout result = new LinearLayout(getContext());
        result.setOrientation(LinearLayout.VERTICAL);
        result.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
        return result;
    }

    private TextView label(String text, int size, boolean strong) {
        TextView result = new TextView(getContext());
        result.setText(text);
        result.setTextSize(size);
        result.setTextColor(blue);
        result.setTypeface(strong ? bold : regular);
        result.setIncludeFontPadding(false);
        result.setTextDirection(AppLanguage.isEnglish(getContext()) ? View.TEXT_DIRECTION_LTR : View.TEXT_DIRECTION_RTL);
        return result;
    }

    /** Requirement 9: When tapping numeric input, automatically select all existing text. */
    private EditText input(String placeholder, String value, boolean number) {
        EditText result = new EditText(getContext());
        result.setHint(placeholder);
        result.setHintTextColor(dark ? 0xff64748b : 0xff9baec5);
        result.setTextColor(blue);
        result.setTextSize(14);
        if (number) {
            result.setKeyListener(android.text.method.DigitsKeyListener.getInstance("0123456789٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹.٫,٬+-−"));
            result.setRawInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
            result.setTextDirection(View.TEXT_DIRECTION_LTR);
            result.setGravity((AppLanguage.isEnglish(getContext()) ? Gravity.LEFT : Gravity.RIGHT) | Gravity.CENTER_VERTICAL);
            // Requirement 9: Select all existing text on focus
            result.setSelectAllOnFocus(true);
        }
        result.setTypeface(regular);
        result.setFilters(new InputFilter[]{new InputFilter.LengthFilter(number ? 40 : 60)});
        result.setIncludeFontPadding(false);
        result.setPadding(dp(9), dp(6), dp(9), dp(6));
        result.setVerticalScrollBarEnabled(false);
        result.setHorizontalScrollBarEnabled(false);
        result.setBackground(shape(dark ? 0xff1e293b : 0xfff5f8fd, border));
        result.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(compact ? 40 : 44)));
        result.setText(value);
        return result;
    }

    private Button button(String text, boolean primary) {
        Button result = new Button(getContext());
        result.setText(text);
        result.setTextSize(13);
        result.setTypeface(bold);
        result.setAllCaps(false);
        result.setTextColor(primary ? 0xffffffff : sky);
        result.setGravity(Gravity.CENTER);
        result.setTextDirection(AppLanguage.isEnglish(getContext()) ? View.TEXT_DIRECTION_FIRST_STRONG_LTR : View.TEXT_DIRECTION_FIRST_STRONG_RTL);
        result.setSingleLine(true);
        result.setBackground(shape(primary ? sky : (dark ? 0xff1e293b : 0xffe7f0fa), primary ? sky : border));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(44));
        result.setLayoutParams(params);
        result.setMinimumHeight(0);
        result.setMinHeight(0);
        result.setMinimumWidth(0);
        result.setMinWidth(0);
        result.setIncludeFontPadding(false);
        result.setPadding(dp(8), dp(3), dp(8), dp(3));
        pressFeedback(result);
        return result;
    }

    private void pressFeedback(final View view) {
        view.setOnTouchListener(new OnTouchListener() {
            @Override public boolean onTouch(View target, android.view.MotionEvent event) {
                int action = event.getActionMasked();
                if (action == android.view.MotionEvent.ACTION_DOWN || action == android.view.MotionEvent.ACTION_UP
                        || action == android.view.MotionEvent.ACTION_CANCEL) {
                    float scale = action == android.view.MotionEvent.ACTION_DOWN ? 0.97f : 1f;
                    target.animate().scaleX(scale).scaleY(scale).setStartDelay(0).setDuration(150).start();
                }
                return false;
            }
        });
    }

    private GradientDrawable shape(int fill, int stroke) {
        GradientDrawable background = new GradientDrawable();
        background.setColor(fill);
        background.setCornerRadius(dp(12));
        background.setStroke(dp(1), stroke);
        return background;
    }

    private void icon(final TextView view, SketchIconDrawable.Kind kind, int sizeDp, boolean white) {
        final SketchIconDrawable drawable = new SketchIconDrawable(getContext(), kind);
        drawable.setBounds(0, 0, dp(sizeDp), dp(sizeDp));
        if (white) drawable.setColorFilter(0xffffffff, android.graphics.PorterDuff.Mode.SRC_IN);
        view.setTag(drawable);
        if (view instanceof Button) {
            setButtonLabel((Button) view, view.getText().toString());
            return;
        }
        view.setCompoundDrawablePadding(dp(8));
        view.setCompoundDrawablesRelative(drawable, null, null, null);
    }

    private TextView fieldLabel(String text) {
        TextView result = label(text, 12, true);
        result.setPadding(0, 0, 0, 0);
        result.setSingleLine(true);
        result.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        result.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(compact ? 18 : 22)));
        return result;
    }

    private void setButtonLabel(Button button, String label) {
        Object savedIcon = button.getTag();
        button.setContentDescription(label);
        if (!(savedIcon instanceof android.graphics.drawable.Drawable)) {
            button.setText(label);
            return;
        }
        android.text.SpannableString grouped = new android.text.SpannableString("\uFFFC" + label);
        grouped.setSpan(new CenteredIconSpan((android.graphics.drawable.Drawable) savedIcon, label.isEmpty() ? 0 : dp(8)),
                0, 1, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        button.setCompoundDrawablesRelative(null, null, null, null);
        button.setText(grouped);
    }

    private static final class CenteredIconSpan extends android.text.style.ReplacementSpan {
        private final android.graphics.drawable.Drawable drawable;
        private final int gap;

        CenteredIconSpan(android.graphics.drawable.Drawable drawable, int gap) {
            this.drawable = drawable;
            this.gap = gap;
        }

        @Override public int getSize(android.graphics.Paint paint, CharSequence text, int start, int end,
                android.graphics.Paint.FontMetricsInt metrics) {
            android.graphics.Paint.FontMetricsInt font = paint.getFontMetricsInt();
            if (metrics != null) {
                int center = (font.ascent + font.descent) / 2;
                int half = drawable.getBounds().height() / 2;
                metrics.ascent = Math.min(font.ascent, center - half);
                metrics.descent = Math.max(font.descent, center + half);
                metrics.top = metrics.ascent;
                metrics.bottom = metrics.descent;
            }
            return drawable.getBounds().width() + gap;
        }

        @Override public void draw(android.graphics.Canvas canvas, CharSequence text, int start, int end,
                float x, int top, int baseline, int bottom, android.graphics.Paint paint) {
            android.graphics.Paint.FontMetricsInt font = paint.getFontMetricsInt();
            float center = baseline + (font.ascent + font.descent) / 2f;
            int saved = canvas.save();
            canvas.translate(x + gap, center - drawable.getBounds().height() / 2f);
            drawable.draw(canvas);
            canvas.restoreToCount(saved);
        }
    }

    private String format(BigDecimal amount) {
        if (amount.signum() > 0 && amount.compareTo(new BigDecimal("0.01")) < 0) return t("أقل من ٠٫٠١");
        DecimalFormat format = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(AppLanguage.locale(getContext())));
        format.setRoundingMode(java.math.RoundingMode.HALF_UP);
        return format.format(amount);
    }

    private String arabic(int value) {
        return String.format(AppLanguage.locale(getContext()), "%d", value);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private String t(String value) { return AppLanguage.text(getContext(), value); }
}
