# SOL — Official Store

A static streetwear storefront for SOL, built directly in this repository.

## Features
- SOL brand mark in the header and footer
- Editorial homepage and collection/category navigation
- Product grid, product detail view, size selection and cart preview
- Studio page for manually entering Tapstitch product details and mockup images
- Responsive desktop and mobile layout

## Run locally
Open `index.html` in a browser.

## Publish with GitHub Pages
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. The included workflow deploys the static site whenever changes are pushed to `main`.
4. After the first successful run, the Pages URL will appear in Settings → Pages.

## Product manager limitation
The Studio product manager currently saves product entries in the current browser's local storage. That means product edits are not shared with other visitors/devices and can be lost if browser data is cleared. Tapstitch is a manual workflow here: copy the product information and upload the mockup; there is no automatic Tapstitch API sync. Public multi-device product publishing and real checkout require a backend and payment provider, which are not configured yet.

## Logo asset
`assets/sol-logo.jpg` is the supplied SOL logo artwork, cropped and optimized for the storefront.
