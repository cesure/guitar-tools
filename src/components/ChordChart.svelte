<script lang="ts">
  import { onMount } from 'svelte';
  import Seg from './Seg.svelte';
  import ChordDiagram from './ChordDiagram.svelte';
  import { pluck } from '../lib/audio';
  import { load, oneOf, save } from '../lib/storage';
  import {
    FINDER_QUALITIES, ROOT_NAMES, TUNING, chordPitchClasses, chordVoicings, midiToFreq, spelling,
    type Chord, type ChordQuality, type Voicing,
  } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, lang }: { t: Messages['chords']; lang: Lang } = $props();

  const s = $state(load('gt-chords', { labels: 'fingers' as 'fingers' | 'notes' }, (v) => ({ labels: oneOf(v.labels, ['fingers', 'notes'] as const, 'fingers') })));
  $effect(() => save('gt-chords', s));

  /* ---------- Akkord-Finder (Auswahl steht in der URL) ---------- */
  const find = $state({ root: 0, quality: '' as ChordQuality });
  let ready = false;
  onMount(() => {
    const p = new URLSearchParams(location.search);
    const root = Number(p.get('root'));
    if (p.has('root') && Number.isInteger(root) && root >= 0 && root < 12) find.root = root;
    const q = p.get('q');
    if (q !== null && (FINDER_QUALITIES as string[]).includes(q)) find.quality = q as ChordQuality;
    ready = true;
  });
  $effect(() => {
    const p = new URLSearchParams();
    if (find.root !== 0) p.set('root', String(find.root));
    if (find.quality !== '') p.set('q', find.quality);
    if (ready) history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
  });

  const rootNames = $derived(ROOT_NAMES[lang]);
  const voicings = $derived(chordVoicings(find.root, find.quality));

  const chordName = (c: Chord) => `${rootNames[c.root]}${c.quality}`;
  /** Tonnamen passend zum Akkord (C7 → B statt A♯). */
  const namesFor = (c: Chord) =>
    spelling(lang, c.root, c.quality === 'm' || c.quality === 'm7' ? 'minor' : c.quality === '7' ? 'mixolydian' : 'major');
  const voicingLabel = (v: Voicing) =>
    v.kind === 'open' ? t.open : `${v.kind === 'E' ? t.shapeE : t.shapeA} · ${v.position}. ${t.fret}`;

  let playing = $state<string | null>(null);
  /** Akkord von der tiefsten zur höchsten Saite anschlagen. */
  function strum(c: Chord, id: string) {
    let k = 0;
    c.frets.forEach((f, i) => {
      if (f === null) return;
      pluck(midiToFreq(TUNING[i] + f), 2.2, 0.2, k++ * 0.035);
    });
    playing = id;
    setTimeout(() => playing === id && (playing = null), 600);
  }
</script>

<div class="card controls">
  <div class="wide"><div class="label">{t.finder}</div><p class="hint-left">{t.finderSub}</p></div>
  <div class="wide"><Seg cols={6} items={rootNames.map((n, i) => ({ value: i, label: n }))} bind:value={find.root} label={t.finder} /></div>
  <div class="wide">
    <Seg cols={4} items={FINDER_QUALITIES.map((q) => ({ value: q, label: `${rootNames[find.root]}${q}` }))} bind:value={find.quality} label={t.kind} />
  </div>
  <div><div class="label">{t.labels}</div><Seg small items={[{ value: 'fingers', label: t.fingers }, { value: 'notes', label: t.notes }]} bind:value={s.labels} label={t.labels} /></div>
</div>

<h2 class="result">{rootNames[find.root]}{find.quality} <span>{rootNames[find.root]} {t.qualities[find.quality]}</span></h2>
<div class="grid">
  {#each voicings as v (v.frets.join())}
    {@const id = `v-${v.frets.join()}`}
    <button class="chord card" class:playing={playing === id} onclick={() => strum(v, id)} aria-label="{chordName(v)} {voicingLabel(v)} – {t.play}">
      <div class="head"><span class="name small">{chordName(v)}</span><span class="quality">{voicingLabel(v)}</span></div>
      <ChordDiagram chord={v} labels={s.labels} names={namesFor(v)} />
      <div class="tones">{chordPitchClasses(v).map((pc) => namesFor(v)[pc]).join(' · ')}</div>
    </button>
  {/each}
</div>

<p class="legend">{t.legend}</p>

<style>
  .controls { display: flex; flex-wrap: wrap; gap: 12px 28px; margin-bottom: 16px; }
  .controls > div { min-width: 0; max-width: 100%; }
  .controls .wide { flex-basis: 100%; }
  .hint-left { color: var(--muted); font-size: 13px; margin: -4px 0 0; }
  .result { font-size: 28px; margin: 8px 0 12px; }
  .result span { font-size: 15px; font-weight: 400; color: var(--muted); margin-left: 8px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .chord { all: unset; box-sizing: border-box; cursor: pointer; padding: 14px 12px 12px; text-align: center; transition: transform 0.1s, border-color 0.2s; }
  .chord:hover { border-color: var(--accent); }
  .chord:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .chord.playing { transform: scale(0.98); border-color: var(--accent); }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin-bottom: 4px; }
  .name { font-size: 22px; font-weight: 700; }
  .name.small { font-size: 18px; }
  .quality { font-size: 11px; color: var(--muted); text-align: right; }
  .tones { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .legend { color: var(--muted); font-size: 13px; margin-top: 16px; }
  @media (max-width: 720px) {
    .controls > div { flex-basis: 100%; }
    .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  }
</style>
