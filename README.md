# GlobalTrack

A polished, responsive shipment tracking website plus a separate admin portal. Supports multi-stage journeys using air, sea, road, bus, car and train. This app calculates a scheduled position from the start time and stage durations; it does not receive live GPS or carrier telemetry.

## Files
- Main public site: root (`index.html`, `styles.css`, `app.js`)
- Separate admin site: `admin/`
- Shared API/backend: `netlify/functions/`
- Persistent shipment records: Netlify Blobs

## Deploy the main site
1. Upload this project to a GitHub repository.
2. Import that repository into Netlify.
3. Build command: `npm install`
4. Publish directory: `.`. Functions directory: `netlify/functions`.
5. Set environment variables in Netlify Project configuration:
   - `ADMIN_PASSWORD`: strong unique admin password
   - `SESSION_SECRET`: a separate random secret of at least 32 characters
   - `ADMIN_ORIGIN`: optional, set to the exact admin-site origin once deployed, e.g. `https://your-admin-site.netlify.app`
6. Redeploy after setting variables.

## Deploy admin separately
Create a second Netlify site from the same Git repository. Configure:
- Base directory: `admin`
- Publish directory: `.`
- Build command: leave blank (or `npm install` if Netlify asks)
- Functions are not needed on the admin site.

After deploying the main site, set the admin website's API base URL. Open the admin site, open browser developer tools Console and run:
`localStorage.setItem('globaltrack_api_base','https://YOUR-MAIN-SITE.netlify.app')`
Then refresh. Replace the example with the actual main-site URL. This is a one-time per browser setup in this starter build. For a polished production setup, configure `API_BASE` in `admin/admin.js` before deployment instead.

For CORS, set `ADMIN_ORIGIN` on the main site's environment variables to the exact admin site URL, then redeploy the main site. Do not use a trailing slash.

## Remove Netlify branding badge
In Netlify open the relevant site -> Project configuration -> General -> Powered by Netlify badge -> turn it off -> Save. This is a per-site setting and takes effect without redeploying.

## Important
- This is scheduled simulated tracking, not real-time GPS or verified carrier tracking. Don't represent the simulated marker as a verified live location.
- Map tiles and place lookup use OpenStreetMap/Nominatim. Road routes use OSRM's public demo routing service. Public endpoints have usage limits and are not guaranteed for commercial-scale production.
- Keep `ADMIN_PASSWORD` and `SESSION_SECRET` only in Netlify environment variables. Never put secrets in GitHub or browser JavaScript.
- The sample tracking record is a local preview convenience; remove it from `app.js` before presenting the site as a live customer service. Real shipments are managed through the admin backend.
