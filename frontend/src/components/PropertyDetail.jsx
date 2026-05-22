import React, { useMemo, useState } from 'react';
import { ArrowLeft, Home, Calendar, TrendingUp, Clock, Star, Brain, ChevronRight, MapPin, Wifi, Car, Key, Bath } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function nightsBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
}

const STATUS_COLORS = {
  confirmed: { bg: 'rgba(45,212,172,0.12)', border: 'rgba(45,212,172,0.35)', text: '#2dd4af' },
  pending:   { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
  cancelled: { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   text: '#f87171' },
};

// Occupancy bar chart — last 12 weeks
function OccupancyChart({ bookings, propertyId }) {
  const weeks = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (11 - i) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      // Count booked nights in this week for this property
      let booked = 0;
      bookings.filter(b => b.property_id === propertyId && b.status !== 'cancelled').forEach(b => {
        const start = new Date(b.check_in_date + 'T00:00:00');
        const end   = new Date(b.check_out_date + 'T00:00:00');
        for (let d = new Date(Math.max(start, weekStart)); d <= Math.min(end, weekEnd); d.setDate(d.getDate() + 1)) {
          booked++;
        }
      });
      const occ = Math.min(100, Math.round((booked / 7) * 100));
      const label = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      return { label, occ, booked };
    });
  }, [bookings, propertyId]);

  const max = Math.max(...weeks.map(w => w.occ), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.3rem', height: 64, width: '100%' }}>
      {weeks.map((w, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div
            title={`${w.label}: ${w.occ}% occupancy`}
            style={{
              width: '100%',
              height: `${Math.max(4, (w.occ / 100) * 52)}px`,
              borderRadius: '3px 3px 0 0',
              background: w.occ > 70 ? 'linear-gradient(180deg,#2dd4af,#0d9488)' :
                          w.occ > 30 ? 'linear-gradient(180deg,#60a5fa,#2563eb)' :
                                       'rgba(255,255,255,0.1)',
              transition: 'height 0.3s ease',
              cursor: 'default',
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function PropertyDetail({ property, bookings, gridCols, gridRows, onBack }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState(null);

  // ── Match this property's grid row by name ──────────────────────────────
  const gridRow = useMemo(() => {
    if (!gridRows || !gridCols) return null;
    const nameCol = gridCols.find(c => c.id === 'col_name');
    if (!nameCol) return null;
    return gridRows.find(r => (r[nameCol.id] || '').toLowerCase() === property.name.toLowerCase()) || null;
  }, [gridRows, gridCols, property.name]);

  // ── Booking analytics ────────────────────────────────────────────────────
  const propBookings = useMemo(() =>
    bookings.filter(b => b.property_id === property.id && b.status !== 'cancelled')
      .sort((a, b) => a.check_in_date > b.check_in_date ? 1 : -1),
    [bookings, property.id]
  );

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = propBookings.filter(b => b.check_in_date >= today);
  const past     = propBookings.filter(b => b.check_in_date < today);

  const totalNights = propBookings.reduce((s, b) => s + nightsBetween(b.check_in_date, b.check_out_date), 0);
  const avgStay = propBookings.length ? (totalNights / propBookings.length).toFixed(1) : 0;

  // Occupancy over last 90 days
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyStr = ninetyDaysAgo.toISOString().slice(0, 10);
  let bookedIn90 = 0;
  propBookings.forEach(b => {
    const start = b.check_in_date  > ninetyStr ? b.check_in_date  : ninetyStr;
    const end   = b.check_out_date < today     ? b.check_out_date : today;
    if (start < end) bookedIn90 += nightsBetween(start, end);
  });
  const occupancyRate = Math.min(100, Math.round((bookedIn90 / 90) * 100));

  const nextBooking = upcoming[0] || null;
  const lastBooking = [...past].reverse()[0] || null;

  // ── Grid info fields (excluding name col) ───────────────────────────────
  const infoFields = gridRow && gridCols
    ? gridCols.filter(c => c.id !== 'col_name').map(c => ({ label: c.label, value: gridRow[c.id] || '', type: c.type }))
    : [];

  const FIELD_ICONS = {
    'Full Address': <MapPin size={13} />,
    'WiFi Password': <Wifi size={13} />,
    'Parking': <Car size={13} />,
    'Keybox Code': <Key size={13} />,
    'No. of Bathrooms': <Bath size={13} />,
  };

  return (
    <div style={{ padding: '1.5rem', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', borderRadius: 9, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          <ArrowLeft size={14} /> Back to Properties
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, rgba(167,139,250,0.9))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🏠 {property.name}
          </h1>
          {gridRow?.col_address && (
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <MapPin size={11} /> {gridRow.col_address}
            </p>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {property.bedrooms && (
            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderRadius: 20, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd' }}>
              {property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
        {[
          {
            icon: <TrendingUp size={18} />,
            label: 'Occupancy Rate',
            value: `${occupancyRate}%`,
            sub: 'Last 90 days',
            color: occupancyRate > 70 ? '#2dd4af' : occupancyRate > 40 ? '#60a5fa' : '#f87171',
            bg: occupancyRate > 70 ? 'rgba(45,212,172,0.08)' : occupancyRate > 40 ? 'rgba(96,165,250,0.08)' : 'rgba(248,113,113,0.08)',
          },
          {
            icon: <Clock size={18} />,
            label: 'Avg Length of Stay',
            value: avgStay ? `${avgStay} nights` : '—',
            sub: `Over ${propBookings.length} booking${propBookings.length !== 1 ? 's' : ''}`,
            color: '#a78bfa',
            bg: 'rgba(167,139,250,0.08)',
          },
          {
            icon: <Calendar size={18} />,
            label: 'Total Bookings',
            value: propBookings.length,
            sub: `${upcoming.length} upcoming`,
            color: '#fbbf24',
            bg: 'rgba(251,191,36,0.08)',
          },
          {
            icon: <Star size={18} />,
            label: 'Nights Booked',
            value: totalNights,
            sub: 'All time',
            color: '#f472b6',
            bg: 'rgba(244,114,182,0.08)',
          },
        ].map((tile, i) => (
          <div key={i} style={{ background: tile.bg, border: `1px solid ${tile.color}30`, borderRadius: 14, padding: '1rem 1.1rem' }}>
            <div style={{ color: tile.color, marginBottom: '0.5rem', opacity: 0.8 }}>{tile.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: tile.color, lineHeight: 1 }}>{tile.value}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tile.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '0.15rem' }}>{tile.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Occupancy chart ── */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>📈 Occupancy — Last 12 Weeks</h3>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.65rem' }}>
                {[['#2dd4af','High (>70%)'],['#60a5fa','Mid (30-70%)'],['rgba(255,255,255,0.15)','Low']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
                  </div>
                ))}
              </div>
            </div>
            <OccupancyChart bookings={bookings} propertyId={property.id} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', opacity: 0.5 }}>12 weeks ago</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', opacity: 0.5 }}>This week</span>
            </div>
          </div>

          {/* ── Upcoming bookings ── */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1.1rem 1.25rem' }}>
            <h3 style={{ margin: '0 0 0.9rem', fontSize: '0.9rem', fontWeight: 700 }}>
              ✈️ Upcoming Bookings ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', opacity: 0.5, fontSize: '0.82rem' }}>No upcoming bookings.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {upcoming.slice(0, 6).map(bk => {
                  const nights = nightsBetween(bk.check_in_date, bk.check_out_date);
                  const sc = STATUS_COLORS[bk.status] || STATUS_COLORS.confirmed;
                  return (
                    <div key={bk.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.6rem 0.85rem', border: '1px solid var(--border-glass)' }}>
                      <div style={{ minWidth: 90 }}>
                        <div style={{ fontSize: '0.72rem', color: '#2dd4af', fontWeight: 700 }}>{formatDate(bk.check_in_date)}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>→ {formatDate(bk.check_out_date)}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bk.guest_name || 'Guest'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{nights} night{nights !== 1 ? 's' : ''} · check-in {bk.check_in_time}</div>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, textTransform: 'capitalize', flexShrink: 0 }}>
                        {bk.status}
                      </span>
                    </div>
                  );
                })}
                {upcoming.length > 6 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, textAlign: 'center', paddingTop: '0.25rem' }}>
                    +{upcoming.length - 6} more upcoming
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Booking history ── */}
          {past.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1.1rem 1.25rem' }}>
              <h3 style={{ margin: '0 0 0.9rem', fontSize: '0.9rem', fontWeight: 700 }}>🕓 Recent History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {[...past].reverse().slice(0, 5).map(bk => {
                  const nights = nightsBetween(bk.check_in_date, bk.check_out_date);
                  return (
                    <div key={bk.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: 0.75 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: 100 }}>{formatDate(bk.check_in_date)}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', flex: 1 }}>{bk.guest_name || 'Guest'}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{nights}n</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── AI Performance Evaluation ── */}
          <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(240,59,106,0.04))', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: '1.25rem 1.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, rgba(167,139,250,0.3), rgba(240,59,106,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={16} style={{ color: '#c4b5fd' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>AI Performance Evaluation</h3>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.7 }}>Powered by Claude AI</p>
                </div>
              </div>
              <button
                disabled
                title="Add CLAUDE_API_KEY to Netlify to enable"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: 9, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', fontSize: '0.8rem', fontWeight: 600, cursor: 'not-allowed', opacity: 0.6 }}
              >
                <Brain size={13} /> Generate Analysis
              </button>
            </div>

            {aiEvaluation ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {aiEvaluation}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {/* Placeholder sections */}
                {[
                  { label: '📊 Performance Summary', text: 'Overall occupancy, revenue efficiency, and trend direction for this property.' },
                  { label: '✅ Strengths', text: 'What this property does well — high demand periods, guest satisfaction signals, turnaround efficiency.' },
                  { label: '⚠️ Areas to Watch', text: 'Low occupancy windows, cleaning bottlenecks, or patterns that may need attention.' },
                  { label: '💡 Recommendations', text: 'AI-suggested actions: pricing adjustments, maintenance windows, or staffing optimisations.' },
                ].map((sec, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.7rem 0.9rem', border: '1px solid rgba(167,139,250,0.12)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '0.3rem' }}>{sec.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.55, fontStyle: 'italic' }}>{sec.text}</div>
                    {/* Skeleton shimmer bars */}
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {[80, 95, 65].map((w, j) => (
                        <div key={j} style={{ height: 6, width: `${w}%`, borderRadius: 3, background: 'rgba(167,139,250,0.12)' }} />
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
                    🔑 Add <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>CLAUDE_API_KEY</code> in Netlify → Site Settings → Environment Variables to unlock
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Property Info ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Property Info card */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1rem 1.15rem' }}>
            <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.88rem', fontWeight: 700 }}>📋 Property Info</h3>
            {infoFields.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {infoFields.filter(f => f.value).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.6, flexShrink: 0, paddingTop: 1 }}>
                      {FIELD_ICONS[f.label] || <ChevronRight size={13} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{f.label}</div>
                      {f.type === 'link' ? (
                        <a href={f.value.startsWith('http') ? f.value : `https://${f.value}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-all' }}>{f.value}</a>
                      ) : (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>{f.value}</div>
                      )}
                    </div>
                  </div>
                ))}
                {infoFields.filter(f => f.value).length === 0 && (
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.5 }}>No info filled in yet. Edit in the Property Info grid.</p>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.5 }}>Fill in the Property Info grid to see details here.</p>
            )}
          </div>

          {/* Next booking card */}
          {nextBooking && (
            <div style={{ background: 'rgba(45,212,172,0.06)', border: '1px solid rgba(45,212,172,0.25)', borderRadius: 14, padding: '1rem 1.15rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#2dd4af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Next Check-in</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDate(nextBooking.check_in_date)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{nextBooking.guest_name || 'Guest'} · {nextBooking.check_in_time}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '0.15rem' }}>{nightsBetween(nextBooking.check_in_date, nextBooking.check_out_date)} nights</div>
              {(() => {
                const daysUntil = Math.round((new Date(nextBooking.check_in_date) - new Date()) / 86400000);
                return daysUntil >= 0 ? (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 20, background: 'rgba(45,212,172,0.12)', border: '1px solid rgba(45,212,172,0.25)', color: '#2dd4af', display: 'inline-block', fontWeight: 700 }}>
                    In {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* Stats mini-card */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1rem 1.15rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', fontWeight: 700 }}>🔢 Quick Stats</h3>
            {[
              ['Confirmed bookings', propBookings.filter(b => b.status === 'confirmed').length],
              ['Pending bookings',   propBookings.filter(b => b.status === 'pending').length],
              ['Cancelled',         bookings.filter(b => b.property_id === property.id && b.status === 'cancelled').length],
              ['Bedrooms',          property.bedrooms || '—'],
              ['Check-in type',     property.checkin_type || 'Standard'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
