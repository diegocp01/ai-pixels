# One canvas versus four parallel quadrants

**The current single-model setup finished faster and produced more coherent drawings.** Across eight matched pairs, median Enter-to-finished time was **1.96 s** for one model and **2.50 s** for four. The four-worker version won both trials of the precisely specified ring. One model won all six trials of the free-form illustrations. [View all 16 drawings](quadrant-comparison.png) · [Per-trial timings and visual observations](quadrant-timings.csv)

| Prompt | One model, finished | Four quadrants, finished | Coherent images, one / four |
|---|---:|---:|---:|
| Hot-air balloon and one sun | 1.83 s | 2.65 s | 2/2 · 0/2 |
| Robot holding an umbrella | 2.81 s | 3.97 s | 2/2 · 0/2 |
| Teapot with spout and handle | 2.19 s | 2.40 s | 2/2 · 0/2 |
| Ring with exact center and radii | 1.62 s | 1.22 s | 2/2 · 2/2 |

Each time is the median of two live runs in November 2026. Across all eight runs per architecture, median time to first visible pixels was 1.08 s for one worker and 1.11 s for four. The app was ready at 2.07 s and 2.57 s, respectively.

## How the comparison worked

Both paths used GPT-6.1 Sol Ultrafast, the same 128 × 128 starting canvas, the same user prompt, and fresh conversation state. The baseline used the app’s current compact instruction. The alternative issued four concurrent Responses requests. Each worker received global coordinates, its own 64 × 64 region, a common center and approximate subject bounds, and the same lighting direction. Each could draw a shape past its boundary. The renderer displayed only the pixels inside that worker’s quadrant, without a planner or a seam-repair pass.

Each prompt ran twice with the order reversed. Timing started at a real Enter keypress in Chrome and ended on the last observed change to the canvas. In every trial the exported pixels matched the actual browser canvas. The four calls launched within 8 ms of each other and overlapped on every drawing. Four workers used 8,802 total output tokens across the eight images, versus 2,866 for one worker.

## What happened at the seams

All 16 images passed their automated color and feature-position checks. To assess coherence separately, the images were shuffled and reviewed with the architecture and timings hidden. The visual criteria were a single composition, continuous contours where objects crossed a quadrant boundary, and the requested number of prominent objects. These judgments apply to this small sample.

- **Balloon:** Both split drawings had a sun on each side and a visible break in the balloon shading. The single-model drawings each had one sun.
- **Robot:** Both split drawings placed parts of the face at different heights across the center seam.
- **Teapot:** One split drawing had a forked spout. The other had a visible step in the body and handle.
- **Ring:** All four outputs were pixel-identical. The prompt supplied the center, both radii, and both colors, so workers could independently calculate the same boundary.

## Reproduce

Use the local API key, Playwright, and Chromium setup described in the [benchmark instructions](RESULTS.md#repeat-the-live-benchmark). This comparison makes 40 live Responses calls if every worker completes on its first attempt.

```sh
PIXEL_BENCH_OUT=./quadrant-output PIXEL_TAG=quadrantab \
PIXEL_CANDIDATES=sol61:compact,sol61:quadrants \
PIXEL_TASKS=porthole,robot,teapot,balloon,robot,porthole,balloon,teapot \
node --env-file-if-exists=.env.local bench/run.mjs
```
