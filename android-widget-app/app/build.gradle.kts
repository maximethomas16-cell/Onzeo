plugins {
  id("com.android.application")
}

val widgetEndpoint = providers.gradleProperty("widgetEndpoint")
  .orElse(providers.environmentVariable("FC_REGNY_WIDGET_ENDPOINT"))
  .orElse("https://maximethomas16-cell.github.io/fc-regny-widget-codex/widget-data.json")
  .get()

android {
  namespace = "fr.fcregny.widget"
  compileSdk = 35

  defaultConfig {
    applicationId = "fr.fcregny.widget"
    minSdk = 26
    targetSdk = 35
    versionCode = 4
    versionName = "1.0.3"
    buildConfigField("String", "WIDGET_ENDPOINT", "\"$widgetEndpoint\"")
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  buildFeatures {
    buildConfig = true
  }
}
