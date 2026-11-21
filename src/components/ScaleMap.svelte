<script lang="ts">
  import { onMount } from 'svelte';
  import Seg from './Seg.svelte';
  import {
    CHARACTERISTIC, INTERVALS, MAIN_SCALES, MORE_SCALES, PARALLEL, ROOT_NAMES, SCALES, TUNING,
    cagedShapes, spelling, type ScaleId,
  } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, lang }: { t: Messages['scales']; lang: Lang } = $props();

  const FRETS = 15;
  const DEFAULTS = { root: 0, scale: 'major' as ScaleId, shape: 0, labels: 'note' as 'note' | 'iv' };
  const s = $state({ ...DEFAULTS });
  let ready = false;
  let copied = $state(false);
  let moreOpen = $state(false);

  // Einstellungen stehen in der URL → „Link kopieren“ zeigt genau diese Ansicht
  onMount(() => {
    const p = new URLSearchParams(location.search);
    const root = Number(p.get('root'));
    if (p.has('root') && Number.isInteger(root) && root >= 0 && root < 12) s.root = root;
    const scale = p.get('scale');
    if (scale && scale in SCALES) s.scale = scale as ScaleId;
    const shape = Number(p.get('shape'));
    if (Number.isInteger(shape) && shape > 0 && shape <= 5) s.shape = shape;
    if (p.get('labels') === 'iv') s.labels = 'iv';
    ready = true;
  });

  $effect(() => {
    const p = new URLSearchParams();
    (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).forEach((k) => {
      if (s[k] !== DEFAULTS[k]) p.set(k, String(s[k]));
    });
    if (ready) history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
  });

  const rootNames = $derived(ROOT_NAMES[lang]);
  const names = $derived(spelling(lang, s.root, s.scale));
  const intervals = $derived(SCALES[s.scale] as readonly number[]);
  const chars = $derived(CHARACTERISTIC[s.scale] ?? []);
  const shapes = $derived(cagedShapes(s.root, s.scale));
  const win = $derived(s.shape ? shapes[s.shape - 1] : null);
  const parallel = $derived(PARALLEL[s.scale]);
  const showMore = $derived(moreOpen || MORE_SCALES.includes(s.scale));
  // Hohe e-Saite oben, wie in Tabs
  const strings = [...TUNING.keys()].reverse();

  const shapeItems = $derived([
    { value: 0, label: t.all },
    ...shapes.map((sh, i) => ({ value: i + 1, label: `${i + 1} · ${sh.name}` })),
  ]);

  function cell(stringIndex: number, fret: number) {
    const pc = (TUNING[stringIndex] + fret) % 12;
    const rel = (pc - s.root + 12) % 12;
    if (!intervals.includes(rel)) return null;
    return {
      text: s.labels === 'iv' ? INTERVALS[rel] : names[pc],
      root: rel === 0,
      char: chars.includes(rel),
      dim: win !== null && (fret < win.from || fret > win.to),
    };
  }

  function goParallel() {
    if (!parallel) return;
    s.root = (s.root + parallel.shift) % 12;
    s.scale = parallel.scale;
    s.shape = 0;
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }
</script>

