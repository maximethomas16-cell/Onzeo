package fr.fcregny.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class WidgetRepository {
  private static final String PREFS = "fc_regny_widget_prefs";
  private static final String KEY_CACHE = "cache_json";
  private static final String KEY_OVERRIDE_PAYLOAD = "override_payload_json";
  private static final String KEY_STANDING_OFFSET_PREFIX = "standing_offset_";
  private static final String DEFAULT_ENDPOINT = BuildConfig.WIDGET_ENDPOINT;

  private WidgetRepository() {
  }

  static String getEndpoint(Context context) {
    return DEFAULT_ENDPOINT;
  }

  static String getAdminUrl(Context context) {
    String endpoint = getEndpoint(context);
    if (endpoint == null || endpoint.isEmpty()) {
      return "https://maximethomas16-cell.github.io/Onzeo/admin.html";
    }

    if (endpoint.endsWith("/widget-data.json")) {
      return endpoint.substring(0, endpoint.length() - "/widget-data.json".length()) + "/admin.html";
    }

    if (endpoint.endsWith("/api/public/widget")) {
      return endpoint.substring(0, endpoint.length() - "/api/public/widget".length()) + "/admin.html";
    }

    if (endpoint.endsWith("/")) {
      return endpoint + "admin.html";
    }

    return endpoint + "/admin.html";
  }

  static String getSelectorUrl(Context context) {
    String endpoint = getEndpoint(context);
    if (endpoint == null || endpoint.isEmpty()) {
      return "https://maximethomas16-cell.github.io/Onzeo/selector.html";
    }

    if (endpoint.endsWith("/widget-data.json")) {
      return endpoint.substring(0, endpoint.length() - "/widget-data.json".length()) + "/selector.html";
    }

    if (endpoint.endsWith("/api/public/widget")) {
      return endpoint.substring(0, endpoint.length() - "/api/public/widget".length()) + "/selector.html";
    }

    if (endpoint.endsWith("/")) {
      return endpoint + "selector.html";
    }

    return endpoint + "/selector.html";
  }

  static void saveEndpoint(Context context, String endpoint) {
    // Endpoint is now embedded at build time and not user-editable.
  }

  static void savePayloadOverride(Context context, String rawPayload) {
    if (rawPayload == null || rawPayload.trim().isEmpty()) {
      prefs(context).edit().remove(KEY_OVERRIDE_PAYLOAD).apply();
      return;
    }
    prefs(context).edit().putString(KEY_OVERRIDE_PAYLOAD, rawPayload).apply();
  }

  static int getStandingOffset(Context context, int widgetId) {
    return prefs(context).getInt(KEY_STANDING_OFFSET_PREFIX + widgetId, 0);
  }

  static boolean hasStandingOffset(Context context, int widgetId) {
    return prefs(context).contains(KEY_STANDING_OFFSET_PREFIX + widgetId);
  }

  static void shiftStandingOffset(Context context, int widgetId, int delta) {
    int next = Math.max(0, getStandingOffset(context, widgetId) + delta);
    prefs(context).edit().putInt(KEY_STANDING_OFFSET_PREFIX + widgetId, next).apply();
  }

  static void saveStandingOffset(Context context, int widgetId, int offset) {
    prefs(context).edit().putInt(KEY_STANDING_OFFSET_PREFIX + widgetId, Math.max(0, offset)).apply();
  }

  static Bitmap loadClubBadgeBitmap(Context context, WidgetPayload payload, int sizePx) {
    if (payload == null) {
      return ClubBadgeRenderer.createFallback("Club", sizePx);
    }

    String logoUrl = resolveLogoUrl(getEndpoint(context), payload.clubLogoPath);
    if (!logoUrl.isEmpty()) {
      try {
        return ClubBadgeRenderer.loadRemote(logoUrl, sizePx);
      } catch (Exception ignored) {
        // Fall back to generated club initials.
      }
    }

    return ClubBadgeRenderer.createFallback(payload.clubName, sizePx);
  }

  static String normalizeEndpoint(String raw) {
    String value = raw == null ? "" : raw.trim();
    if (value.isEmpty()) return "";
    if (!(value.startsWith("http://") || value.startsWith("https://"))) return "";
    if (value.endsWith("/api/public/widget")) return value;
    if (value.endsWith("/")) return value + "api/public/widget";
    if (value.contains("/api/public/widget")) return value;
    return value + "/api/public/widget";
  }

  static boolean isPlaceholder(String endpoint) {
    return endpoint == null || endpoint.isEmpty() || endpoint.contains("votre-domaine-club.fr");
  }

  static WidgetPayload loadCachedPayload(Context context) {
    String override = prefs(context).getString(KEY_OVERRIDE_PAYLOAD, null);
    if (override != null && !override.isEmpty()) {
      try {
        return parsePayload(new JSONObject(override));
      } catch (JSONException ignored) {
        // Ignore invalid override payloads and continue with cache.
      }
    }

    String raw = prefs(context).getString(KEY_CACHE, null);
    if (raw == null || raw.isEmpty()) return null;
    try {
      return parsePayload(new JSONObject(raw));
    } catch (JSONException ignored) {
      return null;
    }
  }

  static String getStoredPayloadJson(Context context) {
    String override = prefs(context).getString(KEY_OVERRIDE_PAYLOAD, null);
    if (override != null && !override.trim().isEmpty()) {
      return override;
    }

    String raw = prefs(context).getString(KEY_CACHE, null);
    return raw == null ? "" : raw;
  }

  static WidgetPayload fetchPayload(Context context) throws Exception {
    String override = prefs(context).getString(KEY_OVERRIDE_PAYLOAD, null);
    if (override != null && !override.isEmpty()) {
      return parsePayload(new JSONObject(override));
    }

    String endpoint = getEndpoint(context);
    if (endpoint == null || endpoint.isEmpty()) {
      throw new IllegalStateException("URL de flux widget absente.");
    }

    HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
    connection.setRequestMethod("GET");
    connection.setConnectTimeout(8000);
    connection.setReadTimeout(8000);
    connection.setRequestProperty("Accept", "application/json");

    int statusCode = connection.getResponseCode();
    InputStream stream = statusCode >= 200 && statusCode < 300 ? connection.getInputStream() : connection.getErrorStream();
    String body = readFully(stream);
    if (statusCode < 200 || statusCode >= 300) {
      throw new IllegalStateException(body.isEmpty() ? "Erreur HTTP " + statusCode : body);
    }

    prefs(context).edit().putString(KEY_CACHE, body).apply();
    return parsePayload(new JSONObject(body));
  }

  private static WidgetPayload parsePayload(JSONObject root) throws JSONException {
    JSONObject data = root.optJSONObject("data");
    if (data == null) {
      data = root;
    }
    if (data == null) {
      throw new JSONException("Champ data manquant.");
    }

    JSONObject club = data.optJSONObject("club");
    JSONObject season = data.optJSONObject("season");

    return new WidgetPayload(
      data.optInt("widgetVersion", 0),
      club != null ? club.optString("name", "FC Regny") : "FC Regny",
      club != null ? club.optString("fullName", "") : "",
      club != null ? club.optString("logoPath", "") : "",
      season != null ? season.optString("team", "Seniors 1") : "Seniors 1",
      season != null ? season.optString("division", "") : "",
      parseStanding(data.optJSONObject("standing")),
      parseMatchCard(data.optJSONObject("lastMatch")),
      parseMatchCard(data.optJSONObject("nextMatch"))
    );
  }

  private static WidgetPayload.Standing parseStanding(JSONObject standing) {
    if (standing == null) return null;

    JSONArray rowsJson = standing.optJSONArray("rows");
    WidgetPayload.StandingRow[] rows = new WidgetPayload.StandingRow[rowsJson != null ? rowsJson.length() : 0];
    for (int index = 0; index < rows.length; index++) {
      JSONObject row = rowsJson.optJSONObject(index);
      rows[index] = row == null
        ? null
        : new WidgetPayload.StandingRow(
          row.has("rank") && !row.isNull("rank") ? row.optInt("rank") : null,
          row.optString("team", ""),
          row.has("points") && !row.isNull("points") ? row.optInt("points") : null,
          row.has("played") && !row.isNull("played") ? row.optInt("played") : null,
          row.has("goalDifference") && !row.isNull("goalDifference") ? row.optInt("goalDifference") : null,
          row.optBoolean("tracked", false)
        );
    }

    return new WidgetPayload.Standing(
      standing.has("rank") && !standing.isNull("rank") ? standing.optInt("rank") : null,
      standing.has("points") && !standing.isNull("points") ? standing.optInt("points") : null,
      standing.has("played") && !standing.isNull("played") ? standing.optInt("played") : null,
      standing.has("goalDifference") && !standing.isNull("goalDifference") ? standing.optInt("goalDifference") : null,
      standing.optString("division", ""),
      rows
    );
  }

  private static WidgetPayload.MatchCard parseMatchCard(JSONObject card) {
    if (card == null) return null;
    return new WidgetPayload.MatchCard(
      card.optString("title", ""),
      card.optString("competition", ""),
      card.optString("kickoffDateLabel", ""),
      card.optString("kickoffTimeLabel", ""),
      card.optString("venue", ""),
      card.optString("scoreLine", ""),
      parseTeam(card.optJSONObject("homeTeam"), "Domicile"),
      parseTeam(card.optJSONObject("awayTeam"), "Exterieur"),
      card.optBoolean("isFinished", false)
    );
  }

  private static WidgetPayload.TeamInfo parseTeam(JSONObject team, String fallbackName) {
    if (team == null) return new WidgetPayload.TeamInfo(fallbackName, null);
    Integer rank = team.has("rank") && !team.isNull("rank") ? team.optInt("rank") : null;
    return new WidgetPayload.TeamInfo(team.optString("name", fallbackName), rank);
  }

  private static String readFully(InputStream stream) throws Exception {
    if (stream == null) return "";
    try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
      StringBuilder builder = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) {
        builder.append(line);
      }
      return builder.toString();
    }
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  private static String resolveLogoUrl(String endpoint, String logoPath) {
    String rawPath = logoPath == null ? "" : logoPath.trim();
    if (rawPath.isEmpty()) {
      return "";
    }

    try {
      return new URL(new URL(endpoint), rawPath).toString();
    } catch (Exception ignored) {
      return "";
    }
  }
}
