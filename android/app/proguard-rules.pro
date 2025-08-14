# Keep OkHttp
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**

# Keep kotlinx.serialization
-keep class kotlinx.serialization.** { *; }
-dontwarn kotlinx.serialization.**

# ZXing core
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**
