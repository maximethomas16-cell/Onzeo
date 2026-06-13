package fr.fcregny.widget;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public class MainActivity extends Activity {
  static final String EXTRA_OPEN_ADMIN = "fr.fcregny.widget.extra.OPEN_ADMIN";
  private static final String ADMIN_PASSWORD_HASH = "72d51a99c6c1f2489087f61ebf094c89c621b0a5d6574c0f5a35fee17571d522";
  private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
  private boolean adminPromptShown = false;
  private boolean hasLoadedOnce = false;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    TextView endpointValue = findViewById(R.id.endpointValue);
    Button selectClubButton = findViewById(R.id.selectClubButton);
    Button refreshButton = findViewById(R.id.refreshButton);
    Button adminButton = findViewById(R.id.adminButton);

    endpointValue.setText(WidgetRepository.getEndpoint(this));
    statusText().setText(R.string.status_loading);
    appWidgetId = extractWidgetId(getIntent());

    selectClubButton.setOnClickListener(view -> startActivity(new Intent(this, ClubSelectionWebActivity.class)));
    refreshButton.setOnClickListener(view -> {
      statusText().setText(R.string.status_saved);
      WidgetUpdateTask.updateAsync(this, null, null);
      loadClubOverview();
    });
    adminButton.setOnClickListener(view -> showAdminPasswordDialog());

    if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
      setResult(RESULT_CANCELED);
      WidgetUpdateTask.updateAsync(this, new int[] { appWidgetId }, null);
      Intent resultIntent = new Intent();
      resultIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
      setResult(RESULT_OK, resultIntent);
      finish();
      return;
    }

    loadClubOverview();

    maybeOpenAdminFromIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    appWidgetId = extractWidgetId(intent);
    maybeOpenAdminFromIntent(intent);
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID && hasLoadedOnce) {
      loadClubOverview();
    }
    hasLoadedOnce = true;
  }

  private void loadClubOverview() {
    statusText().setText(R.string.status_loading);

    new Thread(() -> {
      WidgetPayload payload = null;
      Exception fetchError = null;

      try {
        payload = WidgetRepository.fetchPayload(getApplicationContext());
      } catch (Exception error) {
        fetchError = error;
        payload = WidgetRepository.loadCachedPayload(getApplicationContext());
      }

      Bitmap badge = WidgetRepository.loadClubBadgeBitmap(getApplicationContext(), payload, dpToPx(72));
      WidgetPayload resolvedPayload = payload;
      Exception resolvedError = fetchError;

      runOnUiThread(() -> bindClubOverview(resolvedPayload, badge, resolvedError));
    }).start();
  }

  private void bindClubOverview(WidgetPayload payload, Bitmap badge, Exception fetchError) {
    ImageView clubBadgeView = findViewById(R.id.clubBadgeView);
    TextView clubNameView = findViewById(R.id.clubNameView);
    TextView clubMetaView = findViewById(R.id.clubMetaView);

    if (badge != null) {
      clubBadgeView.setImageBitmap(badge);
    }

    String clubName = payload != null ? payload.clubName : getString(R.string.widget_label);
    String clubMeta = payload != null ? payload.seasonTeam : getString(R.string.widget_subtitle);
    if (payload != null && payload.seasonDivision != null && !payload.seasonDivision.isEmpty()) {
      clubMeta = clubMeta + " · " + payload.seasonDivision;
    }

    clubNameView.setText(clubName);
    clubMetaView.setText(clubMeta);

    if (fetchError != null && payload == null) {
      statusText().setText(R.string.status_error);
      return;
    }

    if (fetchError != null) {
      statusText().setText(R.string.status_cached);
      return;
    }

    statusText().setText(R.string.status_embedded);
  }

  private void showAdminPasswordDialog() {
    if (adminPromptShown) {
      return;
    }
    adminPromptShown = true;

    EditText input = new EditText(this);
    input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
    input.setHint(R.string.admin_password_hint);
    input.setTextColor(getColor(R.color.inputText));
    input.setHintTextColor(getColor(R.color.inputHint));
    input.setBackgroundResource(R.drawable.bg_input);
    input.setSaveEnabled(false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      input.setImportantForAutofill(EditText.IMPORTANT_FOR_AUTOFILL_NO);
      input.setAutofillHints((String[]) null);
    }
    int horizontalPadding = dpToPx(14);
    int verticalPadding = dpToPx(12);
    input.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);

    TextView titleView = new TextView(this);
    titleView.setText(R.string.admin_dialog_title);
    titleView.setTextColor(getColor(R.color.inputText));
    titleView.setTextSize(20);
    titleView.setTypeface(titleView.getTypeface(), android.graphics.Typeface.BOLD);

    TextView messageView = new TextView(this);
    messageView.setText(R.string.admin_dialog_message);
    messageView.setTextColor(getColor(R.color.inputText));
    messageView.setTextSize(16);

    LinearLayout container = new LinearLayout(this);
    container.setOrientation(LinearLayout.VERTICAL);
    int margin = dpToPx(8);
    int spacing = dpToPx(14);
    container.setPadding(margin, margin, margin, 0);
    container.addView(titleView, new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ));
    LinearLayout.LayoutParams messageLayoutParams = new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    );
    messageLayoutParams.topMargin = dpToPx(10);
    container.addView(messageView, messageLayoutParams);
    LinearLayout.LayoutParams inputLayoutParams = new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    );
    inputLayoutParams.topMargin = spacing;
    container.addView(input, inputLayoutParams);

    AlertDialog dialog = new AlertDialog.Builder(this)
      .setView(container)
      .setNegativeButton(android.R.string.cancel, null)
      .setPositiveButton(R.string.admin_open_button, (dialogInterface, which) -> {
        String password = input.getText() == null ? "" : input.getText().toString();
        if (isValidAdminPassword(password)) {
          statusText().setText(R.string.admin_access_granted);
          startActivity(new Intent(this, AdminWebActivity.class));
          return;
        }

        statusText().setText(R.string.admin_access_denied);
      })
      .setOnDismissListener(dialogInterface -> adminPromptShown = false)
      .create();
    dialog.setOnShowListener(dialogInterface -> {
      dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(getColor(R.color.inputText));
      dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(getColor(R.color.inputText));
    });
    dialog.show();
  }

  private int extractWidgetId(Intent intent) {
    if (intent == null || intent.getExtras() == null) return AppWidgetManager.INVALID_APPWIDGET_ID;
    return intent.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
  }

  private void maybeOpenAdminFromIntent(Intent intent) {
    if (intent == null || !intent.getBooleanExtra(EXTRA_OPEN_ADMIN, false) || adminPromptShown) {
      return;
    }
    showAdminPasswordDialog();
  }

  private boolean isValidAdminPassword(String password) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(String.valueOf(password).getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder();
      for (byte value : hash) {
        builder.append(String.format("%02x", value));
      }
      return ADMIN_PASSWORD_HASH.equals(builder.toString());
    } catch (Exception error) {
      return false;
    }
  }

  private TextView statusText() {
    return findViewById(R.id.statusText);
  }

  private int dpToPx(int dp) {
    return Math.round(dp * getResources().getDisplayMetrics().density);
  }
}
