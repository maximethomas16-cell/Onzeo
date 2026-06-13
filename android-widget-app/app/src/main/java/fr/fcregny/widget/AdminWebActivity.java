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

public class AdminWebActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_admin_web);

    TextView adminUrlLabel = findViewById(R.id.adminUrlValue);
    TextView adminStatus = findViewById(R.id.adminStatusText);
    WebView webView = findViewById(R.id.adminWebView);

    String adminUrl = WidgetRepository.getAdminUrl(this);
    adminUrlLabel.setText(adminUrl);
    adminStatus.setText(R.string.admin_loading);

    webView.getSettings().setJavaScriptEnabled(true);
    webView.getSettings().setDomStorageEnabled(true);
    webView.getSettings().setLoadsImagesAutomatically(true);
    webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
    webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
    webView.addJavascriptInterface(new AndroidWidgetAdminBridge(getApplicationContext()), "AndroidWidgetAdmin");
    webView.setWebViewClient(new WebViewClient() {
      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        adminStatus.setText(R.string.admin_loading);
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        adminStatus.setText(R.string.admin_loaded);
      }

      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request != null && request.isForMainFrame()) {
          adminStatus.setText(R.string.admin_load_error);
        }
      }
    });
    webView.loadUrl(adminUrl);
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
