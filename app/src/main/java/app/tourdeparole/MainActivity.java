package app.tourdeparole;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Coque minimale : une WebView qui charge l'application hors ligne (assets/index.html). */
public class MainActivity extends Activity {
    private WebView web;

    /** Pont JavaScript : garde l'écran allumé pendant une session. */
    public class Bridge {
        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(new Runnable() {
                public void run() {
                    Window w = getWindow();
                    if (on) w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.parseColor("#FFF3E2"));
        getWindow().setNavigationBarColor(Color.parseColor("#FFF3E2"));
        if (getIntent().getBooleanExtra("devtools", false)) WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#FFF3E2"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient());
        /* Android 15+ (cible 35 et plus) dessine l'application sous les barres système :
           on réserve la place des barres, de l'encoche et du clavier avec un conteneur crème. */
        final FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#FFF3E2"));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                int l, t, r, bt;
                if (Build.VERSION.SDK_INT >= 30) {
                    android.graphics.Insets i = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                    l = i.left; t = i.top; r = i.right; bt = i.bottom;
                } else {
                    l = in.getSystemWindowInsetLeft(); t = in.getSystemWindowInsetTop();
                    r = in.getSystemWindowInsetRight(); bt = in.getSystemWindowInsetBottom();
                }
                v.setPadding(l, t, r, bt);
                return in;
            }
        });
        setContentView(root);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__back ? window.__back() : false", new ValueCallback<String>() {
            public void onReceiveValue(String v) {
                if (!"true".equals(v)) finish();
            }
        });
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }
}
