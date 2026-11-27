<script lang="ts">
  import { onMount } from 'svelte';
  import Seg from './Seg.svelte';
  import { METERS, METER_IDS, SOUND_IDS } from '../lib/metronome';
  import { BPM_MAX, BPM_MIN, clampBpm, metronome as m } from '../lib/metronome-store.svelte';
  import { audioLog, audioState, elementOutput, playbackSession, pluck, restartAudio, setElementOutput, setPlaybackSession } from '../lib/audio';
  import type { Messages } from '../i18n/ui';

  let { t }: { t: Messages['metronome'] } = $props();

  const s = m.s;
  // Bis die gespeicherten Einstellungen geladen sind, nichts zeigen – sonst blitzt kurz der Standardwert auf
  let hydrated = $state(false);
  onMount(() => (hydrated = true));

  // Fehlersuche: ?debug in der Adresse zeigt Zustand und Protokoll der Audio-Ausgabe
  let debugOn = $state(false);
  let debug = $state('');
  let copied = $state(false);
  let viaEl = $state(false);
  onMount(() => {
    if (!new URLSearchParams(location.search).has('debug')) return;
    debugOn = true;
    viaEl = elementOutput();
    let lastT = 0, lastN = 0;
    const id = setInterval(() => {
      const ac = (globalThis as { __gtAudio?: AudioContext }).__gtAudio;
      const t = ac?.currentTime ?? 0;
      const moving = ac ? (t > lastT ? 'läuft' : 'STEHT') : '–';
      const n = m.scheduled;
      debug = [
        `Version: ${__BUILD__}`,
        `AudioContext: ${audioState()} · Uhr ${t.toFixed(2)} s (${moving}) · ${ac?.sampleRate ?? '–'} Hz`,
        `Metronom läuft: ${m.running} · Klicks geplant: ${n}${m.running ? (n > lastN ? ' (+)' : ' (keine neuen!)') : ''}`,
        `Seite: ${document.visibilityState} · audioSession: ${playbackSession()} · Ausgabe: ${elementOutput() ? 'Audio-Element' : 'direkt'}`,
        `Browser: ${navigator.userAgent.replace(/^.*?\) /, '')}`,
        '',
        ...audioLog.slice(-25),
      ].join('\n');
      lastT = t;
      lastN = n;
    }, 500);
    return () => clearInterval(id);
  });
  async function copyLog() {
    try {
      await navigator.clipboard.writeText(debug + '\n\n' + audioLog.join('\n'));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }

  // Tempo direkt als Zahl eingeben: große Zahl antippen, tippen, Enter (oder wegklicken) übernimmt
  let editing = $state(false);
  let draft = $state('');
  function commitBpm() {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) s.bpm = clampBpm(n);
    editing = false;
  }
  function bpmKey(e: KeyboardEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter') el.blur();
    else if (e.key === 'Escape') {
      draft = String(s.bpm);
      el.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      s.bpm = clampBpm((parseInt(draft, 10) || s.bpm) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
      draft = String(s.bpm);
    }
  }

  let tapped = $state(false);
  function tap() {
    m.tap();
    tapped = true;
    setTimeout(() => (tapped = false), 120);
  }

  const meter = $derived(METERS[s.meter] ?? METERS['4/4']);
  const status = $derived.by(() => {
    if (!m.running) return t.ready;
    const target = s.ramp ? (s.bpm >= s.rampTarget ? ` · ${t.reached}` : ` → ${s.rampTarget}`) : '';
    return `${t.bar} ${m.bar + 1} · ${s.bpm} ${t.bpm}${target}`;
  });

  const meters = METER_IDS.map((id) => ({ value: id, label: id }));
  const subs = $derived([1, 2, 4, 3].map((v) => ({ value: v, label: t.subdivisions[v] })));
  const sounds = $derived(SOUND_IDS.map((v) => ({ value: v, label: t.sounds[v] })));

  function onkeydown(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(el.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      m.toggle();
    } else if (e.key.toLowerCase() === 't') tap();
  }
</script>

<svelte:window {onkeydown} />

<div class="grid2" class:wait={!hydrated}>
  <div class="card">
    <div class="bpm-wrap">
      <button class="round" onclick={() => (s.bpm = clampBpm(s.bpm - 1))} aria-label={t.slower}>−</button>
      <div>
        <input
          class="bpm"
          type="text"
          inputmode="numeric"
          enterkeyhint="done"
          autocomplete="off"
          maxlength="3"
          aria-label={t.bpmInput}
          title={t.bpmInput}
          value={editing ? draft : String(s.bpm)}
          onfocus={(e) => {
            editing = true;
            draft = String(s.bpm);
            (e.currentTarget as HTMLInputElement).select();
          }}
          oninput={(e) => (draft = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 3))}
          onblur={commitBpm}
          onkeydown={bpmKey}
        />
        <div class="hint">{t.bpm}</div>
      </div>
      <button class="round" onclick={() => (s.bpm = clampBpm(s.bpm + 1))} aria-label={t.faster}>+</button>
    </div>
    <input type="range" min={BPM_MIN} max={BPM_MAX} bind:value={s.bpm} aria-label={t.bpm} style="margin-top:20px" />
    <div class="dots" class:many={meter.beats > 7} aria-hidden="true">
      {#each Array(meter.beats) as _, i}
        <i class:accent={s.accent && (i === 0 || meter.accents.includes(i))} class:on={i === m.beat}></i>
      {/each}
    </div>
    <div class="row" style="justify-content:center">
      <button class="btn" class:stop={m.running} onclick={() => m.toggle()}>{m.running ? t.stop : t.start}</button>
      <button class="btn ghost tap" class:flash={tapped} onclick={tap} title={t.tapHint}>{t.tap}</button>
    </div>
    <div class="status">{status}</div>
    {#if m.muted}<button class="muted" onclick={() => {}}>{t.muted}</button>{/if}
    {#if debugOn}
      <div class="dbg-row">
        <button class="btn ghost small" onclick={() => pluck(440, 0.6, 0.5)}>Testton</button>
        <button class="btn ghost small" onclick={restartAudio}>Audio neu starten</button>
        <button class="btn ghost small" onclick={() => setPlaybackSession(playbackSession() !== 'playback')}>Lautlos-Schalter ignorieren</button>
        <button class="btn ghost small" onclick={() => { setElementOutput(!elementOutput()); viaEl = elementOutput(); }}>Ausgabe über Audio-Element: {viaEl ? 'an' : 'aus'}</button>
        <button class="btn ghost small" onclick={copyLog}>{copied ? 'Kopiert ✓' : 'Protokoll kopieren'}</button>
      </div>
      <pre class="debug">{debug}</pre>
    {/if}
  </div>

  <div class="card">
    <div class="label">{t.meter}</div>
    <Seg small items={meters} bind:value={s.meter} label={t.meter} />
    <div class="label" style="margin-top:18px">{t.subdivision}</div>
    <Seg items={subs} bind:value={s.subdivision} label={t.subdivision} />
    <div class="label" style="margin-top:18px">{t.sound}</div>
    <Seg items={sounds} bind:value={s.sound} label={t.sound} />
    <div class="label" style="margin-top:18px">{t.volume}</div>
    <div class="vol">
      <input type="range" min="0" max="150" step="5" bind:value={s.volume} aria-label={t.volume} />
      <span>{s.volume} %</span>
    </div>
    <div class="field" class:off={s.sound === 'drums'} style="margin-top:8px">
      <label for="m-accent">{t.accent}</label><input id="m-accent" type="checkbox" bind:checked={s.accent} />
    </div>

    <div class="label" style="margin-top:22px">{t.ramp}</div>
    <div class="field"><label for="m-ramp">{t.rampOn}</label><input id="m-ramp" type="checkbox" bind:checked={s.ramp} /></div>
    <div class="field" class:off={!s.ramp}><label for="m-step">{t.rampStep}</label><input id="m-step" type="number" min="1" max="50" bind:value={s.rampStep} /></div>
    <div class="field" class:off={!s.ramp}><label for="m-every">{t.rampEvery}</label><input id="m-every" type="number" min="1" max="64" bind:value={s.rampEvery} /></div>
    <div class="field" class:off={!s.ramp}><label for="m-target">{t.rampTarget}</label><input id="m-target" type="number" min={BPM_MIN} max={BPM_MAX} bind:value={s.rampTarget} /></div>
  </div>
</div>

<style>
  .wait { visibility: hidden; }
  .bpm-wrap { display: flex; align-items: center; justify-content: center; gap: 24px; }
  .bpm { all: unset; box-sizing: content-box; width: 3ch; font-size: 96px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: center; line-height: 1; color: var(--text); border-radius: 12px; cursor: text; }
  .bpm:hover { background: var(--panel2); }
  .bpm:focus { background: var(--panel2); outline: 2px solid var(--accent); outline-offset: 2px; }
  .round { all: unset; cursor: pointer; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-size: 22px; background: var(--panel); }
  .round:focus-visible { outline: 2px solid var(--accent); }
  .dots { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin: 22px 0; }
  .dots.many { gap: 8px; }
  .dots i { width: 18px; height: 18px; border-radius: 50%; background: var(--panel2); border: 1px solid var(--line); transition: background 0.05s; }
  .dots.many i { width: 14px; height: 14px; }
  .dots i.accent { border-color: var(--accent); }
  .dots i.on { background: var(--text); }
  .dots i.accent.on { background: var(--accent); }
  .btn.stop { background: var(--text); color: var(--bg); }
  .btn.tap { min-width: 90px; }
  .btn.tap.flash { background: var(--accent); color: var(--accent-ink); }
  .status { color: var(--muted); font-size: 13px; margin-top: 14px; text-align: center; font-variant-numeric: tabular-nums; }
  .field.off { opacity: 0.45; }
  .vol { display: flex; align-items: center; gap: 12px; }
  .vol span { min-width: 4.5ch; text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 14px; }
  .muted { all: unset; display: block; cursor: pointer; margin: 12px auto 0; padding: 8px 12px; border-radius: 10px; font-size: 13px; text-align: center; color: var(--text); background: color-mix(in srgb, var(--char) 18%, transparent); border: 1px solid var(--char); }
  .dbg-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .dbg-row .btn { padding: 6px 10px; font-size: 12px; }
  .debug { margin: 12px 0 0; padding: 8px; font-size: 11px; line-height: 1.4; white-space: pre-wrap; color: var(--muted); background: var(--bg); border-radius: 8px; }
  @media (max-width: 720px) {
    .bpm { font-size: 80px; }
    .row .btn { flex: 1; }
  }
</style>
