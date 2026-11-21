<script lang="ts">
  import { onMount } from 'svelte';
  import Seg from './Seg.svelte';
  import { METERS, METER_IDS, SOUND_IDS } from '../lib/metronome';
  import { BPM_MAX, BPM_MIN, clampBpm, metronome as m } from '../lib/metronome-store.svelte';
  import type { Messages } from '../i18n/ui';

  let { t }: { t: Messages['metronome'] } = $props();

  const s = m.s;
  // Bis die gespeicherten Einstellungen geladen sind, nichts zeigen – sonst blitzt kurz der Standardwert auf
  let hydrated = $state(false);
  onMount(() => (hydrated = true));

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
        <div class="bpm" aria-live="polite">{s.bpm}</div>
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
  </div>

  <div class="card">
    <div class="label">{t.meter}</div>
    <Seg small items={meters} bind:value={s.meter} label={t.meter} />
    <div class="label" style="margin-top:18px">{t.subdivision}</div>
    <Seg items={subs} bind:value={s.subdivision} label={t.subdivision} />
    <div class="label" style="margin-top:18px">{t.sound}</div>
    <Seg items={sounds} bind:value={s.sound} label={t.sound} />
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
  .bpm { font-size: 96px; font-weight: 600; font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; line-height: 1; }
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
  @media (max-width: 720px) {
    .bpm { font-size: 80px; }
    .row .btn { flex: 1; }
  }
</style>
