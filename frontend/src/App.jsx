import React, { useState } from 'react';
import { Edit2, X, Plus, Trash2, Search, RotateCcw, CheckSquare, ChevronUp, ChevronDown } from 'lucide-react';
import StaffCalendar from './components/StaffCalendar';
import AddModal from './components/AddModal';
import PropertyItineraryModal from './components/PropertyItineraryModal';
import WhatsAppImportModal from './components/WhatsAppImportModal';
import ExcelImport from './components/ExcelImport';
import { useLocalStorage } from './hooks/useLocalStorage';

const initialProperties = [
  { id: 'p1', name: 'Villa Sunset', latitude: 25.0, longitude: 55.1, bedrooms: 3, guest_checkin_time_mins: null },
  { id: 'p2', name: 'Downtown Apartment', latitude: 25.1, longitude: 55.2, bedrooms: 2, guest_checkin_time_mins: 900 },
  { id: 'p3', name: 'Marina Penthouse', latitude: 25.05, longitude: 55.15, bedrooms: 4, guest_checkin_time_mins: null },
];

const initialStaff = [
  { id: 's1', name: 'Alice', roles: ['PA'], has_car: true, start_time_mins: 0, end_time_mins: 1440 },
  { id: 's2', name: 'Bob', roles: ['Cleaner'], has_car: true, start_time_mins: 0, end_time_mins: 1440 },
  { id: 's3', name: 'Charlie', roles: ['Cleaner'], has_car: false, start_time_mins: 0, end_time_mins: 1440 },
];

function getStaffColor(roles) {
  if (!roles || roles.length === 0) return '#a78bfa';
  if (roles.length === 1) {
    if (roles[0] === 'PA') return '#0284c7';
    if (roles[0] === 'Handyman') return '#d97706';
    return '#a78bfa';
  }
  if (roles.length === 2) return '#10b981';
  return '#ec4899';
}

const initialTasks = [
  { id: 't1', property_id: 'p1', task_type: 'Cleaning', duration_mins: 120, time_window_start_mins: 600, time_window_end_mins: 840, required_roles: ['Cleaner'], priority: 2 },
  { id: 't2', property_id: 'p2', task_type: 'Check-in', duration_mins: 30, time_window_start_mins: 840, time_window_end_mins: 900, required_roles: ['PA'], priority: 1 },
  { id: 't3', property_id: 'p3', task_type: 'Cleaning', duration_mins: 180, time_window_start_mins: 540, time_window_end_mins: 1020, required_roles: ['Cleaner'], priority: 3 },
  { id: 't4', property_id: 'p1', task_type: 'Check-in', duration_mins: 30, time_window_start_mins: 900, time_window_end_mins: 960, required_roles: ['PA'], priority: 1 },
  { id: 't5', property_id: 'p2', task_type: 'Cash Collection', duration_mins: 45, time_window_start_mins: 600, time_window_end_mins: 900, required_roles: ['PA'], priority: 2 },
];

function formatTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function toTimeStr(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getPriorityLabel(p) {
  if (p === 1) return 'High Priority';
  if (p === 2) return 'Medium Priority';
  return 'Low Priority';
}

function App() {
  const [properties, setProperties] = useLocalStorage('hhs_properties', initialProperties);
  const [staff, setStaff] = useLocalStorage('hhs_staff', initialStaff);
  const [tasks, setTasks] = useLocalStorage('hhs_tasks', initialTasks);
  const [hq, setHq] = useLocalStorage('hhs_hq', { name: '', address: '', latitude: null, longitude: null, mapUrl: '' });
  const [offDaysRaw, setOffDaysRaw] = useLocalStorage('hhs_offdays', {});
  const [collapsedCards, setCollapsedCards] = useLocalStorage('hhs_collapsed_cards', {
    hq: false, properties: false, staff: false, tasks: false, checkins: false, schedule: false
  });
  const [checkins, setCheckins] = useLocalStorage('hhs_checkins', []);
  const [scheduleNotes, setScheduleNotes] = useLocalStorage('hhs_schedule_notes', {});
  const [completedTasks, setCompletedTasks] = useLocalStorage('hhs_completed_tasks', []);
  const [expertRules, setExpertRules] = useLocalStorage('hhs_expert_rules', []);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [addModal, setAddModal] = useState(null); // 'property' | 'staff' | 'task'
  const [showExcel, setShowExcel] = useState(false);
  const getLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayDateObj = new Date();
  const todayStrISO = getLocalDateStr(todayDateObj);
  const tmrwDateObj = new Date(); tmrwDateObj.setDate(todayDateObj.getDate() + 1);
  const tmrwStrISO = getLocalDateStr(tmrwDateObj);

  const [activeTab, setActiveTab] = useState(todayStrISO);
  const [scheduleViewMode, setScheduleViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [runSheetGrouping, setRunSheetGrouping] = useState('property'); // 'property' | 'staff'
  const [creationMode, setCreationMode] = useLocalStorage('hhs_creation_mode', 'task'); // 'task' | 'property'
  const [propSearch, setPropSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [propFilter, setPropFilter] = useState('all'); // 'all' | 'located' | 'missing'
  const [mapLinkStatus, setMapLinkStatus] = useState(null); // { ok, lat, lng, short } | null
  // Bulk-select sets
  const [selProps, setSelProps] = useState(new Set());
  const [selStaff, setSelStaff] = useState(new Set());
  const [selTasks, setSelTasks] = useState(new Set());

  const [feedbackText, setFeedbackText] = useState('');
  const [isLearning, setIsLearning] = useState(false);

  const toggleTaskCompletion = (taskId) => {
    setCompletedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleTeachAI = () => {
    if (!feedbackText.trim()) return;
    setIsLearning(true);
    
    // Simulate LLM delay
    setTimeout(() => {
      const text = feedbackText.toLowerCase();
      let extractedConstraints = [];

      // A simple regex/keyword matcher to prove the concept
      staff.forEach(s => {
        const sName = s.name.toLowerCase();
        if (text.includes(sName)) {
          if (text.includes('never') || text.includes('don\'t') || text.includes('not') || text.includes('avoid')) {
            // Find what they shouldn't do
            const tasksTypes = ['check-in', 'deep cleaning', 'touch up', 'mid-stay', 'cash collection'];
            tasksTypes.forEach(tt => {
              if (text.includes(tt.replace('-', '')) || text.includes(tt)) {
                extractedConstraints.push({ type: 'disallow_task', staff_id: s.id, staff_name: s.name, task_type: tt });
              }
            });
          }
        }
      });

      setExpertRules(prev => [
        {
          id: 'rule_' + Date.now(),
          raw_text: feedbackText,
          timestamp: new Date().toISOString(),
          constraints: extractedConstraints
        },
        ...prev
      ]);
      setFeedbackText('');
      setIsLearning(false);
    }, 1500);
  };

  const handleRemoveRule = (ruleId) => {
    setExpertRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const todayStr = todayDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const tmrwStr = tmrwDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // ── Location helpers ─────────────────────────────────────────────────────
  const hasLocation = (p) => !!(p.latitude && p.longitude);

  /** Haversine distance in metres between two lat/lng pairs */
  function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Cluster properties that are within THRESHOLD metres of each other */
  const CLUSTER_THRESHOLD_M = 150;
  function groupByBuilding(props) {
    const clusters = []; // array of arrays
    props.forEach(p => {
      if (!hasLocation(p)) { clusters.push([p]); return; }
      // Try to merge into an existing cluster
      const target = clusters.find(c => c.some(q =>
        hasLocation(q) && haversineM(p.latitude, p.longitude, q.latitude, q.longitude) <= CLUSTER_THRESHOLD_M
      ));
      if (target) target.push(p);
      else clusters.push([p]);
    });
    return clusters;
  }

  /** Human-readable reason a property has no location */
  function locationStatus(p) {
    if (hasLocation(p)) return null;
    if (p.mapUrl && p.mapUrl.trim()) return { label: 'Link failed', hint: 'Google Maps link was found but coordinates could not be extracted', color: '#f87171' };
    return { label: 'No location', hint: 'No Google Maps link was provided for this property', color: 'rgba(251,191,36,0.9)' };
  }

  /** Extract lat/lng from a Google Maps URL (inline, mirrors ExcelImport logic) */
  function extractCoordsFromUrl(url) {
    if (!url) return null;
    let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    return null;
  }

  /** Estimate one-way drive time in minutes, mirroring the backend logistics engine */
  function travelMins(lat1, lon1, lat2, lon2) {
    // Base distance at 25 km/h
    const baseMins = (haversineM(lat1, lon1, lat2, lon2) / 1000 / 25) * 60;
    // Apply 1.5x traffic baseline + 20 minute parking/security buffer
    const rawTime = (baseMins * 1.5) + 20;
    // Snap to 15-minute blocks
    return Math.ceil(rawTime / 15.0) * 15;
  }

  const hqReady = !!(hq.latitude && hq.longitude);

  const toggleCard = (cardId) => {
    setCollapsedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  /** Helper to determine if a staff member is off on a specific Date */
  function isOff(staffMem, dateObj) {
    const dow = dateObj.getDay();
    const isRecurringOff = (staffMem.recurring_off_days || []).includes(dow);
    const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const isAbsoluteOff = (offDaysRaw[staffMem.id] || []).includes(dateKey);
    return isRecurringOff || isAbsoluteOff;
  }

  /**
   * Canonical role mapping — single source of truth.
   * PA  = personal assistant (drives, greets guests, collects cash)
   * Cleaner = cleaning & inspection work
   */
  function rolesForTaskType(task_type) {
    switch (task_type) {
      case 'Cleaning': // legacy
      case 'Checkout Cleaning':
      case 'Check-in Cleaning':
      case 'Deep Cleaning':
      case 'Mid-stay Cleaning':
      case 'Linen Change':
      case 'Touch Up': return ['Cleaner'];
      case 'Inspection': return ['Cleaner'];
      case 'Drop-off / Pick-up': return ['PA'];
      case 'Check-in': return ['PA'];
      case 'Cash Collection':
      case 'Pay Collect':
      case 'Viewings': return ['PA'];
      case 'Picture / Measurement': return ['Cleaner', 'PA'];
      case 'Maintenance': return ['Handyman'];
      default: return ['Cleaner'];
    }
  }

  // ── Schedule Post-Processing (Auto PA Drop-offs & Warnings) ─────────────
  const applyPostProcessing = (scheduleData) => {
    const processDay = (rows) => {
      const recommendations = [];
      const warnings = [];
      const paDriverRows = rows.filter(r => {
        const s = staff.find(x => x.id === r.staff_id);
        return s && s.roles?.includes('PA') && s.has_car;
      });
      const nonDriverRows = rows.filter(r => {
        const s = staff.find(x => x.id === r.staff_id);
        return s && !s.has_car && r.tasks.length > 0;
      });

      nonDriverRows.forEach(cleanerRow => {
        if (cleanerRow.tasks.length === 0) return;

        // Sort tasks chronologically
        const sortedTasks = [...cleanerRow.tasks].sort((a, b) => a.start_time_mins - b.start_time_mins);
        
        let stickyPaRow = null;
        let prevTask = null;

        sortedTasks.forEach((assigned) => {
          // Check for existing manual drop-off
          const hasManualDropoff = tasks.some(t =>
            (t.task_type === 'Drop-off / Pick-up' || t.task_type === 'HQ Pick-up & Drop-off') &&
            t.property_id === assigned.property_id &&
            Math.abs(t.time_window_start_mins - assigned.start_time_mins) <= 90
          );
          // Check if PA already assigned drop-off
          const hasPaDropoff = paDriverRows.some(paRow =>
            paRow.tasks.some(pt =>
              pt.property_id === assigned.property_id &&
              (pt.task_type === 'Drop-off / Pick-up' || pt.task_type === 'HQ Pick-up & Drop-off' || pt.task_type === 'Transit → Next Unit') &&
              pt.start_time_mins <= assigned.start_time_mins
            )
          );

          if (!hasManualDropoff && !hasPaDropoff) {
            const prop = properties.find(p => p.id === assigned.property_id);
            const cleanerName = staff.find(s => s.id === cleanerRow.staff_id)?.name ?? 'Staff';

            // Select a sticky PA on the very first leg if we don't have one
            if (!stickyPaRow && paDriverRows.length > 0) {
              const candidates = [...paDriverRows].sort((a, b) => (a.cursor ?? 0) - (b.cursor ?? 0));
              stickyPaRow = candidates[0];
            }

            if (stickyPaRow) {
              let travelTime = 20;
              let actualStart, actualEnd;
              let taskName = 'HQ Pick-up & Drop-off';

              if (!prevTask) {
                // First task: from HQ
                if (hqReady && prop?.latitude && prop?.longitude) {
                  travelTime = travelMins(hq.latitude, hq.longitude, prop.latitude, prop.longitude);
                }
                actualStart = assigned.start_time_mins - travelTime;
                actualEnd = actualStart + travelTime;
              } else {
                // Subsequent task: from prevTask property
                const prevProp = properties.find(p => p.id === prevTask.property_id);
                if (prevTask.property_id === assigned.property_id) {
                  travelTime = 0;
                  taskName = 'In Bldg';
                  actualStart = prevTask.end_time_mins;
                } else {
                  if (prevProp?.latitude && prop?.latitude) {
                    travelTime = travelMins(prevProp.latitude, prevProp.longitude, prop.latitude, prop.longitude);
                  }
                  actualStart = prevTask.end_time_mins;
                  taskName = 'Transit → Next Unit';
                }
                actualEnd = actualStart + travelTime;
              }

              if (actualStart <= actualEnd) {
                stickyPaRow.tasks.push({
                  task_id: `auto_transit_${assigned.task_id}`,
                  property_id: assigned.property_id,
                  task_type: taskName,
                  start_time_mins: actualStart,
                  end_time_mins: actualEnd,
                  auto_generated: true,
                  for_cleaner: cleanerName,
                });
              }
            }

            recommendations.push({
              cleaner: cleanerName,
              property: prop?.name ?? 'Unknown',
              time: assigned.start_time_mins,
              pa_available: paDriverRows.length > 0,
            });
          }

          // Check-in deadline warnings
          const prop = properties.find(p => p.id === assigned.property_id);
          const deadline = assigned.checkin_deadline || prop?.guest_checkin_time_mins;
          if (deadline && assigned.end_time_mins > deadline) {
            warnings.push({
              property: prop?.name ?? 'Unknown',
              task_type: assigned.task_type,
              ends_at: assigned.end_time_mins,
              guest_arrives: deadline,
              overlap_mins: assigned.end_time_mins - deadline,
              staff_name: staff.find(s => s.id === cleanerRow.staff_id)?.name || cleanerRow.staff_name,
            });
          }

          prevTask = assigned;
        });

        // Auto-generate Pick-up & HQ Return at end of schedule
        if (prevTask && stickyPaRow) {
          const hasManualReturn = tasks.some(t =>
            (t.task_type === 'Drop-off / Pick-up' || t.task_type === 'Pick-up & HQ Return') &&
            t.property_id === prevTask.property_id &&
            Math.abs(t.time_window_start_mins - prevTask.end_time_mins) <= 90
          );
          const hasPaReturn = paDriverRows.some(paRow =>
            paRow.tasks.some(pt =>
              pt.property_id === prevTask.property_id &&
              (pt.task_type === 'Drop-off / Pick-up' || pt.task_type === 'Pick-up & HQ Return') &&
              Math.abs(pt.start_time_mins - prevTask.end_time_mins) <= 30
            )
          );

          if (!hasManualReturn && !hasPaReturn) {
            const prop = properties.find(p => p.id === prevTask.property_id);
            const cleanerName = staff.find(s => s.id === cleanerRow.staff_id)?.name ?? 'Staff';

            let travelTime = 20;
            if (hqReady && prop?.latitude && prop?.longitude) {
              travelTime = travelMins(prop.latitude, prop.longitude, hq.latitude, hq.longitude);
            }

            const actualStart = prevTask.end_time_mins;

            stickyPaRow.tasks.push({
              task_id: `auto_return_${prevTask.task_id}`,
              property_id: prevTask.property_id,
              task_type: 'Pick-up & HQ Return',
              start_time_mins: actualStart,
              end_time_mins: actualStart + travelTime,
              auto_generated: true,
              for_cleaner: cleanerName,
            });
            stickyPaRow.cursor = actualStart + travelTime + 10;
          }
        }
      });

      rows.forEach(row => row.tasks.sort((a, b) => a.start_time_mins - b.start_time_mins));
      return { recommendations, warnings };
    };

    let allRecs = [];
    let allWarns = [];
    Object.keys(scheduleData).forEach(k => {
      if (k === 'unassigned_tasks') return;
      const res = processDay(scheduleData[k]);
      allRecs.push(...res.recommendations);
      allWarns.push(...res.warnings);
    });

    return {
      ...scheduleData,
      recommendations: allRecs,
      deadline_warnings: allWarns,
    };
  };

  // ── Client-side fallback scheduler ──────────────────────────────────────
  const buildLocalSchedule = () => {
    const neededDates = new Set([todayStrISO, tmrwStrISO, activeTab]);
    const schedules = {};

    const sorted = [...tasks]
      .map(t => ({ ...t, required_roles: rolesForTaskType(t.task_type) }))
      .sort((a, b) =>
        a.priority !== b.priority ? a.priority - b.priority : a.time_window_start_mins - b.time_window_start_mins
      );

    const makeRows = (taskList, dateStr) => staff.map(s => {
      let startOffset = 0;
      if (hqReady) {
        const firstTask = taskList.find(t => t.required_roles.includes(s.role));
        const firstProp = firstTask ? properties.find(p => p.id === firstTask.property_id) : null;
        if (firstProp?.latitude && firstProp?.longitude) {
          startOffset = travelMins(hq.latitude, hq.longitude, firstProp.latitude, firstProp.longitude);
        }
      }
      return { staff_id: s.id, staff_name: s.name, roles: s.roles, tasks: [], cursor: s.start_time_mins + startOffset, hqOffset: startOffset };
    });

    neededDates.forEach(dateStr => {
      const dObj = new Date(dateStr);
      schedules[dateStr] = makeRows(sorted, dateStr).filter(r => {
        const s = staff.find(x => x.id === r.staff_id);
        return !isOff(s, dObj);
      });
    });

    const unassigned = [];

    /** Try to assign a task to the best-fit row from a set of rows */
    function tryAssign(rows, task) {
      if (!rows) return false;
      let eligible = rows.filter(row => row.roles?.some(r => task.required_roles.includes(r)));
      
      // 🧠 Apply AI Rulebook constraints
      expertRules.forEach(rule => {
        (rule.constraints || []).forEach(c => {
          if (c.type === 'disallow_task' && task.task_type.toLowerCase().includes(c.task_type)) {
            eligible = eligible.filter(row => row.staff_id !== c.staff_id);
          }
        });
      });

      if (eligible.length === 0) return false;

      const taskProp = properties.find(p => p.id === task.property_id);
      const checkinDeadline = taskProp?.guest_checkin_time_mins ?? Infinity;

      let maxStaff = 1;
      if (task.required_roles.includes('Cleaner') && task.task_type.toLowerCase().includes('cleaning')) {
        maxStaff = Math.min(4, eligible.length);
      }

      for (let numStaff = 1; numStaff <= maxStaff; numStaff++) {
        const durationPerCleaner = Math.ceil(task.duration_mins / numStaff);

        const candidates = eligible.map(row => {
          const s = staff.find(x => x.id === row.staff_id);
          const start = Math.max(row.cursor, task.time_window_start_mins);
          const end = start + durationPerCleaner;
          const fits = end <= Math.min(task.time_window_end_mins, s.end_time_mins, checkinDeadline);
          return { row, start, end, fits };
        }).filter(c => c.fits);

        if (candidates.length >= numStaff) {
          candidates.sort((a, b) => a.row.cursor !== b.row.cursor ? a.row.cursor - b.row.cursor : a.row.tasks.length - b.row.tasks.length);
          
          const selected = candidates.slice(0, numStaff);
          const teamStart = Math.max(...selected.map(c => c.start));
          const teamEnd = teamStart + durationPerCleaner;

          const allFit = selected.every(c => {
             const s = staff.find(x => x.id === c.row.staff_id);
             return teamEnd <= Math.min(task.time_window_end_mins, s.end_time_mins, checkinDeadline);
          });

          if (allFit) {
             selected.forEach((c, idx) => {
                c.row.tasks.push({
                   task_id: task.id + (numStaff > 1 ? `_part${idx+1}` : ''),
                   property_id: task.property_id,
                   task_type: task.task_type,
                   start_time_mins: teamStart,
                   end_time_mins: teamEnd,
                   checkin_deadline: checkinDeadline !== Infinity ? checkinDeadline : null,
                   team_size: numStaff > 1 ? numStaff : undefined
                });
                c.row.cursor = teamEnd + 15;
             });
             return true;
          }
        }
      }
      return false;
    }

    const dynamicTasks = [...sorted];

    // Inject PA check-in tasks for Meet & Greet properties
    checkins.forEach(c => {
      const prop = properties.find(p => p.id === c.property_id);
      if (prop?.checkin_type === 'Meet & Greet') {
        dynamicTasks.push({
          id: `auto_mg_${c.id}`,
          property_id: c.property_id,
          task_type: 'Inspect & Check-in',
          duration_mins: 60, // 30 min inspect + 30 min meet and greet
          time_window_start_mins: Math.max(0, c.time_mins - 30),
          time_window_end_mins: c.time_mins + 30, // strict ETA deadline
          required_roles: ['PA'],
          priority: 1, // critical
          auto_generated: false,
          target_day: c.day, // 'today' or 'tomorrow'
          fallback_task: {
            id: `auto_mg_fallback_${c.id}`,
            property_id: c.property_id,
            task_type: 'Check-in (No Inspect)',
            duration_mins: 30, // Just the 30 min meet and greet
            time_window_start_mins: c.time_mins,
            time_window_end_mins: c.time_mins + 30,
            required_roles: ['PA'],
            priority: 1,
            auto_generated: false
          }
        });
      }
    });

    dynamicTasks.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.time_window_start_mins - b.time_window_start_mins
    );

    dynamicTasks.forEach(task => {
      if (task.target_day) {
        // Strict day assignment for Meet & Greet auto-tasks
        const targetDateISO = task.target_day === 'today' ? todayStrISO : task.target_day === 'tomorrow' ? tmrwStrISO : null;
        if (targetDateISO && schedules[targetDateISO]) {
           if (!tryAssign(schedules[targetDateISO], task)) {
             if (task.fallback_task) {
               if (!tryAssign(schedules[targetDateISO], task.fallback_task)) {
                 unassigned.push(task); // Couldn't even fit the fallback
               }
             } else {
               unassigned.push(task);
             }
           }
        }
      } else if (task.assigned_date) {
        if (schedules[task.assigned_date]) {
          if (!tryAssign(schedules[task.assigned_date], task)) {
            unassigned.push(task);
          }
        }
      } else {
        if (task.priority <= 2) {
          if (!tryAssign(schedules[todayStrISO], task) && !tryAssign(schedules[tmrwStrISO], task))
            unassigned.push(task);
        } else {
          if (!tryAssign(schedules[tmrwStrISO], task) && !tryAssign(schedules[todayStrISO], task))
            unassigned.push(task);
        }
      }
    });

    return applyPostProcessing({ ...schedules, unassigned_tasks: unassigned });
  };

  const generateSchedule = async () => {
    setLoading(true); setError(null);

    // Give UI time to show loading state
    setTimeout(() => {
      try {
        setSchedule(buildLocalSchedule());
      } catch (err) {
        setError(`⚠️ Error generating expert schedule: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleAdd = (type, newItem) => {
    if (type === 'property') setProperties(prev => [...prev, newItem]);
    else if (type === 'staff') setStaff(prev => [...prev, newItem]);
    else if (type === 'task') setTasks(prev => [...prev, newItem]);
    else if (type === 'checkin') {
      setCheckins(prev => [...prev, { ...newItem, id: 'c' + Date.now() }]);
    }
  };

  const handleResetAll = () => {
    if (window.confirm('Reset ALL data to defaults? This cannot be undone.')) {
      setProperties(initialProperties);
      setStaff(initialStaff);
      setTasks(initialTasks);
      setSchedule(null);
    }
  };

  const handleDelete = (type, id) => {
    if (type === 'property') { setProperties(prev => prev.filter(p => p.id !== id)); setSelProps(s => { const n = new Set(s); n.delete(id); return n; }); }
    else if (type === 'staff') { setStaff(prev => prev.filter(s => s.id !== id)); setSelStaff(s => { const n = new Set(s); n.delete(id); return n; }); }
    else if (type === 'task') { setTasks(prev => prev.filter(t => t.id !== id)); setSelTasks(s => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const handleDeleteCheckin = (id) => {
    setCheckins(prev => prev.filter(c => c.id !== id));
  };

  const toggleSel = (set, setSel, id) => {
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkDelete = (type) => {
    if (type === 'property') {
      if (selProps.size === 0) return;
      if (!window.confirm(`Delete ${selProps.size} selected propert${selProps.size === 1 ? 'y' : 'ies'}?`)) return;
      setProperties(prev => prev.filter(p => !selProps.has(p.id)));
      setSelProps(new Set());
    } else if (type === 'staff') {
      if (selStaff.size === 0) return;
      if (!window.confirm(`Delete ${selStaff.size} selected staff member${selStaff.size === 1 ? '' : 's'}?`)) return;
      setStaff(prev => prev.filter(s => !selStaff.has(s.id)));
      setSelStaff(new Set());
    } else if (type === 'task') {
      if (selTasks.size === 0) return;
      if (!window.confirm(`Delete ${selTasks.size} selected task${selTasks.size === 1 ? '' : 's'}?`)) return;
      setTasks(prev => prev.filter(t => !selTasks.has(t.id)));
      setSelTasks(new Set());
    }
  };

  const handleDeleteAll = (type) => {
    if (type === 'property') {
      if (!window.confirm('Delete ALL properties? This cannot be undone.')) return;
      setProperties([]); setSelProps(new Set());
    } else if (type === 'staff') {
      if (!window.confirm('Delete ALL staff? This cannot be undone.')) return;
      setStaff([]); setSelStaff(new Set());
    } else if (type === 'task') {
      if (!window.confirm('Delete ALL pending tasks? This cannot be undone.')) return;
      setTasks([]); setSelTasks(new Set());
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (editingItem.type === 'hq') {
      let lat = parseFloat(data.latitude) || null;
      let lng = parseFloat(data.longitude) || null;
      // Try to extract coords from the Maps URL if manual coords are blank
      if ((!lat || !lng) && data.mapUrl) {
        const coords = extractCoordsFromUrl(data.mapUrl);
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }
      setHq({ name: data.name, address: data.address, latitude: lat, longitude: lng, mapUrl: data.mapUrl || '' });
    } else if (editingItem.type === 'property') {
      const mapUrl = (data.google_maps_link || '').trim();
      let lat = editingItem.data.latitude || 0;
      let lng = editingItem.data.longitude || 0;
      if (mapUrl) {
        const coords = extractCoordsFromUrl(mapUrl);
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }
      const checkinMins = data.guest_checkin_time ? parseTime(data.guest_checkin_time) : null;
      setProperties(properties.map(p => p.id === editingItem.data.id
        ? { ...p, name: data.name, google_maps_link: mapUrl, mapUrl, latitude: lat, longitude: lng, guest_checkin_time_mins: checkinMins, bedrooms: parseInt(data.bedrooms) || 1, access_method: data.access_method || '', checkin_type: data.checkin_type || 'Self Check-in' }
        : p
      ));
      setMapLinkStatus(null);
    } else if (editingItem.type === 'cluster') {
      const idsToUpdate = new Set(editingItem.data.map(p => p.id));
      const checkinType = data.checkin_type;
      const accessMethod = (data.access_method || '').trim();
      const clusterName = (data.cluster_name || '').trim();

      setProperties(properties.map(p => {
        if (idsToUpdate.has(p.id)) {
          const updates = {};
          if (checkinType !== 'No Change') updates.checkin_type = checkinType;
          if (accessMethod === 'CLEAR') updates.access_method = '';
          else if (accessMethod !== '') updates.access_method = accessMethod;
          if (clusterName === 'CLEAR') updates.cluster_name = '';
          else if (clusterName !== '') updates.cluster_name = clusterName;
          return { ...p, ...updates };
        }
        return p;
      }));
    } else if (editingItem.type === 'staff') {
      const roles = ['PA', 'Cleaner', 'Handyman', 'Reservations', 'Accountant'].filter(r => data[`role_${r}`]);
      if (roles.length === 0) roles.push('Cleaner'); // fallback
      setStaff(staff.map(s => s.id === editingItem.data.id ? {
        ...s, name: data.name, roles, has_car: !!data.has_car,
        start_time_mins: 0,
        end_time_mins: 1440
      } : s));
      if (schedule) {
        const ns = JSON.parse(JSON.stringify(schedule));
        ['today', 'tomorrow'].forEach(day => {
          const ss = ns[day].find(x => x.staff_id === editingItem.data.id);
          if (ss) ss.staff_name = data.name;
        });
        setSchedule(ns);
      }
    } else if (editingItem.type === 'task') {
      setTasks(tasks.map(t => t.id === editingItem.data.id ? {
        ...t, task_type: data.task_type, priority: parseInt(data.priority),
        duration_mins: parseInt(data.duration_mins),
        time_window_start_mins: parseTime(data.time_window_start),
        time_window_end_mins: parseTime(data.time_window_end),
        required_roles: rolesForTaskType(data.task_type),
        target_day: data.target_day || null
      } : t));
    } else if (editingItem.type === 'schedule') {
      const { staff_id, start_time, end_time } = data;
      const newSchedule = JSON.parse(JSON.stringify(schedule));
      const day = editingItem.day;
      let taskToMove = null;
      newSchedule[day].forEach(ss => {
        const idx = ss.tasks.findIndex(t => t.task_id === editingItem.data.task_id);
        if (idx !== -1) taskToMove = ss.tasks.splice(idx, 1)[0];
      });
      if (taskToMove) {
        taskToMove.start_time_mins = parseTime(start_time);
        taskToMove.end_time_mins = parseTime(end_time);
        const target = newSchedule[day].find(s => s.staff_id === staff_id);
        if (target) {
          target.tasks.push(taskToMove);
          target.tasks.sort((a, b) => a.start_time_mins - b.start_time_mins);
        }
      }
      setSchedule(newSchedule);
    }
    setEditingItem(null);
  };

  const renderRunSheet = (dayKey) => {
    if (!schedule || !schedule[dayKey]) return null;
    if (runSheetGrouping === 'staff') {
      const staffWithTasks = schedule[dayKey].filter(ss => ss.tasks.length > 0);
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {staffWithTasks.map(ss => {
            const roleColor = getStaffColor(ss.roles);
            return (
              <div key={ss.staff_id} style={{ overflowX: 'auto', paddingBottom: '0.5rem', margin: '0 -1.5rem', padding: '0 1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: roleColor }}></span>
                  {ss.staff_name} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({ss.roles?.join(', ')})</span>
                </h3>
                <table className="runsheet-table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: roleColor, color: 'white', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem', width: '40px', textAlign: 'center' }}>✓</th>
                      <th style={{ padding: '0.5rem' }}>Time</th>
                      <th style={{ padding: '0.5rem' }}>Area / Unit</th>
                      <th style={{ padding: '0.5rem' }}>Type</th>
                      <th style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.15)' }}>Access / Keys</th>
                      {ss.roles?.includes('PA') && <th style={{ padding: '0.5rem', background: '#F03B6A' }}>M&G</th>}
                      {ss.roles?.includes('PA') && <th style={{ padding: '0.5rem', background: '#0ea5e9' }}>Cash Collection</th>}
                      <th style={{ padding: '0.5rem' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ss.tasks.map((task, idx) => {
                      const prop = properties.find(p => p.id === task.property_id);
                      // In staff view, we might want to check if it's auto-generated to handle task mapping
                      let origTask = tasks.find(t => t.id === task.task_id);
                      // team-cleaning tasks might have _part1 appended to the ID
                      if (!origTask && task.task_id.includes('_part')) {
                         origTask = tasks.find(t => t.id === task.task_id.split('_part')[0]);
                      }
                      const relativeDay = dayKey === todayStrISO ? 'today' : dayKey === tmrwStrISO ? 'tomorrow' : dayKey;
                      const cin = checkins.find(c => c.day === relativeDay && c.property_id === task.property_id);
                      
                      let taskName = task.task_type;
                      if (task.auto_generated && taskName.includes('Drop-off')) {
                         taskName = `Drive → ${task.for_cleaner}`;
                      }

                      const isCompleted = completedTasks.includes(task.task_id);
                      return (
                        <tr key={`${task.task_id}-${idx}`} style={{ 
                          borderBottom: '1px solid var(--border-glass)',
                          opacity: isCompleted ? 0.6 : 1,
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          background: isCompleted ? 'rgba(0,0,0,0.1)' : 'transparent'
                        }}>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isCompleted} 
                              onChange={(e) => { e.stopPropagation(); toggleTaskCompletion(task.task_id); }}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                              title="Mark task as done"
                            />
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 600 }}>{formatTime(task.start_time_mins)} - {formatTime(task.end_time_mins)}</td>
                          <td style={{ padding: '0.5rem', fontWeight: 600 }}>{prop?.name || 'Unknown'}</td>
                          <td style={{ padding: '0.5rem' }}>{taskName}</td>
                          <td style={{ padding: '0.5rem' }}>{prop?.access_method || '-'}</td>
                          {ss.roles?.includes('PA') && <td style={{ padding: '0.5rem', background: 'rgba(240,59,106,0.1)', color: '#FF7FA5', fontWeight: 600 }}>{cin?.meet_and_greet || '-'}</td>}
                          {ss.roles?.includes('PA') && <td style={{ padding: '0.5rem', background: 'rgba(14,165,233,0.1)' }}>
                            {(cin?.cash_collection || origTask?.cash_collection) ? <span style={{ background: '#b91c1c', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 600, textDecoration: isCompleted ? 'line-through' : 'none' }}>{cin?.cash_collection || origTask?.cash_collection}</span> : '-'}
                          </td>}
                          <td style={{ padding: '0.25rem 0.5rem' }}>
                            <input 
                              type="text" 
                              value={origTask ? (origTask.notes || '') : (scheduleNotes[task.task_id] || '')} 
                              onChange={(e) => {
                                if (origTask) {
                                  setTasks(prev => prev.map(x => x.id === origTask.id ? { ...x, notes: e.target.value } : x));
                                } else {
                                  setScheduleNotes(prev => ({ ...prev, [task.task_id]: e.target.value }));
                                }
                              }}
                              placeholder="Add note..."
                              style={{ 
                                background: 'rgba(0,0,0,0.1)', border: '1px solid transparent', borderBottom: '1px dashed rgba(255,255,255,0.2)', 
                                color: 'var(--text-primary)', width: '100%', padding: '0.25rem 0.4rem', borderRadius: '4px', 
                                fontSize: '0.8rem', outline: 'none',
                                textDecoration: isCompleted ? 'line-through' : 'none'
                              }}
                              onFocus={(e) => e.target.style.borderBottom = '1px solid var(--brand-pink)'}
                              onBlur={(e) => e.target.style.borderBottom = '1px dashed rgba(255,255,255,0.2)'}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
          {staffWithTasks.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No staff scheduled for {dayKey}</div>}
        </div>
      );
    }

    // Default Property View
    const propsWithActivity = new Set();
    const scheduledTasksByProp = {};
    
    schedule[dayKey].forEach(ss => {
      ss.tasks.forEach(task => {
        propsWithActivity.add(task.property_id);
        if (!scheduledTasksByProp[task.property_id]) scheduledTasksByProp[task.property_id] = [];
        scheduledTasksByProp[task.property_id].push({ ...task, staff_name: ss.staff_name, staff_roles: ss.roles });
      });
    });
    checkins.filter(c => c.day === dayKey).forEach(c => propsWithActivity.add(c.property_id));

    const sortedProps = Array.from(propsWithActivity).map(pid => properties.find(p => p.id === pid)).filter(Boolean);
    sortedProps.sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div style={{ overflowX: 'auto', paddingBottom: '1rem', margin: '0 -1.5rem', padding: '0 1.5rem' }}>
        <table className="runsheet-table" style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'var(--brand-pink-deep)', color: 'white', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Unit</th>
              <th style={{ padding: '0.5rem' }}>Access / Keys</th>
              <th style={{ padding: '0.5rem' }}>Type</th>
              <th style={{ padding: '0.5rem', background: '#2DD4AC', color: '#111' }}>ETA</th>
              <th style={{ padding: '0.5rem', background: '#F03B6A' }}>M&G</th>
              <th style={{ padding: '0.5rem', background: '#0ea5e9' }}>Cash Collection</th>
              <th style={{ padding: '0.5rem', background: '#eab308', color: '#111' }}>Inspection</th>
              <th style={{ padding: '0.5rem', background: '#0284c7' }}>PA</th>
              <th style={{ padding: '0.5rem', background: '#0284c7' }}>PA Time</th>
              <th style={{ padding: '0.5rem', background: '#a78bfa' }}>Cleaner / HM</th>
              <th style={{ padding: '0.5rem', background: '#a78bfa' }}>Task Time</th>
              <th style={{ padding: '0.5rem', background: '#0ea5e9' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortedProps.map(prop => {
              const acts = scheduledTasksByProp[prop.id] || [];
              const relativeDay = dayKey === todayStrISO ? 'today' : dayKey === tmrwStrISO ? 'tomorrow' : dayKey;
              const cin = checkins.find(c => c.day === relativeDay && c.property_id === prop.id);
              
              const pas = acts.filter(t => t.required_roles?.includes('PA') || t.staff_roles?.includes('PA') || t.auto_generated);
              const cleaners = acts.filter(t => !pas.includes(t));
              
              // Handle team cleaning task parts mapping back to original task
              const origTasks = acts.map(a => {
                let id = a.task_id;
                if (id && id.includes('_part')) id = id.split('_part')[0];
                return tasks.find(t => t.id === id);
              }).filter(Boolean);
              
              const allCash = [cin?.cash_collection, ...origTasks.map(t => t.cash_collection)].filter(Boolean).join(' | ');
              const allNotes = origTasks.map(t => t.notes).filter(Boolean).join(' | ');
              const allInspections = origTasks.map(t => t.inspection_staff).filter(Boolean).join(' | ');
              const types = Array.from(new Set(acts.filter(a => !a.auto_generated).map(a => a.task_type))).join(', ') || 'Transit';
              
              const etaMins = cin?.time_mins ?? prop.guest_checkin_time_mins;

              return (
                <tr key={prop.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 600 }}>{prop.name}</td>
                  <td style={{ padding: '0.5rem' }}>{prop.access_method || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{cin ? (types ? `Check In + ${types}` : 'Check In') : types}</td>
                  <td style={{ padding: '0.5rem', background: 'rgba(45,212,172,0.1)' }}>{etaMins != null ? formatTime(etaMins) : '-'}</td>
                  <td style={{ padding: '0.5rem', background: 'rgba(240,59,106,0.1)', fontWeight: 600, color: '#FF7FA5' }}>{cin?.meet_and_greet || '-'}</td>
                  <td style={{ padding: '0.5rem', background: 'rgba(14,165,233,0.1)' }}>
                    {allCash ? <span style={{ background: '#b91c1c', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{allCash}</span> : '-'}
                  </td>
                  <td style={{ padding: '0.5rem', background: 'rgba(234,179,8,0.1)', fontWeight: 600, color: '#eab308' }}>{allInspections || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{pas.map(p => p.staff_name).join(', ') || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{pas.map(p => `${formatTime(p.start_time_mins)} - ${formatTime(p.end_time_mins)}`).join(', ') || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{cleaners.map(c => c.staff_name).join(' / ') || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{cleaners.map(c => `${formatTime(c.start_time_mins)} - ${formatTime(c.end_time_mins)}`).join(' / ') || '-'}</td>
                  <td style={{ padding: '0.25rem 0.5rem' }}>
                    {origTasks.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {origTasks.map(t => (
                          <input 
                            key={t.id}
                            type="text" 
                            value={t.notes || ''} 
                            onChange={(e) => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, notes: e.target.value } : x))}
                            placeholder={`Add note...`}
                            style={{ 
                              background: 'rgba(0,0,0,0.1)', border: '1px solid transparent', borderBottom: '1px dashed rgba(255,255,255,0.2)', 
                              color: 'var(--text-primary)', width: '100%', padding: '0.25rem 0.4rem', borderRadius: '4px', 
                              fontSize: '0.8rem', outline: 'none' 
                            }}
                            onFocus={(e) => e.target.style.borderBottom = '1px solid var(--brand-pink)'}
                            onBlur={(e) => e.target.style.borderBottom = '1px dashed rgba(255,255,255,0.2)'}
                          />
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
            {sortedProps.length === 0 && (
              <tr><td colSpan="12" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks scheduled for {dayKey}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTimelineHeader = () => {
    const hours = [];
    for (let h = 0; h <= 24; h++) {
      let label = '';
      if (h === 0 || h === 24) label = '12 AM';
      else if (h === 12) label = '12 PM';
      else if (h > 12) label = `${h - 12} PM`;
      else label = `${h} AM`;
      hours.push(label);
    }
    return (
      <div style={{ display: 'flex', position: 'relative', height: '16px', marginBottom: '0.25rem' }}>
        <div style={{ width: '140px', minWidth: '140px', position: 'sticky', left: 0, zIndex: 40, background: 'var(--bg-card)' }}></div>
        <div style={{ flex: 1, position: 'relative' }}>
          {hours.map((label, i) => (
            <div key={i} style={{ position: 'absolute', left: `${(i / 24) * 100}%`, transform: 'translateX(-50%)', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTimeline = (dayKey) => {
    if (!schedule || !schedule[dayKey]) return null;

    const relativeDay = dayKey === todayStrISO ? 'today' : dayKey === tmrwStrISO ? 'tomorrow' : dayKey;

    // Gather all ETAs for this day to draw global vertical lines
    const activeETAs = [];
    checkins.filter(c => c.day === relativeDay).forEach(c => {
       const p = properties.find(x => x.id === c.property_id);
       activeETAs.push({ time: c.time_mins, name: p?.name || 'Guest', id: c.id });
    });
    const servicedPropIds = new Set(schedule[dayKey].flatMap(ss => ss.tasks.map(t => t.property_id)));
    servicedPropIds.forEach(pid => {
       if (!checkins.some(c => c.day === relativeDay && c.property_id === pid)) {
          const p = properties.find(x => x.id === pid);
          if (p && p.guest_checkin_time_mins != null) {
             activeETAs.push({ time: p.guest_checkin_time_mins, name: p.name, id: `implicit-${p.id}` });
          }
       }
    });

    return (
    <div style={{ overflowX: 'auto', paddingBottom: '0.5rem', margin: '0 -1.5rem', padding: '0 1.5rem 0.5rem 1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '1600px', position: 'relative' }}>
        {renderTimelineHeader()}
        
        {/* Global check-in vertical lines */}
        <div style={{ position: 'absolute', top: '16px', bottom: 0, left: '140px', right: 0, pointerEvents: 'none', zIndex: 5 }}>
          {activeETAs.map(eta => {
             const leftPercent = Math.max(0, (eta.time - 0) / 1440 * 100);
             return (
               <div key={`global-eta-${eta.id}`} style={{
                  position: 'absolute', left: `${leftPercent}%`, top: 0, bottom: 0, width: '2px',
                  borderLeft: '2px dashed rgba(167, 139, 250, 0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center'
               }}>
                  <div style={{ background: '#a78bfa', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, transform: 'translate(-50%, -8px)', fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'auto', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} title={`${eta.name} arriving at ${formatTime(eta.time)}`}>
                    🛎 {formatTime(eta.time)}
                  </div>
               </div>
             )
          })}
        </div>

        {schedule[dayKey].map(ss => (
          <div key={ss.staff_id} className="timeline-row">
            <div className="timeline-staff">
              <span>{ss.staff_name}</span>
              <span className="time-label">{staff.find(s => s.id === ss.staff_id)?.roles?.join(', ')}</span>
            </div>
            <div className="timeline-tasks">
              {ss.tasks.length === 0
                ? <div style={{ opacity: 0.5, display: 'flex', alignItems: 'center', paddingLeft: '1rem' }}>No tasks assigned</div>
                : ss.tasks.map(task => {
                  const prop = properties.find(p => p.id === task.property_id);
                  const viewStart = 0, viewTotal = 1440;
                  const leftPercent = Math.max(0, (task.start_time_mins - viewStart) / viewTotal * 100);
                  const widthPercent = Math.max(1.5, (task.end_time_mins - task.start_time_mins) / viewTotal * 100);
                  const isAuto = !!task.auto_generated;
                  const isCompleted = completedTasks.includes(task.task_id);
                  return (
                    <div key={task.task_id} className={`task-block ${isCompleted ? 'completed' : ''}`}
                      onClick={() => !isAuto && setEditingItem({ type: 'schedule', day: dayKey, data: { ...task, current_staff_id: ss.staff_id } })}
                      title={isAuto ? `Auto-generated drop-off for ${task.for_cleaner}` : undefined}
                      style={{
                        position: 'absolute', left: `${leftPercent}%`, width: `${widthPercent}%`,
                        top: '6px', bottom: '6px', height: 'auto', padding: '0.3rem 0.5rem',
                        opacity: isCompleted ? 0.5 : 1,
                        filter: isCompleted ? 'grayscale(0.8)' : 'none',
                        ...(isAuto ? {
                          background: 'linear-gradient(135deg, rgba(45,212,172,0.25), rgba(45,212,172,0.45))',
                          border: '1.5px dashed rgba(45,212,172,0.7)',
                          cursor: 'default',
                        } : {}),
                      }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.25rem' }}>
                        <strong style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', textDecoration: isCompleted ? 'line-through' : 'none' }}>{prop?.name}</strong>
                        <input 
                          type="checkbox" 
                          checked={isCompleted} 
                          onChange={(e) => { e.stopPropagation(); toggleTaskCompletion(task.task_id); }}
                          style={{ cursor: 'pointer', transform: 'scale(0.8)', margin: 0, opacity: 0.8 }}
                          title="Mark task as done"
                        />
                      </div>
                      <span className="time-label" style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                        <span style={{ fontSize: '0.65rem' }}>{formatTime(task.start_time_mins)}–{formatTime(task.end_time_mins)}</span>
                        <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isAuto ? `🚗 Drop-off → ${task.for_cleaner}` : task.task_type}
                        </span>
                      </span>
                    </div>
                  );
                })
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  };

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
          <img
            src="/airbetter-logo.png"
            alt="Airbetter logo"
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 20px rgba(240,59,106,0.35)' }}
          />
          <div>
            <h1>Airbetter Holiday Homes</h1>
            <p className="subtitle">Smart scheduling for your properties, PAs &amp; cleaners.</p>
          </div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
            All changes are auto-saved
          </span>
          <button
            onClick={handleResetAll}
            style={{ marginLeft: '1rem', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '0.25rem 0.6rem', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RotateCcw size={12} /> Reset to defaults
          </button>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', color: 'var(--text-secondary)' }}>
          <div><strong>Today:</strong> {todayStr}</div>
          <div><strong>Tomorrow:</strong> {tmrwStr}</div>
        </div>
      </header>

      {/* ── Top Level Row: HQ & Guest Arrivals ─────────────────────────────────────────── */}
      <div className="dashboard-grid">
        <div style={{
          background: hqReady
            ? 'linear-gradient(120deg, rgba(45,212,172,0.08) 0%, rgba(240,59,106,0.06) 100%)'
            : 'rgba(251,191,36,0.05)',
          border: `1px solid ${hqReady ? 'rgba(45,212,172,0.25)' : 'rgba(251,191,36,0.25)'}`,
          borderRadius: 16, padding: '1rem 1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%' }} onClick={() => toggleCard('hq')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🏢</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Headquarters</span>
            </div>
            <button className="icon-btn" title={collapsedCards.hq ? "Expand" : "Collapse"}>
              {collapsedCards.hq ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>

          {!collapsedCards.hq && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', paddingLeft: '2.25rem' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {hq.name || 'Headquarters — not set'}
                  </span>
                  {hqReady
                    ? <span style={{ fontSize: '0.72rem', color: 'var(--success)', background: 'rgba(45,212,172,0.1)', border: '1px solid rgba(45,212,172,0.25)', borderRadius: 4, padding: '0.05rem 0.4rem' }}>📍 Located</span>
                    : <span style={{ fontSize: '0.72rem', color: 'var(--warning)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 4, padding: '0.05rem 0.4rem' }}>⚠️ No location — schedule travel times will be estimated without HQ offset</span>
                  }
                </div>
                {hq.address && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{hq.address}</div>}
                {hqReady && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {hq.latitude.toFixed(5)}, {hq.longitude.toFixed(5)} · All staff depart from and return to this location
                  </div>
                )}
                {!hq.name && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Set your HQ address so the AI can calculate accurate departure times from base.
                  </div>
                )}
              </div>
              <button
                className="icon-btn accent"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'hq', data: hq }); }}
              >
                ✏️ {hq.name ? 'Edit HQ' : 'Set HQ'}
              </button>
            </div>
          )}
        </div>

        {/* 🧠 Train AI Card */}
        <div className="glass-card" style={{ border: '1px solid var(--brand-pink)' }}>
          <div className="card-header">
            <h2>🧠 Train AI (Expert Feedback)</h2>
            <div className="header-actions">
              <button className="icon-btn" onClick={() => toggleCard('trainAi')} title={collapsedCards.trainAi ? "Expand" : "Collapse"}>
                {collapsedCards.trainAi ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>
          {!collapsedCards.trainAi && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <textarea
                  className="form-control"
                  style={{ flex: 1, minHeight: '60px', resize: 'vertical' }}
                  placeholder="e.g. Ranjith should never be assigned to Check-in tasks"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTeachAI();
                    }
                  }}
                />
                <button 
                  className="action-btn" 
                  style={{ width: 'auto', padding: '0 1rem', height: '60px', flexShrink: 0 }}
                  onClick={handleTeachAI}
                  disabled={!feedbackText.trim() || isLearning}
                >
                  {isLearning ? '🧠 Learning...' : 'Teach AI'}
                </button>
              </div>
              
              {expertRules.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>AI Rulebook (Active Rules)</h3>
                  <ul className="data-list">
                    {expertRules.map(rule => (
                      <li key={rule.id} className="data-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <span style={{ fontStyle: 'italic', color: 'var(--text-primary)', fontSize: '0.85rem' }}>"{rule.raw_text}"</span>
                          <button className="icon-btn danger-soft" style={{ padding: '4px' }} onClick={() => handleRemoveRule(rule.id)} title="Remove rule"><Trash2 size={14} /></button>
                        </div>
                        {rule.constraints && rule.constraints.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {rule.constraints.map((c, i) => (
                              <span key={i} style={{ fontSize: '0.7rem', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid rgba(167,139,250,0.3)' }}>
                                {c.type === 'disallow_task' ? `🚫 Disallow: ${c.staff_name} -> ${c.task_type}` : JSON.stringify(c)}
                              </span>
                            ))}
                          </div>
                        )}
                        {(!rule.constraints || rule.constraints.length === 0) && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--warning)' }}>⚠️ No strict constraints extracted (Simulated LLM only caught general feedback)</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🛎 Guest Arrivals Card */}
        <div className="glass-card">
          <div className="card-header">
            <h2>🛎 Guest Arrivals</h2>
            <div className="header-actions">
              <button className="icon-btn accent" title="Add Guest Arrival" onClick={() => setAddModal('checkin')}><Plus size={16} /></button>
              <div style={{ width: 1, height: 24, background: 'var(--border-glass)', margin: '0 0.25rem' }} />
              <button className="icon-btn" onClick={() => toggleCard('checkins')} title={collapsedCards.checkins ? "Expand" : "Collapse"}>
                {collapsedCards.checkins ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>
          {!collapsedCards.checkins && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {['today', 'tomorrow'].map(dayGroup => {
                const dayCheckins = checkins.filter(c => c.day === dayGroup).sort((a, b) => a.time_mins - b.time_mins);
                if (dayCheckins.length === 0) return null;
                return (
                  <div key={dayGroup}>
                    <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{dayGroup}</h3>
                    <ul className="data-list">
                      {dayCheckins.map(c => {
                        const p = properties.find(x => x.id === c.property_id);
                        return (
                          <li key={c.id} className="data-item" style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 500 }}>{p?.name ?? 'Unknown Property'}</span>
                            </div>
                            <div className="header-actions">
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 6, padding: '0.15rem 0.4rem' }}>
                                🛎 {formatTime(c.time_mins)}
                              </span>
                              <button className="edit-btn danger" style={{ padding: '2px 4px' }} onClick={() => handleDeleteCheckin(c.id)} title="Clear check-in"><X size={14} /></button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {checkins.length === 0 && (
                <div className="data-item no-results">No upcoming check-ins</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Properties Card */}
        <div className="glass-card">
          <div className="card-header">
            <h2>🏠 Properties ({properties.length})</h2>
            <div className="header-actions">
              {selProps.size > 0 && (
                <button className="icon-btn danger" title={`Delete ${selProps.size} selected`} onClick={() => handleBulkDelete('property')}>
                  <Trash2 size={14} /><span style={{ fontSize: '0.72rem', marginLeft: 3 }}>{selProps.size}</span>
                </button>
              )}
              <button className="icon-btn danger-soft" title="Delete All Properties" onClick={() => handleDeleteAll('property')}>
                <Trash2 size={14} /><span style={{ fontSize: '0.72rem', marginLeft: 3 }}>All</span>
              </button>
              <button className="icon-btn accent" title="Import from Excel" onClick={() => setShowExcel(true)}>📂</button>
              <button className="icon-btn accent" title="Add Property" onClick={() => setAddModal('property')}><Plus size={16} /></button>
              <div style={{ width: 1, height: 24, background: 'var(--border-glass)', margin: '0 0.25rem' }} />
              <button className="icon-btn" onClick={() => toggleCard('properties')} title={collapsedCards.properties ? "Expand" : "Collapse"}>
                {collapsedCards.properties ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>

          {!collapsedCards.properties && (
            <>
          {/* Search + Location filter row */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: 1, marginBottom: 0 }}>
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                placeholder="Search properties…"
                value={propSearch}
                onChange={e => setPropSearch(e.target.value)}
              />
            </div>
            {/* 3-way location filter pill group */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-glass)', flexShrink: 0 }}>
              {[['all', 'All'], ['located', '📍'], ['missing', '⚠️']].map(([val, label]) => (
                <button key={val} title={val === 'all' ? 'Show all' : val === 'located' ? 'With location' : 'Missing location'}
                  onClick={() => setPropFilter(val)}
                  style={{
                    padding: '0.3rem 0.55rem', fontSize: '0.75rem', cursor: 'pointer', border: 'none',
                    background: propFilter === val ? 'var(--brand-pink)' : 'transparent',
                    color: propFilter === val ? 'white' : 'var(--text-secondary)',
                    fontWeight: propFilter === val ? 700 : 400,
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped, filtered property list */}
          <ul className="data-list scrollable-list">
            {(() => {
              const searched = properties.filter(p => p.name.toLowerCase().includes(propSearch.toLowerCase()));
              const filtered = searched.filter(p =>
                propFilter === 'all' ? true :
                  propFilter === 'located' ? hasLocation(p) :
                    !hasLocation(p)
              );
              if (filtered.length === 0) return <li className="data-item no-results">No matching properties</li>;

              // Only group by building when showing properties with location
              if (propFilter === 'missing') {
                // Just list them flat with status badge
                return filtered.map(p => {
                  const status = locationStatus(p);
                  return (
                    <li key={p.id} className={`data-item${selProps.has(p.id) ? ' selected' : ''}`}>
                      <input type="checkbox" className="bulk-check" checked={selProps.has(p.id)} onChange={() => toggleSel(selProps, setSelProps, p.id)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        {status && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: status.color, background: `${status.color}22`, border: `1px solid ${status.color}55`, borderRadius: 4, padding: '0.05rem 0.35rem' }}>
                              {status.label}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {status.hint}
                            </span>
                            {p.checkin_type === 'Meet & Greet' ? (
                              <span style={{ fontSize: '0.68rem', color: '#F03B6A', background: 'rgba(240,59,106,0.1)', border: '1px solid rgba(240,59,106,0.25)', borderRadius: 4, padding: '0.05rem 0.3rem', fontWeight: 600 }}>🤝 Meet & Greet</span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 4, padding: '0.05rem 0.3rem' }}>🔑 Self Check-in</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        <button className="edit-btn" onClick={() => setEditingItem({ type: 'property', data: p })}><Edit2 size={15} /></button>
                        <button className="edit-btn danger" onClick={() => handleDelete('property', p.id)}><Trash2 size={15} /></button>
                      </div>
                    </li>
                  );
                });
              }

              // Group by proximity cluster
              const clusters = groupByBuilding(filtered);
              return clusters.map((cluster, ci) => (
                <React.Fragment key={ci}>
                  {/* Building group header — only shown when cluster has 2+ located properties */}
                  {cluster.length > 1 && hasLocation(cluster[0]) && (
                    <li style={{
                      padding: '0.3rem 0.5rem', fontSize: '0.7rem', fontWeight: 700,
                      color: 'var(--brand-pink)', letterSpacing: '0.06em', textTransform: 'uppercase',
                      background: 'rgba(240,59,106,0.06)', borderRadius: 6, marginTop: ci > 0 ? '0.4rem' : 0,
                      borderLeft: '2px solid var(--brand-pink)', listStyle: 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span>🏢 {cluster[0].cluster_name || 'Building cluster'} · {cluster.length} units</span>
                      <button className="edit-btn" style={{ background: 'transparent' }} onClick={() => setEditingItem({ type: 'cluster', data: cluster })} title="Bulk Edit Cluster Properties"><Edit2 size={13} /></button>
                    </li>
                  )}
                  {cluster.map((p, pi) => {
                    const status = locationStatus(p);
                    const inCluster = cluster.length > 1 && hasLocation(cluster[0]);
                    return (
                      <li key={p.id} className={`data-item${selProps.has(p.id) ? ' selected' : ''}`}
                        style={inCluster ? { paddingLeft: '1.25rem' } : {}}>
                        <input type="checkbox" className="bulk-check" checked={selProps.has(p.id)} onChange={() => toggleSel(selProps, setSelProps, p.id)} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                            {hasLocation(p)
                              ? <span title={`${p.latitude?.toFixed(4)}, ${p.longitude?.toFixed(4)}`} style={{ fontSize: '0.68rem', color: 'var(--success)', background: 'rgba(45,212,172,0.1)', border: '1px solid rgba(45,212,172,0.25)', borderRadius: 4, padding: '0.05rem 0.3rem' }}>📍 Located</span>
                              : status && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: status.color, background: `${status.color}22`, border: `1px solid ${status.color}55`, borderRadius: 4, padding: '0.05rem 0.3rem' }}>{status.label}</span>
                            }
                            {p.checkin_type === 'Meet & Greet' ? (
                              <span style={{ fontSize: '0.68rem', color: '#F03B6A', background: 'rgba(240,59,106,0.1)', border: '1px solid rgba(240,59,106,0.25)', borderRadius: 4, padding: '0.05rem 0.3rem', fontWeight: 600 }}>🤝 Meet & Greet</span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 4, padding: '0.05rem 0.3rem' }}>🔑 Self Check-in</span>
                            )}
                          </div>
                          {!hasLocation(p) && status && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {status.hint}
                            </div>
                          )}
                          {hasLocation(p) && (
                            <div style={{ fontSize: '0.67rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                              {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                          <button className="edit-btn" onClick={() => setEditingItem({ type: 'property', data: p })}><Edit2 size={15} /></button>
                          <button className="edit-btn danger" onClick={() => handleDelete('property', p.id)}><Trash2 size={15} /></button>
                        </div>
                      </li>
                    );
                  })}
                </React.Fragment>
              ));
            })()}
          </ul>
          </>
          )}
        </div>

        {/* Staff Card */}
        <div className="glass-card">
          <div className="card-header">
            <h2>👤 Staff ({staff.length})</h2>
            <div className="header-actions">
              {selStaff.size > 0 && (
                <button className="icon-btn danger" title={`Delete ${selStaff.size} selected`} onClick={() => handleBulkDelete('staff')}>
                  <Trash2 size={14} /><span style={{ fontSize: '0.72rem', marginLeft: 3 }}>{selStaff.size}</span>
                </button>
              )}
              <button className="icon-btn danger-soft" title="Delete All Staff" onClick={() => handleDeleteAll('staff')}>
                <Trash2 size={14} /><span style={{ fontSize: '0.72rem', marginLeft: 3 }}>All</span>
              </button>
              <button className="icon-btn accent" title="Add Staff" onClick={() => setAddModal('staff')}><Plus size={16} /></button>
              <div style={{ width: 1, height: 24, background: 'var(--border-glass)', margin: '0 0.25rem' }} />
              <button className="icon-btn" onClick={() => toggleCard('staff')} title={collapsedCards.staff ? "Expand" : "Collapse"}>
                {collapsedCards.staff ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>
          
          {!collapsedCards.staff && (
            <>
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search staff…"
              value={staffSearch}
              onChange={e => setStaffSearch(e.target.value)}
            />
          </div>
          <ul className="data-list scrollable-list">
            {staff
              .filter(s => s.name.toLowerCase().includes(staffSearch.toLowerCase()) || (s.roles || []).some(r => r.toLowerCase().includes(staffSearch.toLowerCase())))
              .map(s => (
                <li key={s.id} className={`data-item${selStaff.has(s.id) ? ' selected' : ''}`}>
                  <input type="checkbox" className="bulk-check" checked={selStaff.has(s.id)} onChange={() => toggleSel(selStaff, setSelStaff, s.id)} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div className="item-header" style={{ marginBottom: '0.2rem' }}>
                      <span>{s.name} <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.roles?.join(', ')} {s.has_car ? '🚗' : ''}</span></span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="edit-btn" onClick={() => setEditingItem({ type: 'staff', data: s })}><Edit2 size={15} /></button>
                        <button className="edit-btn danger" onClick={() => handleDelete('staff', s.id)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            {staff.filter(s => s.name.toLowerCase().includes(staffSearch.toLowerCase()) || (s.roles || []).some(r => r.toLowerCase().includes(staffSearch.toLowerCase()))).length === 0 &&
              <li className="data-item no-results">No matching staff</li>}
          </ul>
          </>
          )}
        </div>

        {/* Tasks Card */}
        <div className="glass-card">
          <div className="card-header">
            <h2>📋 Pending Tasks ({tasks.length})</h2>
            <div className="header-actions">
              {selTasks.size > 0 && (
                <button className="icon-btn danger" title={`Delete ${selTasks.size} selected`} onClick={() => handleBulkDelete('task')}>
                  <Trash2 size={14} /><span style={{ fontSize: '0.72rem', marginLeft: 3 }}>{selTasks.size}</span>
                </button>
              )}
              <button className="icon-btn danger-soft" title="Delete All Tasks" onClick={() => handleDeleteAll('task')}>
                <Trash2 size={14} /><span style={{ fontSize: '0.72rem', marginLeft: 3 }}>All</span>
              </button>
              <button className="icon-btn" title="Settings" onClick={() => setAddModal('settings')}>
                ⚙️
              </button>
              <button className="icon-btn" style={{ background: '#25D366', color: 'white' }} title="WhatsApp Import" onClick={() => setAddModal('whatsapp')}>
                💬 <span style={{ fontSize: '0.75rem', marginLeft: 3, paddingRight: 4, fontWeight: 600 }}>WhatsApp</span>
              </button>
              {creationMode === 'property' && (
                <button className="icon-btn accent" title="Add Property Itinerary" onClick={() => setAddModal('property_itinerary')} style={{ background: '#0284c7', color: 'white' }}>
                  <Plus size={16} /><span style={{ fontSize: '0.75rem', marginLeft: 3, paddingRight: 4, fontWeight: 600 }}>Itinerary</span>
                </button>
              )}
              <button className="icon-btn accent" title="Add Task" onClick={() => setAddModal('task')}><Plus size={16} /></button>
              <div style={{ width: 1, height: 24, background: 'var(--border-glass)', margin: '0 0.25rem' }} />
              <button className="icon-btn" onClick={() => toggleCard('tasks')} title={collapsedCards.tasks ? "Expand" : "Collapse"}>
                {collapsedCards.tasks ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>
          
          {!collapsedCards.tasks && (
            <>
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search tasks…"
              value={taskSearch}
              onChange={e => setTaskSearch(e.target.value)}
            />
          </div>
          <ul className="data-list scrollable-list">
            {tasks
              .filter(t => {
                const prop = properties.find(p => p.id === t.property_id);
                const q = taskSearch.toLowerCase();
                return (prop?.name ?? '').toLowerCase().includes(q) ||
                  t.task_type.toLowerCase().includes(q) ||
                  getPriorityLabel(t.priority).toLowerCase().includes(q);
              })
              .map(t => {
                const prop = properties.find(p => p.id === t.property_id);
                return (
                  <li key={t.id} className={`data-item${selTasks.has(t.id) ? ' selected' : ''}`}>
                    <input type="checkbox" className="bulk-check" checked={selTasks.has(t.id)} onChange={() => toggleSel(selTasks, setSelTasks, t.id)} style={{ marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div className="item-header">
                        <span style={{ fontWeight: 500 }}>{prop?.name ?? '(unknown)'}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="edit-btn" onClick={() => setEditingItem({ type: 'task', data: t })}><Edit2 size={15} /></button>
                          <button className="edit-btn danger" onClick={() => handleDelete('task', t.id)}><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="time-label">{formatTime(t.time_window_start_mins)} – {formatTime(t.time_window_end_mins)} ({t.duration_mins}m)</span>
                        </div>
                        <span className={`badge ${t.task_type.toLowerCase().replace(' ', '-')}`}>{t.task_type}</span>
                      </div>
                      <div style={{ marginTop: '0.25rem' }}>
                        <span className="time-label" style={{ color: t.priority === 1 ? 'var(--danger)' : t.priority === 2 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {getPriorityLabel(t.priority)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            {tasks.filter(t => {
              const prop = properties.find(p => p.id === t.property_id);
              const q = taskSearch.toLowerCase();
              return (prop?.name ?? '').toLowerCase().includes(q) || t.task_type.toLowerCase().includes(q) || getPriorityLabel(t.priority).toLowerCase().includes(q);
            }).length === 0 &&
              <li className="data-item no-results">No matching tasks</li>}
          </ul>
          </>
          )}
        </div>
      </div>

      {/* Staff Off-Days Calendar */}
      <StaffCalendar staff={staff} offDaysRaw={offDaysRaw} setOffDaysRaw={setOffDaysRaw} setStaff={setStaff} />

      <button className="action-btn" onClick={generateSchedule} disabled={loading} style={{ marginTop: '2rem' }}>
        {loading ? '⏳ Optimizing Schedule...' : '⚡ Generate Multi-Day Schedule'}
      </button>

      {error && (
        <div style={{
          marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 10,
          background: 'rgba(255, 76, 106, 0.1)', border: '1px solid rgba(255,76,106,0.3)',
          color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {schedule && (
        <div className="glass-card schedule-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Generated Schedule</h2>
            <div className="header-actions">
              <button onClick={() => setActiveTab(todayStrISO)} style={{
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                background: activeTab === todayStrISO ? 'var(--brand-pink)' : 'transparent',
                color: activeTab === todayStrISO ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border-glass)',
                fontWeight: activeTab === todayStrISO ? 700 : 400,
                transition: 'all 0.2s',
              }}>
                Today ({todayStr})
              </button>
              <button onClick={() => setActiveTab(tmrwStrISO)} style={{
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                background: activeTab === tmrwStrISO ? 'var(--brand-pink)' : 'transparent',
                color: activeTab === tmrwStrISO ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border-glass)',
                fontWeight: activeTab === tmrwStrISO ? 700 : 400,
                transition: 'all 0.2s',
              }}>
                Tomorrow ({tmrwStr})
              </button>
              <input 
                type="date" 
                value={activeTab} 
                onChange={e => setActiveTab(e.target.value)}
                style={{
                  padding: '0.4rem 0.5rem', borderRadius: '8px', cursor: 'pointer',
                  background: (activeTab !== todayStrISO && activeTab !== tmrwStrISO) ? 'var(--brand-pink)' : 'transparent',
                  color: (activeTab !== todayStrISO && activeTab !== tmrwStrISO) ? 'white' : 'var(--text-primary)',
                  border: '1px solid var(--border-glass)',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
              <div style={{ width: 1, height: 24, background: 'var(--border-glass)', margin: '0 0.25rem' }} />
              <button className="icon-btn" onClick={() => toggleCard('schedule')} title={collapsedCards.schedule ? "Expand" : "Collapse"}>
                {collapsedCards.schedule ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>
          
          {!collapsedCards.schedule && (
            <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '10px', width: 'fit-content' }}>
            <button onClick={() => setScheduleViewMode('timeline')} style={{
              padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer',
              background: scheduleViewMode === 'timeline' ? 'var(--brand-pink)' : 'transparent',
              color: scheduleViewMode === 'timeline' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s'
            }}>Visual Timeline</button>
            <button onClick={() => setScheduleViewMode('table')} style={{
              padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer',
              background: scheduleViewMode === 'table' ? 'var(--brand-pink)' : 'transparent',
              color: scheduleViewMode === 'table' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s'
            }}>Daily Run-Sheet</button>
            {scheduleViewMode === 'table' && (
              <>
                <div style={{ width: 1, background: 'var(--border-glass)', margin: '0 0.25rem' }} />
                <select 
                  value={runSheetGrouping} 
                  onChange={e => setRunSheetGrouping(e.target.value)}
                  style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <option value="property" style={{ color: 'black' }}>Group by Property</option>
                  <option value="staff" style={{ color: 'black' }}>Group by Staff</option>
                </select>
              </>
            )}
          </div>

          {scheduleViewMode === 'timeline' ? (
            <div className="schedule-timeline">{renderTimeline(activeTab)}</div>
          ) : (
            <div className="schedule-runsheet">{renderRunSheet(activeTab)}</div>
          )}

          {/* Legend for auto-generated blocks */}
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-block', width: 20, height: 12, borderRadius: 3, background: 'rgba(45,212,172,0.35)', border: '1.5px dashed rgba(45,212,172,0.7)', flexShrink: 0 }} />
            Auto-generated PA drop-off (not saved to task list)
            <span style={{ display: 'inline-block', width: 20, height: 12, borderRadius: 3, background: 'linear-gradient(135deg, var(--brand-pink-deep), var(--brand-pink))', flexShrink: 0, marginLeft: '0.75rem' }} />
            Manually added task
          </div>

          {/* 🛎 Check-in deadline warnings */}
          {schedule.deadline_warnings?.length > 0 && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: 12, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)' }}>
              <h3 style={{ fontSize: '0.95rem', color: '#a78bfa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🛎 Check-in Deadline Conflicts ({schedule.deadline_warnings.length})
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {schedule.deadline_warnings.map((w, i) => (
                  <li key={i} style={{
                    fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
                    background: 'rgba(167,139,250,0.05)', borderRadius: 8, padding: '0.55rem 0.75rem',
                    border: '1px solid rgba(167,139,250,0.15)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.property}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      <span>{w.task_type}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>assigned to</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.staff_name}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>⚠️</span>
                      <span>Task ends at {formatTime(w.ends_at)} but guest arrives at {formatTime(w.guest_arrives)} — {w.overlap_mins} min overlap. Consider an earlier time window or additional staff.</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* PA drop-off recommendations */}
          {schedule.recommendations?.length > 0 && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: 12, background: 'rgba(45,212,172,0.06)', border: '1px solid rgba(45,212,172,0.2)' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--success)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🚗 PA Drop-off Recommendations ({schedule.recommendations.length})
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {schedule.recommendations.map((rec, i) => (
                  <li key={i} style={{
                    fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
                    background: 'rgba(45,212,172,0.05)', borderRadius: 8, padding: '0.55rem 0.75rem',
                    border: '1px solid rgba(45,212,172,0.12)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.cleaner}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>needs a drop-off at</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.property}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>by {formatTime(rec.time)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: rec.pa_available ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {rec.pa_available
                        ? <><span>✓</span><span>Auto-assigned to a PA in the schedule above (shown as dashed block)</span></>
                        : <><span>⚠️</span><span>No PA available — consider adding a PA to your staff or a Drop-off / Pick-up task manually</span></>
                      }
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unassigned tasks */}
          {schedule.unassigned_tasks?.length > 0 && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: 12, background: 'rgba(255,76,106,0.07)', border: '1px solid rgba(255,76,106,0.2)' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--danger)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚠️ Unassigned Tasks ({schedule.unassigned_tasks.length})
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {schedule.unassigned_tasks.map(t => {
                  const prop = properties.find(p => p.id === t.property_id);
                  return (
                    <li key={t.id || t.task_id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--danger)' }}>●</span>
                      <span><strong style={{ color: 'var(--text-primary)' }}>{prop?.name ?? '(unknown)'}</strong> — {t.task_type} ({t.duration_mins}m)</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{getPriorityLabel(t.priority)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <AddModal
          type={addModal}
          properties={properties}
          onSave={(item) => handleAdd(addModal, item)}
          onClose={() => setAddModal(null)}
        />
      )}

      {/* Excel Import Modal */}
      {showExcel && (
        <ExcelImport
          onImport={(imported) => setProperties(prev => [...prev, ...imported])}
          onClose={() => setShowExcel(false)}
        />
      )}

      {/* WhatsApp Import Modal */}
      {addModal === 'whatsapp' && (
        <WhatsAppImportModal
          properties={properties}
          onClose={() => setAddModal(null)}
          onSave={(payload) => {
            setTasks(prev => [...prev, ...payload.tasks]);
            setAddModal(null);
          }}
        />
      )}

      {/* Property Itinerary Modal */}
      {addModal === 'property_itinerary' && (
        <PropertyItineraryModal
          properties={properties}
          onClose={() => setAddModal(null)}
          onSave={(payload) => {
            setTasks(prev => [...prev, ...payload.tasks]);
            setCheckins(prev => [...prev, ...payload.checkins]);
            setAddModal(null);
          }}
        />
      )}

      {/* Settings Modal */}
      {addModal === 'settings' && (
        <div className="modal-overlay" onClick={() => setAddModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Global Settings</h2>
              <button className="close-btn" onClick={() => setAddModal(null)}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Schedule Creation Workflow</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Choose how you prefer to build the daily schedule.</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => setCreationMode('task')}
                    style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: creationMode === 'task' ? '2px solid var(--brand-pink)' : '1px solid var(--border-glass)', background: creationMode === 'task' ? 'rgba(240,59,106,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Task-Centric (Default)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add tasks one-by-one from the Pending Tasks menu.</div>
                  </button>
                  <button 
                    onClick={() => setCreationMode('property')}
                    style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: creationMode === 'property' ? '2px solid var(--brand-pink)' : '1px solid var(--border-glass)', background: creationMode === 'property' ? 'rgba(240,59,106,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Property-Centric</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add full daily itineraries grouped by property all at once.</div>
                  </button>
                </div>
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '2rem' }}>
              <button type="button" className="btn-primary" onClick={() => setAddModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem.type === 'hq' ? '🏢 Headquarters' : `Edit ${editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)}`}</h2>
              <button className="close-btn" onClick={() => setEditingItem(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              {editingItem.type === 'hq' && (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    This is where all staff start and end their day. Paste a Google Maps link to auto-fill coordinates.
                  </p>
                  <div className="form-group">
                    <label>HQ Name</label>
                    <input type="text" name="name" className="form-control" defaultValue={editingItem.data.name} placeholder="e.g. Airbetter Operations HQ" required />
                  </div>
                  <div className="form-group">
                    <label>Address / Description</label>
                    <input type="text" name="address" className="form-control" defaultValue={editingItem.data.address} placeholder="e.g. Sheikh Zayed Rd, Dubai" />
                  </div>
                  <div className="form-group">
                    <label>Google Maps Link</label>
                    <input type="text" name="mapUrl" className="form-control" defaultValue={editingItem.data.mapUrl} placeholder="https://maps.google.com/... (auto-extracts coordinates)" />
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'block' }}>
                      Paste a Maps link and coordinates will be extracted automatically. Or enter them manually below.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Latitude (optional)</label>
                      <input type="number" step="any" name="latitude" className="form-control" defaultValue={editingItem.data.latitude ?? ''} placeholder="25.2048" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Longitude (optional)</label>
                      <input type="number" step="any" name="longitude" className="form-control" defaultValue={editingItem.data.longitude ?? ''} placeholder="55.2708" />
                    </div>
                  </div>
                </>
              )}
              {editingItem.type === 'cluster' && (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Bulk edit settings for all <strong>{editingItem.data.length}</strong> properties in this building cluster.
                  </p>
                  <div className="form-group">
                    <label>Building Cluster Name</label>
                    <input name="cluster_name" className="form-control" defaultValue={editingItem.data[0]?.cluster_name || ''} placeholder="e.g. Marina Towers" />
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'block' }}>
                      Leave blank for no change. Type exactly "CLEAR" to remove the custom name.
                    </span>
                  </div>
                  <div className="form-group">
                    <label>Access Method</label>
                    <input name="access_method" className="form-control" placeholder="Leave blank for no change..." />
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'block' }}>
                      Leave blank to keep existing access methods. Type exactly "CLEAR" to remove access methods.
                    </span>
                  </div>
                  <div className="form-group">
                    <label>Check-in Type</label>
                    <select name="checkin_type" className="form-control" defaultValue="No Change">
                      <option value="No Change">No Change (Keep existing)</option>
                      <option value="Self Check-in">Self Check-in</option>
                      <option value="Meet & Greet">Meet & Greet (PA)</option>
                    </select>
                  </div>
                </>
              )}
              {editingItem.type === 'property' && (() => {
                const initCoords = extractCoordsFromUrl(editingItem.data.google_maps_link || editingItem.data.mapUrl || '');
                return (
                  <>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Property Name</label>
                        <input type="text" name="name" className="form-control" defaultValue={editingItem.data.name} required />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Bedrooms</label>
                        <input name="bedrooms" type="number" min="0" className="form-control" required defaultValue={editingItem.data.bedrooms || 1} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Access Method</label>
                        <input name="access_method" className="form-control" placeholder="e.g. Keyless + Smartloc" defaultValue={editingItem.data.access_method || ''} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Check-in Type</label>
                        <select name="checkin_type" className="form-control" defaultValue={editingItem.data.checkin_type || 'Self Check-in'}>
                          <option value="Self Check-in">Self Check-in</option>
                          <option value="Meet & Greet">Meet & Greet (PA)</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Google Maps Link</label>
                      <input
                        type="text"
                        name="google_maps_link"
                        className="form-control"
                        defaultValue={editingItem.data.google_maps_link || editingItem.data.mapUrl || ''}
                        placeholder="https://maps.app.goo.gl/... or full Google Maps URL"
                        onChange={e => {
                          const url = e.target.value.trim();
                          if (!url) { setMapLinkStatus(null); return; }
                          const isShort = /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
                          const coords = extractCoordsFromUrl(url);
                          if (coords) setMapLinkStatus({ ok: true, lat: coords.lat, lng: coords.lng, short: false });
                          else if (isShort) setMapLinkStatus({ ok: null, short: true });
                          else if (/maps\.google|google\.com\/maps/i.test(url)) setMapLinkStatus({ ok: false, short: false });
                          else setMapLinkStatus(null);
                        }}
                      />
                      {/* Live verification badge */}
                      {(mapLinkStatus ?? (initCoords ? { ok: true, lat: initCoords.lat, lng: initCoords.lng, short: false } : null)) && (() => {
                        const s = mapLinkStatus ?? { ok: true, lat: initCoords.lat, lng: initCoords.lng, short: false };
                        return (
                          <div style={{
                            marginTop: '0.4rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            color: s.ok === true ? 'var(--success)' : s.ok === null ? 'var(--warning)' : '#f87171'
                          }}>
                            {s.ok === true && <><span>✓</span><span>Coordinates verified: {s.lat.toFixed(5)}, {s.lng.toFixed(5)}</span></>}
                            {s.ok === null && <><span>🔗</span><span>Short link detected — coordinates will be resolved when you generate a schedule</span></>}
                            {s.ok === false && <><span>⚠️</span><span>Maps link found but no coordinates could be extracted. Try a full Google Maps URL.</span></>}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}
              {editingItem.type === 'staff' && (
                <>
                  <div className="form-group"><label>Staff Name</label>
                    <input type="text" name="name" className="form-control" defaultValue={editingItem.data.name} required />
                  </div>
                  <div className="form-group"><label>Roles</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {['PA', 'Cleaner', 'Handyman', 'Reservations', 'Accountant'].map(r => (
                        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                          <input type="checkbox" name={`role_${r}`} value={r} defaultChecked={(editingItem.data.roles || []).includes(r)} />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" name="has_car" defaultChecked={editingItem.data.has_car} />
                      <span style={{ fontSize: '0.9rem' }}>Has Car? (Driver)</span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}><label>Start Time</label>
                      <input type="time" name="start_time" className="form-control" defaultValue={toTimeStr(editingItem.data.start_time_mins)} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}><label>End Time</label>
                      <input type="time" name="end_time" className="form-control" defaultValue={toTimeStr(editingItem.data.end_time_mins)} required />
                    </div>
                  </div>
                </>
              )}
              {editingItem.type === 'task' && (
                <>
                  <div className="form-group"><label>Task Type</label>
                    <select name="task_type" className="form-control" defaultValue={editingItem.data.task_type}>
                      <option value="Checkout Cleaning">Checkout Cleaning</option>
                      <option value="Check-in Cleaning">Check-in Cleaning</option>
                      <option value="Deep Cleaning">Deep Cleaning</option>
                      <option value="Mid-stay Cleaning">Mid-stay Cleaning</option>
                      <option value="Check-in">Check-in</option>
                      <option value="Inspection">Inspection</option>
                      <option value="Cash Collection">Cash Collection</option>
                      <option value="Drop-off / Pick-up">Drop-off / Pick-up</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}><label>Target Day</label>
                      <select name="target_day" className="form-control" defaultValue={editingItem.data.target_day || ''}>
                        <option value="">Auto (Based on priority)</option>
                        <option value="today">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}><label>Priority</label>
                      <select name="priority" className="form-control" defaultValue={editingItem.data.priority}>
                        <option value="1">High (Must do today)</option>
                        <option value="2">Medium</option>
                        <option value="3">Low (Can push to tomorrow)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}><label>Duration (minutes)</label>
                      <input type="number" name="duration_mins" className="form-control" defaultValue={editingItem.data.duration_mins} required />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}><label>Window Start</label>
                      <input type="time" name="time_window_start" className="form-control" defaultValue={toTimeStr(editingItem.data.time_window_start_mins)} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}><label>Window End</label>
                      <input type="time" name="time_window_end" className="form-control" defaultValue={toTimeStr(editingItem.data.time_window_end_mins)} required />
                    </div>
                  </div>
                </>
              )}
              {editingItem.type === 'schedule' && (
                <>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    Override assignment for <strong>{properties.find(p => p.id === editingItem.data.property_id)?.name} ({editingItem.data.task_type})</strong>.
                  </p>
                  <div className="form-group"><label>Assign To</label>
                    <select name="staff_id" className="form-control" defaultValue={editingItem.data.current_staff_id}>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.roles?.join(', ')})</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}><label>Start Time</label>
                      <input type="time" name="start_time" className="form-control" defaultValue={toTimeStr(editingItem.data.start_time_mins)} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}><label>End Time</label>
                      <input type="time" name="end_time" className="form-control" defaultValue={toTimeStr(editingItem.data.end_time_mins)} required />
                    </div>
                  </div>
                </>
              )}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
