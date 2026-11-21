<script lang="ts">
  import Seg from './Seg.svelte';
  import ChordDiagram from './ChordDiagram.svelte';
  import { pluck } from '../lib/audio';
  import { load, save } from '../lib/storage';
  import { CHORDS, ROOT_NAMES, TUNING, chordPitchClasses, midiToFreq, spelling, type Chord } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, lang }: { t: Messages['chords']; lang: Lang } = $props();

  const s = $state(load('gt-chords', { filter: 'basic', labels: 'fingers' as 'fingers' | 'notes' }));
  $effect(() => save('gt-chords', s));

  const filters = ['basic', 'major', 'minor', 'seventh', 'variant', 'all'];
  const visible = $derived(
    CHORDS.filter((c) => (s.filter === 'all' ? true : s.filter === 'basic' ? c.basic : c.group === s.filter)),
  );
  const rootNames = $derived(ROOT_NAMES[lang]);
  /** Tonnamen passend zum Akkord (C7 → B statt A♯). Dur-, Moll- bzw. Sept-Tonart als Grundlage. */
  const namesFor = (c: Chord) => spelling(lang, c.root, c.quality === 'm' ? 'minor' : c.quality === '7' ? 'mixolydian' : 'major');

  const chordName = (c: Chord) => `${rootNames[c.root]}${c.quality}`;
  let playing = $state<string | null>(null);

  /** Akkord von der tiefsten zur höchsten Saite anschlagen. */
  function strum(c: Chord) {
    let k = 0;
    c.frets.forEach((f, i) => {
      if (f === null) return;
      pluck(midiToFreq(TUNING[i] + f), 2.2, 0.2, k++ * 0.035);
    });
    playing = chordName(c);
    setTimeout(() => playing === chordName(c) && (playing = null), 600);
  }
</script>

<div class="card controls">
  <div><div class="label">{t.filter}</div><Seg items={filters.map((f) => ({ value: f, label: t.groups[f] }))} bind:value={s.filter} label={t.filter} /></div>
  <div><div class="label">{t.labels}</div><Seg items={[{ value: 'fingers', label: t.fingers }, { value: 'notes', label: t.notes }]} bind:value={s.labels} label={t.labels} /></div>
</div>

<div class="grid">
  {#each visible as c (chordName(c))}
    <button class="chord card" class:playing={playing === chordName(c)} onclick={() => strum(c)} aria-label="{chordName(c)} – {t.play}">
      <div class="head">
        <span class="name">{chordName(c)}</span>
        <span class="quality">{t.qualities[c.quality]}</span>
      </div>
      <ChordDiagram chord={c} labels={s.labels} names={namesFor(c)} />
      <div class="tones">{chordPitchClasses(c).map((pc) => namesFor(c)[pc]).join(' · ')}</div>
    </button>
  {/each}
</div>

<p class="legend">{t.legend}</p>

<style>
  .controls { display: flex; flex-wrap: wrap; gap: 18px 28px; margin-bottom: 16px; }
  .controls > div { min-width: 0; max-width: 100%; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .chord { all: unset; box-sizing: border-box; cursor: pointer; padding: 14px 12px 12px; text-align: center; transition: transform 0.1s, border-color 0.2s; }
  .chord:hover { border-color: var(--accent); }
  .chord:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .chord.playing { transform: scale(0.98); border-color: var(--accent); }
  .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .name { font-size: 22px; font-weight: 700; }
  .quality { font-size: 11px; color: var(--muted); }
  .tones { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .legend { color: var(--muted); font-size: 13px; margin-top: 16px; }
  @media (max-width: 720px) {
    .controls > div { flex-basis: 100%; }
    .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  }
</style>
