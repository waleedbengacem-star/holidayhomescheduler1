import React, { useState, useRef, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { getDefaultDuration } from '../utils';

function toTimeStr(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** Extract coords from a Google Maps URL */
function extractCoords(url) {
  if (!url) return null;
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

function isMapsUrl(url) {
  return /maps\.google|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
}
function isShortMapsUrl(url) {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
}

/** Live Maps link verification badge */
function MapsLinkField({ defaultValue = '' }) {
  const [status, setStatus] = useState(() => {
    if (!defaultValue) return null;
    const coords = extractCoords(defaultValue);
    if (coords) return { ok: true, lat: coords.lat, lng: coords.lng };
    if (isShortMapsUrl(defaultValue)) return { ok: 'short' };
    if (isMapsUrl(defaultValue)) return { ok: false };
    return null;
  });

  function handleChange(e) {
    const url = e.target.value.trim();
    if (!url) { setStatus(null); return; }
    const coords = extractCoords(url);
    if (coords) { setStatus({ ok: true, lat: coords.lat, lng: coords.lng }); return; }
    if (isShortMapsUrl(url)) { setStatus({ ok: 'short' }); return; }
    if (isMapsUrl(url)) { setStatus({ ok: false }); return; }
    setStatus(null);
  }

  return (
    <div className="form-group">
      <label>Google Maps Link <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(optional — auto-extracts coordinates)</span></label>
      <input
        name="google_maps_link"
        className="form-control"
        defaultValue={defaultValue}
        placeholder="https://maps.app.goo.gl/... or full Google Maps URL"
        onChange={handleChange}
      />
      {status && (
        <div style={{
          marginTop: '0.4rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
          color: status.ok === true ? 'var(--success)' : status.ok === 'short' ? 'var(--warning)' : '#f87171'
        }}>
          {status.ok === true && <><span>✓</span><span>Coordinates verified: {status.lat.toFixed(5)}, {status.lng.toFixed(5)}</span></>}
          {status.ok === 'short' && <><span>🔗</span><span>Short link — coordinates will be resolved when the schedule is generated</span></>}
          {status.ok === false && <><span>⚠️</span><span>Maps link found but no coordinates could be extracted. Try copying the full URL.</span></>}
        </div>
      )}
    </div>
  );
}

/** Searchable property picker */
function PropertyPicker({ properties }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(properties[0] || null);
  const wrapRef = useRef();

  useEffect(() => {
    function onDown(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = properties.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const hasLoc = (p) => !!(p.latitude && p.longitude);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input type="hidden" name="property_id" value={selected?.id ?? ''} />
      <button type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        style={{
          width: '100%', textAlign: 'left', background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--border-glass)', color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          padding: '0.75rem 1rem', borderRadius: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          ...(open ? { borderColor: 'var(--brand-pink)', boxShadow: '0 0 0 2px rgba(240,59,106,0.2)' } : {}),
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {selected ? (
            <>
              <span>{selected.name}</span>
              {hasLoc(selected)
                ? <span style={{ fontSize: '0.68rem', color: 'var(--success)', background: 'rgba(45,212,172,0.1)', border: '1px solid rgba(45,212,172,0.25)', borderRadius: 4, padding: '0.05rem 0.3rem' }}>📍</span>
                : <span style={{ fontSize: '0.68rem', color: 'var(--warning)', opacity: 0.7, borderRadius: 4, padding: '0.05rem 0.3rem' }}>⚠️ no location</span>
              }
            </>
          ) : <span style={{ opacity: 0.5 }}>Select a property…</span>}
        </span>
        <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-glass-strong)',
          borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-glass)', position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter properties…"
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.4rem 0.75rem 0.4rem 2rem', borderRadius: 6, fontSize: '0.85rem', outline: 'none' }} />
          </div>
          <ul style={{ listStyle: 'none', maxHeight: 220, overflowY: 'auto', padding: '0.25rem 0' }}>
            {filtered.length === 0 && (
              <li style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', opacity: 0.6 }}>No properties match "{query}"</li>
            )}
            {filtered.map(p => {
              const loc = hasLoc(p);
              const isActive = selected?.id === p.id;
              return (
                <li key={p.id} onClick={() => { setSelected(p); setOpen(false); setQuery(''); }}
                  style={{
                    padding: '0.55rem 1rem', cursor: 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                    background: isActive ? 'rgba(240,59,106,0.12)' : 'transparent', color: isActive ? 'var(--brand-pink)' : 'var(--text-primary)', transition: 'background 0.12s'
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                  <span>{p.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                    {loc
                      ? <span title={`${p.latitude?.toFixed(4)}, ${p.longitude?.toFixed(4)}`} style={{ fontSize: '0.68rem', color: 'var(--success)', background: 'rgba(45,212,172,0.1)', border: '1px solid rgba(45,212,172,0.25)', borderRadius: 4, padding: '0.05rem 0.35rem' }}>📍 Located</span>
                      : <span style={{ fontSize: '0.68rem', color: 'rgba(251,191,36,0.8)', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 4, padding: '0.05rem 0.35rem' }}>⚠️ No location</span>
                    }
                    {isActive && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <div style={{ padding: '0.4rem 1rem', borderTop: '1px solid var(--border-glass)', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
            <span>📍 {properties.filter(hasLoc).length} located</span>
            <span>⚠️ {properties.filter(p => !hasLoc(p)).length} missing</span>
            <span style={{ marginLeft: 'auto' }}>{filtered.length} shown</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddModal({ type, properties, onSave, onClose }) {
  const durationRef = useRef(null);

  function handleTaskTypeChange(e, propId) {
    if (!durationRef.current) return;
    const val = e.target.value;
    const prop = properties.find(p => p.id === propId);
    const beds = prop ? (prop.bedrooms || 1) : 1;
    durationRef.current.value = getDefaultDuration(val, beds, 1).toString();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    if (type === 'property') {
      const mapUrl = (d.google_maps_link || '').trim();
      let lat = parseFloat(d.latitude) || 0;
      let lng = parseFloat(d.longitude) || 0;
      if ((!lat || !lng) && mapUrl) {
        const coords = extractCoords(mapUrl);
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }
      const checkinMins = d.guest_checkin_time ? parseTime(d.guest_checkin_time) : null;
      onSave({ id: 'p' + Date.now(), name: d.name, bedrooms: parseInt(d.bedrooms) || 1, latitude: lat, longitude: lng, google_maps_link: mapUrl, mapUrl, guest_checkin_time_mins: checkinMins, access_method: d.access_method || '', checkin_type: d.checkin_type || 'Self Check-in' });
    } else if (type === 'checkin') {
      onSave({ 
        property_id: d.property_id, 
        time_mins: parseTime(d.guest_checkin_time), 
        day: d.day,
        meet_and_greet: d.meet_and_greet || '',
        cash_collection: d.cash_collection || ''
      });
    } else if (type === 'staff') {
      const roles = ['PA', 'Cleaner', 'Handyman', 'Reservations', 'Accountant'].filter(r => d[`role_${r}`]);
      if (roles.length === 0) roles.push('Cleaner'); // fallback
      onSave({ id: 's' + Date.now(), name: d.name, roles, has_car: !!d.has_car, start_time_mins: 0, end_time_mins: 1440 });
    } else if (type === 'task') {
      // Strict role mapping — PA handles guest-facing and transport; Cleaner handles cleaning work
      const roleMap = {
        'Cleaning': ['Cleaner'], // legacy
        'Checkout Cleaning': ['Cleaner'],
        'Check-in Cleaning': ['Cleaner'],
        'Deep Cleaning': ['Cleaner'],
        'Mid-stay Cleaning': ['Cleaner'],
        'Linen Change': ['Cleaner'],
        'Touch Up': ['Cleaner'],
        'Inspection': ['Cleaner'],
        'Drop-off / Pick-up': ['PA'],
        'Check-in': ['PA'],
        'Cash Collection': ['PA'],
        'Pay Collect': ['PA'],
        'Viewings': ['PA'],
        'Maintenance': ['Handyman'],
        'Picture / Measurement': ['Cleaner', 'PA'],
      };
      const roles = roleMap[d.task_type] ?? ['Cleaner'];
      onSave({ 
        id: 't' + Date.now(), 
        property_id: d.property_id, 
        task_type: d.task_type, 
        duration_mins: parseInt(d.duration_mins), 
        time_window_start_mins: parseTime(d.time_window_start), 
        time_window_end_mins: parseTime(d.time_window_end), 
        required_roles: roles, 
        priority: parseInt(d.priority),
        cash_collection: d.cash_collection || '',
        notes: d.notes || '',
        inspection_staff: d.inspection_staff || '',
        target_day: d.target_day || null
      });
    }
    onClose();
  }

  const title = type === 'property' ? 'Add Property' : type === 'staff' ? 'Add Staff Member' : type === 'checkin' ? 'Add Guest Arrival' : 'Add Task';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {type === 'property' && (
            <>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Property Name</label>
                  <input name="name" className="form-control" required placeholder="e.g. Ocean View Villa" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Bedrooms</label>
                  <input name="bedrooms" type="number" min="0" className="form-control" required defaultValue="1" />
                </div>
              </div>
              {/* Live-verifying Maps link field */}
              <MapsLinkField />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Latitude <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(auto-filled from link)</span></label>
                  <input name="latitude" type="number" step="any" className="form-control" placeholder="25.0" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Longitude</label>
                  <input name="longitude" type="number" step="any" className="form-control" placeholder="55.1" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Access Method (Keys / Smartloc)</label>
                  <input name="access_method" className="form-control" placeholder="e.g. Keyless + Smartloc" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Check-in Type</label>
                  <select name="checkin_type" className="form-control" defaultValue="Self Check-in">
                    <option value="Self Check-in">Self Check-in</option>
                    <option value="Meet & Greet">Meet & Greet (PA)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {type === 'checkin' && (
            <>
              <div className="form-group">
                <label>Property</label>
                <PropertyPicker properties={properties} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Day</label>
                  <select name="day" className="form-control">
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Check-in ETA</label>
                  <input name="guest_checkin_time" type="time" className="form-control" required defaultValue="15:00" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Meet & Greet</label>
                  <input name="meet_and_greet" className="form-control" placeholder="e.g. Ranjith, Self Check-In" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Cash Collection</label>
                  <input name="cash_collection" className="form-control" placeholder="e.g. Collect 3,900" />
                </div>
              </div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.1rem', display: 'block' }}>
                🛎 The scheduler will prioritize finishing all tasks here before the guest arrives.
              </span>
            </>
          )}

          {type === 'staff' && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input name="name" className="form-control" required placeholder="e.g. Diana" />
              </div>
              <div className="form-group">
                <label>Roles</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {['PA', 'Cleaner', 'Handyman', 'Reservations', 'Accountant'].map(r => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input type="checkbox" name={`role_${r}`} value={r} defaultChecked={r === 'Cleaner'} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" name="has_car" />
                  <span style={{ fontSize: '0.9rem' }}>Has Car? (Driver)</span>
                </label>
              </div>
            </>
          )}

          {type === 'task' && (
            <>
              <div className="form-group">
                <label>Property</label>
                <PropertyPicker properties={properties} />
              </div>
              <div className="form-group">
                <label>Task Type</label>
                <select name="task_type" className="form-control" onChange={e => handleTaskTypeChange(e, document.querySelector('input[name="property_id"]')?.value)}>
                  <option value="Checkout Cleaning">Checkout Cleaning</option>
                  <option value="Check-in Cleaning">Check-in Cleaning</option>
                  <option value="Deep Cleaning">Deep Cleaning</option>
                  <option value="Mid-stay Cleaning">Mid-stay Cleaning</option>
                  <option value="Linen Change">Linen Change</option>
                  <option value="Touch Up">Touch Up</option>
                  <option value="Check-in">Check-in</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Cash Collection">Cash Collection</option>
                  <option value="Pay Collect">Pay Collect</option>
                  <option value="Viewings">Viewings</option>
                  <option value="Picture / Measurement">Picture / Measurement</option>
                  <option value="Drop-off / Pick-up">Drop-off / Pick-up</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Target Day</label>
                  <select name="target_day" className="form-control">
                    <option value="">Auto (Based on priority)</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Priority</label>
                  <select name="priority" className="form-control">
                    <option value="1">High (Must do today)</option>
                    <option value="2">Medium</option>
                    <option value="3">Low (Can push to tomorrow)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Duration (minutes)</label>
                  <input name="duration_mins" type="number" className="form-control" defaultValue="60" ref={durationRef} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Window Start</label>
                  <input name="time_window_start" type="time" className="form-control" defaultValue="09:00" required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Window End</label>
                  <input name="time_window_end" type="time" className="form-control" defaultValue="17:00" required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Cash Collection</label>
                  <input name="cash_collection" className="form-control" placeholder="e.g. Collect 8,500" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Notes</label>
                  <input name="notes" className="form-control" placeholder="e.g. Bring extra towels" />
                </div>
              </div>
              <div className="form-group">
                <label>Inspection Staff</label>
                <input name="inspection_staff" className="form-control" placeholder="e.g. Ranjith" />
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add {type.charAt(0).toUpperCase() + type.slice(1)}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
