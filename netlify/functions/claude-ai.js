/**
 * Netlify Serverless Function: claude-ai
 * 
 * This function is the secure server-side proxy between the frontend
 * and the Anthropic Claude API. It keeps the API key off the client.
 * 
 * Endpoint: POST /api/claude-ai
 * Body: { feedbackText: string, staffList: [{id, name, roles}], taskTypes: string[] }
 * Returns: { constraints: [...], summary: string, rawResponse: string }
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

  if (!CLAUDE_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'CLAUDE_API_KEY environment variable is not set in Netlify. Go to Site Settings → Environment Variables and add it.'
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { feedbackText, staffList = [], taskTypes = [] } = body;

  if (!feedbackText?.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'feedbackText is required' }) };
  }

  // Build staff and task context for Claude
  const staffContext = staffList.map(s => `- ${s.name} (roles: ${(s.roles || []).join(', ')})`).join('\n');
  const taskContext = taskTypes.join(', ');

  const systemPrompt = `You are an AI assistant for a Holiday Home Operations Scheduler.
Your job is to extract scheduling constraints from plain-English instructions given by a manager.

Current staff members:
${staffContext || '(none listed)'}

Available task types: ${taskContext || 'Checkout Cleaning, Check-in Cleaning, Deep Cleaning, Mid-stay Cleaning, Linen Change, Touch Up, Check-in, Inspection, Cash Collection, Pay Collect, Viewings, Drop-off / Pick-up, Maintenance, Picture / Measurement'}

You must respond with a valid JSON object (no markdown, no code blocks, just raw JSON) in this exact format:
{
  "summary": "A short, friendly 1-sentence explanation of what rule was understood",
  "constraints": [
    {
      "type": "disallow_task",
      "staff_id": "<the id of the staff member, or null if unknown>",
      "staff_name": "<staff name exactly as listed above>",
      "task_type": "<exact task type from the list above>"
    }
  ]
}

Supported constraint types:
- "disallow_task": Prevents a specific staff member from being assigned a specific task type

If the instruction is not a scheduling constraint (e.g. it's a general note or preference), return an empty constraints array but still provide a helpful summary.
If multiple constraints are mentioned, include all of them in the constraints array.
Only use staff names and task types that match the lists above. If unsure, do your best to match.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // Fast + cheap, perfect for this use case
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: feedbackText,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: `Anthropic API returned ${response.status}: ${errText}` }),
      };
    }

    const claudeData = await response.json();
    const rawText = claudeData.content?.[0]?.text ?? '';

    // Parse the JSON Claude returned
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // If Claude wrapped it in code blocks, strip them
      const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Fallback: return raw text so frontend can show it
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            summary: rawText,
            constraints: [],
            rawResponse: rawText,
          }),
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary: parsed.summary || 'Rule understood.',
        constraints: parsed.constraints || [],
        rawResponse: rawText,
      }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Server error: ${err.message}` }),
    };
  }
};
