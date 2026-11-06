# Room/WorkManager instantiate these entry points reflectively in release builds.
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}
-keep class dev.faris.knockernative.RenewWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}
