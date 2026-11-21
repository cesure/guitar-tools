<script lang="ts">
  import { onDestroy } from 'svelte';
  import { pluck } from '../lib/audio';
  import { load, save } from '../lib/storage';
  import { PitchListener, type MicError, type Pitch } from '../lib/pitch';
  import { NOTE_NAMES, STRING_LABELS, TUNING, midiToFreq } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, mic, lang }: { t: Messages['tuner']; mic: Messages['mic']; lang: Lang } = $props();

  const s = $state(load('gt-tuner', { a4: 440 }));
  $effect(() => save('gt-tuner', s));

  let pitch = $state<Pitch | null>(null);
  let running = $state(false);
  let error = $state<MicError | null>(null);
  const listener = new PitchListener((p) => (pitch = p));
  $effect(() => {
    listener.a4 = Math.min(450, Math.max(430, s.a4 || 440));
  });

  async function toggle() {
    if (running) {
      listener.stop();
      running = false;
      pitch = null;
      return;
    }
    error = await listener.start();
    running = !error;
  }
  onDestroy(() => listener.stop());

  const names = $derived(NOTE_NAMES[lang]);
  const cents = $derived(pitch?.cents ?? 0);
  const inTune = $derived(pitch !== null && Math.abs(cents) <= 5);
  // Nächste Gitarrensaite zum erkannten Ton
  const nearString = $derived(
    pitch ? TUNING.reduce((best, m, i) => (Math.abs(m - pitch!.midi) < Math.abs(TUNING[best] - pitch!.midi) ? i : best), 0) : -1,
  );
  const status = $derived(!pitch ? t.play : inTune ? t.inTune : cents < 0 ? t.flat : t.sharp);

  function reference(i: number) {
    pluck(midiToFreq(TUNING[i]) * (s.a4 / 440), 2.5, 0.4);
  }
</script>

<div class="card tuner" class:ok={inTune}>
  <svg viewBox="0 0 300 170" class="gauge" aria-hidden="true">
    {#each Array(11) as _, k}
      {@const a = ((k - 5) * 9 * Math.PI) / 180}
      <line
        x1={150 + Math.sin(a) * 118} y1={150 - Math.cos(a) * 118}
        x2={150 + Math.sin(a) * (k === 5 ? 98 : 106)} y2={150 - Math.cos(a) * (k === 5 ? 98 : 106)}
        class="tick" class:center={k === 5}
      />
    {/each}
    <path d="M {150 - 118 * Math.sin(Math.PI / 36)} {150 - 118 * Math.cos(Math.PI / 36)} A 118 118 0 0 1 {150 + 118 * Math.sin(Math.PI / 36)} {150 - 118 * Math.cos(Math.PI / 36)}" class="zone" />
    <text x="40" y="160" class="scale">−50</text>
    <text x="260" y="160" class="scale">+50</text>
    <g class="needle" style:transform="rotate({pitch ? Math.max(-50, Math.min(50, cents)) * 0.9 : 0}deg)" class:idle={!pitch}>
      <line x1="150" y1="150" x2="150" y2="40" />
      <circle cx="150" cy="150" r="6" />
    </g>
  </svg>

  <div class="note" aria-live="polite">
    {#if pitch}{names[pitch.midi % 12]}<sub>{Math.floor(pitch.midi / 12) - 1}</sub>{:else}–{/if}
  </div>
  <p class="status">{running ? status : ' '}</p>
  <p class="hz">{pitch ? `${pitch.freq.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents} Cent` : ' '}</p>

  <button class="btn" class:ghost={running} onclick={toggle}>{running ? t.stop : t.start}</button>
  {#if error}<p class="error">{mic[error]}</p>{/if}
</div>

<div class="card" style="margin-top:16px">
  <div class="label">{t.strings}</div>
  <div class="strings">
    {#each STRING_LABELS[lang] as label, i}
      <button class="string" class:near={i === nearString} class:ok={i === nearString && inTune && pitch?.midi === TUNING[i]} onclick={() => reference(i)}>
        <strong>{label}</strong><span>{midiToFreq(TUNING[i]).toFixed(1)}</span>
      </button>
    {/each}
  </div>
  <div class="field" style="margin-top:12px">
    <label for="a4">{t.reference} (A)</label>
    <span><input id="a4" type="number" min="430" max="450" bind:value={s.a4} /> Hz</span>
  </div>
  <p class="privacy">{t.privacy}</p>
</div>

<style>
  .tuner { text-align: center; max-width: 520px; }
  .gauge { width: 100%; max-width: 340px; display: block; margin: 0 auto; }
  .tick { stroke: var(--muted); stroke-width: 2; stroke-linecap: round; }
  .tick.center { stroke: var(--text); stroke-width: 3; }
  .zone { fill: none; stroke: var(--ok); stroke-width: 6; opacity: 0.35; stroke-linecap: round; }
  .scale { fill: var(--muted); font-size: 11px; text-anchor: middle; }
  .needle { transform-origin: 150px 150px; transition: transform 0.15s ease-out; }
  .needle line { stroke: var(--accent); stroke-width: 3; stroke-linecap: round; }
  .needle circle { fill: var(--accent); }
  .needle.idle { opacity: 0.3; }
  .ok .needle line { stroke: var(--ok); }
  .ok .needle circle { fill: var(--ok); }
  .note { font-size: 84px; font-weight: 600; line-height: 1; margin-top: -10px; }
  .note sub { font-size: 24px; color: var(--muted); font-weight: 500; vertical-align: baseline; margin-left: 2px; }
  .ok .note { color: var(--ok); }
  .status { font-weight: 600; margin: 8px 0 0; min-height: 1.5em; }
  .ok .status { color: var(--ok); }
  .hz { color: var(--muted); font-size: 13px; margin: 2px 0 18px; font-variant-numeric: tabular-nums; }
  .error { color: #c0392b; font-size: 14px; margin: 12px 0 0; }
  .strings { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .string { all: unset; cursor: pointer; text-align: center; padding: 10px 0; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); }
  .string strong { display: block; font-size: 20px; }
  .string span { font-size: 10.5px; color: var(--muted); }
  .string.near { border-color: var(--accent); }
  .string.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 15%, transparent); }
  .string:focus-visible { outline: 2px solid var(--accent); }
  .privacy { color: var(--muted); font-size: 12px; margin: 10px 0 0; }
  .field input { width: 70px; }
</style>
