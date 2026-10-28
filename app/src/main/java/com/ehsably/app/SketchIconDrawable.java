package com.ehsably.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import java.util.ArrayList;
import java.util.List;

/** Small, hand-drawn vector icons. Geometry stays crisp at any display density. */
final class SketchIconDrawable extends Drawable {
    enum Kind { CART, CALCULATOR, WEIGHT, PRICE, PLUS, MINUS, TRASH, RESET, STAR, HEART, WEBSITE, SAVINGS_ARROW, MENU }

    private static final int PRIMARY = 0xff1f347d;
    private static final int SECONDARY = 0xff3c89bd;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final List<Stroke> strokes = new ArrayList<>();
    private final int intrinsicSize;
    private int alpha = 255;
    private float trimProgress = 1f;
    private final Path trimmedPath = new Path();
    private Runnable trimFrame;
    private android.view.View trimOwner;
    private android.view.View.OnAttachStateChangeListener trimAttachment;
    private android.view.ViewTreeObserver.OnWindowFocusChangeListener trimFocus;

    SketchIconDrawable(Context context, Kind kind) {
        intrinsicSize = Math.max(1, Math.round(24 * context.getResources().getDisplayMetrics().density));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        build(kind == null ? Kind.CART : kind);
    }

    @Override public void draw(Canvas canvas) {
        Rect bounds = getBounds();
        if (bounds.isEmpty() || alpha == 0) return;
        float scale = Math.min(bounds.width(), bounds.height()) / 32f;
        int saved = canvas.save();
        canvas.translate(bounds.left + (bounds.width() - 32 * scale) / 2f,
                bounds.top + (bounds.height() - 32 * scale) / 2f);
        canvas.scale(scale, scale);
        for (int index = 0; index < strokes.size(); index++) {
            Stroke stroke = strokes.get(index);
            float progress = Math.max(0f, Math.min(1f,
                    trimProgress * (1f + 0.045f * (strokes.size() - 1)) - index * 0.045f));
            if (progress <= 0f) continue;
            paint.setColor(stroke.secondary ? SECONDARY : PRIMARY);
            paint.setAlpha((alpha * stroke.opacity + 127) / 255);
            paint.setStrokeWidth(stroke.width);
            paint.setStyle(stroke.filled && progress >= 1f ? Paint.Style.FILL : Paint.Style.STROKE);
            if (progress >= 1f) {
                canvas.drawPath(stroke.path, paint);
            } else {
                trimmedPath.reset();
                float remaining = stroke.length * progress;
                for (Contour contour : stroke.contours) {
                    if (remaining <= 0f) break;
                    contour.measure.getSegment(0f, Math.min(remaining, contour.length), trimmedPath, true);
                    remaining -= contour.length;
                }
                canvas.drawPath(trimmedPath, paint);
            }
        }
        canvas.restoreToCount(saved);
    }

    @Override public void setAlpha(int value) {
        alpha = Math.max(0, Math.min(255, value));
        invalidateSelf();
    }

    @Override public int getAlpha() { return alpha; }

    @Override public void setColorFilter(ColorFilter filter) {
        paint.setColorFilter(filter);
        invalidateSelf();
    }