<div class="card">
  <div class="controls">
    <div class="wide"><div class="label">{t.root}</div><Seg items={rootNames.map((n, i) => ({ value: i, label: n }))} bind:value={s.root} label={t.root} /></div>
    <div class="wide">
      <div class="label">{t.scale}</div>
      <div class="scale-row">
        <Seg items={MAIN_SCALES.map((k) => ({ value: k, label: t.names[k] }))} bind:value={s.scale} label={t.scale} />
        <button class="more" class:open={showMore} aria-expanded={showMore} onclick={() => (moreOpen = !moreOpen)}>{t.more} {showMore ? '▴' : '▾'}</button>
      </div>
      {#if showMore}
        <div class="more-row">
          <Seg small items={MORE_SCALES.map((k) => ({ value: k, label: t.names[k] }))} bind:value={s.scale} label={t.more} />
        </div>
      {/if}
    </div>
    <div><div class="label">{t.shape}</div><Seg items={shapeItems} bind:value={s.shape} label={t.shape} /></div>
    <div>
      <div class="label">{t.labels}</div>
      <Seg items={[{ value: 'note', label: t.notes }, { value: 'iv', label: t.intervals }]} bind:value={s.labels} label={t.labels} />
    </div>
  </div>

  <div class="scroll">
    <div class="fb" style:--frets={FRETS} role="img" aria-label={`${rootNames[s.root]} ${t.names[s.scale]}`}>
      {#each strings as si, row}
        {#each Array(FRETS + 1) as _, f}
          {@const c = cell(si, f)}
          <div
            class="cell f{f}"
            class:inl={([3, 5, 7, 9, 15].includes(f) && row === 2) || (f === 12 && (row === 1 || row === 3))}
            style:--sw="{(0.8 + (5 - si) * 0.4).toFixed(1)}px"
          >
            {#if c}<span class="m" class:root={c.root} class:char={c.char} class:dim={c.dim}>{c.text}</span>{/if}
          </div>
        {/each}
      {/each}
      {#each Array(FRETS + 1) as _, f}
        <div class="cell lbl f{f}" class:inlay={[3, 5, 7, 9, 15].includes(f)} class:dbl={f === 12}><span>{f || ''}</span></div>
      {/each}
    </div>
  </div>
  <div class="swipe">{t.swipe}</div>

  <div class="legend">
    <span><i class="root"></i>{t.legendRoot}</span>
    <span><i></i>{t.legendNote}</span>
    {#if chars.length}<span><i class="char"></i>{t.legendChar} ({chars.map((c) => INTERVALS[c]).join(', ')})</span>{/if}
    {#if s.shape}<span><i class="dim"></i>{t.legendOut}</span>{/if}
  </div>

  <div class="info">
    <p><strong>{rootNames[s.root]} {t.names[s.scale]}:</strong> {t.info[s.scale]}</p>
    <div class="row">
      {#if parallel}
        <button class="btn ghost small" onclick={goParallel}>
          {t.sameNotes} {rootNames[(s.root + parallel.shift) % 12]} {t.names[parallel.scale]} →
        </button>
      {/if}
      <button class="btn ghost small" onclick={share}>{copied ? t.copied : t.share}</button>
    </div>
  </div>
</div>

<style>
  .controls { display: flex; flex-wrap: wrap; gap: 18px 28px; margin-bottom: 20px; }
  .controls > div { min-width: 0; max-width: 100%; }
  .controls .wide { flex-basis: 100%; }
  .scale-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: stretch; }
  .more { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 10px; border: 1px dashed var(--line); color: var(--muted); font-size: 14px; }
  .more:hover, .more.open { color: var(--text); border-style: solid; }
  .more:focus-visible { outline: 2px solid var(--accent); }
  .more-row { margin-top: 8px; }
  .scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .fb {
    display: grid; grid-template-columns: 36px repeat(var(--frets), minmax(36px, 1fr)); min-width: 660px;
    background: var(--fb-bg); border-radius: 10px; padding: 14px 12px 6px;
  }
  .cell { height: 30px; display: flex; align-items: center; justify-content: center; position: relative; border-right: 2px solid var(--fb-fret); }
  .cell::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--sw, 1px); background: var(--fb-string); transform: translateY(-50%); }
  .cell.f0 { border-right: 5px solid var(--fb-nut); }
  .cell.f0::before { opacity: 0.5; }
  /* Griffbrett-Einlagen wie auf der echten Gitarre, 12. Bund doppelt und hervorgehoben */
  .cell.inl::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px; border-radius: 50%; background: var(--fb-inlay); opacity: 0.6; transform: translateX(-50%); }
  .cell.f12:not(.lbl) { background: color-mix(in srgb, var(--fb-inlay) 16%, transparent); border-right-width: 3px; }
  .cell.lbl.f12 span { font-weight: 700; color: var(--text); font-size: 12px; }
  .cell.lbl { border-right: none; height: auto; padding-top: 6px; flex-direction: column; gap: 2px; font-size: 11px; color: var(--fb-label); font-variant-numeric: tabular-nums; }
  .cell.lbl::before { display: none; }
  .cell.lbl.inlay::after { content: '●'; color: var(--fb-inlay); font-size: 7px; line-height: 1; }
  .cell.lbl.dbl::after { content: '● ●'; color: var(--fb-inlay); font-size: 7px; line-height: 1; }
  .m {
    position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%;
    background: var(--fb-dot); color: var(--fb-dot-ink); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
    font-size: 10.5px; font-weight: 600; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s;
  }
  .m.root { background: var(--accent); color: var(--accent-ink); box-shadow: none; }
  .m.char { background: var(--char); color: #fff; box-shadow: none; }
  .m.dim { opacity: 0.15; }
  .swipe { display: none; color: var(--muted); font-size: 12px; text-align: center; margin-top: 8px; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--muted); font-size: 13px; margin-top: 14px; }
  .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: -1px; margin-right: 6px; background: var(--fb-dot); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15); }
  .legend i.root { background: var(--accent); }
  .legend i.char { background: var(--char); }
  .legend i.dim { opacity: 0.25; }
  .info { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
  .info p { margin: 0 0 12px; }
  .btn.small { padding: 6px 14px; font-size: 13px; font-weight: 500; white-space: normal; }
  @media (max-width: 720px) {
    .controls > div { flex-basis: 100%; }
    .scale-row { flex-wrap: nowrap; }
    .scale-row :global(.seg) { flex: 1; min-width: 0; }
    .scroll { margin: 0 -18px; padding: 0 18px; }
    .swipe { display: block; }
  }
</style>
