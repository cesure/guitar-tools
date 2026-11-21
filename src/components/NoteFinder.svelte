<script lang="ts">
  import { onDestroy } from 'svelte';
  import { scale } from 'svelte/transition';
  import Seg from './Seg.svelte';
  import { pluck } from '../lib/audio';
  import { load, save } from '../lib/storage';
  import MicPanel from './MicPanel.svelte';
  import { PitchListener, type Pitch } from '../lib/pitch';
  import { NATURALS, NOTE_NAMES, STRING_LABELS, TUNING, midiToFreq } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, mic, lang }: { t: Messages['finder']; mic: Messages['mic']; lang: Lang } = $props();

  const names = $derived(NOTE_NAMES[lang]);
  const settings = $state(
    load('gt-finder', { strings: [true, true, true, true, true, true], all12: false, sound: true, mode: 'one' as 'one' | 'all' }),
  );
  $effect(() => save('gt-finder', settings));

  /* ---------- Aufgabe ---------- */
  let note = $state<number | null>(null);
  let string = $state(0); // Modus „Eine Saite“
  let step = $state(0); // Modus „Alle Saiten“: aktuelle Saite (0 = tiefe E)
  let found = $state<(number | null)[]>([null, null, null, null, null, null]);
  let flash = $state<'correct' | 'done' | null>(null);

  /** Bund des Tons auf einer Saite im Bereich 0–11 (12 gilt als gleichwertig zu 0). */
  const fretOf = (s: number, n: number) => (n - (TUNING[s] % 12) + 12) % 12;
  const targetMidis = (s: number, n: number) => {
    const f = fretOf(s, n);
    return f === 0 ? [TUNING[s], TUNING[s] + 12] : [TUNING[s] + f];
  };
  const activeString = $derived(settings.mode === 'one' ? string : step);

  /* ---------- Statistik ---------- */
  let count = $state(0);
  let totalMs = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let last = 0;
  const avg = $derived(count ? (totalMs / count / 1000).toLocaleString(lang, { maximumFractionDigits: 1 }) + ' s' : '–');
  const minutes = $derived(startedAt ? Math.floor((now - startedAt) / 60000) : 0);

  function scored() {
    const ts = performance.now();
    totalMs += ts - last;
    count++;
    last = ts;
    now = ts;
  }

  function next() {
    const pool = settings.all12 ? [...Array(12).keys()] : NATURALS;
    const strs = settings.strings.flatMap((on, i) => (on ? [i] : []));
    if (settings.mode === 'one' && !strs.length) return;
    let n: number;
    let s = string;
    do {
      n = pool[(Math.random() * pool.length) | 0];
      if (settings.mode === 'one') s = strs[(Math.random() * strs.length) | 0];
    } while (note !== null && n === note && (settings.mode === 'all' || s === string) && pool.length > 1);

    const ts = performance.now();
    if (!startedAt) startedAt = ts;
    last = ts;
    now = ts;
    note = n;
    string = s;
    step = 0;
    found = [null, null, null, null, null, null];
    flash = null;
    // Mit Mikrofon nicht automatisch vorspielen – das Mikrofon würde den Lautsprecher hören
    if (settings.sound && !micOn) play();
  }

  /** Bis zu diesem Zeitpunkt ignoriert das Mikrofon Töne (eigener Lautsprecher klingt noch nach). */
  let deafUntil = 0;
  function play() {
    if (note === null) return;
    pluck(midiToFreq(targetMidis(activeString, note)[0]));
    deafUntil = performance.now() + 2600;
  }

  /** Richtiger Ton gespielt (per Mikrofon oder „Gefunden“-Knopf). */
  function hit() {
    if (note === null || flash) return;
    scored();
    if (settings.mode === 'one') {
      flash = 'correct';
      setTimeout(next, 700);
      return;
    }
    found[step] = fretOf(step, note);
    if (step < 5) {
      step++;
      return;
    }
    flash = 'done';
    setTimeout(next, 1400);
  }

  // Modus gewechselt → neue Aufgabe
  let lastMode = settings.mode;
  $effect(() => {
    if (settings.mode !== lastMode) {
      lastMode = settings.mode;
      if (note !== null) next();
    }
  });

  /* ---------- Mikrofon ---------- */
  let heard = $state<Pitch | null>(null);
  let micOn = $state(false);
  let stable = 0;
  let stableMidi = -1;

  const listener = new PitchListener((p) => {
    heard = p;
    if (!p || Math.abs(p.cents) > 40 || performance.now() < deafUntil) {
      stable = 0;
      return;
    }
    stable = p.midi === stableMidi ? stable + 1 : 1;
    stableMidi = p.midi;
    // ~150 ms derselbe Ton → zählt
    if (stable === 3 && note !== null && targetMidis(activeString, note).includes(p.midi)) hit();
  });

  $effect(() => {
    if (!micOn) heard = null;
  });
  onDestroy(() => listener.stop());

  function onkeydown(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(el.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (settings.mode === 'all' && note !== null && !flash) hit();
      else next();
    } else if (e.key.toLowerCase() === 'r') play();
  }
</script>

<svelte:window {onkeydown} />

