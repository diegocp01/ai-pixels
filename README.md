# Pixelplot

![Three drawings made in Pixelplot: a teal hot-air balloon, a green robot holding a red umbrella, and a blue teapot with a yellow handle.](docs/pixelplot.png)

I gave GPT‑6.1 Sol 16,384 pixels to draw and control. Type what you want to see and watch the picture take shape. Then tell it what to change.

## Try it locally

You need **Node.js 22.9 or newer** and an OpenAI API key with access to GPT‑6.1 Sol Ultrafast. The studio runs with Node’s built-in modules.

```sh
git clone https://github.com/diegocp01/pixelplot.git
cd pixelplot
```

Create a file named `.env.local` in the project directory with your own key in place of the placeholder below. Git ignores this file. You can also supply `OPENAI_API_KEY` through your shell environment.

```dotenv
OPENAI_API_KEY=your-api-key
```

Run `npm start`, then open [Pixelplot on localhost](http://127.0.0.1:4681/). Drawing requests use your OpenAI account. The key stays on the local server.

Try typing **“Draw a little green robot holding a red umbrella in the rain.”** Press Enter. Then type **“Make just the umbrella yellow.”** You can queue a follow-up while the first drawing finishes or use the history button to edit an earlier version. History lasts for the current page session.

## How the pixels get their colors

One model draws the whole 128 × 128 canvas. The Node server sends your prompt and the current scene to GPT‑6.1 Sol using the streaming Responses API with `service_tier: "ultrafast"`. The model replies with short drawing commands. For example, this command paints a red rectangle 12 pixels wide and 6 pixels tall, starting at (20, 30).

```text
rect mailbox.flag #d34652 20 30 12 6
```

The browser paints each shape as its command arrives. Shapes have names, so a follow-up like “make the flag yellow” can recolor `mailbox.flag` while preserving the rest of the image. The renderer also supports polygons, ovals, lines, and gradients.

## How fast is it?

Across five matched prompts, the first pixels appeared in **1.00 s** and the finished drawing appeared in **1.88 s** median from pressing Enter. A separate experiment gave four models one quadrant each. One model finished all six free-form illustrations faster, and the shapes lined up across the canvas. [Timing methodology and results](bench/RESULTS.md) · [Quadrant experiment and images](bench/quadrant-results.md)

## Development

- Run `npm test` for the offline renderer and generation tests.
- The server and OpenAI integration live in [server.mjs](server.mjs) and [provider.mjs](provider.mjs). The browser paints from [public/scene.mjs](public/scene.mjs).
- To use a key from another environment file, set `PIXEL_KEY_FILE` to its path in `.env.local`. To try the optional GPT‑6.2 Sol Agents Sessions transport, set `PIXEL_API_MODE=sessions` before starting the server.
- Older 64 × 64 scenes reopen at double resolution. Type **“Refine colors and detail”** to refine one at the native canvas size.
