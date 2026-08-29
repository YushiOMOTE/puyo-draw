# Puyo Chain Simulator

A dependency-free static web app for designing Puyo Puyo boards and previewing chain reactions with touch-friendly controls.

## Live Demo

Open the deployed app on GitHub Pages: [Puyo Chain Simulator](https://yushiomote.github.io/puyo-draw/)

## Local Development

Serve the repository with any static file server, then open the local URL in a browser. For example:

```sh
python3 -m http.server 4173
```

Open <http://localhost:4173>.

Run the logic tests with:

```sh
npm test
```

## GitHub Pages

Pushing to the `main` branch triggers `.github/workflows/deploy.yml`. In the repository settings, set Pages → Build and deployment → Source to **GitHub Actions**.

## Documentation

- [Product concept](docs/CONCEPT.md)
- [Product specification](docs/SPECIFICATION.md)
- [Contribution guidelines](AGENTS.md)
