import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CalendarDays, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function StaffCalendar({ staff, offDaysRaw, setOffDaysRaw, setStaff }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [isCollapsed, setIsCollapsed] = useLocalStorage('hhs_cal_collapsed', false);
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [openPopup, setOpenPopup] = useState(null); // staffId of open recurring popup
  const [roleFilter, setRoleFilter] = useState('All');

  // Derive unique roles from staff list
  const allRoles = ['All', ...Array.from(new Set(staff.flatMap(s => s.roles || (s.role ? [s.role] : []))))];
  const filteredStaff = roleFilter === 'All' ? staff : staff.filter(s => (s.roles || [s.role]).includes(roleFilter));

  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function dateKey(day) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function toggleOff(staffId, day) {
    const key = dateKey(day);
    setOffDaysRaw(prev => {
      const staffSet = new Set(prev[staffId] || []);
      if (staffSet.has(key)) staffSet.delete(key);
      else staffSet.add(key);
      return { ...prev, [staffId]: Array.from(staffSet) };
    });
  }

  function isOff(staff, day) {
    const dow = new Date(viewYear, viewMonth, day).getDay();
    const isRecurringOff = (staff.recurring_off_days || []).includes(dow);
    const isAbsoluteOff = (offDaysRaw[staff.id] || []).includes(dateKey(day));
    return isRecurringOff || isAbsoluteOff;
  }

  function toggleRecurring(staffId, dow) {
    setStaff(prev => prev.map(s => {
      if (s.id !== staffId) return s;
      const recurring = s.recurring_off_days || [];
      return {
        ...s,
        recurring_off_days: recurring.includes(dow) 
          ? recurring.filter(d => d !== dow)
          : [...recurring, dow]
      };
    }));
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // --- Roster Pattern Generator ---
  function RosterPatternModal({ onClose }) {
    const [selStaff, setSelStaff] = useState(staff[0]?.id || '');
    const [patternStr, setPatternStr] = useState('14,14'); // days on, days off
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [cycles, setCycles] = useState(3);

    const applyPattern = (e) => {
      e.preventDefault();
      if (!selStaff) return;
      const [onDays, offDays] = patternStr.split(',').map(Number);
      if (!onDays || !offDays) return alert("Invalid pattern");

      setOffDaysRaw(prev => {
        const staffSet = new Set(prev[selStaff] || []);
        let current = new Date(startDate);
        
        for (let i = 0; i < cycles; i++) {
          // Skip 'on' days
          current.setDate(current.getDate() + onDays);
          
          // Mark 'off' days
          for (let j = 0; j < offDays; j++) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            staffSet.add(`${y}-${m}-${d}`);
            current.setDate(current.getDate() + 1);
          }
        }
        return { ...prev, [selStaff]: Array.from(staffSet) };
      });
      onClose();
    };

    return (
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <h2>Crisis Roster Generator</h2>
            <button className="close-btn" onClick={onClose}><X size={20} /></button>
          </div>
          <form onSubmit={applyPattern}>
            <div className="form-group">
              <label>Select Staff</label>
              <select className="form-control" value={selStaff} onChange={e => setSelStaff(e.target.value)}>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.roles?.join(', ') || s.role})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Pattern (Days On / Days Off)</label>
              <select className="form-control" value={patternStr} onChange={e => setPatternStr(e.target.value)}>
                <option value="14,14">2 Weeks On, 2 Weeks Off</option>
                <option value="7,7">1 Week On, 1 Week Off</option>
                <option value="5,2">5 Days On, 2 Days Off</option>
                <option value="21,7">3 Weeks On, 1 Week Off</option>
              </select>
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Number of Cycles</label>
              <input type="number" min="1" max="20" className="form-control" value={cycles} onChange={e => setCycles(parseInt(e.target.value))} required />
            </div>
            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Generate Off-Days</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ marginTop: '2rem', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>📅 Staff Off-Days Calendar</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => setShowPatternModal(true)}>
            <CalendarDays size={14} /> Crisis Roster
          </button>
          {!isCollapsed && (
            <>
              <button className="icon-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
              <span style={{ fontWeight: 600, minWidth: 160, textAlign: 'center' }}>{monthName}</span>
              <button className="icon-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
            </>
          )}
          <button className="icon-btn" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Expand" : "Collapse"}>
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {showPatternModal && <RosterPatternModal onClose={() => setShowPatternModal(false)} />}

      {!isCollapsed && (
        <>
          {/* Role filter pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {allRoles.map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: 20,
                  border: `1px solid ${roleFilter === role ? 'rgba(240,59,106,0.6)' : 'var(--border-glass)'}`,
                  background: roleFilter === role
                    ? 'linear-gradient(135deg, rgba(240,59,106,0.2), rgba(167,139,250,0.15))'
                    : 'rgba(255,255,255,0.04)',
                  color: roleFilter === role ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: roleFilter === role ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                }}
              >
                {role}
                {role !== 'All' && (
                  <span style={{ marginLeft: '0.35rem', opacity: 0.55, fontSize: '0.65rem' }}>
                    {staff.filter(s => (s.roles || [s.role]).includes(role)).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="cal-table">
              <thead>
            <tr>
              <th className="cal-staff-col">Staff</th>
              {days.map(d => {
                const dow = new Date(viewYear, viewMonth, d).getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <th key={d} className={`cal-day-col${isWeekend ? ' weekend' : ''}`}>
                    <div>{DAYS[dow]}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{d}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map(s => (
              <tr key={s.id}>
                <td className="cal-staff-name" style={{ verticalAlign: 'middle', paddingTop: '0.4rem', paddingBottom: '0.4rem', position: 'relative', textAlign: 'center' }}>
                  <div
                    onClick={() => setOpenPopup(openPopup === s.id ? null : s.id)}
                    title="Click to set recurring off-days"
                    style={{ fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    {s.name}
                    <span style={{ fontSize: '0.6rem', opacity: 0.45 }}>▾</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{s.roles?.join(', ') || s.role}</div>

                  {/* Recurring off-day popup */}
                  {openPopup === s.id && (
                    <>
                      {/* Backdrop to close on outside click */}
                      <div
                        onClick={() => setOpenPopup(null)}
                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 100,
                        background: 'linear-gradient(135deg, rgba(25,12,45,0.98), rgba(20,8,38,0.99))',
                        border: '1px solid rgba(240,59,106,0.3)',
                        borderRadius: 10, padding: '0.75rem',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        minWidth: 180,
                      }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Recurring Off Days
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {DAYS.map((dowStr, i) => {
                            const isRec = (s.recurring_off_days || []).includes(i);
                            return (
                              <button key={i}
                                onClick={(e) => { e.stopPropagation(); toggleRecurring(s.id, i); }}
                                title={`Toggle ${dowStr} as recurring off-day`}
                                style={{
                                  fontSize: '0.72rem', padding: '0.25rem 0.45rem', cursor: 'pointer',
                                  borderRadius: 6,
                                  border: `1px solid ${isRec ? '#fca5a5' : 'rgba(255,255,255,0.15)'}`,
                                  background: isRec ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                                  color: isRec ? '#f87171' : 'var(--text-secondary)',
                                  fontWeight: isRec ? 700 : 400,
                                  transition: 'all 0.15s',
                                }}
                              >
                                {dowStr}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.62rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
                          Click a day to toggle recurring off
                        </div>
                      </div>
                    </>
                  )}
                </td>
                {days.map(d => {
                  const dow = new Date(viewYear, viewMonth, d).getDay();
                  const isRecOff = (s.recurring_off_days || []).includes(dow);
                  const isAbsOff = (offDaysRaw[s.id] || []).includes(dateKey(d));
                  const off = isRecOff || isAbsOff;
                  const isWeekend = dow === 0 || dow === 6;
                  
                  return (
                    <td
                      key={d}
                      className={`cal-cell${off ? ' off' : ''}${isWeekend ? ' weekend' : ''}`}
                      onClick={() => !isRecOff && toggleOff(s.id, d)}
                      title={isRecOff ? `${s.name} is always off on ${DAYS[dow]}s (Recurring)` : (isAbsOff ? `${s.name} is OFF on this specific day` : `Mark ${s.name} off on this day`)}
                      style={{ cursor: isRecOff ? 'not-allowed' : 'pointer' }}
                    >
                      {isAbsOff && <span className="off-dot" style={{ background: '#ef4444' }}>✕</span>}
                      {isRecOff && <span className="off-dot" style={{ background: '#fca5a5', opacity: 0.8 }}>R</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

        <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Click any cell to toggle a day off for a staff member. Red = off day.
        </p>
        </>
      )}
    </div>
  );
}
