import React, { useState } from 'react';
import { X, Play, FileText, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { getDefaultDuration } from '../utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse raw WhatsApp export into message blocks { time, sender, body } */
function parseMessages(raw) {
  const lines = raw.split('\n');
  const blocks = [];
  const stampRe = /^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]\s*([^:]+):\s*(.*)/i;
  let current = null;

  lines.forEach(line => {
    const m = line.match(stampRe);
    if (m) {
      if (current) blocks.push(current);
      current = { time: m[1], date: m[2], sender: m[3].trim(), body: m[4] };
    } else if (current) {
      current.body += '\n' + line;
    }
  });
  if (current) blocks.push(current);
  return blocks;
}

/** Try to extract a "Building Name + Unit Number" from a string.
 *  Returns { raw, building, unit } or null */
function extractUnitRef(text) {
  // Handles: "Burj crown 3501-2B", "Celadon 507", "J One 1110 A", "EMAAR PALACE 1806 T1 18", "Studio One -2012"
  const re = /([A-Za-z][A-Za-z\s\-]{1,30}?)\s+(\d{3,4}(?:[- ][A-Za-z0-9]+)?(?:\s+[A-Za-z][A-Za-z0-9\s]{0,4})?)/;
  const m = text.match(re);
  if (!m) return null;
  const building = m[1].trim();
  const unit = m[2].trim();
  // Filter out false positives (day names, weekday-like words, short common words)
  const skipWords = ['available', 'permit', 'parking', 'access', 'internet', 'working', 'not', 'first', 'fire', 'hair'];
  if (skipWords.some(w => building.toLowerCase() === w)) return null;
  return { raw: `${building} ${unit}`, building, unit };
}

/** Fuzzy-match a unit reference against known properties (by building keyword) */
function matchProperty(ref, properties) {
  if (!ref) return null;
  const bldLower = ref.building.toLowerCase();
  return properties.find(p => {
    const pn = p.name.toLowerCase();
    // Check if any word of building appears in property name or vice versa
    const bWords = bldLower.split(/\s+/).filter(w => w.length > 2);
    return bWords.some(w => pn.includes(w));
  }) || null;
}

/** Check if a line indicates something is missing/unavailable */
function hasIssue(line) {
  return /not\s+available|not available|missing|leaking|blocked|broken|issue|doesn.t work|does not work|no parking|no card/i.test(line);
}

/** Parse an inspection-style checklist from a message body.
 *  Returns { issues: string[], items: {label, status}[] } */
function parseChecklist(body) {
  const lines = body.split('\n');
  const items = [];
  const issues = [];
  lines.forEach(l => {
    const m = l.match(/^(.+?)\s*[–\-:]\s*(.+)$/);
    if (!m) return;
    const label = m[1].trim();
    const status = m[2].trim();
    const isIssue = /not available|not\s+available|missing|not\s+present/i.test(status);
    items.push({ label, status, isIssue });
    if (isIssue) issues.push(`${label}: ${status}`);
  });
  return { items, issues };
}

/** Detect if a message body describes a resolved/completed action */
function isResolved(body) {
  return /done|resolved|completed|finished|fixed|delivered|working normal|normal|attended|confirmed/i.test(body);
}

/** Detect operational task type and role from body text */
function detectTask(body) {
  const l = body.toLowerCase();
  if (/drain|ac leak|fcu|water leak|plumb/i.test(l))    return { type: 'AC / Plumbing Repair', role: 'Handyman' };
  if (/gas stove|spark|gas cooker/i.test(l))            return { type: 'Gas Appliance Repair', role: 'Handyman' };
  if (/lock|smart lock|access card|key/i.test(l))       return { type: 'Lock / Access Issue', role: 'PA' };
  if (/clean/i.test(l))                                 return { type: 'Cleaning', role: 'Cleaner' };
  if (/mobile|lost.*(found|item)|found.*(mobile|item)/i.test(l)) return { type: 'Lost & Found', role: 'PA' };
  if (/viewing/i.test(l))                               return { type: 'Property Viewing', role: 'PA' };
  if (/collect|deliver|pass|bring/i.test(l))            return { type: 'Errand / Delivery', role: 'PA' };
  if (/missing|not available/i.test(l))                 return { type: 'Missing Item', role: 'PA' };
  return null;
}

