import React, { useRef, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle, AlertCircle, X, MapPin, Loader } from 'lucide-react';

const KNOWN_NAME_COLS = ['property name', 'name', 'unit', 'property', 'unit name', 'apartment', 'villa', 'address', 'title'];
const KNOWN_LAT_COLS  = ['latitude', 'lat'];
const KNOWN_LNG_COLS  = ['longitude', 'lng', 'long', 'lon'];
const KNOWN_MAP_COLS  = ['google maps', 'maps link', 'map link', 'location', 'maps', 'map', 'google map', 'directions', 'url', 'link'];

function findCol(headers, candidates) {
  return headers.find(h => candidates.includes(h.toLowerCase().trim())) || null;
}

// ── URL parsers ──────────────────────────────────────────────────────────────

/** Extract lat/lng from a Google Maps URL if it contains them inline */
function extractCoordsFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // Format: @lat,lng  (e.g. maps.google.com/.../@25.1234,55.1234,17z)
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // Format: ?q=lat,lng  (e.g. maps.google.com/?q=25.1234,55.1234)
  m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // Format: ll=lat,lng
  m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // Format: /place/.../@lat,lng or /dir/.../@lat,lng
  m = url.match(/\/(?:place|dir)\/[^@]*@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // Format: saddr or daddr
  m = url.match(/[?&](?:saddr|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  return null;
}

/** Detect if a cell value looks like a Google Maps URL */
function isMapsUrl(val) {
  if (!val || typeof val !== 'string') return false;
  return /maps\.google\.|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(val);
}

/** Detect if this is a shortened maps URL that needs server-side resolution */
function isShortMapsUrl(url) {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
}

/** Call the backend to resolve a short URL */
async function resolveShortUrl(url) {
  try {
    const res = await fetch('http://localhost:8000/api/resolve-maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return url;
    const data = await res.json();
    return data.resolved_url || url;
  } catch {
    return url; // backend offline — return as-is
  }
}

// ────────────────────────────────────────────────────────────────────────────

export default function ExcelImport({ onImport, onClose }) {
  const fileRef = useRef();
  const [fileName, setFileName]     = useState(null);
  const [headers, setHeaders]       = useState([]);
  const [rows, setRows]             = useState([]);
  const [nameCol, setNameCol]       = useState('');
  const [detectedCol, setDetectedCol] = useState(null);
  const [mapCol, setMapCol]         = useState('');
  const [detectedMapCol, setDetectedMapCol] = useState(null);
  const [preview, setPreview]       = useState(null);   // array of property objects
  const [resolving, setResolving]   = useState(false);  // true while short URLs are being resolved
  const [error, setError]           = useState(null);

  // Build the preview array from current row data + chosen columns
  const buildPreview = useCallback(async (rowData, nCol, mCol) => {
    const latCol = findCol(Object.keys(rowData[0] || {}), KNOWN_LAT_COLS);
    const lngCol = findCol(Object.keys(rowData[0] || {}), KNOWN_LNG_COLS);

    // First pass — build with whatever coords we can extract synchronously
    const items = rowData.map((row, i) => {
      const name = (row[nCol] ?? '').toString().trim();
      if (!name) return null;

      let lat = parseFloat(latCol ? row[latCol] : 0) || 0;
      let lng = parseFloat(lngCol ? row[lngCol] : 0) || 0;
      let mapUrl = mCol ? (row[mCol] ?? '').toString().trim() : '';
      let coordStatus = 'none'; // 'none' | 'direct' | 'resolving' | 'resolved' | 'failed'

      // Try to extract coords directly from the URL (works for full Google Maps URLs)
      if (mapUrl && isMapsUrl(mapUrl)) {
        const coords = extractCoordsFromUrl(mapUrl);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          coordStatus = 'direct';
        } else if (isShortMapsUrl(mapUrl)) {
          coordStatus = 'resolving'; // needs async resolution
        } else {
          coordStatus = 'failed';   // map URL but couldn't parse coords
        }
      } else if (lat || lng) {
        coordStatus = 'direct';
      }

      return { id: 'px' + Date.now() + i, name, latitude: lat, longitude: lng, mapUrl, coordStatus };
    }).filter(Boolean);

    // Check if any items need short URL resolution
    const needsResolve = items.filter(it => it.coordStatus === 'resolving');
    if (needsResolve.length > 0) {
      setResolving(true);
      setPreview([...items]); // show spinner state immediately

      // Resolve all short URLs in parallel
      await Promise.all(needsResolve.map(async (item) => {
        const fullUrl = await resolveShortUrl(item.mapUrl);
        const coords = extractCoordsFromUrl(fullUrl);
        if (coords) {
          item.latitude = coords.lat;
          item.longitude = coords.lng;
          item.coordStatus = 'resolved';
        } else {
          item.coordStatus = 'failed';
        }
      }));

      setResolving(false);
    }

    setPreview([...items]);
    return items;
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setPreview(null);
    setHeaders([]);
    setNameCol('');
    setMapCol('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rowData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rowData.length) { setError('The sheet appears to be empty.'); return; }

        const allHeaders = Object.keys(rowData[0]);
        setHeaders(allHeaders);
        setRows(rowData);

        // Auto-detect name column
        const autoName = findCol(allHeaders, KNOWN_NAME_COLS) || allHeaders[0];
        setDetectedCol(autoName);
        setNameCol(autoName);

        // Auto-detect maps link column — first try known names, then scan values
        let autoMap = findCol(allHeaders, KNOWN_MAP_COLS);
        if (!autoMap) {
          // Scan each column's first few values to see if any contain a Maps URL
          autoMap = allHeaders.find(h => {
            return rowData.slice(0, 5).some(row => isMapsUrl((row[h] ?? '').toString()));
          }) || '';
        }
        setDetectedMapCol(autoMap || null);
        setMapCol(autoMap || '');

        await buildPreview(rowData, autoName, autoMap || '');
      } catch (err) {
        setError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleColChange(field, value) {
    if (field === 'name') setNameCol(value);
    if (field === 'map') setMapCol(value);
    const nCol = field === 'name' ? value : nameCol;
    const mCol = field === 'map'  ? value : mapCol;
    setError(null);
    const mapped = await buildPreview(rows, nCol, mCol);
    if (!mapped.length) setError('No non-empty values found in that column.');
  }

  function handleImport() {
    if (preview?.length) {
      // Strip internal fields before sending to parent
      onImport(preview.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })));
      onClose();
    }
  }

  const resolvedCount = preview?.filter(p => p.latitude || p.longitude).length ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📂 Import Properties from Excel</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Upload any <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> file.
          Google Maps links are auto-detected and coordinates extracted automatically.
        </p>

        <div className="upload-zone" onClick={() => fileRef.current.click()}>
          <Upload size={32} style={{ opacity: 0.6 }} />
          <p style={{ margin: '0.5rem 0 0' }}>
            {fileName ? fileName : 'Click to select file'}
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }} onChange={handleFile} />
        </div>

        {headers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
            {/* Name column picker */}
            <div className="form-group" style={{ margin: 0 }}>
              <label>
                Property Name Column
                {detectedCol && <span style={{ color: 'var(--success)', marginLeft: '0.5rem', fontSize: '0.72rem' }}>
                  ✓ auto: "{detectedCol}"
                </span>}
              </label>
              <select className="form-control" value={nameCol} onChange={e => handleColChange('name', e.target.value)}>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* Maps link column picker */}
            <div className="form-group" style={{ margin: 0 }}>
              <label>
                <MapPin size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Google Maps Column
                {detectedMapCol && <span style={{ color: 'var(--brand-pink)', marginLeft: '0.5rem', fontSize: '0.72rem' }}>
                  ✓ auto: "{detectedMapCol}"
                </span>}
              </label>
              <select className="form-control" value={mapCol} onChange={e => handleColChange('map', e.target.value)}>
                <option value="">— none —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="import-error" style={{ marginTop: '0.75rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Preview table */}
        {preview?.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                <CheckCircle size={16} />
                <strong>{preview.length} properties ready</strong>
              </div>
              {resolvedCount > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--brand-pink)' }}>
                  📍 {resolvedCount} with coordinates
                </span>
              )}
              {resolving && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Resolving map links…
                </span>
              )}
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.25rem' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px', gap: '0.5rem',
                padding: '0.3rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-glass)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <span>Name</span><span>Latitude</span><span>Longitude</span><span>Source</span>
              </div>

              {preview.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px', gap: '0.5rem',
                  padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-glass)', fontSize: '0.83rem',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span style={{ opacity: p.latitude ? 1 : 0.3 }}>{p.latitude ? p.latitude.toFixed(5) : '—'}</span>
                  <span style={{ opacity: p.longitude ? 1 : 0.3 }}>{p.longitude ? p.longitude.toFixed(5) : '—'}</span>
                  <span>
                    {p.coordStatus === 'direct'    && <span title="Extracted from URL" style={{ color: 'var(--success)', fontSize: '0.75rem' }}>📍 direct</span>}
                    {p.coordStatus === 'resolved'  && <span title="Resolved via backend" style={{ color: 'var(--brand-pink)', fontSize: '0.75rem' }}>🔗 resolved</span>}
                    {p.coordStatus === 'resolving' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>⏳ …</span>}
                    {p.coordStatus === 'failed'    && <span title="Could not extract coords" style={{ color: '#f87171', fontSize: '0.75rem' }}>⚠ failed</span>}
                    {p.coordStatus === 'none'      && <span style={{ opacity: 0.3, fontSize: '0.75rem' }}>—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!preview?.length || resolving} onClick={handleImport}>
            {resolving ? 'Resolving…' : `Import ${preview?.length ?? ''} Properties`}
          </button>
        </div>
      </div>
    </div>
  );
}