<div class="grid2">
  <div class="card stage" class:correct={flash !== null}>
    <div class="note" aria-live="polite">
      {#key `${note}-${string}`}
        <span in:scale={{ start: 0.92, duration: 160 }}>{note !== null ? names[note] : '?'}</span>
      {/key}
    </div>

    {#if note === null}
      <p class="hint">{t.start}</p>
    {:else if settings.mode === 'one'}
      <p class="hint">{t.on} <b>{t.stringNames[string]}</b></p>
    {:else}
      <p class="hint">{t.allTask}</p>
      <div class="steps">
        {#each STRING_LABELS[lang] as label, i}
          <div class="stepchip" class:now={i === step && flash === null} class:done={found[i] !== null}>
            <strong>{label}</strong>
            <span>{found[i] !== null ? `${t.fret} ${found[i]}` : i === step && flash === null ? '…' : ''}</span>
          </div>
        {/each}
      </div>
    {/if}

    <p class="feedback">
      {#if flash === 'correct'}{t.correct}{:else if flash === 'done'}{t.done}{:else if micOn}
        {heard ? `${t.heard}: ${names[heard.midi % 12]}${Math.floor(heard.midi / 12) - 1}` : t.listening}
      {:else}&nbsp;{/if}
    </p>

    <div class="row" style="justify-content:center">
      {#if settings.mode === 'all' && note !== null}
        <button class="btn" onclick={hit} disabled={flash !== null}>{t.found}</button>
      {:else}
        <button class="btn" onclick={next}>{t.next}</button>
      {/if}
      <button class="btn ghost" onclick={play} disabled={note === null}>↻ {t.repeat}</button>
    </div>
    <p class="keys">{t.keys}</p>
  </div>

  <div class="card">
    <div class="label">{t.mic}</div>
    <MicPanel {listener} t={mic} startLabel={t.micStart} stopLabel={t.micStop} bind:running={micOn} onstart={() => note === null && next()} />
    {#if !micOn}<p class="small">{t.micHint}</p>{/if}

    <div class="label" style="margin-top:18px">{t.settings}</div>
    <div class="field">
      <span>{t.mode}</span>
      <Seg small label={t.mode} bind:value={settings.mode} items={[{ value: 'one', label: t.modeOne }, { value: 'all', label: t.modeAll }]} />
    </div>
    <div class="field" class:off={settings.mode === 'all'}>
      <span>{t.strings}</span>
      <div class="seg small" role="group" aria-label={t.strings}>
        {#each STRING_LABELS[lang] as s, i}
          <button
            type="button"
            aria-pressed={settings.strings[i]}
            class:active={settings.strings[i]}
            disabled={settings.mode === 'all'}
            onclick={() => (settings.strings[i] = !settings.strings[i])}>{s}</button
          >
        {/each}
      </div>
    </div>
    <div class="field">
      <span>{t.notes}</span>
      <Seg small label={t.notes} bind:value={settings.all12} items={[{ value: false, label: t.naturals }, { value: true, label: t.all12 }]} />
    </div>
    <div class="field">
      <label for="finder-sound">{t.sound}</label>
      <input id="finder-sound" type="checkbox" bind:checked={settings.sound} />
    </div>

    <div class="label" style="margin-top:22px">{t.today}</div>
    <div class="stats">
      <div><strong>{count}</strong><span>{t.played}</span></div>
      <div><strong>{avg}</strong><span>{t.avg}</span></div>
      <div><strong>{minutes}</strong><span>{t.minutes}</span></div>
    </div>
  </div>
</div>

<style>
  .stage { text-align: center; transition: border-color 0.2s, background 0.2s; }
  .stage.correct { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 8%, var(--panel)); }
  .note { font-size: clamp(110px, 18vw, 200px); font-weight: 600; line-height: 1; margin: 10px 0; letter-spacing: -0.02em; display: grid; }
  .note span { grid-area: 1 / 1; }
  .correct .note { color: var(--ok); }
  .hint b { color: var(--accent); font-weight: 600; }
  .steps { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 14px 0 0; }
  .stepchip { border: 1px solid var(--line); border-radius: 10px; padding: 8px 0 6px; background: var(--bg); transition: 0.2s; }
  .stepchip strong { display: block; font-size: 18px; }
  .stepchip span { display: block; font-size: 11px; color: var(--muted); min-height: 1.3em; }
  .stepchip.now { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); }
  .stepchip.done { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent); }
  .stepchip.done span { color: var(--ok); font-weight: 600; }
  .feedback { min-height: 1.5em; margin: 14px 0; font-weight: 600; color: var(--muted); }
  .correct .feedback { color: var(--ok); }
  .keys { color: var(--muted); font-size: 12px; margin: 18px 0 0; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .small { color: var(--muted); font-size: 13px; margin: 8px 0 0; }
  .field.off { opacity: 0.45; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .stats div { background: var(--bg); border-radius: 10px; padding: 14px; }
  .stats strong { display: block; font-size: 22px; }
  .stats span { color: var(--muted); font-size: 13px; }
  @media (max-width: 720px) {
    .keys { display: none; }
    .steps { gap: 4px; }
  }
</style>
