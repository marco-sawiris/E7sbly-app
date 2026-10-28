package com.ehsably.app;

import android.content.Context;

/** Theme state persistence and helper for Light and Dark modes. */
final class AppTheme {
    static boolean isDark(Context context) {
        return context.getSharedPreferences("app_settings", 0).getBoolean("dark_theme", false);
    }

    static void setDark(Context context, boolean dark) {
        context.getSharedPreferences("app_settings", 0).edit().putBoolean("dark_theme", dark).apply();
    }
}
