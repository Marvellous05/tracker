GLOBALTRACK PUBLIC WEBSITE REDESIGN

This package replaces ONLY the public-facing website files:
- index.html
- styles.css
- app.js

IMPORTANT:
Do not delete or replace your existing admin folder, netlify folder, netlify.toml, package.json, or Netlify environment variables. Those contain your existing admin/login and shipment-storage setup.

HOW TO UPDATE THE EXISTING GITHUB PROJECT
1. Download and extract this ZIP on your computer.
2. Open your existing GlobalTrack GitHub repository.
3. Replace the existing root-level index.html, styles.css, and app.js with the three files from this ZIP.
4. Leave the admin/ folder, netlify/ folder, netlify.toml, and package.json exactly as they are.
5. Commit the changes. Netlify should deploy the updated public website automatically.

MAP NOTES
The shipment map uses Leaflet, OpenStreetMap tiles, and Photon place search. Internet access is required for map tiles and place lookup. Air and sea stages are drawn as clean route connections; road stages currently use a direct route line rather than turn-by-turn road directions.

The public page continues to read shipment records from /.netlify/functions/shipments using the existing tracking-number query.
