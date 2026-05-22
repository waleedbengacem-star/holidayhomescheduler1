/**
 * Netlify Serverless Function: claude-ai
 *
 * Secure server-side proxy to the Anthropic Claude API.
 * Accepts the full operational context of the scheduler so Claude can
 * reason over ALL available information — staff, properties (including
 * custom columns), tasks, off-days, and any learned rules — before
 * extracting or applying scheduling constraints.
 *
 * Endpoint: POST /api/claude-ai
 * Body: { feedbackText, systemContext }
 * Returns: { constraints, summary, rawResponse }
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'CLAUDE_API_KEY not set. Go to Netlify → Site Settings → Environment Variables.' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const { feedbackText, systemContext = {} } = body;
  if (!feedbackText?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'feedbackText is required' }) };

  // ── Build rich context block from all available data ──────────────────────
  const {
    staff = [],
    properties = [],
    propertyGridCols = [],
    propertyGridRows = [],
    tasks = [],
    offDays = {},
    expertRules = [],
    taskTypes = [],
    hq = null,
  } = systemContext;

  // Staff section
  const staffSection = staff.length
    ? staff.map(s => {
        const offList = offDays[s.id] || [];
        const recOff = (s.recurring_off_days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
        return [
          `  • ${s.name}`,
          `    Roles: ${(s.roles || []).join(', ') || 'None'}`,
          `    Has car: ${s.has_car ? 'Yes' : 'No'}`,
          `    Recurring off days: ${recOff || 'None'}`,
          `    Specific off dates: ${offList.length ? offList.slice(0, 10).join(', ') + (offList.length > 10 ? ` (+${offList.length - 10} more)` : '') : 'None'}`,
          s.ai_notes ? `    Additional context: ${s.ai_notes}` : null,
        ].filter(Boolean).join('\n');
      }).join('\n\n')
    : '  (No staff listed)';

  // Properties section — includes any custom columns from the Property Info grid
  const hasGridData = propertyGridCols.length > 0 && propertyGridRows.length > 0;
  const propertiesSection = hasGridData
    ? propertyGridRows.map(row => {
        const fields = propertyGridCols.map(col => `    ${col.label}: ${row[col.id] || '—'}`).join('\n');
        return fields;
      }).join('\n\n')
    : properties.length
      ? properties.map(p => `  • ${p.name} (${p.bedrooms || '?'} beds) — lat: ${p.latitude || '?'}, lng: ${p.longitude || '?'}`).join('\n')
      : '  (No properties listed)';

  // Pending tasks
  const tasksSection = tasks.length
    ? tasks.map(t => {
        const propName = properties.find(p => p.id === t.property_id)?.name || t.property_id;
        return `  • ${t.task_type} @ ${propName} (${t.duration_mins}min, priority ${t.priority})`;
      }).join('\n')
    : '  (No pending tasks)';

  // Previously learned rules
  const rulesSection = expertRules.length
    ? expertRules.slice(0, 15).map(r => `  • [${r.timestamp?.slice(0, 10) || 'rule'}] ${r.raw_text}`).join('\n')
    : '  (No rules learned yet)';

  // HQ
  const hqSection = hq
    ? `  ${hq.name} — ${hq.address} (lat: ${hq.latitude || '?'}, lng: ${hq.longitude || '?'})`
    : '  (HQ not configured)';

  const systemPrompt = `You are an AI scheduling assistant for a Holiday Home Operations company.

Your job is to extract scheduling constraints and rules from plain-English manager instructions.
You have access to the COMPLETE current state of the scheduling system. Use ALL of it when interpreting instructions.

═══════════════════════════════════════════════════
HEADQUARTERS
═══════════════════════════════════════════════════
${hqSection}

═══════════════════════════════════════════════════
STAFF (${staff.length} members)
═══════════════════════════════════════════════════
${staffSection}

═══════════════════════════════════════════════════
PROPERTIES${hasGridData ? ' (from Property Info grid — includes all custom columns)' : ''}
═══════════════════════════════════════════════════
${propertiesSection}

═══════════════════════════════════════════════════
PENDING TASKS (${tasks.length})
═══════════════════════════════════════════════════
${tasksSection}

═══════════════════════════════════════════════════
AVAILABLE TASK TYPES
═══════════════════════════════════════════════════
${taskTypes.join(', ') || 'Checkout Cleaning, Check-in Cleaning, Deep Cleaning, Mid-stay Cleaning, Linen Change, Touch Up, Check-in, Inspection, Cash Collection, Pay Collect, Viewings, Drop-off / Pick-up, Maintenance, Picture / Measurement'}

═══════════════════════════════════════════════════
PREVIOUSLY LEARNED RULES (${expertRules.length})
═══════════════════════════════════════════════════
${rulesSection}

═══════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════
Respond with ONLY a valid JSON object (no markdown, no code blocks) in this exact format:
{
  "summary": "A short, friendly 1-sentence explanation of what rule was understood",
  "constraints": [
    {
      "type": "disallow_task",
      "staff_id": "<id or null>",
      "staff_name": "<exact name from list above>",
      "task_type": "<exact task type>"
    }
  ]
}

Supported constraint types:
- "disallow_task": Prevents a staff member from being assigned a specific task type
- "prefer_property": Expresses a staff preference for certain properties (include as metadata)
- "time_preference": Expresses a time-of-day preference for a staff member
- "property_note": Records an important property-specific scheduling note

If the instruction is a general preference or observation (not a hard constraint), still return an empty constraints array with a helpful summary.
Consider ALL data above — including custom property columns (WiFi, Keybox codes, parking, etc.) — when interpreting what the manager means.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: feedbackText }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: `Anthropic API returned ${response.status}: ${errText}` }) };
    }

    const claudeData = await response.json();
    const rawText = claudeData.content?.[0]?.text ?? '';

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      try { parsed = JSON.parse(cleaned); }
      catch { return { statusCode: 200, headers, body: JSON.stringify({ summary: rawText, constraints: [], rawResponse: rawText }) }; }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        summary: parsed.summary || 'Rule understood.',
        constraints: parsed.constraints || [],
        rawResponse: rawText,
      }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: `Server error: ${err.message}` }) };
  }
};
