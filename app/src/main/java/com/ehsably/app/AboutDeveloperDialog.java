package com.ehsably.app;

import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.IOException;
import java.io.InputStream;

/** Local developer portrait, reading text, and an explicit browser link. */
final class AboutDeveloperDialog {
    static void show(final Context context, Typeface regular, Typeface bold) {
        final boolean dark = AppTheme.isDark(context);
        final int blue = dark ? 0xfff8fafc : 0xff1f347d;
        final int sky = dark ? 0xff60a5fa : 0xff3c89bd;
        final int cardBg = dark ? 0xff1e293b : 0xffffffff;
        final int strokeColor = dark ? 0xff334155 : 0xffd9dee5;
        final int bioColor = dark ? 0xffcbd5e1 : 0xff55606f;
        final int descColor = dark ? 0xff94a3b8 : 0xff617999;

        LinearLayout content = new LinearLayout(context);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setLayoutDirection(AppLanguage.direction(context));
        content.setPadding(dp(context, 16), dp(context, 4), dp(context, 16), dp(context, 6));
        TextView appTitle = text(context, AppLanguage.isEnglish(context) ? "E7sbly · Version 2" : "احسبلى · الإصدار ٢", 18, blue, bold, false);
        content.addView(appTitle);
        TextView description = text(context, "قارن لحد ٥ منتجات حسب سعر الكيلو، واختار الأوفر. شغال بدون إنترنت، وبياناتك على جهازك.", 13, descColor, regular, false);
        description.setPadding(0, dp(context, 4), 0, dp(context, 8));
        content.addView(description);
        TextView developerLabel = text(context, "عن المطور", 14, blue, bold, false);
        content.addView(developerLabel);

        LinearLayout card = new LinearLayout(context);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        GradientDrawable background = new GradientDrawable();
        background.setColor(dark ? 0xff0f172a : 0xfff5f8fd);
        background.setCornerRadius(dp(context, 12));
        background.setStroke(dp(context, 2), strokeColor);
        card.setBackground(background);
        card.setPadding(dp(context, 2), dp(context, 2), dp(context, 2), dp(context, 2));
        card.setClipToOutline(true);
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
        cardParams.topMargin = dp(context, 5);
        card.setLayoutParams(cardParams);

        LinearLayout banner = new LinearLayout(context);
        banner.setOrientation(LinearLayout.HORIZONTAL);
        banner.setGravity(Gravity.BOTTOM);
        banner.setBackgroundColor(cardBg);
        LinearLayout words = new LinearLayout(context);
        words.setOrientation(LinearLayout.VERTICAL);
        words.setPadding(dp(context, 10), dp(context, 12), dp(context, 5), dp(context, 12));
        TextView firstName = text(context, "MARCO SAWIRIS", 26, blue, bold, true);
        firstName.setSingleLine(true);
        firstName.setAutoSizeTextTypeUniformWithConfiguration(14, 22, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
        firstName.setPadding(0, dp(context, 5), 0, 0);
        content.addView(firstName);
        TextView role = text(context, "Senior Graphic Designer & Art Director", 14, sky, bold, true);
        role.setPadding(0, dp(context, 4), 0, dp(context, 2));
        content.addView(role);
        Typeface medium;
        try { medium = Typeface.createFromAsset(context.getAssets(), "fonts/montserrat-arabic-medium.otf"); }
        catch (RuntimeException unavailableMedium) { medium = Typeface.create("sans-serif-medium", Typeface.NORMAL); }
        TextView bio = text(context, "20+ years of design experience across Egypt and Qatar, creating brand identities, campaigns, packaging and motion graphics.", 22, bioColor, medium, true);
        bio.setLineSpacing(dp(context, 2), 1.1f);
        bio.setBreakStrategy(android.text.Layout.BREAK_STRATEGY_HIGH_QUALITY);
        bio.setHyphenationFrequency(android.text.Layout.HYPHENATION_FREQUENCY_NONE);
        words.addView(bio);
        banner.addView(words, new LinearLayout.LayoutParams(0, -2, 1));
        PortraitView portrait = new PortraitView(context);
        banner.addView(portrait, new LinearLayout.LayoutParams(dp(context, 118), -2));
        card.addView(banner);
        content.addView(card);

        final TextView website = new TextView(context);
        final SketchIconDrawable globe = new SketchIconDrawable(context, SketchIconDrawable.Kind.WEBSITE);
        globe.setBounds(0, 0, dp(context, 22), dp(context, 22));
        android.text.SpannableString siteLabel = new android.text.SpannableString("\uFFFC  marco-sawiris.github.io");
        siteLabel.setSpan(new android.text.style.ImageSpan(globe, android.text.style.DynamicDrawableSpan.ALIGN_CENTER),
                0, 1, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        siteLabel.setSpan(new android.text.style.UnderlineSpan(), 3, siteLabel.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        website.setText(siteLabel);
        website.setTextIsSelectable(false);
        website.setLongClickable(false);
        website.setContentDescription(AppLanguage.text(context, "marco-sawiris.github.io، رابط الموقع"));
        website.setGravity(Gravity.CENTER);
        website.setFocusable(true);
        website.setLinkTextColor(sky);
        website.setTextDirection(View.TEXT_DIRECTION_LTR);
        website.setTextSize(13 * 0.8f);
        website.setTypeface(bold);
        website.setTextColor(sky);
        website.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        LinearLayout.LayoutParams linkParams = new LinearLayout.LayoutParams(-1, dp(context, 48));
        linkParams.topMargin = dp(context, 4);
        content.addView(website, linkParams);
        website.post(new Runnable() { @Override public void run() { globe.playTrim(website, 500); } });
        website.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View view) {
                try {
                    context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://marco-sawiris.github.io/")));
                } catch (ActivityNotFoundException unavailableBrowser) {
                    Toast.makeText(context, AppLanguage.text(context, "افتح marco-sawiris.github.io من متصفحك"), Toast.LENGTH_LONG).show();
                }
            }
        });

        FitContentLayout fittedContent = new FitContentLayout(context);
        fittedContent.addView(content);
        TextView title = text(context, "عن التطبيق والمطور", 19, blue, bold, false);
        title.setPadding(dp(context, 16), dp(context, 16), dp(context, 16), dp(context, 6));
        AlertDialog dialog = new AlertDialog.Builder(context).setCustomTitle(title).setView(fittedContent)
                .setPositiveButton(AppLanguage.text(context, "إغلاق"), null).create();
        dialog.show();
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTypeface(bold);
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(sky);
        final android.view.Window aboutWindow = dialog.getWindow();
        if (aboutWindow != null) {
            int width = Math.min(context.getResources().getDisplayMetrics().widthPixels - dp(context, 24), dp(context, 460));
            aboutWindow.setLayout(width, android.view.ViewGroup.LayoutParams.WRAP_CONTENT);
            final View decor = aboutWindow.getDecorView();
            decor.getViewTreeObserver().addOnGlobalLayoutListener(new android.view.ViewTreeObserver.OnGlobalLayoutListener() {
                @Override public void onGlobalLayout() {
                    if (decor.getWidth() <= 0 || decor.getHeight() <= 0) return;
                    decor.getViewTreeObserver().removeOnGlobalLayoutListener(this);
                    decor.post(new Runnable() {
                        @Override public void run() {
                            ViewMotion.reveal(decor, 0, 40);
                            View[] reveals = {title, appTitle, description, developerLabel, firstName, role,
                                    card, bio, portrait, website, dialog.getButton(AlertDialog.BUTTON_POSITIVE)};
                            for (int index = 0; index < reveals.length; index++)
                                ViewMotion.reveal(reveals[index], 100 + index * 105, 22);
                        }
                    });
                }
            });
        }
    }

