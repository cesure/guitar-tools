<script lang="ts">
  import { onDestroy } from 'svelte';
  import Seg from './Seg.svelte';
  import { Metronome } from '../lib/metronome';
  import { load, save } from '../lib/storage';
  import type { Messages } from '../i18n/ui';

  let { t }: { t: Messages['metronome'] } = $props();

  const s = $state(
    load('gt-metronome', { bpm: 96, beats: 4, subdivision: 1, ramp: false, rampStep: 5, rampEvery: 4, rampTarget: 140 }),
  );
  $effect(() => save('gt-metronome', s));

  let running = $state(false);
  let beat = $state(-1);
  let bar = $state(0);
  let wakeLock: WakeLockSentinel | null = null;

  const clamp = (v: number) => Math.max(30, Math.min(300, Math.round(v) || 30));

  const metro = new Metronome({
    onBeat: (b) => (beat = b),
    onBar: (n) => {
      bar = n;
      if (s.ramp && s.rampEvery > 0 && n % s.rampEvery === 0 && s.bpm < s.rampTarget) {
        s.bpm = Math.min(s.rampTarget, s.bpm + s.rampStep);
      }
    },
  });

  // Einstellungen live an das Metronom weitergeben
  $effect(() => {
    metro.bpm = clamp(s.bpm);
    metro.beats = s.beats;
    metro.subdivision = s.subdivision;
    metro.secondaryAccents = s.beats === 6 ? [3] : []; // 6/8 wird in zwei Gruppen gefühlt
  });

  async function toggle() {
    if (running) {
      metro.stop();
      running = false;
      beat = -1;
      await wakeLock?.release().catch(() => {});
      wakeLock = null;
    } else {
      bar = 0;
      metro.start();
      running = true;
      // Bildschirm am Handy anlassen, solange das Metronom läuft
      wakeLock = await navigator.wakeLock?.request('screen').catch(() => null);
    }
  }

  onDestroy(() => metro.stop());

  const status = $derived.by(() => {
    if (!running) return t.ready;
    const target = s.ramp ? (s.bpm >= s.rampTarget ? ` · ${t.reached}` : ` → ${s.rampTarget}`) : '';
    return `${t.bar} ${bar + 1} · ${s.bpm} ${t.bpm}${target}`;
  });

  const meters = [
    { value: 4, label: '4/4' },
    { value: 3, label: '3/4' },
    { value: 6, label: '6/8' },
  ];
  const subs = $derived([1, 2, 4, 3].map((v) => ({ value: v, label: t.subdivisions[v] })));
</script>

<div class="grid2">
  <div class="card">
    <div class="bpm-wrap">
      <button class="round" onclick={() => (s.bpm = clamp(s.bpm - 1))} aria-label={t.slower}>−</button>
      <div>
        <div class="bpm" aria-live="polite">{s.bpm}</div>
        <div class="hint">{t.bpm}</div>
      </div>
      <button class="round" onclick={() => (s.bpm = clamp(s.bpm + 1))} aria-label={t.faster}>+</button>
    </div>
    <input type="range" min="30" max="300" bind:value={s.bpm} aria-label={t.bpm} style="margin-top:20px" />
    <div class="dots" aria-hidden="true">
      {#each Array(s.beats) as _, i}
        <i class:accent={i === 0 || (s.beats === 6 && i === 3)} class:on={i === beat}></i>
      {/each}
    </div>
    <div class="row" style="justify-content:center">
      <button class="btn" class:stop={running} onclick={toggle}>{running ? t.stop : t.start}</button>
    </div>
    <div class="status">{status}</div>
  </div>

  <div class="card">
    <div class="label">{t.meter}</div>
    <Seg items={meters} bind:value={s.beats} label={t.meter} />
    <div class="label" style="margin-top:18px">{t.subdivision}</div>
    <Seg items={subs} bind:value={s.subdivision} label={t.subdivision} />

    <div class="label" style="margin-top:22px">{t.ramp}</div>
    <div class="field"><label for="m-ramp">{t.rampOn}</label><input id="m-ramp" type="checkbox" bind:checked={s.ramp} /></div>
    <div class="field" class:off={!s.ramp}><label for="m-step">{t.rampStep}</label><input id="m-step" type="number" min="1" max="50" bind:value={s.rampStep} /></div>
    <div class="field" class:off={!s.ramp}><label for="m-every">{t.rampEvery}</label><input id="m-every" type="number" min="1" max="64" bind:value={s.rampEvery} /></div>
    <div class="field" class:off={!s.ramp}><label for="m-target">{t.rampTarget}</label><input id="m-target" type="number" min="30" max="300" bind:value={s.rampTarget} /></div>
  </div>
</div>

<style>
  .bpm-wrap { display: flex; align-items: center; justify-content: center; gap: 24px; }
  .bpm { font-size: 96px; font-weight: 600; font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; line-height: 1; }
  .round { all: unset; cursor: pointer; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-size: 22px; background: var(--panel); }
  .round:focus-visible { outline: 2px solid var(--accent); }
  .dots { display: flex; gap: 12px; justify-content: center; margin: 22px 0; }
  .dots i { width: 18px; height: 18px; border-radius: 50%; background: var(--panel2); border: 1px solid var(--line); transition: background 0.05s; }
  .dots i.accent { border-color: var(--accent); }
  .dots i.on { background: var(--text); }
  .dots i.accent.on { background: var(--accent); }
  .btn.stop { background: var(--text); color: var(--bg); }
  .status { color: var(--muted); font-size: 13px; margin-top: 14px; text-align: center; font-variant-numeric: tabular-nums; }
  .field.off { opacity: 0.45; }
  @media (max-width: 720px) {
    .bpm { font-size: 80px; }
    .row .btn { flex: 1; }
  }
</style>
