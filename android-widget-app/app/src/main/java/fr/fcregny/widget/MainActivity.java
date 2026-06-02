package fr.fcregny.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

public class MainActivity extends Activity {
  private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    TextView endpointValue = findViewById(R.id.endpointValue);
    TextView statusText = findViewById(R.id.statusText);
    Button refreshButton = findViewById(R.id.refreshButton);

    endpointValue.setText(WidgetRepository.getEndpoint(this));
    statusText.setText(R.string.status_embedded);
    appWidgetId = extractWidgetId(getIntent());

    refreshButton.setOnClickListener(view -> {
      statusText.setText(R.string.status_saved);
      WidgetUpdateTask.updateAsync(this, null, null);
    });

    if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
      setResult(RESULT_CANCELED);
      WidgetUpdateTask.updateAsync(this, new int[] { appWidgetId }, null);
      Intent resultIntent = new Intent();
      resultIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
      setResult(RESULT_OK, resultIntent);
      finish();
    }
  }

  private int extractWidgetId(Intent intent) {
    if (intent == null || intent.getExtras() == null) return AppWidgetManager.INVALID_APPWIDGET_ID;
    return intent.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
  }
}
