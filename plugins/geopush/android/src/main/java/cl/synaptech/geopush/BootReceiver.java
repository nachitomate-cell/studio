package cl.synaptech.geopush;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Android olvida las geocercas al reiniciar o al actualizar la app: se vuelven a registrar. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            GeoPushGeocercas.registrar(context);
        }
    }
}