/** Check urgency */
function detectPriority(body) {
  if (/urgent|asap|immediately|right now|waiting|emergency|as soon as/i.test(body)) return '🔴 URGENT';
  return '🟡 SCHEDULED';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WhatsAppImportModal({ properties, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [inspectionText, setInspectionText] = useState('');
  const [operationalText, setOperationalText] = useState('');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [importDate, setImportDate] = useState(yesterday.toISOString().split('T')[0]);

  const [report, setReport] = useState({
    inspections: [], operations: [], urgent: [], flagged: [], resolved: [],
    summary: { total: 0, resolved: 0, pending: 0, carried: 0 }
  });

  // ── Parser ──────────────────────────────────────────────────────────────────
  const parseAll = () => {
    if (!inspectionText.trim() && !operationalText.trim()) {
      return alert('Please paste some WhatsApp messages first.');
    }

    const inspections = [];
    const operations = [];
    const urgent = [];
    const flagged = [];
    const resolved = [];

    // ── 1. INSPECTION MESSAGES ────────────────────────────────────────────────
    // The inspection group often has: a unit name line, then a checklist block.
    // We split on timestamp blocks; within each block we find the unit then parse the checklist.
    const insMsgs = parseMessages(inspectionText);

    // Also handle non-timestamped checklist dumps (paste without timestamps)
    const allInsBlocks = insMsgs.length > 0
      ? insMsgs
      : [{ time: 'Unknown', sender: 'Staff', body: inspectionText }];

    allInsBlocks.forEach(msg => {
      const lines = msg.body.split('\n').map(l => l.trim()).filter(Boolean);

      // Try to find unit reference in the first 1-3 lines
      let unitRef = null;
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        unitRef = extractUnitRef(lines[i]);
        if (unitRef) break;
      }

      // If no unit on first lines, check entire body (for non-timestamped dumps)
      if (!unitRef) unitRef = extractUnitRef(msg.body.split('\n')[0]);

      if (!unitRef) return; // Can't associate without a unit

      const matchedProp = matchProperty(unitRef, properties);
      const checklist = parseChecklist(msg.body);

      const entry = {
        id: 'i_' + Date.now() + Math.random().toString(36).slice(2, 6),
        unit: unitRef.raw,
        property_id: matchedProp?.id || null,
        type: 'Inspection',
        time: msg.time,
        status: checklist.issues.length > 0 ? '⚠️ Issue' : '✅ Clear',
        details: checklist.issues.length > 0
          ? checklist.issues.slice(0, 2).join(', ')
          : 'All items checked OK',
        hasIssue: checklist.issues.length > 0,
        checklist: checklist.items,
        issues: checklist.issues
      };
      inspections.push(entry);

      // Auto-create Missing Item tasks for each flagged checklist item
      checklist.issues.forEach(issue => {
        const t = {
          id: 'io_' + Date.now() + Math.random().toString(36).slice(2, 6),
          unit: unitRef.raw,
          property_id: matchedProp?.id || null,
          task_type: 'Missing Item',
          priority: '🟡 SCHEDULED',
          role: 'PA',
          details: issue,
        };
        operations.push(t);
      });
    });

    // Handle non-timestamped inspection dumps (split on blank-line unit groups)
    if (insMsgs.length === 0 && inspectionText.trim()) {
      // already handled above via fallback block
    }

    // Handle inspection text WITHOUT timestamps at all (just unit + checklist blocks)
    if (insMsgs.length === 0) {
      // Split on lines that look like unit refs (all caps words or contain numbers)
      const rawLines = inspectionText.split('\n');
      let currentUnit = null;
      let checklistBuf = [];

      const flushChecklist = () => {
        if (!currentUnit || checklistBuf.length === 0) return;
        const matchedProp = matchProperty(currentUnit, properties);
        const checklist = parseChecklist(checklistBuf.join('\n'));
        inspections.push({
          id: 'i_' + Date.now() + Math.random().toString(36).slice(2, 6),
          unit: currentUnit.raw,
          property_id: matchedProp?.id || null,
          type: 'Inspection',
          time: 'Logged',
          status: checklist.issues.length > 0 ? '⚠️ Issue' : '✅ Clear',
          details: checklist.issues.length > 0 ? checklist.issues.slice(0, 2).join(', ') : 'All items checked OK',
          hasIssue: checklist.issues.length > 0,
          issues: checklist.issues
        });
        checklist.issues.forEach(issue => {
          operations.push({
            id: 'io_' + Date.now() + Math.random().toString(36).slice(2, 6),
            unit: currentUnit.raw,
            property_id: matchedProp?.id || null,
            task_type: 'Missing Item',
            priority: '🟡 SCHEDULED',
            role: 'PA',
            details: issue
          });
        });
        checklistBuf = [];
      };

      rawLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const ref = extractUnitRef(trimmed);
        const isChecklistLine = /–|-/.test(trimmed) && trimmed.split(/–|-/).length === 2;
        if (ref && !isChecklistLine) {
          flushChecklist();
          currentUnit = ref;
        } else if (currentUnit) {
          checklistBuf.push(trimmed);
        }
      });
      flushChecklist();
    }

    // ── 2. OPERATIONAL MESSAGES ───────────────────────────────────────────────
    const opsMsgs = parseMessages(operationalText);

    opsMsgs.forEach(msg => {
      const body = msg.body.trim();
      if (!body || body.startsWith('http')) return;

      // Skip pure @mention lines or photo notifications
      if (/^@\w|^\d+ photo/i.test(body)) return;

      // Detect unit reference anywhere in the body
      const lines = body.split('\n');
      let unitRef = null;
      for (const line of lines) {
        unitRef = extractUnitRef(line);
        if (unitRef) break;
      }

      const matchedProp = unitRef ? matchProperty(unitRef, properties) : null;
      const taskDef = detectTask(body);

      // Detect resolved messages
      if (isResolved(body) && unitRef) {
        resolved.push({
          id: 'r_' + Date.now() + Math.random().toString(36).slice(2, 6),
          unit: unitRef.raw,
          property_id: matchedProp?.id || null,
          task_type: taskDef?.type || 'General Task',
          priority: '🔵 INFO',
          role: taskDef?.role || 'PA',
          details: body.substring(0, 80) + (body.length > 80 ? '…' : '')
        });
        return;
      }

      if (!taskDef && !unitRef) return; // Can't classify

      const priority = detectPriority(body);
      const unit = unitRef ? unitRef.raw : '[UNIT UNCLEAR — needs confirmation]';
      const type = taskDef?.type || 'General Task';
      const role = taskDef?.role || 'PA';

      if (!unitRef && !taskDef) return;

      const t = {
        id: 'o_' + Date.now() + Math.random().toString(36).slice(2, 6),
        unit,
        property_id: matchedProp?.id || null,
        task_type: type,
        priority,
        role,
        details: body.substring(0, 100) + (body.length > 100 ? '…' : '')
      };

      if (!unitRef) {
        flagged.push({ ...t, reason: '[UNIT UNCLEAR — needs confirmation]' });
      } else {
        operations.push(t);
        if (priority === '🔴 URGENT') urgent.push(t);
      }
    });

    setReport({
      inspections,
      operations,
      urgent,
      flagged,
      resolved,
      summary: {
        total: inspections.length + operations.length + resolved.length,
        resolved: resolved.length,
        pending: operations.length,
        carried: 0
      }
    });
    setStep(2);
  };

  // ── Save to scheduler ─────────────────────────────────────────────────────
  const handleSave = () => {
    const newTasks = [];
    const addTask = (op, isHistorical = false) => {
      if (!op.property_id) return; // can't schedule without a linked property
      const prop = properties.find(p => p.id === op.property_id);
      const beds = prop ? (prop.bedrooms || 1) : 1;
      newTasks.push({
        id: op.id,
        property_id: op.property_id,
        task_type: op.task_type,
        duration_mins: getDefaultDuration(op.task_type, beds, 1),
        time_window_start_mins: 540,
        time_window_end_mins: 1020,
        required_roles: [op.role],
        priority: op.priority.includes('URGENT') ? 1 : 2,
        assigned_date: isHistorical ? importDate : undefined,
        notes: op.details
      });
    };

    report.operations.forEach(op => addTask(op, false));
    report.resolved.forEach(op => addTask(op, true));
    onSave({ tasks: newTasks });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const Table = ({ headers, rows, emptyMsg }) => (
    <div style={{ border: '1px solid var(--border-glass)', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
        <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
          <tr>
            {headers.map(h => <th key={h} style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-glass)', whiteSpace: 'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ padding: '0.9rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{emptyMsg}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {row.map((cell, j) => <td key={j} style={{ padding: '0.6rem 0.75rem', verticalAlign: 'top' }}>{cell}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );

  const PriorityBadge = ({ p }) => {
    const color = p.includes('URGENT') ? '#F7698A' : p.includes('SCHEDULED') ? '#FBBF24' : '#60A5FA';
    return <span style={{ color, fontWeight: 600 }}>{p}</span>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '920px', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.18)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#25D366', color: 'white', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><FileText size={20} /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Operations Command Center</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {step === 1 ? 'Step 1 — Paste & Extract' : 'Step 2–3 — Report & Prioritize'}
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '1.4rem', overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Paste raw WhatsApp exports. Timestamps optional.</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Log Date:</span>
                  <input type="date" value={importDate} onChange={e => setImportDate(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, color: 'var(--brand-pink)', display: 'block', marginBottom: '0.4rem' }}>1. INSPECTION GROUP MESSAGES</label>
                <textarea value={inspectionText} onChange={e => setInspectionText(e.target.value)}
                  placeholder="Paste check-in / check-out messages & checklists here…"
                  style={{ width: '100%', height: '155px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.9rem', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.83rem', resize: 'vertical', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#0284c7', display: 'block', marginBottom: '0.4rem' }}>2. OPERATIONAL GROUP MESSAGES</label>
                <textarea value={operationalText} onChange={e => setOperationalText(e.target.value)}
                  placeholder="Paste maintenance requests, repairs, lost & found, confirmations…"
                  style={{ width: '100%', height: '155px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.9rem', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.83rem', resize: 'vertical', outline: 'none' }}
                />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.8rem 1rem', borderRadius: '8px', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                <strong>3. AVAILABLE RESOURCES</strong> — Auto-pulled from your Active Staff list.
              </div>

              <button className="action-btn" onClick={parseAll} style={{ background: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,0.25)' }}>
                <Play size={17} /> Parse & Generate Report
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Day Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
                {[
                  { label: 'TOTAL TASKS', value: report.summary.total, color: 'var(--text-primary)' },
                  { label: 'RESOLVED', value: report.summary.resolved, color: '#2DD4AC' },
                  { label: 'PENDING', value: report.summary.pending, color: '#FBBF24' },
                  { label: 'CARRIED OVER', value: report.summary.carried, color: 'var(--text-secondary)' },
                ].map(c => (
                  <div key={c.label} className="glass-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Urgent Alerts */}
              {report.urgent.length > 0 && (
                <div style={{ background: 'rgba(240,59,106,0.1)', border: '1px solid rgba(240,59,106,0.25)', borderRadius: '8px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#F7698A', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <AlertTriangle size={16}/> URGENT ALERTS
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.4rem', fontSize: '0.83rem', lineHeight: 1.7 }}>
                    {report.urgent.map((u, i) => <li key={i}><strong>{u.unit}</strong> — {u.task_type}: {u.details}</li>)}
                  </ul>
                </div>
              )}

              {/* Flagged */}
              {report.flagged.length > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <AlertCircle size={16}/> UNASSIGNED / FLAGGED
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.4rem', fontSize: '0.83rem', lineHeight: 1.7 }}>
                    {report.flagged.map((f, i) => <li key={i}>{f.reason}: "{f.details}"</li>)}
                  </ul>
                </div>
              )}

              {/* Inspection Table */}
              <div>
                <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.6rem 0' }}>INSPECTION REPORT TABLE</h3>
                <Table
                  headers={['Unit', 'Type', 'Time', 'Status', 'Details']}
                  emptyMsg="No inspection data found"
                  rows={report.inspections.map(i => [
                    <strong>{i.unit}</strong>,
                    i.type,
                    i.time,
                    <span style={{ color: i.hasIssue ? '#F7698A' : '#2DD4AC', fontWeight: 600 }}>{i.status}</span>,
                    <span style={{ color: 'var(--text-secondary)' }}>{i.details}</span>
                  ])}
                />
              </div>

              {/* Operational Table */}
              <div>
                <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.6rem 0' }}>OPERATIONAL TASK TABLE</h3>
                <Table
                  headers={['Unit', 'Task', 'Priority', 'Assigned Role', 'Details']}
                  emptyMsg="No operational tasks found"
                  rows={report.operations.map(o => [
                    <strong>{o.unit}</strong>,
                    o.task_type,
                    <PriorityBadge p={o.priority} />,
                    o.role,
                    <span style={{ color: 'var(--text-secondary)' }}>{o.details}</span>
                  ])}
                />
              </div>

              {/* Resolved */}
              {report.resolved.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.6rem 0', color: '#2DD4AC', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={15}/> RESOLVED TODAY
                  </h3>
                  <Table
                    headers={['Unit', 'Task', 'Details']}
                    emptyMsg=""
                    rows={report.resolved.map(r => [
                      <strong>{r.unit}</strong>,
                      r.task_type,
                      <span style={{ color: 'var(--text-secondary)' }}>{r.details}</span>
                    ])}
                  />
                </div>
              )}

              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <Info size={15} color="#0284c7" style={{ marginTop: 2 }} />
                <span><strong>STEP 4 — TOMORROW'S SCHEDULE</strong>: Generated automatically by the routing engine once you confirm below.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
          {step === 2 && <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back to Edit</button>}
          {step === 2 && <button className="btn-primary" style={{ flex: 2, background: '#25D366' }} onClick={handleSave}>Confirm & Pass to Routing Engine</button>}
        </div>
      </div>
    </div>
  );
}
