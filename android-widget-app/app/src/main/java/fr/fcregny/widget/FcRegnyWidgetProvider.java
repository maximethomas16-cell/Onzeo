package fr.fcregny.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

public class FcRegnyWidgetProvider extends AppWidgetProvider {
  public static final String ACTION_REFRESH = "fr.fcregny.widget.action.REFRESH";
  public static final String ACTION_STANDING_UP = "fr.fcregny.widget.action.STANDING_UP";
  public static final String ACTION_STANDING_DOWN = "fr.fcregny.widget.action.STANDING_DOWN";

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    WidgetUpdateTask.updateAsync(context, appWidgetIds, null);
  }

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
    WidgetUpdateTask.updateAsync(context, new int[] { appWidgetId }, null);
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent != null ? intent.getAction() : null;
    if (ACTION_STANDING_UP.equals(action) || ACTION_STANDING_DOWN.equals(action)) {
      int widgetId = intent != null ? intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID) : AppWidgetManager.INVALID_APPWIDGET_ID;
      if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
        WidgetRepository.shiftStandingOffset(context.getApplicationContext(), widgetId, ACTION_STANDING_DOWN.equals(action) ? 1 : -1);
        WidgetUpdateTask.updateAsync(context, new int[] { widgetId }, goAsync());
        return;
      }
    }

    if (ACTION_REFRESH.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
      int[] widgetIds = intent != null ? intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS) : null;
      WidgetUpdateTask.updateAsync(context, widgetIds, goAsync());
      return;
    }

    super.onReceive(context, intent);
  }
}
