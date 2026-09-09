# Puyo Chain Simulator

> Powered by [Ama](https://github.com/citrus610/ama)

> Draw a board, test the chain, and build longer chains with Ama.

A touch-friendly, dependency-free Puyo Puyo board lab for experimenting with chain ideas on a phone or desktop. The app opens in Tokopuyo mode for step-driven practice; Drawing mode is the board-building submode for freely placing puyos, simulating chains, and exploring ideas before returning to the retained Tokopuyo session.

<p align="center">
  <a href="https://yushiomote.github.io/puyo-draw/">Try Puyo Chain Simulator</a>
</p>

<p align="center">
  <img src="docs/media/tokopuyo-overview.png" alt="Standard Tokopuyo mode screen with a board, Current pair, and upcoming pairs" width="390" />
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
        <strong>Get long-chain construction suggestions</strong><br />
        Ask Ama to search the current field for promising placements. Numbered candidates make the potential of each route easy to compare at a glance.
      </td>
      <td align="center">
        <img src="docs/media/ama-chain-suggestions.png" alt="Ama suggestions marked with numbered candidate placements on the board" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Inspect chains step by step</strong><br />
        Turn on chain step mode to pause the result and move through each round with first, previous, next, last, play, and stop controls.
      </td>
      <td align="center">
        <img src="docs/media/tokopuyo-chain-step-mode.png" alt="Tokopuyo chain step mode showing a two-chain result and timeline controls" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Review your last move with Ama</strong><br />
        Compare your placement with Ama's preferred choice, then inspect the ranking and score to understand why another route was stronger. Learn more from the <a href="https://github.com/citrus610/ama">official Ama AI project</a>.
      </td>
      <td align="center">
        <img src="docs/media/ama-last-move-review.png" alt="Ama last move review comparing the player's move and Ama's choice" width="300" />
        <br />
        <img src="docs/media/ama-future-potential-stability.png" alt="Ama review showing future potential, stability, and evaluation details" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Drop garbage puyos</strong><br />
        Enable Tokopuyo garbage mode to replace the active pair with a movable garbage puyo. Use it to practice handling pressure and see how garbage interacts with clearing groups.
      </td>
      <td align="center">
        <img src="docs/media/tokopuyo-garbage-mode.png" alt="Tokopuyo garbage mode with a movable garbage puyo and garbage on the board" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Search and start a specific Tsumo</strong><br />
        Find a pattern by its number or by entering the first puyo colors, compare matching sequences, and start Tokopuyo with the selected Tsumo.
      </td>
      <td align="center">
        <img src="docs/media/tsumo-search.png" alt="Search Tsumo dialog with matching sequences" width="300" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Build and test a board in Drawing mode</strong><br />
        Move from Tokopuyo into the Drawing submode to place colored or garbage puyos, erase cells, and simulate the settled field. When the board is ready, choose the opening pairs and start Tokopuyo directly from your drawing.
      </td>
      <td align="center">
        <img src="docs/media/drawing-mode.png" alt="Drawing mode with a custom board and drawing controls" width="300" />
        <br />
        <img src="docs/media/start-tokopuyo-from-board.png" alt="Start Tokopuyo from this board setup dialog" width="300" />
      </td>
    </tr>
  </tbody>
</table>

Ama's output is a bounded search and heuristic signal for exploring ideas—not a guarantee of the globally optimal move.

## Ama attribution

The Tokopuyo suggestions and last-move review use the [Ama](https://github.com/citrus610/ama) AI project by citrus610. Ama is distributed under the MIT License (Copyright (c) 2023 citrus610); the pinned upstream source used by this project is included in [`third_party/ama`](third_party/ama), with its license text in [`third_party/ama/LICENSE`](third_party/ama/LICENSE).

## A quick tour

1. Open the [live demo](https://yushiomote.github.io/puyo-draw/). It starts in Tokopuyo mode with a random pattern.
2. Practice with Current, Next, and Next Next using the move, rotate, and drop controls.
3. Switch to Drawing mode, hold a cell, and flick toward a color to sketch a board.
4. Tap Suggestion to see possible extensions, then Simulate to watch the chain resolve.
5. Start Tokopuyo from This Board to practice the designed field, or switch back to return to the retained Tokopuyo session. Then try long-chain Suggestion, emergency-attack Suggestion, Review Last Move, and chain step mode.

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

### Optional traffic analytics

The site includes an opt-in Cloudflare Web Analytics integration for basic page views and performance metrics. To enable it:

1. In Cloudflare Web Analytics, add the deployed hostname and copy the JavaScript site token.
2. Set the `content` value of `meta[name="cloudflare-web-analytics-token"]` in `index.html` to that token.
3. Deploy the site and wait a few minutes for data to appear in the Cloudflare dashboard.

Leave the value empty to keep analytics disabled. See the [Cloudflare setup guide](https://developers.cloudflare.com/web-analytics/get-started/) for the dashboard steps.

## Documentation

- [Product concept](docs/CONCEPT.md)
- [Product specification](docs/SPECIFICATION.md)
- [Tokopuyo specification](docs/TOCOPUYO_TSUMO_SPECIFICATION.md)
- [Tokopuyo implementation plan](docs/TOCOPUYO_IMPLEMENTATION_PLAN.md)
- [Contribution guidelines](AGENTS.md)
