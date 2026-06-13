package fr.fcregny.widget;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

final class ClubBadgeRenderer {
  private ClubBadgeRenderer() {
  }

  static Bitmap loadRemote(String urlString, int sizePx) throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
    connection.setConnectTimeout(8000);
    connection.setReadTimeout(8000);
    connection.setRequestProperty("Accept", "image/*");

    int statusCode = connection.getResponseCode();
    if (statusCode < 200 || statusCode >= 300) {
      throw new IllegalStateException("Erreur logo HTTP " + statusCode);
    }

    try (InputStream stream = connection.getInputStream()) {
      Bitmap source = BitmapFactory.decodeStream(stream);
      if (source == null) {
        throw new IllegalStateException("Logo club invalide.");
      }
      return Bitmap.createScaledBitmap(source, sizePx, sizePx, true);
    }
  }

  static Bitmap createFallback(String clubName, int sizePx) {
    Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(bitmap);

    Paint background = new Paint(Paint.ANTI_ALIAS_FLAG);
    background.setShader(
      new LinearGradient(
        0,
        0,
        sizePx,
        sizePx,
        0xFFFFB347,
        0xFF183064,
        Shader.TileMode.CLAMP
      )
    );

    float corner = sizePx * 0.26f;
    RectF outer = new RectF(0, 0, sizePx, sizePx);
    canvas.drawRoundRect(outer, corner, corner, background);

    Paint inner = new Paint(Paint.ANTI_ALIAS_FLAG);
    inner.setColor(0x1AFFFFFF);
    RectF inset = new RectF(sizePx * 0.08f, sizePx * 0.08f, sizePx * 0.92f, sizePx * 0.92f);
    canvas.drawRoundRect(inset, corner * 0.8f, corner * 0.8f, inner);

    Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    stroke.setStyle(Paint.Style.STROKE);
    stroke.setStrokeWidth(Math.max(2f, sizePx * 0.02f));
    stroke.setColor(0x40FFFFFF);
    canvas.drawRoundRect(inset, corner * 0.8f, corner * 0.8f, stroke);

    Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    text.setColor(0xFFFFF8F1);
    text.setTextAlign(Paint.Align.CENTER);
    text.setFakeBoldText(true);
    text.setTextSize(sizePx * 0.34f);

    String initials = initialsFor(clubName);
    Rect textBounds = new Rect();
    text.getTextBounds(initials, 0, initials.length(), textBounds);
    float centerY = (sizePx / 2f) - textBounds.exactCenterY();
    canvas.drawText(initials, sizePx / 2f, centerY, text);

    return bitmap;
  }

  private static String initialsFor(String clubName) {
    String[] rawTokens = String.valueOf(clubName == null ? "" : clubName).trim().split("\\s+");
    StringBuilder builder = new StringBuilder();

    for (String token : rawTokens) {
      String cleaned = token.replaceAll("[^A-Za-z0-9]", "");
      if (cleaned.isEmpty()) {
        continue;
      }

      String upper = cleaned.toUpperCase(Locale.ROOT);
      if (
        "FC".equals(upper) ||
        "AS".equals(upper) ||
        "US".equals(upper) ||
        "SC".equals(upper) ||
        "CLUB".equals(upper) ||
        "DE".equals(upper) ||
        "DU".equals(upper) ||
        "DES".equals(upper) ||
        "LA".equals(upper) ||
        "LE".equals(upper) ||
        "LES".equals(upper)
      ) {
        continue;
      }

      builder.append(upper.charAt(0));
      if (builder.length() == 2) {
        break;
      }
    }

    if (builder.length() == 0) {
      builder.append("C");
    }
    if (builder.length() == 1) {
      builder.append("L");
    }
    return builder.toString();
  }
}
