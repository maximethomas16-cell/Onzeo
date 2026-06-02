package fr.fcregny.widget;

import android.content.Context;
import android.content.SharedPreferences;

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
  private static final String DEFAULT_ENDPOINT = BuildConfig.WIDGET_ENDPOINT;

  private WidgetRepository() {
  }

  static String getEndpoint(Context context) {
    return DEFAULT_ENDPOINT;
  }

  static void saveEndpoint(Context context, String endpoint) {
    // Endpoint is now embedded at build time and not user-editable.
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
    String raw = prefs(context).getString(KEY_CACHE, null);
    if (raw == null || raw.isEmpty()) return null;
    try {
      return parsePayload(new JSONObject(raw));
    } catch (JSONException ignored) {
      return null;
    }
  }

  static WidgetPayload fetchPayload(Context context) throws Exception {
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
    if (data == null) throw new JSONException("Champ data manquant.");

    JSONObject club = data.optJSONObject("club");
    JSONObject season = data.optJSONObject("season");

    return new WidgetPayload(
      data.optInt("widgetVersion", 0),
      club != null ? club.optString("name", "FC Régny") : "FC Régny",
      season != null ? season.optString("team", "Seniors 1") : "Seniors 1",
      parseMatchCard(data.optJSONObject("lastMatch")),
      parseMatchCard(data.optJSONObject("nextMatch"))
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
      parseTeam(card.optJSONObject("awayTeam"), "Extérieur"),
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
}
