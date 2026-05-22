import React, { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Trash2, Plus, GripVertical, Edit2, Check, X } from 'lucide-react';
import BookingManager from './BookingManager';

const DEFAULT_COLS = [
  { id: 'col_name',     label: 'Property Name',    type: 'text',  width: 200, fixed: true },
  { id: 'col_address',  label: 'Full Address',      type: 'text',  width: 260 },
  { id: 'col_maps',     label: 'Maps Link',         type: 'link',  width: 220 },
  { id: 'col_wifi',     label: 'WiFi Password',     type: 'text',  width: 150 },
  { id: 'col_parking',  label: 'Parking',           type: 'text',  width: 140 },
  { id: 'col_keybox',   label: 'Keybox Code',       type: 'text',  width: 130 },
  { id: 'col_baths',    label: 'No. of Bathrooms',  type: 'number',width: 130 },
  { id: 'col_floors',   label: 'Total Floors',      type: 'number',width: 110 },
];

const DEFAULT_ROWS = [
  { id: 'row_1', col_name: 'Villa Sunset',         col_address: '', col_maps: '', col_wifi: '', col_parking: '', col_keybox: '', col_baths: '', col_floors: '' },
  { id: 'row_2', col_name: 'Downtown Apartment',   col_address: '', col_maps: '', col_wifi: '', col_parking: '', col_keybox: '', col_baths: '', col_floors: '' },
  { id: 'row_3', col_name: 'Marina Penthouse',     col_address: '', col_maps: '', col_wifi: '', col_parking: '', col_keybox: '', col_baths: '', col_floors: '' },
];

function newRowId() { return 'row_' + Date.now(); }
function newColId() { return 'col_' + Date.now(); }

