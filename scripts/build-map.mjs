import fs from 'node:fs';
import { geoEquirectangular, geoPath } from 'd3-geo';
const land = JSON.parse(fs.readFileSync(new URL('../public/world-land.geojson', import.meta.url), 'utf8'));
const projection = geoEquirectangular().translate([480, 255]).scale(146);
const outline = geoPath(projection)(land);
if (!outline || outline.length < 1000) throw new Error('Missing world map geometry');
fs.writeFileSync(new URL('../lib/world-map.json', import.meta.url), JSON.stringify({ outline, source: 'Natural Earth 1:110m land, public domain', sourceUrl: 'https://www.naturalearthdata.com/about/terms-of-use/' }));
console.log('Projected Natural Earth land geometry.');
