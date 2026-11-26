# Pixelplot generation latency

On November 23, 2026, **GPT-6.1 Sol Ultrafast with one compact drawing request** finished fastest. On five matched new scenes its median was **1.00 s to the first visible pixels, 1.88 s to the finished image, and 1.96 s until the app was ready**. All five passed their pixel checks. The model streams shapes and colors. The browser fills the 128 × 128 canvas. The compact instruction asks for 7–10 shapes on a simple subject and lets the model use more for complex requests.

A separate 16-run comparison tested one artist against four artists working on spatial quadrants. [Quadrant timings and visual results](quadrant-results.md)

## Where to put Decisions

All rows use GPT-6.1 Sol Ultrafast and the same five prompts for a skate, teapot, robot, balloon, and lighthouse. Times are medians in seconds from pressing Enter. The last column shows a separate, single recolor trial. Every variant that attempted the edit matched its expected image pixel for pixel.

| Architecture | First pixels | Finished image | App ready | Recolor finished |
|---|---:|---:|---:|---:|
| One compact drawing request | 1.00 | **1.88** | **1.96** | 0.76 |
| One ordinary drawing request | 0.96 | 2.44 | 2.52 | 0.71 |
| Decisions before drawing | 1.23 | 2.62 | 2.74 | 1.16 |
| Decisions during drawing | 0.90 | 2.48 | 2.56 | 0.75 |
| Decisions after drawing | 0.90 | 2.45 | 3.00 | 0.66 |
| Two concurrent drawing models | 1.12 | 2.66 | 2.73 | — |

Before drawing, GPT-6 Luna uses the Decisions API to classify the request as a new scene or an edit. During drawing, it checks a PNG of the partial image while the artist continues. After drawing, it checks the finished PNG. A repair verdict with confidence of at least 0.85 triggers another drawing call. No verdict reached that threshold in these tests. The after-drawing check can keep the app busy even when its finished pixels are already visible. The 0.66 s recolor finished before the verdict and the app became ready at 0.96 s.

The two-worker version draws the background and foreground concurrently and composites them in a fixed order. Across the five scenes, its median was 504 total output tokens, compared with 435 for an ordinary drawing and 317 for a compact drawing. Compact drawing finished faster than ordinary drawing on each of the five prompts. Its drawings have fewer embellishments, visible in the skate’s wheels and the lighthouse’s base. [Compare the actual drawings](comparison.png)

## Which model

All six models received the same compact instruction on three prompts. Each model returned the requested service tier on every completed API response. Times below are Enter to finished canvas in seconds.

| Model | API tier | Robot | Skate | Lighthouse | Median | Passed pixel checks |
|---|---|---:|---:|---:|---:|---:|
| GPT-6.1 Sol | Ultrafast | **3.15** | **1.51** | **1.55** | **1.55** | 3/3 |
| GPT-6 Astra | Ultrafast | 3.27 | 1.78 | 1.72 | 1.78 | 3/3 |
| GPT-6.1 Terra | Fast | 4.30 | 2.37 | 2.53 | 2.53 | 3/3 |
| GPT-6.2 Sol | Ultrafast | 5.25 | 2.95 | 1.77 | 2.95 | 3/3 |
| GPT-6 Luna | Fast | 6.44 | 3.38 | 2.70 | 3.38 | 2/3 |
| GPT-6.2 Astra | Ultrafast | 5.88 | 4.20 | 2.02 | 4.20 | 3/3 |

OpenAI lists four Ultrafast models. All four ran successfully here. A separate live probe of GPT-6.1 Terra with `ultrafast` returned HTTP 400. Terra accepted `fast`. [Ultrafast guide](https://developers.openai.com/api/docs/guides/ultrafast-mode) · [Fast guide](https://developers.openai.com/api/docs/guides/fast-mode)

## Measurement and accuracy

The 96 timed browser runs consisted of 27 initial trials, 16 trials on two additional subjects, 35 matched architecture trials, and 18 final model comparisons. Each browser trial sent a real Enter keypress to Pixelplot’s production frontend and used a live API response. A local benchmark server selected the architecture. Trials ran sequentially in headless Chrome on one machine, rotating candidate order within each batch. Each trial started with fresh conversation state and the same starting canvas for its prompt.

The clock started at the prompt’s keydown event. A frame observer compared actual canvas pixels after paints. It recorded the first visual change, the last visual change, and readiness on a subsequent frame after the app finished the request. Times have approximately one animation frame of resolution. Network latency, output length, and model sampling vary. Each cell in the model table is a single observation, and the medians are specific to these prompts.

The pixel checks measured exact requested colors, relative positions, three separate wheel positions, and complete bitmap equality for the isolated recolor. A visual review checked silhouettes and details such as the teapot’s spout and the robot’s umbrella. Luna’s compact robot failed its color and placement checks and was visibly malformed. After activating the winner, a separate browser check against the running app drew a new sailboat in 2.05 s and recolored all 785 sail pixels in 0.94 s, measured to app readiness. All other pixels were preserved. [Every trial and timing](timings.csv) · [Prompts and pixel checks](workloads.mjs)

## Repeat the live benchmark

Use Node 22.15 or newer with Playwright and Chromium available. Pixelplot’s normal local API key configuration supplies the credentials. Each run makes billable API requests. The command below reproduces the five-scene architecture comparison and the edit. Use a fresh output directory for each experiment. Set `PIXEL_PLAYWRIGHT` to an installed Playwright module and `PIXEL_CHROME` to a browser executable if needed.

```sh
PIXEL_BENCH_OUT=./bench-output PIXEL_TAG=paired \
PIXEL_TASKS=skate,teapot,robot,balloon,lighthouse,edit \
PIXEL_CANDIDATES=sol61:none,sol61:before,sol61:middle,sol61:after,sol61:layers,sol61:compact \
node --env-file-if-exists=.env.local bench/run.mjs
```