    @Override public ColorFilter getColorFilter() { return paint.getColorFilter(); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    @Override public int getIntrinsicWidth() { return intrinsicSize; }
    @Override public int getIntrinsicHeight() { return intrinsicSize; }

    /** Actual arc-length reveal, including every contour of a multi-part path. */
    void playTrim(final android.view.View owner, long delay) {
        if (trimOwner != null) {
            if (trimFrame != null) trimOwner.removeCallbacks(trimFrame);
            if (trimAttachment != null) trimOwner.removeOnAttachStateChangeListener(trimAttachment);
            if (trimFocus != null && trimOwner.getViewTreeObserver().isAlive())
                trimOwner.getViewTreeObserver().removeOnWindowFocusChangeListener(trimFocus);
        }
        trimOwner = owner;
        trimProgress = 1f;
        trimAttachment = new android.view.View.OnAttachStateChangeListener() {
            @Override public void onViewAttachedToWindow(android.view.View view) { }
            @Override public void onViewDetachedFromWindow(android.view.View view) {
                if (trimFrame != null) view.removeCallbacks(trimFrame);
                view.removeOnAttachStateChangeListener(this);
                if (trimFocus != null && view.getViewTreeObserver().isAlive())
                    view.getViewTreeObserver().removeOnWindowFocusChangeListener(trimFocus);
                trimProgress = 1f;
                trimFrame = null; trimOwner = null; trimAttachment = null; trimFocus = null;
            }
        };
        owner.addOnAttachStateChangeListener(trimAttachment);
        // Start after a visible frame. Frame-clock drawing has an explicit app
        // duration and does not vanish when an OEM scales ValueAnimator to zero.
        trimFrame = new Runnable() {
            private long started = -1;
            @Override public void run() {
                if (!owner.isAttachedToWindow()) return;
                if (!owner.isShown() || !owner.hasWindowFocus()) {
                    started = -1; trimProgress = 1f; owner.invalidate();
                    return;
                }
                long now = android.os.SystemClock.uptimeMillis();
                if (started < 0) started = now;
                float phase = ((now - started) % 4000L) / 2000f;
                trimProgress = phase <= 1f ? phase : 2f - phase;
                invalidateSelf(); owner.invalidate();
                owner.postOnAnimation(this);
            }
        };
        trimFocus = new android.view.ViewTreeObserver.OnWindowFocusChangeListener() {
            @Override public void onWindowFocusChanged(boolean focused) {
                if (focused) owner.post(new Runnable() {
                    @Override public void run() { if (owner.isAttachedToWindow()) playTrim(owner, 500); }
                });
                else {
                    if (trimFrame != null) owner.removeCallbacks(trimFrame);
                    trimProgress = 1f; owner.invalidate();
                }
            }
        };
        owner.getViewTreeObserver().addOnWindowFocusChangeListener(trimFocus);
        owner.postDelayed(trimFrame, Math.max(250, delay));
    }

    private void build(Kind kind) {
        Path p;
        switch (kind) {
            case MENU:
                p = move(6f, 9f); p.lineTo(26f, 9f); main(p);
                p = move(6f, 16f); p.lineTo(26f, 16f); main(p);
                p = move(6f, 23f); p.lineTo(26f, 23f); main(p);
                break;
            case SAVINGS_ARROW:
                p = move(24f, 8f); p.lineTo(8f, 24f);
                p.moveTo(8f, 12f); p.lineTo(8f, 24f); p.lineTo(20f, 24f); main(p);
                break;
            case MINUS:
                circle(16f, 16f, 12f, true, false);
                p = move(9f, 16f); p.lineTo(23f, 16f); main(p);
                break;
            case WEBSITE:
                circle(16f, 16f, 12f, false, false);
                p = move(4f, 16f); p.lineTo(28f, 16f); accent(p);
                p = move(6f, 10f); p.quadTo(16f, 13f, 26f, 10f);
                p.moveTo(6f, 22f); p.quadTo(16f, 19f, 26f, 22f); accent(p);
                p = move(16f, 4f); p.cubicTo(8f, 10f, 8f, 22f, 16f, 28f);
                p.moveTo(16f, 4f); p.cubicTo(24f, 10f, 24f, 22f, 16f, 28f); main(p);
                break;
            case CART:
                p = move(3.8f, 6.2f); p.quadTo(6.4f, 5.7f, 8.1f, 6.6f);
                p.lineTo(11.7f, 21.1f); p.quadTo(18.7f, 21.9f, 25.2f, 20.8f); main(p);
                p = move(9.2f, 10.1f); p.quadTo(18.5f, 9.2f, 28.1f, 10.1f);
                p.lineTo(25.7f, 18.3f); p.quadTo(18.9f, 19.5f, 11.2f, 18.9f); main(p);
                p = move(15.1f, 12.3f); p.lineTo(15.7f, 16.8f);
                p.moveTo(21.9f, 12.1f); p.lineTo(21.1f, 16.7f);
                p.moveTo(11.1f, 14.7f); p.quadTo(18.7f, 14.1f, 26.7f, 14.4f); accent(p);
                circle(13.2f, 26.1f, 1.8f, false, false);
                circle(23.5f, 25.8f, 1.8f, false, false);
                p = move(25.2f, 5.9f); p.lineTo(26.6f, 3.7f);
                p.moveTo(28.6f, 7.0f); p.lineTo(30.1f, 6.3f); accent(p);
                p = move(13.2f, 22.9f); p.quadTo(18.3f, 23.3f, 21.5f, 22.7f); echo(p);
                break;
            case CALCULATOR:
                p = move(9.1f, 4.6f); p.quadTo(17.7f, 3.6f, 23.8f, 4.9f);
                p.quadTo(26.1f, 5.3f, 25.7f, 8.1f); p.lineTo(24.8f, 25.7f);
                p.quadTo(24.8f, 28.1f, 22.2f, 27.9f); p.lineTo(8.8f, 27.3f);
                p.quadTo(6.3f, 27.2f, 6.6f, 24.6f); p.lineTo(7.4f, 7.3f);
                p.quadTo(7.4f, 5.1f, 9.1f, 4.6f); p.close(); main(p);
                p = move(10.0f, 8.2f); p.lineTo(22.3f, 8.7f); p.lineTo(22.0f, 13.2f);
                p.lineTo(9.7f, 12.8f); p.close(); accent(p);
                circle(10.8f, 17.3f, 1.0f, false, true);
                circle(16.0f, 17.4f, 1.0f, false, true);
                circle(10.6f, 22.3f, 1.0f, false, true);
                p = move(15.6f, 22.2f); p.quadTo(18.2f, 22.0f, 21.0f, 22.3f);
                p.moveTo(18.4f, 19.6f); p.lineTo(18.2f, 24.6f); accent(p);
                p = move(3.8f, 9.2f); p.lineTo(2.0f, 8.0f);
                p.moveTo(28.3f, 23.4f); p.lineTo(29.7f, 24.6f); accent(p);
                p = move(9.3f, 29.4f); p.quadTo(15.2f, 30.0f, 19.4f, 29.6f); echo(p);
                break;
            case WEIGHT:
                p = move(9.5f, 12.5f); p.quadTo(15.6f, 11.4f, 22.1f, 12.3f);
                p.quadTo(24.4f, 18.2f, 25.6f, 25.2f); p.quadTo(25.8f, 26.4f, 24.5f, 26.6f);
                p.quadTo(15.9f, 28.1f, 7.5f, 26.6f); p.quadTo(5.9f, 26.4f, 6.5f, 24.5f);
                p.quadTo(7.4f, 18.3f, 9.5f, 12.5f); p.close(); main(p);
                p = move(12.5f, 11.9f); p.cubicTo(9.6f, 6.7f, 12.1f, 3.6f, 16.3f, 4.0f);
                p.cubicTo(20.5f, 4.1f, 22.0f, 8.0f, 19.5f, 12.0f); main(p);
                p = move(11.6f, 20.6f); p.quadTo(15.8f, 17.2f, 20.7f, 20.3f);
                p.moveTo(15.9f, 17.0f); p.lineTo(16.2f, 21.1f); accent(p);
                p = move(10.5f, 24.0f); p.quadTo(15.5f, 24.9f, 20.8f, 24.0f); echo(p);
                p = move(25.4f, 8.6f); p.lineTo(27.2f, 6.8f);
                p.moveTo(4.3f, 14.5f); p.lineTo(2.4f, 13.9f); accent(p);
                break;
            case PRICE:
                p = move(5.2f, 14.3f); p.lineTo(15.7f, 4.8f);
                p.quadTo(16.7f, 3.9f, 18.0f, 4.2f); p.lineTo(25.4f, 5.0f);
                p.quadTo(27.0f, 5.1f, 27.0f, 6.7f); p.lineTo(27.6f, 14.6f);
                p.quadTo(27.8f, 15.8f, 26.7f, 16.9f); p.lineTo(16.8f, 27.3f);
                p.quadTo(15.1f, 29.0f, 13.5f, 27.4f); p.lineTo(5.3f, 18.4f);
                p.quadTo(3.5f, 16.2f, 5.2f, 14.3f); p.close(); main(p);
                circle(21.7f, 9.8f, 1.8f, true, false);
                p = move(10.9f, 18.2f); p.lineTo(14.4f, 21.3f);
                p.quadTo(17.0f, 17.8f, 20.1f, 15.0f); accent(p);
                p = move(22.6f, 7.8f); p.quadTo(25.1f, 1.1f, 29.1f, 3.1f); echo(p);
                p = move(7.2f, 20.4f); p.lineTo(12.7f, 26.6f); echo(p);
                break;
            case PLUS:
                p = move(24.9f, 7.0f); p.cubicTo(29.6f, 11.6f, 28.2f, 21.8f, 23.3f, 25.6f);
                p.cubicTo(18.2f, 29.4f, 8.9f, 27.8f, 5.6f, 21.7f);
                p.cubicTo(1.6f, 14.9f, 6.0f, 5.1f, 13.1f, 4.3f);
                p.quadTo(20.3f, 2.9f, 24.9f, 7.0f); p.close(); accent(p);
                p = move(15.9f, 9.5f); p.quadTo(16.5f, 16.0f, 15.8f, 22.8f);
                p.moveTo(9.4f, 16.4f); p.quadTo(16.0f, 15.8f, 22.9f, 16.1f); main(p);
                p = move(7.6f, 25.7f); p.quadTo(11.6f, 29.8f, 16.0f, 29.1f); echo(p);
                break;
            case TRASH:
                p = move(8.6f, 11.1f); p.lineTo(9.5f, 25.0f);
                p.quadTo(9.5f, 27.4f, 12.0f, 27.4f); p.lineTo(20.6f, 27.0f);
                p.quadTo(22.5f, 26.9f, 22.7f, 24.9f); p.lineTo(23.5f, 11.0f); main(p);
                p = move(5.0f, 8.8f); p.quadTo(16.1f, 7.5f, 27.1f, 8.7f);
                p.moveTo(11.5f, 7.9f); p.lineTo(12.1f, 4.8f);
                p.quadTo(15.9f, 3.6f, 19.9f, 4.8f); p.lineTo(20.4f, 7.8f); main(p);
                p = move(13.1f, 13.6f); p.lineTo(13.6f, 22.7f);
                p.moveTo(18.9f, 13.5f); p.lineTo(18.3f, 22.6f); accent(p);
                p = move(25.5f, 4.5f); p.lineTo(27.0f, 3.0f); accent(p);
                p = move(11.8f, 29.0f); p.quadTo(16.0f, 29.6f, 20.4f, 28.7f); echo(p);
                break;
            case RESET:
                p = move(7.2f, 11.0f); p.cubicTo(10.0f, 4.5f, 19.0f, 3.5f, 24.2f, 8.8f);
                p.cubicTo(30.2f, 15.0f, 25.5f, 25.4f, 18.3f, 27.0f);
                p.cubicTo(11.1f, 28.7f, 4.8f, 23.4f, 5.5f, 17.2f); main(p);
                p = move(7.0f, 5.1f); p.lineTo(7.2f, 11.3f); p.lineTo(13.2f, 10.2f); accent(p);
                p = move(22.5f, 24.6f); p.quadTo(17.5f, 29.1f, 12.4f, 26.8f); echo(p);
                p = move(25.6f, 4.0f); p.lineTo(27.0f, 2.5f);
                p.moveTo(28.1f, 7.0f); p.lineTo(30.0f, 6.3f); accent(p);
                break;
            case STAR:
                p = move(16.0f, 3.8f); p.quadTo(16.7f, 4.3f, 19.9f, 11.4f);
                p.lineTo(27.7f, 12.5f); p.quadTo(29.2f, 12.8f, 27.9f, 14.1f);
                p.lineTo(22.0f, 19.3f); p.lineTo(23.4f, 26.7f);
                p.quadTo(23.8f, 28.4f, 22.3f, 27.5f); p.lineTo(15.9f, 23.8f);
                p.lineTo(9.3f, 27.3f); p.quadTo(7.7f, 28.3f, 8.1f, 26.4f);
                p.lineTo(9.5f, 19.0f); p.lineTo(4.1f, 13.7f);
                p.quadTo(3.0f, 12.6f, 4.5f, 12.3f); p.lineTo(12.0f, 11.3f);
                p.lineTo(15.0f, 4.7f); p.quadTo(15.5f, 3.6f, 16.0f, 3.8f); p.close(); main(p);
                p = move(12.4f, 16.6f); p.lineTo(15.1f, 13.9f); accent(p);
                p = move(25.8f, 24.2f); p.lineTo(27.4f, 25.6f);
                p.moveTo(5.6f, 6.4f); p.lineTo(4.4f, 4.6f); accent(p);
                p = move(10.2f, 28.7f); p.lineTo(14.1f, 26.4f); echo(p);
                break;
            case HEART:
                p = move(16.0f, 27.2f); p.cubicTo(11.1f, 23.2f, 4.1f, 18.0f, 4.5f, 11.2f);
                p.cubicTo(4.9f, 4.7f, 12.5f, 3.2f, 16.1f, 9.0f);
                p.cubicTo(20.1f, 2.9f, 27.6f, 5.1f, 27.7f, 11.7f);
                p.cubicTo(27.9f, 18.1f, 21.2f, 23.8f, 16.0f, 27.2f); p.close(); main(p);
                p = move(8.1f, 11.0f); p.quadTo(8.5f, 7.4f, 11.5f, 8.4f); accent(p);
                p = move(18.0f, 24.7f); p.quadTo(22.0f, 21.6f, 24.3f, 18.1f); echo(p);
                p = move(27.3f, 4.9f); p.lineTo(28.7f, 3.4f);
                p.moveTo(3.2f, 21.5f); p.lineTo(1.9f, 22.6f); accent(p);
                break;
        }
    }

    private Path move(float x, float y) {
        Path path = new Path(); path.moveTo(x, y); return path;
    }

    private void main(Path path) { strokes.add(new Stroke(path, false, 2.0f, 255, false)); }
    private void accent(Path path) { strokes.add(new Stroke(path, true, 1.7f, 255, false)); }
    private void echo(Path path) { strokes.add(new Stroke(path, true, 1.0f, 150, false)); }

    private void circle(float x, float y, float radius, boolean secondary, boolean filled) {
        Path path = new Path(); path.addCircle(x, y, radius, Path.Direction.CW);
        strokes.add(new Stroke(path, secondary, 1.8f, 255, filled));
    }

    private static final class Stroke {
        final Path path;
        final boolean secondary;
        final float width;
        final int opacity;
        final boolean filled;
        final List<Contour> contours = new ArrayList<>();
        final float length;
        Stroke(Path path, boolean secondary, float width, int opacity, boolean filled) {
            this.path = path; this.secondary = secondary; this.width = width;
            this.opacity = opacity; this.filled = filled;
            float total = 0f;
            PathMeasure source = new PathMeasure(path, false);
            do {
                float contourLength = source.getLength();
                if (contourLength > 0f) {
                    Path contourPath = new Path();
                    source.getSegment(0f, contourLength, contourPath, true);
                    contours.add(new Contour(contourPath));
                    total += contourLength;
                }
            } while (source.nextContour());
            length = total;
        }
    }

    private static final class Contour {
        final PathMeasure measure;
        final float length;
        Contour(Path path) {
            measure = new PathMeasure(path, false);
            length = measure.getLength();
        }
    }
}
