# Puyo Chain Simulator

> Draw a board, test the chain, and build longer chains with Ama.

A touch-friendly, dependency-free Puyo Puyo board lab for experimenting with chain ideas on a phone or desktop. The app opens in Tokopuyo mode for step-driven practice; Drawing mode is the board-building submode for freely placing puyos, simulating chains, and exploring ideas before returning to the retained Tokopuyo session.

<p align="center">
  <a href="https://yushiomote.github.io/puyo-draw/">Try Puyo Chain Simulator</a>
</p>

<p align="center">
  <img src="docs/media/tokopuyo-mode.png" alt="Tokopuyo mode with Current, Next, and Next Next previews" width="390" />
</p>

<p align="center"><sub>Tokopuyo mode is the main experience: play a pattern with Current, Next, and Next Next always in view.</sub></p>

## Explore the features

<table>
  <thead>
    <tr>
      <th align="left">What you can do</th>
      <th align="center">See it in action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <strong>Ama suggestions and review</strong><br />
        Ask for a long-chain construction move in Tokopuyo, or a chain extension while designing a settled Drawing-mode board. Review the last move side by side with Ama's ranking, future-potential evidence, and immediate board evaluation.
      </td>
      <td align="center">
        <img src="docs/media/ama-suggestion.png" alt="Drawing mode with Ama chain-extension suggestions marked on the board" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Draw, simulate, and start Tokopuyo from your setup</strong><br />
        Switch from the default Tokopuyo mode into the Drawing submode. Hold a cell and flick toward a color, garbage puyo, or delete, then simulate gravity and every chain. When the field is ready, choose compatible opening Current / Next / Next Next pairs and start a new Tokopuyo session from it.
      </td>
      <td align="center">
        <img src="docs/media/tokopuyo-mode.png" alt="Tokopuyo session ready to practice a custom setup" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Inspect every chain step</strong><br />
        Enable chain step mode before a drop that fires. Jump to the first or last round, move one round at a time, or play and pause the sequence to see exactly how clearing and gravity create the next chain.
      </td>
      <td align="center">
        <img src="docs/media/tokopuyo-step-mode.png" alt="Tokopuyo step mode enabled" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Practice, attack, and add garbage</strong><br />
        Move, rotate, and drop pairs with one-handed controls. Use emergency-attack Suggestion for the strongest safe route in the visible queue, or enable Tokopuyo garbage mode to place a movable garbage puyo without consuming the normal Current.
      </td>
      <td align="center">
        <img src="docs/media/tokopuyo-demo.gif" alt="Tokopuyo pair movement, rotation, and drop demo" width="300" />
      </td>
    </tr>
  </tbody>
</table>

Ama's output is a bounded search and heuristic signal for exploring ideas—not a guarantee of the globally optimal move.

## A quick tour

1. Open the [live demo](https://yushiomote.github.io/puyo-draw/). It starts in Tokopuyo mode with a random pattern.
2. Practice with Current, Next, and Next Next using the move, rotate, and drop controls.
3. Switch to Drawing mode, hold a cell, and flick toward a color to sketch a board.
4. Tap Suggestion to see possible extensions, then Simulate to watch the chain resolve.
5. Start Tokopuyo from This Board to practice the designed field, or switch back to return to the retained Tokopuyo session. Then try long-chain Suggestion, emergency-attack Suggestion, Review Last Move, and chain step mode.

## Live Demo

Open the deployed app on GitHub Pages: [Puyo Chain Simulator](https://yushiomote.github.io/puyo-draw/)

## Local Development

Start the included cache-disabled development server:

```sh
npm run dev
```

Open <http://localhost:4173> on the Mac. The server listens on all network interfaces, so an iPhone on the same Wi-Fi can use the Mac's local IP address, such as `http://192.168.1.23:4173`. On macOS, find the Wi-Fi address with `ipconfig getifaddr en0`.

If the iPhone cannot connect, allow incoming connections for the terminal or Node.js in macOS Firewall settings, and make sure both devices are on the same network. The server is intended for local development and is not an internet-facing server.

The development server sends `Cache-Control: no-store`, so JavaScript module changes take effect on the same port without a hard refresh. A different port can be passed after `--`, for example `npm run dev -- 4180`.

Run the logic tests with:

```sh
npm test
```

## GitHub Pages

Pushing to the `main` branch triggers `.github/workflows/deploy.yml`. The workflow adds the deployment commit SHA to every local JavaScript and CSS URL before upload, preventing modules from different releases from being mixed by browser caches. In the repository settings, set Pages → Build and deployment → Source to **GitHub Actions**.

## Documentation

- [Product concept](docs/CONCEPT.md)
- [Product specification](docs/SPECIFICATION.md)
- [Tokopuyo specification](docs/TOCOPUYO_TSUMO_SPECIFICATION.md)
- [Tokopuyo implementation plan](docs/TOCOPUYO_IMPLEMENTATION_PLAN.md)
- [Contribution guidelines](AGENTS.md)