    /** Fit the entire natural layout into the space reserved by AlertDialog. */
    private static final class FitContentLayout extends android.widget.FrameLayout {
        FitContentLayout(Context context) { super(context); }
        @Override protected void onMeasure(int widthSpec, int heightSpec) {
            View child = getChildAt(0);
            int width = Math.max(1, View.MeasureSpec.getSize(widthSpec));
            child.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
            int naturalHeight = Math.max(1, child.getMeasuredHeight());
            int available = View.MeasureSpec.getMode(heightSpec) == View.MeasureSpec.UNSPECIFIED
                    ? naturalHeight : Math.max(1, View.MeasureSpec.getSize(heightSpec));
            float scale = Math.min(1f, available / (float) naturalHeight);
            setMeasuredDimension(resolveSize(width, widthSpec), resolveSize(Math.round(naturalHeight * scale), heightSpec));
            child.setPivotX(0); child.setPivotY(0);
            child.setScaleX(scale); child.setScaleY(scale);
            child.setTranslationX((getMeasuredWidth() - width * scale) / 2f);
            child.setTranslationY(0);
        }
        @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
            View child = getChildAt(0);
            child.layout(0, 0, child.getMeasuredWidth(), child.getMeasuredHeight());
        }
    }

    private static TextView text(Context context, String value, int size, int color, Typeface font, boolean english) {
        TextView view = new TextView(context);
        view.setText(AppLanguage.text(context, value));
        view.setTextSize(size * 0.8f);
        view.setTextColor(color);
        view.setTypeface(font);
        view.setIncludeFontPadding(false);
        view.setTextIsSelectable(false);
        view.setLongClickable(false);
        boolean ltr = english || AppLanguage.isEnglish(context);
        view.setTextDirection(ltr ? View.TEXT_DIRECTION_LTR : View.TEXT_DIRECTION_RTL);
        view.setGravity(ltr ? Gravity.LEFT : Gravity.RIGHT);
        view.setLineSpacing(dp(context, 2), 1f);
        return view;
    }

    /** Fits the entire supplied portrait, preserving its original proportions. */
    private static final class PortraitView extends ImageView {
        PortraitView(Context context) {
            super(context);
            setScaleType(ScaleType.FIT_CENTER);
            setAdjustViewBounds(true);
            setCropToPadding(false);
            setContentDescription(AppLanguage.text(context, "صورة Marco Sawiris"));
            try (InputStream source = context.getAssets().open("developer-reference.png")) {
                setImageDrawable(Drawable.createFromStream(source, "developer-reference"));
            } catch (IOException unavailablePortrait) {
                setImageResource(R.drawable.brand_logo);
                setScaleType(ScaleType.CENTER_INSIDE);
            }
        }
        @Override protected void onMeasure(int widthSpec, int heightSpec) {
            if (android.view.View.MeasureSpec.getMode(heightSpec) == android.view.View.MeasureSpec.EXACTLY) {
                super.onMeasure(widthSpec, heightSpec); return;
            }
            int width = android.view.View.MeasureSpec.getSize(widthSpec);
            Drawable image = getDrawable();
            int height = image == null || image.getIntrinsicWidth() <= 0 ? width
                    : Math.round(width * image.getIntrinsicHeight() / (float) image.getIntrinsicWidth());
            super.onMeasure(android.view.View.MeasureSpec.makeMeasureSpec(width, android.view.View.MeasureSpec.EXACTLY),
                    android.view.View.MeasureSpec.makeMeasureSpec(height, android.view.View.MeasureSpec.EXACTLY));
        }
    }

    private static int dp(Context context, int value) {
        return Math.round(value * 0.8f * context.getResources().getDisplayMetrics().density);
    }
}
