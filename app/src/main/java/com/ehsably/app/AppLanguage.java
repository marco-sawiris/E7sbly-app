package com.ehsably.app;

import android.content.Context;
import android.content.res.Configuration;
import android.view.View;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Locale;
import org.json.JSONObject;

/** Explicit app language, independent of the phone language. Arabic is the default. */
final class AppLanguage {
    private static JSONObject english;
    static boolean isEnglish(Context context) {
        return "en".equals(context.getSharedPreferences("app_settings", 0).getString("language", "ar"));
    }
    static void setEnglish(Context context, boolean value) {
        context.getSharedPreferences("app_settings", 0).edit().putString("language", value ? "en" : "ar").apply();
    }
    static Locale locale(Context context) { return isEnglish(context) ? Locale.US : new Locale("ar", "EG"); }
    static int direction(Context context) { return isEnglish(context) ? View.LAYOUT_DIRECTION_LTR : View.LAYOUT_DIRECTION_RTL; }
    static Context wrap(Context base) {
        Configuration configuration = new Configuration(base.getResources().getConfiguration());
        configuration.setLocale(locale(base));
        configuration.setLayoutDirection(locale(base));
        return base.createConfigurationContext(configuration);
    }
    static String text(Context context, String arabic) {
        if (!isEnglish(context)) return arabic;
        if (english == null) {
            try (InputStream stream = context.getAssets().open("translations.json")) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096]; int count;
                while ((count = stream.read(buffer)) != -1) bytes.write(buffer, 0, count);
                english = new JSONObject(bytes.toString("UTF-8"));
            } catch (Exception unavailable) { english = new JSONObject(); }
        }
        return english.optString(arabic, arabic);
    }
}
