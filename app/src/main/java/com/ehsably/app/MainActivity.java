package com.ehsably.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;

/** Native Android calculator with window styling after content installation. */
public final class MainActivity extends Activity {
    private static final int BACKGROUND = 0xfff5f8fd;

    @Override protected void attachBaseContext(Context base) { super.attachBaseContext(AppLanguage.wrap(base)); }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        boolean dark = AppTheme.isDark(this);
        root.setBackgroundColor(dark ? 0xff0f172a : BACKGROUND);
        root.setLayoutDirection(AppLanguage.direction(this));
        // PhoneWindow.getInsetsController() dereferences its DecorView. Install
        // the content/decor first; calling it earlier crashed the original APK.
        setContentView(root);
        configureSystemBars(root, dark);
        root.addView(new NativeComparisonView(this, new Runnable() {
            @Override public void run() { showDiagnostics(); }
        }), new FrameLayout.LayoutParams(-1, -1));
        root.setFocusableInTouchMode(true);
        root.requestFocus();
    }

    private void configureSystemBars(FrameLayout root, boolean dark) {
        try {
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= 29) Api29.configure(getWindow());
            if (Build.VERSION.SDK_INT >= 30) {
                Api30.configure(getWindow(), root, dark);
            } else {
                if (!dark) {
                    getWindow().getDecorView().setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                } else {
                    getWindow().getDecorView().setSystemUiVisibility(0);
                }
                root.setFitsSystemWindows(true);
            }
        } catch (RuntimeException | LinkageError optionalWindowError) {
            Log.w("Ehsably", "System bar styling unavailable", optionalWindowError);
            root.setFitsSystemWindows(true);
        }
    }

    private void showDiagnostics() {
        final String report = (AppLanguage.isEnglish(this) ? "E7sbly — Version 2\nOffline product price comparison.\nAndroid: " : "احسبلى — الإصدار ٢\nمقارنة أسعار المنتجات، شغال بدون إنترنت.\nأندرويد: ")
                + Build.VERSION.RELEASE + " / API " + Build.VERSION.SDK_INT
                + (AppLanguage.isEnglish(this) ? "\nDevice: " : "\nالجهاز: ") + Build.MANUFACTURER + " " + Build.MODEL;
        new AlertDialog.Builder(this).setTitle(AppLanguage.text(this, "عن التطبيق"))
                .setMessage(report).setNegativeButton(AppLanguage.text(this, "إغلاق"), null)
                .setPositiveButton(AppLanguage.text(this, "نسخ التفاصيل"), new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface dialog, int which) {
                        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                        if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText("Ehsably diagnostics", report));
                    }
                }).show();
    }

    // Isolate Android 11 framework references from verification on Android 10.
    private static final class Api29 {
        static void configure(Window window) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
    }
    private static final class Api30 {
        static void configure(Window window, FrameLayout root, boolean dark) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(dark ? 0 : light, light);
            }
            root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                    Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                    view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                    return WindowInsets.CONSUMED;
                }
            });
        }
    }
}
