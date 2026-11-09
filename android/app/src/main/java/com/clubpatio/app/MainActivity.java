package com.clubpatio.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15+ (targetSdk 35/36) dibuja la app de borde a borde: sin esto el
        // WebView queda bajo la barra de estado y bajo la barra de gestos, y los
        // toques en el menú inferior (Escanear, Premios, Mi perfil) se pierden.
        // El sitio no recibe safe-area-inset en el WebView de Android, así que el
        // margen lo pone el contenedor nativo.
        View raiz = findViewById(android.R.id.content);
        raiz.setBackgroundColor(Color.WHITE);
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets barras = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets teclado = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(barras.left, barras.top, barras.right, Math.max(barras.bottom, teclado.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        // Fondo blanco arriba y abajo → íconos del sistema oscuros.
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);
    }
}
