import React, { useState, useMemo } from 'react';
import { Plus, X, Trash2, Calendar, Check, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';

const STATUS_COLORS = {
  confirmed: { bg: 'rgba(45,212,172,0.15)', border: 'rgba(45,212,172,0.4)', text: '#2dd4af' },
  pending:   { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)',  text: '#fbbf24' },
  cancelled: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   text: '#f87171' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function nightsBetween(a, b) {
  if (!a || !b) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function newId() { return 'bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

const EMPTY_FORM = {
  property_id: '',
  guest_name: '',
  check_in_date: '',
  check_in_time: '15:00',
  check_out_date: '',
  check_out_time: '11:00',
  nights: '',
  status: 'confirmed',
  notes: '',
};

export default function BookingManager({ bookings, setBookings, properties }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterProp, setFilterProp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // ── Form helpers ─────────────────────────────────────────────────────────
  const setField = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      // Auto-calculate check-out when check-in + nights change
      if ((k === 'check_in_date' || k === 'nights') && next.check_in_date && next.nights) {
        const d = new Date(next.check_in_date + 'T00:00:00');
        d.setDate(d.getDate() + parseInt(next.nights));
        next.check_out_date = d.toISOString().slice(0, 10);
      }
      // Auto-calculate nights when both dates set
      if ((k === 'check_in_date' || k === 'check_out_date') && next.check_in_date && next.check_out_date) {
        next.nights = String(nightsBetween(next.check_in_date, next.check_out_date));
      }
      return next;
    });
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, property_id: properties[0]?.id || '' });
    setShowForm(true);
  };

  const openEdit = (bk) => {
    setEditId(bk.id);
    setForm({ ...bk, nights: String(nightsBetween(bk.check_in_date, bk.check_out_date)) });
    setShowForm(true);
  };

  const saveBooking = () => {
    if (!form.property_id || !form.check_in_date || !form.check_out_date) return;
    const entry = { ...form, nights: nightsBetween(form.check_in_date, form.check_out_date) };
    if (editId) {
      setBookings(prev => prev.map(b => b.id === editId ? { ...entry, id: editId } : b));
    } else {
      setBookings(prev => [{ ...entry, id: newId() }, ...prev]);
    }
    setShowForm(false);
    setEditId(null);
  };

  const deleteBooking = (id) => {
    if (window.confirm('Delete this booking?')) setBookings(prev => prev.filter(b => b.id !== id));
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return [...bookings]
      .filter(b => filterProp === 'all' || b.property_id === filterProp)
      .filter(b => filterStatus === 'all' || b.status === filterStatus)
      .sort((a, b) => (a.check_in_date > b.check_in_date ? 1 : -1));
  }, [bookings, filterProp, filterStatus]);

  // ── Calendar view ────────────────────────────────────────────────────────
  const { year, month } = viewMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDOW = new Date(year, month, 1).getDay();
  const monthLabel = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const bookingsByDate = useMemo(() => {
    const map = {};
    bookings.filter(b => b.status !== 'cancelled').forEach(b => {
      const start = new Date(b.check_in_date + 'T00:00:00');
      const end   = new Date(b.check_out_date + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        const prop = properties.find(p => p.id === b.property_id);
        map[key].push({ ...b, propertyName: prop?.name || 'Unknown', isCheckIn: key === b.check_in_date, isCheckOut: key === b.check_out_date });
      }
    });
    return map;
  }, [bookings, properties]);

  const prevMonth = () => setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });

  // ── Smart auto-task preview (mirrors App.jsx bookingTasks logic) ────────────
  const getAutoTasks = (bk) => {
    if (!bk.check_in_date || !bk.check_out_date) return [];
    const tasks = [];

    // Checkout Cleaning always
    tasks.push({ label: 'Checkout Cleaning', date: bk.check_out_date, time: bk.check_out_time, color: '#a78bfa', icon: '🧹' });

    // Find most recent same-property checkout before this check-in
    const prevCheckout = bookings
      .filter(other =>
        other.id !== bk.id &&
        other.property_id === bk.property_id &&
        other.status !== 'cancelled' &&
        other.check_out_date &&
        other.check_out_date <= bk.check_in_date
      )
      .sort((a, b) => b.check_out_date.localeCompare(a.check_out_date))[0];

    const days = prevCheckout
      ? Math.round((new Date(bk.check_in_date) - new Date(prevCheckout.check_out_date)) / 86400000)
      : null;

    if (days === 0) {
      tasks.push({ label: 'No check-in cleaning (same-day checkout covers it)', date: bk.check_in_date, time: '—', color: 'var(--text-secondary)', icon: '✅', dim: true });
    } else if (days !== null && days <= 7) {
      tasks.push({ label: `Touch Up only (prev checkout ${days}d ago)`, date: bk.check_in_date, time: '10:00', color: '#fbbf24', icon: '🧽' });
    } else {
      tasks.push({ label: 'Check-in Cleaning', date: bk.check_in_date, time: '10:00', color: '#60a5fa', icon: '🛏️' });
    }

    tasks.push({ label: 'Check-in / Meet & Greet', date: bk.check_in_date, time: bk.check_in_time, color: '#2dd4af', icon: '✈️' });
    return tasks;
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {/* Property filter */}
        <select
          value={filterProp}
          onChange={e => setFilterProp(e.target.value)}
          className="form-control"
          style={{ width: 'auto', fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
        >
          <option value="all">All Properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="form-control"
          style={{ width: 'auto', fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
        >
          <option value="all">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center', opacity: 0.7 }}>
            {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', background: 'linear-gradient(135deg, rgba(240,59,106,0.2), rgba(167,139,250,0.15))', border: '1px solid rgba(240,59,106,0.4)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={14} /> Add Booking
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Booking Cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed var(--border-glass)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
              <p style={{ margin: 0, opacity: 0.6 }}>No bookings yet. Click <strong>Add Booking</strong> to get started.</p>
            </div>
          )}

          {filtered.map(bk => {
            const prop = properties.find(p => p.id === bk.property_id);
            const sc = STATUS_COLORS[bk.status] || STATUS_COLORS.confirmed;
            const autoTasks = getAutoTasks(bk);
            const nights = nightsBetween(bk.check_in_date, bk.check_out_date);

            return (
              <div key={bk.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1rem 1.25rem', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        🏠 {prop?.name || 'Unknown Property'}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 20, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, textTransform: 'capitalize' }}>
                        {bk.status}
                      </span>
                    </div>
                    {bk.guest_name && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <User size={12} /> {bk.guest_name}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button onClick={() => openEdit(bk)} title="Edit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', borderRadius: 7, padding: '0.25rem 0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Edit</button>
                    <button onClick={() => deleteBooking(bk.id)} title="Delete" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '0.25rem 0.4rem', cursor: 'pointer', color: '#f87171' }}><Trash2 size={12} /></button>
                  </div>
                </div>

                {/* Date row */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div style={{ background: 'rgba(45,212,172,0.08)', border: '1px solid rgba(45,212,172,0.2)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ fontSize: '0.62rem', color: '#2dd4af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Check-in</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(bk.check_in_date)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{bk.check_in_time}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem', opacity: 0.5 }}>
                    → {nights} night{nights !== 1 ? 's' : ''} →
                  </div>
                  <div style={{ background: 'rgba(240,59,106,0.08)', border: '1px solid rgba(240,59,106,0.2)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ fontSize: '0.62rem', color: '#f43f5e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Check-out</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(bk.check_out_date)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{bk.check_out_time}</div>
                  </div>
                </div>

                {/* Auto-tasks preview */}
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>Auto-scheduled tasks</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {autoTasks.map((t, i) => (
                      <span key={i} style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: 6, background: `${t.color}18`, border: `1px solid ${t.color}40`, color: t.dim ? 'var(--text-secondary)' : t.color, fontWeight: 600, opacity: t.dim ? 0.7 : 1 }}>
                        {t.icon} {t.label} · {formatDate(t.date)}
                      </span>
                    ))}
                  </div>
                </div>

                {bk.notes && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.7, fontStyle: 'italic', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem' }}>
                    📝 {bk.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Mini Calendar ── */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1rem', position: 'sticky', top: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{monthLabel}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.15rem', textAlign: 'center' }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.5, padding: '0.2rem 0' }}>{d}</div>
            ))}
            {Array.from({ length: firstDOW }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entries = bookingsByDate[iso] || [];
              const hasCheckin  = entries.some(e => e.isCheckIn);
              const hasCheckout = entries.some(e => e.isCheckOut);
              const isStay      = entries.length > 0 && !hasCheckin && !hasCheckout;
              const today = new Date().toISOString().slice(0, 10);
              return (
                <div key={day} style={{
                  padding: '0.25rem 0.1rem',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: entries.length ? 700 : 400,
                  background: hasCheckin ? 'rgba(45,212,172,0.25)' : hasCheckout ? 'rgba(240,59,106,0.2)' : isStay ? 'rgba(96,165,250,0.12)' : 'transparent',
                  color: hasCheckin ? '#2dd4af' : hasCheckout ? '#f43f5e' : isStay ? '#60a5fa' : iso === today ? 'var(--brand-pink)' : 'var(--text-secondary)',
                  border: iso === today ? '1px solid rgba(240,59,106,0.5)' : '1px solid transparent',
                  cursor: entries.length ? 'pointer' : 'default',
                  position: 'relative',
                }} title={entries.map(e => `${e.propertyName}${e.isCheckIn ? ' ✈ IN' : e.isCheckOut ? ' ✈ OUT' : ' 🌙 stay'}`).join('\n')}>
                  {day}
                  {entries.length > 0 && (
                    <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: hasCheckin ? '#2dd4af' : hasCheckout ? '#f43f5e' : '#60a5fa' }} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)' }}>
            {[['#2dd4af','Check-in'],['#f43f5e','Check-out'],['#60a5fa','Stay']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c, opacity: 0.8 }} />{l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Add / Edit Booking Modal ══ */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(135deg, rgba(25,12,45,0.99), rgba(20,8,38,0.99))', border: '1px solid rgba(240,59,106,0.3)', borderRadius: 18, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{editId ? '✏️ Edit Booking' : '📅 New Booking'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Property *</label>
                <select className="form-control" value={form.property_id} onChange={e => setField('property_id', e.target.value)}>
                  <option value="">Select property…</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Guest Name</label>
                <input className="form-control" placeholder="e.g. John Smith" value={form.guest_name} onChange={e => setField('guest_name', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Check-in Date *</label>
                  <input type="date" className="form-control" value={form.check_in_date} onChange={e => setField('check_in_date', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Check-in Time</label>
                  <input type="time" className="form-control" value={form.check_in_time} onChange={e => setField('check_in_time', e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Number of Nights</label>
                <input type="number" min="1" className="form-control" placeholder="e.g. 3" value={form.nights} onChange={e => setField('nights', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Check-out Date *</label>
                  <input type="date" className="form-control" value={form.check_out_date} onChange={e => setField('check_out_date', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Check-out Time</label>
                  <input type="time" className="form-control" value={form.check_out_time} onChange={e => setField('check_out_time', e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Status</label>
                <select className="form-control" value={form.status} onChange={e => setField('status', e.target.value)}>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Notes</label>
                <textarea className="form-control" rows={2} placeholder="e.g. Early check-in requested, pets allowed…" value={form.notes} onChange={e => setField('notes', e.target.value)} />
              </div>

              {/* Auto-task preview (smart logic) */}
              {form.check_in_date && form.check_out_date && (() => {
                const preview = getAutoTasks({ ...form, id: editId || '__preview__' });
                return (
                  <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Tasks that will be auto-generated</div>
                    {preview.map((t, i) => (
                      <div key={i} style={{ fontSize: '0.78rem', color: t.dim ? 'var(--text-secondary)' : t.color, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', opacity: t.dim ? 0.7 : 1 }}>
                        <Check size={11} /> <strong>{t.icon} {t.label}</strong> · {formatDate(t.date)} {t.time !== '—' ? `at ${t.time}` : ''}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>Cancel</button>
              <button
                onClick={saveBooking}
                className="btn-primary"
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}
                disabled={!form.property_id || !form.check_in_date || !form.check_out_date}
              >
                {editId ? 'Save Changes' : 'Add Booking & Generate Tasks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
