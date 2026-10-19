# GlobalTrack shipment movement simulator

A responsive static website with an interactive OpenStreetMap, route lookup, animated journey marker, configurable journey duration, tracking-number lookup, and an admin interface. **This is a route/time simulator, not real GPS tracking.** It does not verify that physical goods exist or are at the displayed location.

## Run locally

1. Unzip the project.
2. Open `index.html` in a browser, or preferably use VS Code's Live Server extension.
3. Choose **Admin portal** and sign in with local preview password `demo1234`.
4. Create a shipment with origin, destination, transport mode, duration and start time.
5. Use the generated tracking number on the public Track shipment page.

Local preview stores shipments in the current browser's `localStorage`; they are not shared with other devices and the local demo password is not secure. Do not use local-preview mode for private or real customer data.

## Deploy to Netlify with shared persistence

1. Create a GitHub repository and upload all project files, including the `netlify` folder, `netlify.toml`, and `package.json`.
2. In Netlify, import the repository as a new site. Publish directory: `.`. Functions directory: `netlify/functions` (already set in `netlify.toml`).
3. In **Site configuration → Environment variables**, set:
   - `ADMIN_PASSWORD`: a long, unique admin password.
   - `SESSION_SECRET`: a separate random secret, at least 32 random characters.
   Set these for Functions/Builds as applicable, then redeploy.
4. Netlify Functions use Netlify Blobs for shared shipment storage. The included `package.json` lists `@netlify/blobs`; Netlify installs dependencies during build. The admin login endpoint signs a time-limited token and the shipment write/delete endpoint checks it.
5. Test admin login, create a test shipment, then open the site's public URL in a private/incognito window and track its ID.

### Important deployment notes

- The Netlify-hosted version stores shipment records in Netlify Blobs, so the same records can be read across visitors. Confirm current Netlify plan and Blobs usage limits before relying on it for production.
- Keep `ADMIN_PASSWORD` and `SESSION_SECRET` private. Never put secrets in `app.js` or any public file.
- This starter uses one admin password, not multiple user accounts, password reset, rate limiting, or a full audit log. For a public commercial service, add stronger authentication and abuse protection before launch.
- Public tracking endpoints intentionally omit private shipments. Admin API access is protected by a signed, expiring token.
- Maps use OpenStreetMap tiles, Nominatim geocoding and the public OSRM routing demo service. These public services have usage policies and are not guaranteed SLAs. For heavy/production traffic, use a provider and plan appropriate to your traffic. Avoid repeated high-volume geocoding requests.
- Road-like modes (car, motorcycle, truck, walking) request a route from OSRM. The public demo routing service does not distinguish truck or motorcycle restrictions. Plane/ship use a straight-line route in this first version. The marker animates along the selected route over the specified duration, even if that duration is not a physically realistic travel time.
- The website needs an internet connection for map tiles, geocoding and route lookup.
- No real GPS, carrier API, customs status, or delivery confirmation is connected.

## Main files

- `index.html`: customer tracking page, admin login/dashboard and shipment form.
- `styles.css`: responsive layout.
- `app.js`: form handling, map, route, progress simulation and local preview fallback.
- `netlify/functions/login.js`: admin login and signed session token.
- `netlify/functions/shipments.js`: public reads and protected writes using Netlify Blobs.

## Troubleshooting

- If the admin login reports missing environment variables after deployment, add both variables in Netlify and redeploy.
- If map routes fail, check internet access and try a more specific location such as `Yenagoa, Bayelsa, Nigeria`.
- If a map provider is rate-limiting requests, wait before trying again. Public demo services are not guaranteed.
- Netlify Functions require a Netlify deployment or Netlify Dev; opening `index.html` directly runs local preview mode.
