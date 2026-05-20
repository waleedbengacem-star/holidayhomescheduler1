import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { getDefaultDuration } from '../utils';
// Actually, AddModal doesn't export PropertyPicker. I will just make a simple native select for now or duplicate it.
// Better: I'll use a simple native select with search.

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export default function PropertyItineraryModal({ properties, onSave, onClose }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [day, setDay] = useState('today');
  
  const [actions, setActions] = useState([
    {
      id: Date.now().toString(),
      type: 'task', // 'task' or 'checkin'
      task_type: 'Checkout Cleaning', // only used if type === 'task'
      startTime: '10:00',
      endTime: '14:00',
      duration: '120',
      priority: '2',
      cash: '',
      notes: '',
      meetAndGreet: '',
      inspectionStaff: ''
    }
  ]);

  const addAction = (type) => {
    setActions([
      ...actions,
      {
        id: Date.now().toString() + Math.random(),
        type,
        task_type: type === 'task' ? 'Checkout Cleaning' : '',
        startTime: type === 'task' ? '09:00' : '15:00', // for checkin, startTime is ETA
        endTime: '17:00',
        duration: '60',
        priority: '2',
        cash: '',
        notes: '',
        meetAndGreet: '',
        inspectionStaff: ''
      }
    ]);
  };

  const removeAction = (id) => {
    setActions(actions.filter(a => a.id !== id));
  };

  const updateAction = (id, field, value) => {
    setActions(actions.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [field]: value };
      if (field === 'task_type') {
        const prop = properties.find(p => p.id === propertyId);
        const beds = prop ? (prop.bedrooms || 1) : 1;
        updated.duration = getDefaultDuration(value, beds, 1).toString();
      }
      return updated;
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!propertyId) return alert('Please select a property.');
    if (actions.length === 0) return alert('Please add at least one action.');

    const payload = {
      property_id: propertyId,
      day,
      tasks: [],
      checkins: []
    };

    actions.forEach(a => {
      if (a.type === 'checkin') {
        payload.checkins.push({
          id: 'c' + Date.now() + Math.random().toString().substring(2, 6),
          property_id: propertyId,
          time_mins: parseTime(a.startTime),
          day,
          meet_and_greet: a.meetAndGreet || '',
          cash_collection: a.cash || ''
        });
      } else {
        const roleMap = {
          'Cleaning': ['Cleaner'],
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
        const roles = roleMap[a.task_type] ?? ['Cleaner'];
        
        payload.tasks.push({
          id: 't' + Date.now() + Math.random().toString().substring(2, 6),
          property_id: propertyId,
          task_type: a.task_type,
          duration_mins: parseInt(a.duration),
          time_window_start_mins: parseTime(a.startTime),
          time_window_end_mins: parseTime(a.endTime),
          required_roles: roles,
          priority: parseInt(a.priority),
          cash_collection: a.cash || '',
          notes: a.notes || '',
          inspection_staff: a.inspectionStaff || ''
        });
      }
    });

    onSave(payload);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Property Itinerary</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
              <label>Select Property</label>
              <select className="form-control" value={propertyId} onChange={e => setPropertyId(e.target.value)} required>
                <option value="" disabled>-- Choose a Property --</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Day</label>
              <select className="form-control" value={day} onChange={e => setDay(e.target.value)}>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem' }}>Itinerary Actions</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => addAction('task')} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>+ Add Task</button>
              <button type="button" onClick={() => addAction('checkin')} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>+ Add Check-in</button>
            </div>
          </div>

          <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
            {actions.map((act, idx) => (
              <div key={act.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-glass)', position: 'relative' }}>
                <button type="button" onClick={() => removeAction(act.id)} className="icon-btn danger" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}><Trash2 size={16} /></button>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--brand-pink)' }}>
                  Action {idx + 1}: {act.type === 'checkin' ? 'Guest Arrival' : 'Operational Task'}
                </div>
                
                {act.type === 'checkin' ? (
                  <>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>ETA</label>
                        <input type="time" className="form-control" value={act.startTime} onChange={e => updateAction(act.id, 'startTime', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Meet & Greet</label>
                        <input className="form-control" value={act.meetAndGreet} onChange={e => updateAction(act.id, 'meetAndGreet', e.target.value)} placeholder="e.g. Self Check-in" />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Cash Collection</label>
                        <input className="form-control" value={act.cash} onChange={e => updateAction(act.id, 'cash', e.target.value)} placeholder="Amount" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                      <div className="form-group" style={{ flex: 1.5, marginBottom: 0 }}>
                        <label>Task Type</label>
                        <select className="form-control" value={act.task_type} onChange={e => updateAction(act.id, 'task_type', e.target.value)}>
                          <option value="Checkout Cleaning">Checkout Cleaning</option>
                          <option value="Check-in Cleaning">Check-in Cleaning</option>
                          <option value="Deep Cleaning">Deep Cleaning</option>
                          <option value="Mid-stay Cleaning">Mid-stay Cleaning</option>
                          <option value="Linen Change">Linen Change</option>
                          <option value="Touch Up">Touch Up</option>
                          <option value="Inspection">Inspection</option>
                          <option value="Cash Collection">Cash Collection</option>
                          <option value="Pay Collect">Pay Collect</option>
                          <option value="Viewings">Viewings</option>
                          <option value="Picture / Measurement">Picture / Measurement</option>
                          <option value="Drop-off / Pick-up">Drop-off / Pick-up</option>
                          <option value="Maintenance">Maintenance</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Priority</label>
                        <select className="form-control" value={act.priority} onChange={e => updateAction(act.id, 'priority', e.target.value)}>
                          <option value="1">High (Today)</option>
                          <option value="2">Medium</option>
                          <option value="3">Low</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Duration (m)</label>
                        <input type="number" className="form-control" value={act.duration} onChange={e => updateAction(act.id, 'duration', e.target.value)} required />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Window Start</label>
                        <input type="time" className="form-control" value={act.startTime} onChange={e => updateAction(act.id, 'startTime', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Window End</label>
                        <input type="time" className="form-control" value={act.endTime} onChange={e => updateAction(act.id, 'endTime', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Inspection By</label>
                        <input className="form-control" value={act.inspectionStaff} onChange={e => updateAction(act.id, 'inspectionStaff', e.target.value)} placeholder="e.g. Ranjith" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Cash</label>
                        <input className="form-control" value={act.cash} onChange={e => updateAction(act.id, 'cash', e.target.value)} placeholder="e.g. 500" />
                      </div>
                      <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                        <label>Notes</label>
                        <input className="form-control" value={act.notes} onChange={e => updateAction(act.id, 'notes', e.target.value)} placeholder="e.g. Bring extra towels" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            {actions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No actions added yet.
              </div>
            )}
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={actions.length === 0}>Save Itinerary</button>
          </div>
        </form>
      </div>
    </div>
  );
}
