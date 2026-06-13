package fr.fcregny.widget;

import android.content.Context;
import android.webkit.JavascriptInterface;

final class AndroidWidgetAdminBridge {
  private final Context appContext;

  AndroidWidgetAdminBridge(Context appContext) {
    this.appContext = appContext;
  }

  @JavascriptInterface
  public void saveSeasonData(String rawSeasonJson) {
    // Reserved for future native previews of the full season payload.
  }

  @JavascriptInterface
  public void saveWidgetPayload(String rawPayloadJson) {
    WidgetRepository.savePayloadOverride(appContext, rawPayloadJson);
    WidgetUpdateTask.updateAsync(appContext, null, null);
  }

  @JavascriptInterface
  public String getWidgetPayloadJson() {
    return WidgetRepository.getStoredPayloadJson(appContext);
  }
}
