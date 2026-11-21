<script lang="ts">
  /** Griffbild im üblichen Format: Saiten senkrecht (tiefe E links), Sattel oben. */
  import { TUNING, type Chord } from '../lib/music';

  let { chord, labels = 'fingers', names }: { chord: Chord; labels?: 'fingers' | 'notes'; names: string[] } = $props();

  const W = 132, LEFT = 22, GAP = 17.6, TOP = 30, FRET_H = 24, FRETS = 4;
  const sx = (i: number) => LEFT + i * GAP;

  const fretted = $derived(chord.frets.filter((f): f is number => f !== null && f > 0));
  const baseFret = $derived(Math.max(...fretted, 0) > FRETS ? Math.min(...fretted) : 1);
  const fy = (f: number) => TOP + (f - baseFret + 0.5) * FRET_H;
  const isRoot = (i: number, f: number) => (TUNING[i] + f) % 12 === chord.root;
  const noteName = (i: number, f: number) => names[(TUNING[i] + f) % 12];
</script>

<svg viewBox="0 0 {W} {TOP + FRETS * FRET_H + 26}" aria-hidden="true">
  <!-- Bundstäbe und Sattel -->
  {#each Array(FRETS + 1) as _, k}
    <line x1={sx(0)} x2={sx(5)} y1={TOP + k * FRET_H} y2={TOP + k * FRET_H} class="fret" class:nut={k === 0 && baseFret === 1} />
  {/each}
  {#if baseFret > 1}<text x={sx(0) - 9} y={fy(baseFret) + 4} class="base">{baseFret}</text>{/if}
  <!-- Saiten -->
  {#each chord.frets as _, i}
    <line x1={sx(i)} x2={sx(i)} y1={TOP} y2={TOP + FRETS * FRET_H} class="string" />
  {/each}
  <!-- Barré -->
  {#if chord.barre}
    <rect x={sx(chord.barre.from) - 8} y={fy(chord.barre.fret) - 8} width={sx(chord.barre.to) - sx(chord.barre.from) + 16} height="16" rx="8" class="dot" />
  {/if}
  <!-- Leer / gedämpft / Fingerpunkte -->
  {#each chord.frets as f, i}
    {#if f === null}
      <text x={sx(i)} y={TOP - 10} class="mark">×</text>
    {:else if f === 0}
      <circle cx={sx(i)} cy={TOP - 14} r="5" class="open" class:root={isRoot(i, 0)} />
    {:else}
      <circle cx={sx(i)} cy={fy(f)} r="8" class="dot" class:root={isRoot(i, f)} />
      {#if labels === 'fingers' && chord.fingers[i]}
        <text x={sx(i)} y={fy(f) + 3.8} class="in">{chord.fingers[i]}</text>
      {/if}
      {#if labels === 'notes'}
        <text x={sx(i)} y={fy(f) + 3.6} class="in small">{noteName(i, f)}</text>
      {/if}
    {/if}
    {#if labels === 'notes' && f !== null}
      <text x={sx(i)} y={TOP + FRETS * FRET_H + 17} class="below">{noteName(i, f)}</text>
    {/if}
  {/each}
</svg>

<style>
  svg { width: 100%; max-width: 160px; display: block; margin: 0 auto; overflow: visible; }
  .fret { stroke: var(--muted); stroke-width: 1.2; opacity: 0.55; }
  .fret.nut { stroke: var(--text); stroke-width: 4; opacity: 1; }
  .string { stroke: var(--muted); stroke-width: 1.2; }
  .dot { fill: var(--text); }
  .dot.root { fill: var(--accent); }
  .open { fill: none; stroke: var(--text); stroke-width: 1.6; }
  .open.root { stroke: var(--accent); stroke-width: 2.2; }
  .mark { fill: var(--muted); font-size: 13px; text-anchor: middle; }
  .in { fill: var(--bg); font-size: 10px; font-weight: 700; text-anchor: middle; }
  .in.small { font-size: 8px; }
  .below { fill: var(--muted); font-size: 9px; text-anchor: middle; }
  .base { fill: var(--muted); font-size: 10px; text-anchor: end; }
</style>
