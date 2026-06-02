package fr.fcregny.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.text.TextUtils;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class WidgetUpdateTask {
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
    for (int widgetId : widgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_fc_regny);
      bindHeader(context, views, payload);
      bindLastMatch(context, views, payload != null ? payload.lastMatch : null);
      bindNextMatch(context, views, payload != null ? payload.nextMatch : null);
      bindFooter(context, views, fetchError, payload);
      bindActions(context, views, widgetId);
      manager.updateAppWidget(widgetId, views);
    }
  }

  private static void bindHeader(Context context, RemoteViews views, WidgetPayload payload) {
    views.setTextViewText(R.id.widgetClubName, payload != null ? payload.clubName : context.getString(R.string.widget_label));
    views.setTextViewText(R.id.widgetSeasonTeam, payload != null ? payload.seasonTeam : context.getString(R.string.widget_subtitle));
  }

  private static void bindLastMatch(Context context, RemoteViews views, WidgetPayload.MatchCard card) {
    if (card == null) {
      views.setTextViewText(R.id.lastMatchDate, context.getString(R.string.widget_missing_last));
      views.setTextViewText(R.id.lastMatchTeams, "");
      views.setTextViewText(R.id.lastMatchResult, "");
      return;
    }

    views.setTextViewText(R.id.lastMatchDate, card.dateLabel);
    views.setTextViewText(R.id.lastMatchTeams, buildTeamsLine(card));
    views.setTextViewText(R.id.lastMatchResult, card.scoreLine);
  }

  private static void bindNextMatch(Context context, RemoteViews views, WidgetPayload.MatchCard card) {
    if (card == null) {
      views.setTextViewText(R.id.nextMatchDateTime, context.getString(R.string.widget_missing_next));
      views.setTextViewText(R.id.nextMatchVenue, "");
      views.setTextViewText(R.id.nextMatchTeams, "");
      return;
    }

    String dateTime = TextUtils.join(" · ", new CharSequence[] { card.dateLabel, card.timeLabel });
    views.setTextViewText(R.id.nextMatchDateTime, dateTime);
    views.setTextViewText(R.id.nextMatchVenue, card.venue);
    views.setTextViewText(R.id.nextMatchTeams, buildTeamsLine(card));
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

  private static void bindActions(Context context, RemoteViews views, int widgetId) {
    Intent openIntent = new Intent(context, MainActivity.class);
    PendingIntent openPendingIntent = PendingIntent.getActivity(
      context,
      widgetId,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.widgetRoot, openPendingIntent);

    Intent refreshIntent = new Intent(context, FcRegnyWidgetProvider.class).setAction(FcRegnyWidgetProvider.ACTION_REFRESH);
    refreshIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[] { widgetId });
    PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
      context,
      widgetId + 1000,
      refreshIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.widgetRefreshAction, refreshPendingIntent);
  }

  private static String buildTeamsLine(WidgetPayload.MatchCard card) {
    return String.format(
      Locale.ROOT,
      "%s %s  •  %s %s",
      card.homeTeam.name,
      formatRank(card.homeTeam.rank),
      card.awayTeam.name,
      formatRank(card.awayTeam.rank)
    );
  }

  private static String formatRank(Integer rank) {
    return rank == null ? "NC" : "#" + rank;
  }

  private static int[] resolveWidgetIds(Context context, int[] widgetIds) {
    if (widgetIds != null && widgetIds.length > 0) return widgetIds;
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    return manager.getAppWidgetIds(new ComponentName(context, FcRegnyWidgetProvider.class));
  }
}
