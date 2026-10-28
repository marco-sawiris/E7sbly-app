package com.ehsably.app;

import android.os.SystemClock;
import android.view.View;
import android.view.ViewTreeObserver;

/** Small, layout-preserving loops that stop with their owning window. */
final class ViewMotion {
    static void breathe(View view, boolean arrow) { new Loop(view, arrow).attach(); }

    static void reveal(View view, long delay, float distanceDp) {
        if (!android.animation.ValueAnimator.areAnimatorsEnabled()) return;
        view.setAlpha(0f);
        view.setTranslationY(distanceDp * view.getResources().getDisplayMetrics().density);
        view.setScaleX(.92f); view.setScaleY(.92f);
        view.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f)
                .setStartDelay(delay).setDuration(850)
                .setInterpolator(new android.view.animation.DecelerateInterpolator(2f)).start();
    }

    private static final class Loop implements Runnable, View.OnAttachStateChangeListener,
            ViewTreeObserver.OnWindowFocusChangeListener {
        final View view;
        final boolean arrow;
        long started = -1;
        boolean disposed;
        Loop(View view, boolean arrow) { this.view = view; this.arrow = arrow; }
        void attach() {
            view.addOnAttachStateChangeListener(this);
            view.getViewTreeObserver().addOnWindowFocusChangeListener(this);
            view.post(this);
        }
        @Override public void run() {
            if (disposed || !view.isAttachedToWindow()) return;
            if (!view.isShown() || !view.hasWindowFocus()) { reset(); return; }
            long now = SystemClock.uptimeMillis();
            if (started < 0) started = now;
            float wave = (float) (.5 - .5 * Math.cos((now - started) % 2600L * Math.PI * 2 / 2600));
            float density = view.getResources().getDisplayMetrics().density;
            view.setTranslationY((arrow ? 3 : -2) * density * wave);
            if (arrow) view.setTranslationX(-3 * density * wave);
            else { view.setScaleX(1 + .1f * wave); view.setScaleY(1 + .1f * wave); }
            view.postOnAnimation(this);
        }
        void reset() {
            view.removeCallbacks(this); started = -1;
            view.setTranslationX(0); view.setTranslationY(0); view.setScaleX(1); view.setScaleY(1);
        }
        @Override public void onWindowFocusChanged(boolean focused) {
            reset(); if (focused && !disposed) view.post(this);
        }
        @Override public void onViewAttachedToWindow(View owner) { view.removeCallbacks(this); view.post(this); }
        @Override public void onViewDetachedFromWindow(View owner) {
            disposed = true; reset(); view.removeOnAttachStateChangeListener(this);
            if (view.getViewTreeObserver().isAlive()) view.getViewTreeObserver().removeOnWindowFocusChangeListener(this);
        }
    }
}
