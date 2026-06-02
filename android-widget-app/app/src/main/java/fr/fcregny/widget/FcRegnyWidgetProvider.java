package fr.fcregny.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

public class FcRegnyWidgetProvider extends AppWidgetProvider {
  public static final String ACTION_REFRESH = "fr.fcregny.widget.action.REFRESH";

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    WidgetUpdateTask.updateAsync(context, appWidgetIds, null);
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent != null ? intent.getAction() : null;
    if (ACTION_REFRESH.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
      int[] widgetIds = intent != null ? intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS) : null;
      WidgetUpdateTask.updateAsync(context, widgetIds, goAsync());
      return;
    }

    super.onReceive(context, intent);
  }
}
