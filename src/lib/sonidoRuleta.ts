"use client";

/**
 * Sonido de la ruleta, sintetizado con Web Audio.
 *
 * Sin archivos a propósito: en la red de una feria un MP3 que no alcanza a
 * cargar deja el giro mudo justo en el momento en que toda la sala mira. Esto
 * se genera en el navegador y no depende de nada.
 *
 * OJO CON EL AUTOPLAY: los navegadores no dejan sonar audio hasta que alguien
 * interactúa con la página. Como el tótem no se toca, hace falta un click de
 * habilitación al montarlo — por eso `habilitar()` se llama desde un botón.
 */

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** ¿Puede sonar ya, o falta el click de habilitación? */
export function sonidoListo(): boolean {
  return !!ctx && ctx.state === "running";
}

/** Se llama desde un click real del operador al montar la pantalla. */
export async function habilitarSonido(): Promise<boolean> {
  const c = contexto();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    // Un pulso inaudible confirma que el contexto quedó realmente activo.
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.connect(c.destination);
    const o = c.createOscillator();
    o.connect(g);
    o.start();
    o.stop(c.currentTime + 0.01);
    return c.state === "running";
  } catch {
    return false;
  }
}

/** Click seco de la aguja pasando por un tope. */
function tic(cuando: number, volumen = 0.28) {
  const c = contexto();
  if (!c) return;
  const t = c.currentTime + cuando;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(1750, t);
  o.frequency.exponentialRampToValueAtTime(720, t + 0.035);
  g.gain.setValueAtTime(volumen, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.05);
}

/** Nota de la fanfarria. */
function nota(cuando: number, hz: number, dur: number, volumen: number) {
  const c = contexto();
  if (!c) return;
  const t = c.currentTime + cuando;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(hz, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volumen, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

/**
 * Ticks del giro, espaciándose a medida que la rueda frena.
 *
 * Los tiempos se sacan invirtiendo una curva ease-out: si se repartieran
 * parejos, el sonido seguiría acelerado mientras la rueda ya está frenando y
 * se notaría de inmediato que no corresponden.
 */
export function sonarGiro(duracionMs: number, segmentos: number) {
  if (!sonidoListo()) return;
  redoble(duracionMs);
  const total = Math.max(20, Math.min(48, segmentos * 6));
  for (let i = 1; i <= total; i++) {
    const p = i / total;
    const t = 1 - Math.pow(1 - p, 1 / 3);   // inversa de ease-out cúbico
    // Los últimos ticks suenan un poco más fuerte: es el suspenso del final.
    const vol = 0.18 + 0.16 * p;
    tic((t * duracionMs) / 1000, vol);
  }
}

/**
 * Zumbido de tensión que sube durante todo el giro.
 *
 * Es lo que sostiene la expectativa: los ticks marcan el frenado, pero solos
 * dejan un vacío que se siente como que no pasa nada. El barrido va contra el
 * frenado —sube mientras la rueda baja— y ahí es donde aprieta.
 */
function redoble(duracionMs: number) {
  const c = contexto();
  if (!c) return;
  const t = c.currentTime;
  const dur = duracionMs / 1000;

  const o = c.createOscillator();
  const g = c.createGain();
  const filtro = c.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.Q.value = 6;

  o.type = "sawtooth";
  o.frequency.setValueAtTime(55, t);
  o.frequency.exponentialRampToValueAtTime(150, t + dur * 0.92);
  filtro.frequency.setValueAtTime(220, t);
  filtro.frequency.exponentialRampToValueAtTime(1900, t + dur * 0.92);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.14, t + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  o.connect(filtro); filtro.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

/** Golpe grave que aterriza junto con el premio. */
function golpe(cuando: number) {
  const c = contexto();
  if (!c) return;
  const t = c.currentTime + cuando;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.32);
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.52);
}

/** Destellos agudos que caen sobre la fanfarria, como chispas. */
function chispas() {
  const c = contexto();
  if (!c) return;
  for (let i = 0; i < 14; i++) {
    const t = c.currentTime + 0.12 + Math.random() * 1.1;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1600 + Math.random() * 2400, t);
    g.gain.setValueAtTime(0.075, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.19);
  }
}

/** Fanfarria del ganador: golpe, arpegio, acorde mayor y chispas. */
export function sonarGanador() {
  if (!sonidoListo()) return;
  golpe(0);
  // Do mayor subiendo dos octavas: la escala más obvia que existe, que es
  // exactamente lo que se quiere cuando el mensaje es "ganaste".
  const arpegio = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  arpegio.forEach((hz, i) => nota(0.05 + i * 0.085, hz, 0.34, 0.19));
  // Acorde ancho para cerrar, con la fundamental grave sosteniendo.
  [261.63, 523.25, 659.25, 783.99, 1046.5].forEach((hz) => nota(0.5, hz, 1.5, 0.13));
  chispas();
}

/** Sonido corto al arrancar el giro. */
export function sonarArranque() {
  if (!sonidoListo()) return;
  const c = contexto();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.35);
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.42);
}
