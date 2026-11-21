<script lang="ts" generics="T extends string | number | boolean">
  /** Segment-Auswahl, verhält sich wie eine Gruppe von Radio-Buttons. */
  interface Props {
    items: { value: T; label: string }[];
    value: T;
    small?: boolean;
    /** Auf dem Handy als Raster mit so vielen Spalten statt als wischbare Zeile */
    cols?: number;
    label?: string;
  }
  let { items, value = $bindable(), small = false, cols = 0, label }: Props = $props();
</script>

<div class="seg" class:small class:grid={cols > 0} style:--cols={cols || null} role="radiogroup" aria-label={label}>
  {#each items as item (String(item.value))}
    <button
      type="button"
      role="radio"
      aria-checked={item.value === value}
      class:active={item.value === value}
      onclick={() => (value = item.value)}>{item.label}</button
    >
  {/each}
</div>