export default function PropertyGrid({ bookings, setBookings, properties }) {
  const [activeTab, setActiveTab] = useState('grid');
  const [cols, setCols] = useLocalStorage('hhs_prop_grid_cols', DEFAULT_COLS);
  const [rows, setRows] = useLocalStorage('hhs_prop_grid_rows', DEFAULT_ROWS);
  const [editingCell, setEditingCell] = useState(null); // { rowId, colId }
  const [editingColId, setEditingColId] = useState(null); // col header rename
  const [colDraft, setColDraft] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [search, setSearch] = useState('');
  const cellRef = useRef(null);

  // Focus cell input when editingCell changes
  useEffect(() => {
    if (cellRef.current) cellRef.current.focus();
  }, [editingCell]);

  const filteredRows = rows.filter(row =>
    !search.trim() || Object.values(row).some(v =>
      String(v).toLowerCase().includes(search.toLowerCase())
    )
  );

  // ── Cell value helpers ─────────────────────────────────────────────────────
  const getCellVal = (row, colId) => row[colId] ?? '';
  const setCellVal = (rowId, colId, val) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [colId]: val } : r));
  };

  // ── Row actions ────────────────────────────────────────────────────────────
  const addRow = () => {
    const newRow = { id: newRowId() };
    cols.forEach(c => { newRow[c.id] = ''; });
    setRows(prev => [...prev, newRow]);
  };

  const deleteRow = (rowId) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    setSelectedRows(prev => { const n = new Set(prev); n.delete(rowId); return n; });
  };

  const deleteSelected = () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`Delete ${selectedRows.size} row(s)?`)) return;
    setRows(prev => prev.filter(r => !selectedRows.has(r.id)));
    setSelectedRows(new Set());
  };

  const toggleRow = (rowId) => {
    setSelectedRows(prev => {
      const n = new Set(prev);
      n.has(rowId) ? n.delete(rowId) : n.add(rowId);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === filteredRows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredRows.map(r => r.id)));
  };

  // ── Column actions ─────────────────────────────────────────────────────────
  const addColumn = () => {
    if (!newColName.trim()) return;
    const col = { id: newColId(), label: newColName.trim(), type: newColType, width: 150 };
    setCols(prev => [...prev, col]);
    setRows(prev => prev.map(r => ({ ...r, [col.id]: '' })));
    setNewColName('');
    setNewColType('text');
    setShowAddCol(false);
  };

  const deleteColumn = (colId) => {
    if (!window.confirm('Remove this column and all its data?')) return;
    setCols(prev => prev.filter(c => c.id !== colId));
    setRows(prev => prev.map(r => { const n = { ...r }; delete n[colId]; return n; }));
  };

  const startRenameCol = (col) => {
    setEditingColId(col.id);
    setColDraft(col.label);
  };

  const commitRenameCol = () => {
    if (colDraft.trim()) {
      setCols(prev => prev.map(c => c.id === editingColId ? { ...c, label: colDraft.trim() } : c));
    }
    setEditingColId(null);
  };

  // ── Cell renderer ──────────────────────────────────────────────────────────
  const renderCell = (row, col) => {
    const val = getCellVal(row, col.id);
    const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;

    if (isEditing) {
      return (
        <input
          ref={cellRef}
          value={val}
          onChange={e => setCellVal(row.id, col.id, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
          }}
          style={{
            width: '100%', border: 'none', outline: 'none',
            background: 'rgba(167,139,250,0.08)', color: 'var(--text-primary)',
            fontSize: '0.82rem', padding: '0.3rem 0.5rem',
            borderRadius: 4,
          }}
        />
      );
    }

    if (col.type === 'link' && val) {
      return (
        <a
          href={val.startsWith('http') ? val : `https://${val}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ color: '#60a5fa', fontSize: '0.8rem', textDecoration: 'underline', textUnderlineOffset: 2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {val}
        </a>
      );
    }

    return (
      <span style={{ fontSize: '0.82rem', color: val ? 'var(--text-primary)' : 'var(--text-secondary)', opacity: val ? 1 : 0.3 }}>
        {val || '—'}
      </span>
    );
  };

  return (
    <div style={{ padding: '1.5rem', minHeight: '100vh' }}>

      {/* ── Platform Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>🏠 Properties</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {rows.length} properties · {bookings?.length || 0} bookings
          </p>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.3rem' }}>
          {[['grid','📋 Property Info'],['bookings','📅 Bookings']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '0.4rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === key ? 'linear-gradient(135deg, rgba(240,59,106,0.25), rgba(167,139,250,0.2))' : 'transparent',
                boxShadow: activeTab === key ? 'inset 0 0 0 1px rgba(240,59,106,0.35)' : 'none',
                color: activeTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.82rem', fontWeight: activeTab === key ? 700 : 400,
                transition: 'all 0.18s',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Bookings Tab ── */}
      {activeTab === 'bookings' && (
        <BookingManager
          bookings={bookings || []}
          setBookings={setBookings || (() => {})}
          properties={properties || []}
        />
      )}

      {/* ── Property Info Grid Tab ── */}
      {activeTab === 'grid' && (<>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: '0.85rem' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search properties..."
              style={{
                paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.4rem', paddingBottom: '0.4rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem', width: 200,
              }}
            />
          </div>
          {selectedRows.size > 0 && (
            <button onClick={deleteSelected} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#f87171', fontSize: '0.8rem', cursor: 'pointer' }}>
              <Trash2 size={13} /> Delete {selectedRows.size}
            </button>
          )}
          <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', background: 'linear-gradient(135deg, rgba(240,59,106,0.2), rgba(167,139,250,0.15))', border: '1px solid rgba(240,59,106,0.4)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Add Property
          </button>
        </div>

      {/* ── Grid Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
          {/* Column widths */}
          <colgroup>
            <col style={{ width: 36 }} /> {/* checkbox */}
            {cols.map(c => <col key={c.id} style={{ width: c.width }} />)}
            <col style={{ width: 36 }} /> {/* delete */}
          </colgroup>

          {/* ── Header row ── */}
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-glass)' }}>
              {/* Select all */}
              <th style={{ padding: '0.6rem', textAlign: 'center', borderRight: '1px solid var(--border-glass)' }}>
                <input type="checkbox" checked={selectedRows.size === filteredRows.length && filteredRows.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
              </th>

              {cols.map(col => (
                <th key={col.id} style={{ padding: '0', textAlign: 'left', borderRight: '1px solid var(--border-glass)', position: 'relative', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.55rem 0.6rem', minHeight: 38 }}>
                    {editingColId === col.id ? (
                      <input
                        autoFocus
                        value={colDraft}
                        onChange={e => setColDraft(e.target.value)}
                        onBlur={commitRenameCol}
                        onKeyDown={e => { if (e.key === 'Enter') commitRenameCol(); if (e.key === 'Escape') setEditingColId(null); }}
                        style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, border: 'none', outline: 'none', background: 'rgba(167,139,250,0.1)', color: 'var(--text-primary)', borderRadius: 4, padding: '0.15rem 0.3rem' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={() => !col.fixed && startRenameCol(col)}
                        title={col.fixed ? col.label : 'Double-click to rename'}
                        style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em', textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: col.fixed ? 'default' : 'text' }}
                      >
                        {col.label}
                      </span>
                    )}
                    {!col.fixed && editingColId !== col.id && (
                      <button
                        onClick={() => deleteColumn(col.id)}
                        title="Remove column"
                        style={{ opacity: 0, padding: '0.1rem', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
                        className="col-del-btn"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </th>
              ))}

              {/* Add column */}
              <th style={{ padding: '0', textAlign: 'center', width: 36 }}>
                <button
                  onClick={() => setShowAddCol(true)}
                  title="Add column"
                  style={{ width: '100%', height: '100%', padding: '0.55rem 0.4rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                >
                  <Plus size={15} />
                </button>
              </th>
            </tr>
          </thead>

          {/* ── Body rows ── */}
          <tbody>
            {filteredRows.map((row, ri) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: '1px solid var(--border-glass)',
                  background: selectedRows.has(row.id)
                    ? 'rgba(167,139,250,0.07)'
                    : ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!selectedRows.has(row.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!selectedRows.has(row.id)) e.currentTarget.style.background = ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'; }}
              >
                {/* Checkbox */}
                <td style={{ padding: '0.4rem', textAlign: 'center', borderRight: '1px solid var(--border-glass)', verticalAlign: 'middle' }}>
                  <input type="checkbox" checked={selectedRows.has(row.id)} onChange={() => toggleRow(row.id)} style={{ cursor: 'pointer' }} />
                </td>

                {/* Data cells */}
                {cols.map(col => (
                  <td
                    key={col.id}
                    onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRight: '1px solid var(--border-glass)',
                      verticalAlign: 'middle',
                      cursor: 'text',
                      maxWidth: col.width,
                      overflow: 'hidden',
                    }}
                  >
                    {renderCell(row, col)}
                  </td>
                ))}

                {/* Delete row */}
                <td style={{ padding: '0.3rem', textAlign: 'center', verticalAlign: 'middle' }}>
                  <button
                    onClick={() => deleteRow(row.id)}
                    title="Delete row"
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', opacity: 0.35, padding: '0.2rem', borderRadius: 4, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.35}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Add row inline */}
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <td colSpan={cols.length + 2} style={{ padding: '0' }}>
                <button
                  onClick={addRow}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem',
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    opacity: 0.5, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                >
                  <Plus size={13} /> Add item
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Add Column Modal ── */}
      {showAddCol && (
        <div
          onClick={() => setShowAddCol(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(25,12,45,0.99), rgba(20,8,38,0.99))',
              border: '1px solid rgba(240,59,106,0.3)',
              borderRadius: 16, padding: '1.5rem', width: 320,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>➕ Add Column</h3>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Column Name</label>
              <input
                autoFocus
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setShowAddCol(false); }}
                placeholder="e.g. WiFi Password"
                className="form-control"
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Column Type</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { type: 'text', label: '📝 Text' },
                  { type: 'number', label: '🔢 Number' },
                  { type: 'link', label: '🔗 Link' },
                ].map(t => (
                  <button
                    key={t.type}
                    onClick={() => setNewColType(t.type)}
                    style={{
                      padding: '0.3rem 0.7rem', borderRadius: 8, fontSize: '0.78rem', cursor: 'pointer',
                      border: `1px solid ${newColType === t.type ? 'rgba(240,59,106,0.6)' : 'var(--border-glass)'}`,
                      background: newColType === t.type ? 'rgba(240,59,106,0.15)' : 'rgba(255,255,255,0.04)',
                      color: newColType === t.type ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: newColType === t.type ? 600 : 400,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddCol(false)} className="btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }}>Cancel</button>
              <button onClick={addColumn} className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }} disabled={!newColName.trim()}>Add Column</button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for col delete button hover */}
      <style>{`
        th:hover .col-del-btn { opacity: 1 !important; }
      `}</style>
      </>)}
    </div>
  );
}
