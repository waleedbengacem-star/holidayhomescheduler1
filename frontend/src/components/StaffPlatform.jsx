import React, { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Edit2, Check, X, Car, User, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getRoleColor(roles) {
  if (!roles || roles.length === 0) return '#a78bfa';
  if (roles[0] === 'PA') return '#0284c7';
  if (roles[0] === 'Handyman') return '#d97706';
  if (roles.length >= 2) return '#10b981';
  return '#a78bfa';
}

const ROLE_OPTIONS = ['PA', 'Cleaner', 'Handyman', 'Driver', 'Supervisor', 'Inspector'];
const TABS = ['Profiles', 'Statistics'];

export default function StaffPlatform({ staff, setStaff, schedule, completedTasks, properties }) {
  const [activeTab, setActiveTab] = useState('Profiles');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  // ── Edit helpers ────────────────────────────────────────────────────────────
  const startEdit = (s) => {
    setEditingId(s.id);
    setDraft({
      name: s.name,
      roles: [...(s.roles || [])],
      has_car: s.has_car ?? false,
      ai_notes: s.ai_notes || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setDraft({}); };

  const saveEdit = (id) => {
    setStaff(prev => prev.map(s => s.id !== id ? s : { ...s, ...draft }));
    setEditingId(null);
    setDraft({});
  };

  const toggleDraftRole = (role) => {
    setDraft(d => ({
      ...d,
      roles: d.roles.includes(role) ? d.roles.filter(r => r !== role) : [...d.roles, role],
    }));
  };

  // ── Statistics helpers ───────────────────────────────────────────────────────
  const computeStats = () => {
    if (!schedule) return {};
    const stats = {};
    staff.forEach(s => {
      stats[s.id] = { tasksScheduled: 0, tasksCompleted: 0, hoursScheduled: 0, propertiesServed: new Set() };
    });
    Object.values(schedule).forEach(daySlots => {
      daySlots.forEach(slot => {
        const st = stats[slot.staff_id];
        if (!st) return;
        slot.tasks.forEach(task => {
          if (task.is_travel) return;
          st.tasksScheduled++;
          if (completedTasks?.includes(task.task_id)) st.tasksCompleted++;
          st.hoursScheduled += (task.end_time_mins - task.start_time_mins) / 60;
          if (task.property_id && task.property_id !== 'tbd') st.propertiesServed.add(task.property_id);
        });
      });
    });
    // Convert Sets to counts
    Object.values(stats).forEach(s => { s.propertiesServed = s.propertiesServed.size; });
    return stats;
  };

  const stats = computeStats();
  const totalScheduled = Object.values(stats).reduce((a, s) => a + s.tasksScheduled, 0);
  const totalCompleted = Object.values(stats).reduce((a, s) => a + s.tasksCompleted, 0);

  return (
    <div style={{ padding: '1.5rem', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>👥 Staff Management</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {staff.length} staff members · {staff.filter(s => s.has_car).length} with car
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.3rem' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.4rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === tab ? 'linear-gradient(135deg, rgba(240,59,106,0.25), rgba(167,139,250,0.2))' : 'transparent',
                boxShadow: activeTab === tab ? 'inset 0 0 0 1px rgba(240,59,106,0.35)' : 'none',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.82rem', fontWeight: activeTab === tab ? 700 : 400,
                transition: 'all 0.18s',
              }}
            >
              {tab === 'Profiles' ? <><User size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Profiles</> : <><BarChart2 size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Statistics</>}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════ PROFILES TAB ══════════════════════════════════ */}
      {activeTab === 'Profiles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {staff.map(s => {
            const isEditing = editingId === s.id;
            const roleColor = getRoleColor(s.roles);

            return (
              <div
                key={s.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isEditing ? 'rgba(240,59,106,0.4)' : 'var(--border-glass)'}`,
                  borderRadius: 16,
                  padding: '1.25rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: isEditing ? '0 0 0 2px rgba(240,59,106,0.15)' : 'none',
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1rem' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${roleColor}44, ${roleColor}22)`,
                    border: `2px solid ${roleColor}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1rem', color: roleColor, flexShrink: 0,
                  }}>
                    {getInitials(isEditing ? draft.name : s.name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        value={draft.name}
                        onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        className="form-control"
                        style={{ fontSize: '0.9rem', fontWeight: 700, padding: '0.3rem 0.5rem' }}
                      />
                    ) : (
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{s.name}</div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: roleColor, fontWeight: 600, marginTop: '0.1rem' }}>
                      {(isEditing ? draft.roles : s.roles)?.join(' · ') || 'No role'}
                    </div>
                  </div>

                  {/* Edit / Save / Cancel */}
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(s.id)} title="Save" style={{ background: 'rgba(45,212,172,0.15)', border: '1px solid rgba(45,212,172,0.4)', borderRadius: 8, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#2dd4af' }}><Check size={14} /></button>
                        <button onClick={cancelEdit} title="Cancel" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#f87171' }}><X size={14} /></button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(s)} title="Edit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', borderRadius: 8, padding: '0.3rem 0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s' }}><Edit2 size={14} /></button>
                    )}
                  </div>
                </div>

                {/* ── Job Roles ── */}
                <div style={{ marginBottom: '0.9rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>Job Roles</div>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {ROLE_OPTIONS.map(role => {
                        const active = draft.roles.includes(role);
                        return (
                          <button key={role} onClick={() => toggleDraftRole(role)} style={{
                            padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                            border: `1px solid ${active ? roleColor : 'var(--border-glass)'}`,
                            background: active ? `${roleColor}22` : 'transparent',
                            color: active ? roleColor : 'var(--text-secondary)',
                            fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                          }}>{role}</button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {(s.roles || []).map(role => (
                        <span key={role} style={{ padding: '0.2rem 0.7rem', borderRadius: 20, fontSize: '0.75rem', background: `${getRoleColor([role])}22`, border: `1px solid ${getRoleColor([role])}44`, color: getRoleColor([role]), fontWeight: 600 }}>{role}</span>
                      ))}
                      {!s.roles?.length && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.5 }}>No roles set</span>}
                    </div>
                  )}
                </div>

                {/* ── Car ── */}
                <div style={{ marginBottom: '0.9rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>Transport</div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {[true, false].map(val => (
                        <button key={String(val)} onClick={() => setDraft(d => ({ ...d, has_car: val }))} style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.3rem 0.8rem', borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer',
                          border: `1px solid ${draft.has_car === val ? 'rgba(240,59,106,0.5)' : 'var(--border-glass)'}`,
                          background: draft.has_car === val ? 'rgba(240,59,106,0.12)' : 'transparent',
                          color: draft.has_car === val ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: draft.has_car === val ? 600 : 400,
                        }}>
                          <Car size={13} /> {val ? 'Has Car' : 'No Car'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Car size={15} style={{ color: s.has_car ? '#2dd4af' : 'var(--text-secondary)', opacity: s.has_car ? 1 : 0.4 }} />
                      <span style={{ fontSize: '0.82rem', color: s.has_car ? '#2dd4af' : 'var(--text-secondary)', fontWeight: s.has_car ? 600 : 400, opacity: s.has_car ? 1 : 0.6 }}>
                        {s.has_car ? 'Has own car' : 'No car — needs transport'}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── AI / Additional Notes ── */}
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Additional Info
                    <span style={{ fontSize: '0.6rem', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', padding: '0.05rem 0.35rem', borderRadius: 4, fontWeight: 600 }}>AI Context</span>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={draft.ai_notes}
                      onChange={e => setDraft(d => ({ ...d, ai_notes: e.target.value }))}
                      placeholder="e.g. Available only in mornings, prefers properties in Marina, speaks Arabic and English, trained for premium check-ins..."
                      className="form-control"
                      rows={3}
                      style={{ fontSize: '0.8rem', resize: 'vertical', lineHeight: 1.5 }}
                    />
                  ) : (
                    <div style={{
                      fontSize: '0.8rem', color: s.ai_notes ? 'var(--text-primary)' : 'var(--text-secondary)',
                      opacity: s.ai_notes ? 0.85 : 0.4,
                      background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.1)',
                      borderRadius: 8, padding: '0.5rem 0.75rem', lineHeight: 1.5, minHeight: 48,
                      fontStyle: s.ai_notes ? 'normal' : 'italic',
                    }}>
                      {s.ai_notes || 'No additional info yet. Click edit to add context for the AI scheduler.'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════ STATISTICS TAB ══════════════════════════════════ */}
      {activeTab === 'Statistics' && (
        <div>
          {/* Summary bar */}
          {schedule ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.9rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Staff', value: staff.length, icon: '👥', color: '#a78bfa' },
                  { label: 'Tasks Scheduled', value: totalScheduled, icon: '📋', color: '#60a5fa' },
                  { label: 'Tasks Completed', value: totalCompleted, icon: '✅', color: '#2dd4af' },
                  { label: 'Completion Rate', value: totalScheduled ? `${Math.round(totalCompleted / totalScheduled * 100)}%` : '—', icon: '📈', color: '#fbbf24' },
                  { label: 'With Car', value: staff.filter(s => s.has_car).length, icon: '🚗', color: '#f472b6' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{stat.icon}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Per-staff table */}
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-glass)' }}>
                      {['Staff Member', 'Roles', 'Transport', 'Tasks Scheduled', 'Completed', 'Hours Worked', 'Properties Served', 'Completion Rate'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s, ri) => {
                      const st = stats[s.id] || { tasksScheduled: 0, tasksCompleted: 0, hoursScheduled: 0, propertiesServed: 0 };
                      const rate = st.tasksScheduled > 0 ? Math.round(st.tasksCompleted / st.tasksScheduled * 100) : null;
                      const roleColor = getRoleColor(s.roles);
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-glass)', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                          <td style={{ padding: '0.7rem 0.9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${roleColor}22`, border: `1px solid ${roleColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: roleColor, flexShrink: 0 }}>
                                {getInitials(s.name)}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem' }}>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {(s.roles || []).map(r => (
                                <span key={r} style={{ padding: '0.1rem 0.5rem', borderRadius: 20, fontSize: '0.7rem', background: `${getRoleColor([r])}22`, color: getRoleColor([r]), fontWeight: 600 }}>{r}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem' }}>
                            <span style={{ fontSize: '0.8rem', color: s.has_car ? '#2dd4af' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Car size={13} /> {s.has_car ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'center', fontWeight: 600, color: '#60a5fa' }}>{st.tasksScheduled}</td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'center', fontWeight: 600, color: '#2dd4af' }}>{st.tasksCompleted}</td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'center', color: '#fbbf24', fontWeight: 600 }}>{st.hoursScheduled.toFixed(1)}h</td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'center', color: '#c4b5fd', fontWeight: 600 }}>{st.propertiesServed}</td>
                          <td style={{ padding: '0.7rem 0.9rem' }}>
                            {rate !== null ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${rate}%`, borderRadius: 3, background: rate >= 80 ? '#2dd4af' : rate >= 50 ? '#fbbf24' : '#f87171', transition: 'width 0.4s' }} />
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: rate >= 80 ? '#2dd4af' : rate >= 50 ? '#fbbf24' : '#f87171', minWidth: 36 }}>{rate}%</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.4 }}>No data</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
              <h3 style={{ margin: '0 0 0.5rem', opacity: 0.7 }}>No schedule generated yet</h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.5 }}>Generate a schedule in the Scheduler platform to see staff statistics.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
