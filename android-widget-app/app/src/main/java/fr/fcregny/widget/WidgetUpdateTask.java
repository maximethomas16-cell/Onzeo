package fr.fcregny.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class WidgetUpdateTask {
  private static final int LARGE_STANDING_WINDOW_SIZE = 4;
  private static final int MODE_COMPACT = 0;
  private static final int MODE_NORMAL = 1;
  private static final int MODE_LARGE = 2;
  private static final int[] LARGE_STANDING_ROW_IDS = new int[] {
    R.id.largeStandingRow1,
    R.id.largeStandingRow2,
    R.id.largeStandingRow3,
    R.id.largeStandingRow4,
  };
  private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

  private WidgetUpdateTask() {
  }

  static void updateAsync(Context context, int[] widgetIds, android.content.BroadcastReceiver.PendingResult pendingResult) {
    Context appContext = context.getApplicationContext();
    int[] safeIds = resolveWidgetIds(appContext, widgetIds);
    EXECUTOR.execute(() -> {
      try {
        WidgetPayload payload = null;
        Exception fetchError = null;

        try {
          payload = WidgetRepository.fetchPayload(appContext);
        } catch (Exception error) {
          fetchError = error;
          payload = WidgetRepository.loadCachedPayload(appContext);
        }

        updateWidgets(appContext, safeIds, payload, fetchError);
      } finally {
        if (pendingResult != null) {
          pendingResult.finish();
        }
      }
    });
  }

  private static void updateWidgets(Context context, int[] widgetIds, WidgetPayload payload, Exception fetchError) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    Bitmap clubBadge = WidgetRepository.loadClubBadgeBitmap(context, payload, dpToPx(context, 28));

    for (int widgetId : widgetIds) {
      int mode = resolveWidgetMode(manager.getAppWidgetOptions(widgetId));
      RemoteViews views = new RemoteViews(context.getPackageName(), layoutForMode(mode));
      bindHeader(context, views, payload, clubBadge, mode);
      bindBody(context, views, payload, mode, widgetId);
      bindFooter(context, views, fetchError, payload);
      bindActions(context, views, widgetId, mode);
      manager.updateAppWidget(widgetId, views);
    }
  }

  private static int layoutForMode(int mode) {
    if (mode == MODE_COMPACT) return R.layout.widget_fc_regny_compact;
    if (mode == MODE_LARGE) return R.layout.widget_fc_regny_large;
    return R.layout.widget_fc_regny;
  }

  private static int resolveWidgetMode(Bundle options) {
    int minWidth = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0;
    int minHeight = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) : 0;

    if (minHeight >= 260 || minWidth >= 320) {
      return MODE_LARGE;
    }

    if (minHeight <= 120 || minWidth <= 180) {
      return MODE_COMPACT;
    }

    return MODE_NORMAL;
  }

  private static void bindHeader(Context context, RemoteViews views, WidgetPayload payload, Bitmap clubBadge, int mode) {
    views.setTextViewText(R.id.widgetClubName, payload != null ? payload.clubName : context.getString(R.string.widget_label));

    String subtitle = payload != null ? payload.seasonTeam : context.getString(R.string.widget_subtitle);
    if (payload != null && !TextUtils.isEmpty(payload.seasonDivision)) {
      subtitle = mode == MODE_COMPACT ? payload.seasonDivision : subtitle + " - " + payload.seasonDivision;
    }
    views.setTextViewText(R.id.widgetSeasonTeam, subtitle);

    if (clubBadge != null) {
      views.setImageViewBitmap(R.id.widgetClubBadge, clubBadge);
    }
  }

  private static void bindBody(Context context, RemoteViews views, WidgetPayload payload, int mode, int widgetId) {
    if (mode == MODE_COMPACT) {
      bindCompactBody(context, views, payload);
      return;
    }

    if (mode == MODE_LARGE) {
      bindLargeBody(context, views, payload, widgetId);
      return;
    }

    bindNormalBody(context, views, payload);
  }

  private static void bindCompactBody(Context context, RemoteViews views, WidgetPayload payload) {
    WidgetPayload.MatchCard card = payload != null ? payload.lastMatch : null;
    views.setTextViewText(R.id.compactMatchLine, card == null ? context.getString(R.string.widget_compact_pending) : buildCompactScoreLine(card));
  }

  private static void bindNormalBody(Context context, RemoteViews views, WidgetPayload payload) {
    WidgetPayload.MatchCard lastMatch = payload != null ? payload.lastMatch : null;
    WidgetPayload.MatchCard nextMatch = payload != null ? payload.nextMatch : null;
    views.setTextViewText(R.id.normalLineOne, buildNormalLastLine(context, lastMatch));
    views.setTextViewText(R.id.normalLineTwo, buildNormalNextLine(context, nextMatch));
  }

  private static void bindLargeBody(Context context, RemoteViews views, WidgetPayload payload, int widgetId) {
    bindLargeStanding(context, views, payload != null ? payload.standing : null, payload != null ? payload.seasonTeam : null, widgetId);
    bindLastMatch(
      context,
      views,
      payload != null ? payload.lastMatch : null,
      R.id.largeLastMatchDate,
      R.id.largeLastMatchLine,
      R.id.largeLastMatchResult
    );
    bindNextMatch(
      context,
      views,
      payload != null ? payload.nextMatch : null,
      R.id.largeNextMatchDateTime,
      R.id.largeNextMatchVenue,
      R.id.largeNextMatchLine
    );
  }

  private static void bindLastMatch(Context context, RemoteViews views, WidgetPayload.MatchCard card, int dateId, int teamsId, int resultId) {
    if (card == null) {
      views.setTextViewText(dateId, context.getString(R.string.widget_missing_last));
      views.setTextViewText(teamsId, "");
      views.setTextViewText(resultId, "");
      return;
    }

    views.setTextViewText(dateId, safeDate(card.dateLabel));
    views.setTextViewText(teamsId, buildTeamsLine(card));
    views.setTextViewText(resultId, safeScore(card.scoreLine));
  }

  private static void bindNextMatch(Context context, RemoteViews views, WidgetPayload.MatchCard card, int dateTimeId, int venueId, int teamsId) {
    if (card == null) {
      views.setTextViewText(dateTimeId, context.getString(R.string.widget_missing_next));
      views.setTextViewText(venueId, "");
      views.setTextViewText(teamsId, "");
      return;
    }

    views.setTextViewText(dateTimeId, joinTextParts(safeDate(card.dateLabel), safeTime(card.timeLabel)));
    views.setTextViewText(venueId, safeVenue(card.venue));
    views.setTextViewText(teamsId, buildTeamsLine(card));
  }

  private static void bindLargeStanding(Context context, RemoteViews views, WidgetPayload.Standing standing, String seasonTeam, int widgetId) {
    String division = standing != null && !TextUtils.isEmpty(standing.division)
      ? standing.division
      : context.getString(R.string.widget_standing_label);
    String team = !TextUtils.isEmpty(seasonTeam) ? seasonTeam : context.getString(R.string.widget_label);

    views.setTextViewText(R.id.largeStandingRank, formatOrdinalRank(standing != null ? standing.rank : null));
    views.setTextViewText(R.id.largeStandingDivision, division);
    views.setTextViewText(R.id.largeStandingTeam, team);
    views.setTextViewText(
      R.id.largeStandingMeta,
      standing == null
        ? context.getString(R.string.widget_standing_empty)
        : context.getString(
          R.string.widget_standing_meta,
          safeNumber(standing.points),
          safeNumber(standing.played),
          formatGoalDifference(standing.goalDifference)
        )
    );

    WidgetPayload.StandingRow[] rows = standing != null ? standing.rows : null;
    int totalRows = rows != null ? rows.length : 0;
    int maxOffset = Math.max(0, totalRows - LARGE_STANDING_WINDOW_SIZE);
    int preferredOffset = preferredStandingOffset(rows);
    int requestedOffset = WidgetRepository.getStandingOffset(context, widgetId);
    int offset = Math.min(Math.max(0, WidgetRepository.hasStandingOffset(context, widgetId) ? requestedOffset : preferredOffset), maxOffset);
    WidgetRepository.saveStandingOffset(context, widgetId, offset);

    views.setViewVisibility(R.id.largeStandingUpAction, offset > 0 ? View.VISIBLE : View.INVISIBLE);
    views.setViewVisibility(R.id.largeStandingDownAction, offset < maxOffset ? View.VISIBLE : View.INVISIBLE);
    views.setTextViewText(
      R.id.largeStandingWindow,
      totalRows == 0
        ? context.getString(R.string.widget_standing_empty)
        : context.getString(
          R.string.widget_standing_window,
          Math.min(totalRows, offset + 1),
          Math.min(totalRows, offset + LARGE_STANDING_WINDOW_SIZE),
          totalRows
        )
    );
    views.setTextViewText(
      R.id.largeStandingLastHint,
      totalRows == 0
        ? context.getString(R.string.widget_standing_empty)
        : buildStandingTail(rows[totalRows - 1])
    );

    for (int index = 0; index < LARGE_STANDING_ROW_IDS.length; index++) {
      int viewId = LARGE_STANDING_ROW_IDS[index];
      WidgetPayload.StandingRow row = rows != null && offset + index < rows.length ? rows[offset + index] : null;

      if (row == null || TextUtils.isEmpty(row.team)) {
        views.setViewVisibility(viewId, View.GONE);
        continue;
      }

      views.setViewVisibility(viewId, View.VISIBLE);
      views.setTextViewText(viewId, buildStandingRowLine(row));
      views.setInt(viewId, "setBackgroundResource", row.tracked ? R.drawable.bg_widget_action : android.R.color.transparent);
      views.setInt(viewId, "setTextColor", row.tracked ? 0xFFFFFFFF : 0xE6FFFFFF);
    }
  }

  private static void bindFooter(Context context, RemoteViews views, Exception fetchError, WidgetPayload payload) {
    String endpoint = WidgetRepository.getEndpoint(context);
    if (WidgetRepository.isPlaceholder(endpoint)) {
      views.setTextViewText(R.id.widgetFooter, context.getString(R.string.status_placeholder));
      return;
    }

    if (fetchError != null) {
      views.setTextViewText(R.id.widgetFooter, context.getString(R.string.status_error));
      return;
    }

    views.setTextViewText(
      R.id.widgetFooter,
      payload != null && payload.widgetVersion >= 2 ? context.getString(R.string.widget_open_app) : context.getString(R.string.widget_label)
    );
  }

  private static void bindActions(Context context, RemoteViews views, int widgetId, int mode) {
    Intent openIntent = new Intent(context, MainActivity.class);
    openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent openPendingIntent = PendingIntent.getActivity(
      context,
      widgetId,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.widgetRoot, openPendingIntent);

    Intent adminIntent = new Intent(context, MainActivity.class);
    adminIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    adminIntent.putExtra(MainActivity.EXTRA_OPEN_ADMIN, true);
    PendingIntent adminPendingIntent = PendingIntent.getActivity(
      context,
      widgetId + 2000,
      adminIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.widgetAdminAction, adminPendingIntent);

    Intent refreshIntent = new Intent(context, FcRegnyWidgetProvider.class).setAction(FcRegnyWidgetProvider.ACTION_REFRESH);
    refreshIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[] { widgetId });
    PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
      context,
      widgetId + 1000,
      refreshIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.widgetRefreshAction, refreshPendingIntent);

    if (mode == MODE_LARGE) {
      Intent standingUpIntent = new Intent(context, FcRegnyWidgetProvider.class).setAction(FcRegnyWidgetProvider.ACTION_STANDING_UP);
      standingUpIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
      PendingIntent standingUpPendingIntent = PendingIntent.getBroadcast(
        context,
        widgetId + 3000,
        standingUpIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );
      views.setOnClickPendingIntent(R.id.largeStandingUpAction, standingUpPendingIntent);

      Intent standingDownIntent = new Intent(context, FcRegnyWidgetProvider.class).setAction(FcRegnyWidgetProvider.ACTION_STANDING_DOWN);
      standingDownIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
      PendingIntent standingDownPendingIntent = PendingIntent.getBroadcast(
        context,
        widgetId + 4000,
        standingDownIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );
      views.setOnClickPendingIntent(R.id.largeStandingDownAction, standingDownPendingIntent);
    }
  }

  private static String buildTeamsLine(WidgetPayload.MatchCard card) {
    return String.format(
      Locale.ROOT,
      "%s %s - %s %s",
      safeTeamName(card.homeTeam),
      formatRank(card.homeTeam.rank),
      safeTeamName(card.awayTeam),
      formatRank(card.awayTeam.rank)
    );
  }

  private static String buildCompactScoreLine(WidgetPayload.MatchCard card) {
    return String.format(
      Locale.ROOT,
      "%s - %s %s %s - %s",
      formatOrdinalRank(card.homeTeam.rank),
      safeTeamName(card.homeTeam),
      safeScore(card.scoreLine),
      safeTeamName(card.awayTeam),
      formatOrdinalRank(card.awayTeam.rank)
    );
  }

  private static String buildNormalLastLine(Context context, WidgetPayload.MatchCard card) {
    if (card == null) {
      return "Dernier: " + context.getString(R.string.widget_missing_last);
    }

    return String.format(Locale.ROOT, "Dernier | %s | %s", safeDate(card.dateLabel), buildCompactScoreLine(card));
  }

  private static String buildNormalNextLine(Context context, WidgetPayload.MatchCard card) {
    if (card == null) {
      return "Prochain: " + context.getString(R.string.widget_missing_next);
    }

    return String.format(Locale.ROOT, "Prochain | %s | %s", joinTextParts(safeDate(card.dateLabel), safeTime(card.timeLabel)), safeVenue(card.venue));
  }

  private static String buildStandingRowLine(WidgetPayload.StandingRow row) {
    return String.format(
      Locale.ROOT,
      "%s  %s  %s pts  J%s  Diff %s",
      formatOrdinalRank(row.rank),
      row.team,
      safeNumber(row.points),
      safeNumber(row.played),
      formatGoalDifference(row.goalDifference)
    );
  }

  private static String buildStandingTail(WidgetPayload.StandingRow row) {
    return String.format(
      Locale.ROOT,
      "Dernier: %s - %s - %s pts",
      formatOrdinalRank(row.rank),
      row.team,
      safeNumber(row.points)
    );
  }

  private static String formatRank(Integer rank) {
    return rank == null ? "NC" : rank + "e";
  }

  private static String safeTeamName(WidgetPayload.TeamInfo team) {
    return team == null || TextUtils.isEmpty(team.name) ? "Equipe" : team.name;
  }

  private static String safeScore(String scoreLine) {
    return TextUtils.isEmpty(scoreLine) ? "-" : scoreLine;
  }

  private static String safeDate(String dateLabel) {
    return TextUtils.isEmpty(dateLabel) ? "--/--" : dateLabel;
  }

  private static String safeTime(String timeLabel) {
    return TextUtils.isEmpty(timeLabel) ? "--:--" : timeLabel;
  }

  private static String safeVenue(String venue) {
    return TextUtils.isEmpty(venue) ? "Lieu a confirmer" : venue;
  }

  private static String joinTextParts(String... parts) {
    StringBuilder builder = new StringBuilder();
    for (String part : parts) {
      if (TextUtils.isEmpty(part)) {
        continue;
      }

      if (builder.length() > 0) {
        builder.append(" - ");
      }
      builder.append(part);
    }
    return builder.length() == 0 ? "--" : builder.toString();
  }

  private static int preferredStandingOffset(WidgetPayload.StandingRow[] rows) {
    if (rows == null || rows.length <= LARGE_STANDING_WINDOW_SIZE) {
      return 0;
    }

    for (int index = 0; index < rows.length; index++) {
      WidgetPayload.StandingRow row = rows[index];
      if (row != null && row.tracked) {
        return Math.max(0, Math.min(rows.length - LARGE_STANDING_WINDOW_SIZE, index - 2));
      }
    }

    return 0;
  }

  private static String formatOrdinalRank(Integer rank) {
    return rank == null ? "NC" : rank + "e";
  }

  private static String safeNumber(Integer value) {
    return value == null ? "--" : String.valueOf(value);
  }

  private static String formatGoalDifference(Integer value) {
    if (value == null) return "--";
    if (value > 0) return "+" + value;
    return String.valueOf(value);
  }

  private static int[] resolveWidgetIds(Context context, int[] widgetIds) {
    if (widgetIds != null && widgetIds.length > 0) return widgetIds;
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    return manager.getAppWidgetIds(new ComponentName(context, FcRegnyWidgetProvider.class));
  }

  private static int dpToPx(Context context, int dp) {
    return Math.round(dp * context.getResources().getDisplayMetrics().density);
  }
}
