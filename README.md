# SOL — Official Store

A dark, editorial streetwear storefront for SOL, published with GitHub Pages.

## Storefront
- Four clothing categories with responsive collection cards
- Product grid, product detail pages, image galleries, color and size selection
- Search dropdown with live product results
- Wishlist and recently viewed products
- Shopping bag preview with item removal and subtotal
- Responsive desktop, tablet, and mobile layouts
- Keyboard-accessible search, shopping bag, and interactive controls
- Social sharing metadata and SOL favicon

## SOL Studio
Studio is a hidden product-management area for the people maintaining the catalog. It is opened from the footer copyright control (three clicks within four seconds) and asks for a passcode.

**Important:** the passcode is only an informal hidden-entry barrier. It is not secure authentication. Do not store private customer information or secrets in this static site.

Studio supports:
- Manual product creation and editing
- Multiple colors and sizes
- Multiple extracted photo groups assigned to product colors
- Tapstitch product extraction through the Chrome side-panel extension
- Catalog export/import as JSON

## Tapstitch extractor
1. Download the latest [SOL Extractor ZIP](https://github.com/cool7crazy2020-del/sol/releases/download/sol-extractor-latest/SOL-Extractor.zip).
2. Unzip it.
3. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
4. Select the extracted `sol-extractor` folder.
5. Reload the Tapstitch product tab, open the SOL Extractor side panel, then choose **Extract product** and **Send to SOL Studio**.

The extractor reads the active Tapstitch product page only when you press Extract. It can collect only information and images already available in the page; temporary or protected image URLs may not work in the public catalog.

## Local development
Open `index.html` in a browser, or serve the repository folder with a local static web server.

## Deployment
The GitHub Actions workflow in `.github/workflows/pages.yml` deploys the static storefront from the `main` branch to GitHub Pages.

## Important architecture limits
This is currently a static site:
- Studio product changes are saved in that browser's local storage. They are not automatically shared with other visitors or devices.
- To update the public catalog, export the JSON and update the published catalog through the repository workflow.
- There is no live Tapstitch API connection or automatic fulfillment.
- The shopping bag is a preview. Checkout, payment processing, customer accounts, inventory sync, and order management are not connected.
- Real multi-user publishing and checkout require a backend and payment provider.

## Assets
Brand and category artwork live in `assets/`.
