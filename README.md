# Shadow Workipedia

Interactive visualization of Shadow Work's interconnected global issues and systems.

## Development

```bash
pnpm install
pnpm extract-data  # Extract data from parent Shadow Work repo
pnpm dev           # Start dev server on localhost:3000
```

## Build

```bash
pnpm build         # Build static site to dist/
pnpm preview       # Preview production build
```

## Deployment

The `dist/` directory contains a fully self-contained static website optimized for production:
- Minified and tree-shaken code
- Console statements stripped
- Single-bundle output for faster loading

### Deploy to Vercel
```bash
vercel deploy dist --prod
```

### Deploy to Netlify
1. Drag-and-drop `dist/` folder to [Netlify Drop](https://app.netlify.com/drop)
2. Or connect GitHub repo and set build command to `pnpm build`

### Deploy to GitHub Pages
```bash
pnpm build
git subtree push --prefix dist origin gh-pages
```

**Note**: Ensure `data.json` is regenerated before deployment by running `pnpm extract-data` to pull latest issues from parent repo.

### Social Preview Image

The project includes an SVG social preview (`public/og-image.svg`). For better compatibility with social media platforms that require PNG:

```bash
# Convert SVG to PNG (requires ImageMagick or similar)
convert public/og-image.svg -resize 1200x630 public/og-image.png

# Or use online tools like CloudConvert, Convertio, etc.
```

Then update `index.html` to reference `/og-image.png` instead of `/og-image.svg`.

## Architecture

See [Design Document](../docs/plans/2025-11-21-issue-explorer-design.md) in parent repo.
