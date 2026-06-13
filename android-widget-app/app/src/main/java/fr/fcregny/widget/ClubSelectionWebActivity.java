package fr.fcregny.widget;

import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

public class ClubSelectionWebActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_admin_web);

    TextView urlLabelTitle = findViewById(R.id.adminUrlTitle);
    TextView urlLabelValue = findViewById(R.id.adminUrlValue);
    TextView statusView = findViewById(R.id.adminStatusText);
    TextView titleView = findViewById(R.id.adminScreenTitle);
    WebView webView = findViewById(R.id.adminWebView);

    String selectorUrl = WidgetRepository.getSelectorUrl(this);
    titleView.setText(R.string.selector_title);
    urlLabelTitle.setText(R.string.selector_url_label);
    urlLabelValue.setText(selectorUrl);
    statusView.setText(R.string.selector_loading);

    webView.getSettings().setJavaScriptEnabled(true);
    webView.getSettings().setDomStorageEnabled(true);
    webView.getSettings().setLoadsImagesAutomatically(true);
    webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
    webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
    webView.addJavascriptInterface(new AndroidWidgetAdminBridge(getApplicationContext()), "AndroidWidgetAdmin");
    webView.setWebViewClient(new WebViewClient() {
      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        statusView.setText(R.string.selector_loading);
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        statusView.setText(R.string.selector_loaded);
      }

      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request != null && request.isForMainFrame()) {
          statusView.setText(R.string.selector_load_error);
        }
      }
    });
    webView.loadUrl(selectorUrl);
  }

  @Override
  public void onBackPressed() {
    WebView webView = findViewById(R.id.adminWebView);
    if (webView != null && webView.canGoBack()) {
      webView.goBack();
      return;
    }
    super.onBackPressed();
  }
}
