<script lang="ts">
  import { scale } from 'svelte/transition';
  import Seg from './Seg.svelte';
  import { pluck } from '../lib/audio';
  import { load, save } from '../lib/storage';
  import { NATURALS, NOTE_NAMES, STRING_LABELS, midiOnString, midiToFreq } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, lang }: { t: Messages['finder']; lang: Lang } = $props();

  const names = $derived(NOTE_NAMES[lang]);
  const settings = $state(load('gt-finder', { strings: [true, true, true, true, true, true], all12: false, sound: true }));
  $effect(() => save('gt-finder', settings));

  let current = $state<{ note: number; string: number } | null>(null);
  let count = $state(0);
  let totalMs = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let last = 0;

  const avg = $derived(count ? (totalMs / count / 1000).toLocaleString(lang, { maximumFractionDigits: 1 }) + ' s' : '–');
  const minutes = $derived(startedAt ? Math.floor((now - startedAt) / 60000) : 0);

  function next() {
    const pool = settings.all12 ? [...Array(12).keys()] : NATURALS;
    const strs = settings.strings.flatMap((on, i) => (on ? [i] : []));
    if (!strs.length) return;
    let pick: { note: number; string: number };
    do {
      pick = { note: pool[(Math.random() * pool.length) | 0], string: strs[(Math.random() * strs.length) | 0] };
    } while (current && pick.note === current.note && pick.string === current.string && pool.length * strs.length > 1);

    const ts = performance.now();
    if (current) {
      totalMs += ts - last;
      count++;
    } else {
      startedAt = ts;
    }
    last = ts;
    now = ts;
    current = pick;
    if (settings.sound) play();
  }

  function play() {
    if (current) pluck(midiToFreq(midiOnString(current.string, current.note)));
  }

  function onkeydown(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(el.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      next();
    } else if (e.key.toLowerCase() === 'r') play();
  }
</script>

<svelte:window {onkeydown} />

<div class="grid2">
  <div class="card stage">
    <div class="note" aria-live="polite">
      {#key current}
        <span in:scale={{ start: 0.92, duration: 160 }}>{current ? names[current.note] : '?'}</span>
      {/key}
    </div>
    <p class="hint">
      {#if current}
        {t.on} <b>{t.stringNames[current.string]}</b>
      {:else}
        {t.start}
      {/if}
    </p>
    <div class="row" style="justify-content:center;margin-top:24px">
      <button class="btn" onclick={next}>{t.next}</button>
      <button class="btn ghost" onclick={play} disabled={!current}>↻ {t.repeat}</button>
    </div>
    <p class="keys">{t.keys}</p>
  </div>

  <div class="card">
    <div class="label">{t.settings}</div>
    <div class="field">
      <span>{t.strings}</span>
      <div class="seg small" role="group" aria-label={t.strings}>
        {#each STRING_LABELS[lang] as s, i}
          <button
            type="button"
            aria-pressed={settings.strings[i]}
            class:active={settings.strings[i]}
            onclick={() => (settings.strings[i] = !settings.strings[i])}>{s}</button
          >
        {/each}
      </div>
    </div>
    <div class="field">
      <span>{t.notes}</span>
      <Seg
        small
        label={t.notes}
        bind:value={settings.all12}
        items={[
          { value: false, label: t.naturals },
          { value: true, label: t.all12 },
        ]}
      />
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
  .stage { text-align: center; }
  .note { font-size: clamp(110px, 18vw, 220px); font-weight: 600; line-height: 1; margin: 10px 0; letter-spacing: -0.02em; display: grid; }
  .note span { grid-area: 1 / 1; }
  .hint b { color: var(--accent); font-weight: 600; }
  .keys { color: var(--muted); font-size: 12px; margin: 18px 0 0; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .stats div { background: var(--bg); border-radius: 10px; padding: 14px; }
  .stats strong { display: block; font-size: 22px; }
  .stats span { color: var(--muted); font-size: 13px; }
  @media (max-width: 720px) {
    .keys { display: none; }
  }
</style>
