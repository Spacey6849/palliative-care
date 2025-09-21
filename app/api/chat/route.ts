import { NextRequest } from 'next/server';
// Force dynamic execution & disable caching to avoid static optimization error when using request.url and streaming
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'only-no-store';
export const runtime = 'nodejs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase/client';

// Expected table structure (create in Supabase):
// Table: chat_messages
// Columns: id (uuid, pk, default uuid_generate_v4()), role (text), content (text), created_at (timestamptz default now())

export async function POST(req: NextRequest) {
  try {
  const supabase = getSupabase();
  // Ensure chat_messages has needed polymorphic linkage columns (runtime safe add)
  // Supabase schema should already include chat_messages with columns: role, content, username, response, created_at
  const url = new URL(req.url);
  const isStream = url.searchParams.get('stream') === '1';
    const body = await req.json();
  const messages = (body.messages as { role: string; content: string }[] | undefined) || [];
  // Legacy-style: rely mainly on provided conversation (front-end should send recent history)
  const lastUser = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';

    // Identify session (user vs admin) with backward compatibility (sessions may lack admin_id column)
    const cookieStore = cookies();
  const userSession = cookieStore.get('bl_session')?.value || cookieStore.get('ecw_session')?.value || null;
    const adminSession = userSession; // unified cookie; admin now lives in admin_sessions table with same token
  const hasAdminIdCol = false; // sessions table in Supabase uses user_id only
  let userId: string | null = null;
  let adminId: string | null = null;
  if (adminSession) {
      if (hasAdminIdCol) {
        // Not supported in current schema
      } else {
        
        const { data: s } = await supabase.from('admin_sessions').select('admin_id').eq('token', adminSession).limit(1).maybeSingle();
        if (s?.admin_id) adminId = s.admin_id as string;
      }
    }
    if (!adminId && userSession) {
      
      const { data: s } = await supabase.from('sessions').select('user_id').eq('token', userSession).limit(1).maybeSingle();
      if (s?.user_id) {
        const uid = s.user_id as string;
        userId = uid;
      }
    }

  // Build bins + latest metric snapshot. Admin: all bins. User: own bins.
    let bins: any[] = [];
    if (adminId) {
      const { data } = await supabase
        .from('user_bins')
        .select('id,user_id,name,location_label,status,lat,lng, users(username,email,phone,location)')
        .order('id', { ascending: true });
      bins = (data || []).map((b: any) => ({ ...b, ...b.users }));
    } else if (userId) {
      const { data } = await supabase
        .from('user_bins')
        .select('id,user_id,name,location_label,status,lat,lng, users(username,email,phone,location)')
        .eq('user_id', userId)
        .order('id', { ascending: true });
      bins = (data || []).map((b: any) => ({ ...b, ...b.users }));
    }

    // Extract potential bin names from user message for targeted queries
    const mentionText = (lastUser || '').toLowerCase();
    const allNames = bins.map(b => String(b.name || '').trim()).filter(Boolean);
    const matchedNames = allNames.filter(n => mentionText.includes(n.toLowerCase()));

    // Get latest metrics per bin (by id) and also by bin_name as fallback
    const binIds = bins.map(b => b.id);
    let latestByBin: Record<string, any> = {};
    let latestByName: Record<string, any> = {};
    if (binIds.length) {
      const { data: metricRows } = await supabase
        .from('bin_metrics')
        .select('id, bin_id, fill_pct, is_open, recorded_at, bin_name')
        .in('bin_id', binIds)
        .order('recorded_at', { ascending: false })
        .limit(1000);
      for (const row of (metricRows || []) as any[]) {
        if (row?.bin_id && !latestByBin[row.bin_id]) latestByBin[row.bin_id] = row; // first is latest due to DESC
      }
    }
    // Name-based fallback: query for all names (or at least matched) to cover rows missing bin_id
    const namesToQuery = matchedNames.length ? matchedNames : allNames;
    if (namesToQuery.length) {
      const { data: nameRows } = await supabase
        .from('bin_metrics')
        .select('id, bin_id, fill_pct, is_open, recorded_at, bin_name')
        .in('bin_name', namesToQuery)
        .order('recorded_at', { ascending: false })
        .limit(1000);
      for (const row of (nameRows || []) as any[]) {
        const key = (row?.bin_name || '').trim();
        if (key && !latestByName[key]) latestByName[key] = row;
      }
    }

    // Build a concise bin snapshot only if the user asks about bins/metrics
  // Include legacy term 'well' as an alias so older phrasing still pulls bin context
  const needsBinContext = /bin|fill|lid|open|status|location|well/i.test(lastUser || '') && bins.length;
    
    // Determine if the user asked about a specific bin by name
    const askedForAll = /(all\s+bins|every\s+bin|other\s+bins|others|compare\s+bins|list\s+bins)/i.test(lastUser);
    const matchedBins = bins.filter(b => matchedNames.includes(String(b.name || '')));
    let structuredBlock = '';
    if (needsBinContext) {
      const sections: string[] = [];
      const targetBins = matchedBins.length && !askedForAll ? matchedBins : bins;
      for (const b of targetBins) {
        const m = latestByBin[b.id] || latestByName[String(b.name || '').trim()];
        const binName = b.name || 'Unknown Bin';
        const location = b.location_label || (typeof b.location === 'string' ? b.location : `${b.lat ?? '—'}, ${b.lng ?? '—'}`);
        const fill = m?.fill_pct != null ? Math.max(0, Math.min(100, Number(m.fill_pct))) : null;
        const lidState = m?.is_open == null ? 'N/A' : (m.is_open ? 'Open' : 'Closed');
        const statusNorm = (String(b.status || '').toLowerCase() === 'offline') ? 'Offline' : 'Online';
        const section = [
          `Bin Name: ${binName}`,
          `Bin Lid: ${lidState}`,
          `Bin Fill %: ${fill == null ? 'N/A' : String(Math.round(fill)) + '%'}`,
          `Status: ${statusNorm}`,
          `Bin Location: ${location || 'N/A'}`,
        ].join('\n');
        sections.push(section);
      }
      structuredBlock = sections.join('\n\n');
    }

    // Resolve a human-readable username (for new schema). If both admin & user present, admin wins.
    let currentUsername: string | null = null;
    if (adminId) {
      try {
        const { data: a } = await supabase.from('admin_accounts').select('username').eq('id', adminId).limit(1).maybeSingle();
        currentUsername = a?.username || 'Admin';
      } catch { currentUsername = 'Admin'; }
    } else if (userId) {
      try {
        const { data: u } = await supabase.from('users').select('username').eq('id', userId).limit(1).maybeSingle();
        currentUsername = u?.username || 'User';
      } catch { currentUsername = 'User'; }
    }

    let insertedUserMessageId: number | null = null;
    if (lastUser) {
  insertedUserMessageId = await insertChatMessage(supabase, 'user', lastUser, userId, adminId, currentUsername);
    }
  const apiKey = process.env['GEMINI_API_KEY'] || process.env['NEXT_PUBLIC_GEMINI_API_KEY'] || '';
    if (!apiKey) {
      return new Response('AI model key not configured (set GEMINI_API_KEY in .env.local then restart).', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (!lastUser) {
      return new Response('No user message.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    // Require model from env to avoid embedding model literals in code
    const requestedModel = process.env['GEMINI_MODEL'] || '';
    if (!requestedModel) {
      return new Response('AI model not configured (set GEMINI_MODEL).', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const candidateModels = [requestedModel];
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      let model: any = null;
      let chosenModel = '';
      let lastErr: any = null;
      for (const m of candidateModels) {
        try {
          model = genAI.getGenerativeModel({ model: m });
          // simple probe: attempt empty generation with safety; skip heavy content
          chosenModel = m;
          break;
        } catch (e:any) {
          lastErr = e;
          console.error('[chat] model init failed', m, e.message);
        }
      }
      if (!model) {
        return new Response('All Gemini model candidates failed to init: ' + (lastErr?.message || 'unknown'), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      const systemPreamble = adminId
        ? 'You are BinLink, an admin smart-bin assistant. Respond concisely. If bins are mentioned, reference only the provided structured snapshot lines (verbatim) before analysis. Unless the user explicitly asks for other or all bins, answer ONLY about the specific bin they named. ALWAYS format any metrics with one per line using exactly these labels: Bin Lid:, Bin Fill %:, Status:, Bin Location:. If the user asks which bin is critical, prioritize highest Fill % and OPEN status; clearly label the critical bins.'
        : 'You are BinLink, a smart-bin assistant. Respond directly without an opening greeting. Unless the user explicitly asks for other or all bins, answer ONLY about the specific bin they named. ALWAYS format metrics with one per line using exactly these labels: Bin Lid:, Bin Fill %:, Status:, Bin Location:. When the user asks for critical bins, prioritize highest Fill % and OPEN status. Provide a short ordered list from most to least urgent with reasons.';
      const convoLines = messages.slice(-25).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`);
  const debugFlag = url.searchParams.get('debug') === '1';
  const prompt = [
        systemPreamble,
        convoLines.length ? 'Conversation so far:\n' + convoLines.join('\n') : '',
  needsBinContext && structuredBlock ? 'Structured Bin Snapshot (Latest):\n' + structuredBlock : '',
        'User: ' + lastUser
      ].filter(Boolean).join('\n\n');
      // --- Special intent handling BEFORE model call (critical bins on map) ---
  if (/(any|which)\s+bins?.*(are\s+)?(critical|full|open).*map\??/i.test(lastUser)) {
        // Classify critical bins using latest metrics we have.
        const critical: {name:string; reasons:string[]; metrics:any}[] = [];
        const evaluated: {name:string; metrics:any}[] = [];
        for (const b of bins) {
          const m = latestByBin[b.id];
          const name = b.name || 'Bin ' + b.id;
          if (!m) { evaluated.push({ name, metrics: null }); continue; }
          const reasons: string[] = [];
          const fill = m.fill_pct != null ? Number(m.fill_pct) : null;
          if (fill != null && fill >= 95) reasons.push(`Bin is Full (${Math.round(fill)}%)`);
          if (m.is_open === true) reasons.push('Lid OPEN');
          if ((b.status || '').toLowerCase() === 'offline') reasons.push('Offline');
          if (reasons.length) critical.push({ name, reasons, metrics: m });
          evaluated.push({ name, metrics: m });
        }
        // Sort critical bins: highest fill first, then OPEN lids prioritized
        critical.sort((a, b) => {
          const fa = a.metrics?.fill_pct ?? -1;
          const fb = b.metrics?.fill_pct ?? -1;
          if (fb !== fa) return fb - fa;
          const oa = a.metrics?.is_open ? 1 : 0;
          const ob = b.metrics?.is_open ? 1 : 0;
          return ob - oa;
        });
        let answer: string;
        if (!bins.length) {
          answer = 'No bins are available to evaluate.';
        } else if (!critical.length) {
          answer = `No critical bins detected among ${evaluated.length} bins evaluated.`;
        } else {
          const lines: string[] = [];
          lines.push(`Critical Bins (${critical.length} of ${evaluated.length} evaluated):`);
          critical.forEach((c, idx) => {
            lines.push(`${idx + 1}. ${c.name}`);
            lines.push(`   Reasons: ${c.reasons.join('; ')}`);
            const m = c.metrics;
            const fill = m.fill_pct != null ? Math.round(Number(m.fill_pct)) + '%' : '—';
            const lid = m.is_open == null ? '—' : (m.is_open ? 'OPEN' : 'CLOSED');
            lines.push(`   Fill %: ${fill}`);
            lines.push(`   Lid: ${lid}`);
            lines.push(`   Updated: ${m.recorded_at || '—'}`);
          });
          lines.push('Critical criteria: Fill ≥95% and/or Lid OPEN.');
          answer = lines.join('\n');
        }
        const formatted = neatFormat(answer);
        if (insertedUserMessageId) {
          await supabase.from('chat_messages').update({ response: formatted }).eq('id', insertedUserMessageId);
        } else {
          await insertChatMessage(supabase, 'assistant', formatted, userId, adminId, null);
        }
        return new Response(formatted, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      // Deterministic direct answer when a single bin is requested
      if (matchedBins.length === 1 && !askedForAll) {
        const b = matchedBins[0];
        const m = latestByBin[b.id] || latestByName[String(b.name || '').trim()];
        const location = b.location_label || (typeof b.location === 'string' ? b.location : `${b.lat ?? '—'}, ${b.lng ?? '—'}`);
        const lid = m?.is_open == null ? 'N/A' : (m.is_open ? 'Open' : 'Closed');
        const fill = m?.fill_pct != null ? String(Math.round(Number(m.fill_pct))) + '%' : 'N/A';
        const statusNorm = (String(b.status || '').toLowerCase() === 'offline') ? 'Offline' : 'Online';
        const answer = [`Bin Lid: ${lid}`, `Bin Fill %: ${fill}`, `Status: ${statusNorm}`, `Bin Location: ${location || 'N/A'}`].join('\n');
        const formatted = neatFormat(answer);
        if (insertedUserMessageId) {
          await supabase.from('chat_messages').update({ response: formatted }).eq('id', insertedUserMessageId);
        } else {
          await insertChatMessage(supabase, 'assistant', formatted, userId, adminId, null);
        }
        return new Response(formatted, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      if (isStream) {
        const streamingResult = await model.generateContentStream({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        const encoder = new TextEncoder();
        let fullText = '';
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of streamingResult.stream) {
                const text = chunk.text();
                if (text) { fullText += text; controller.enqueue(encoder.encode(text)); }
              }
              if (fullText.trim()) {
                fullText = neatFormat(fullText);
                
                if (insertedUserMessageId) {
                  await supabase.from('chat_messages').update({ response: fullText }).eq('id', insertedUserMessageId);
                } else {
                  await insertChatMessage(supabase, 'assistant', fullText, userId, adminId, null);
                }
              }
              controller.close();
            } catch (e:any) {
              controller.enqueue(encoder.encode('[error:' + (e.message||'stream error') + ']'));
              controller.close();
            }
          }
        });
        return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      } else {
        const result = await model.generateContent(prompt);
  let replyText = result.response.text() || 'No reply.';
  const final = debugFlag ? `[model:${chosenModel}]\n` + replyText : replyText;
  const neat = neatFormat(final);
  
  if (insertedUserMessageId) {
    await supabase.from('chat_messages').update({ response: neat }).eq('id', insertedUserMessageId);
  } else {
    await insertChatMessage(supabase, 'assistant', neat, userId, adminId, null);
  }
  return new Response(neat, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    } catch (err:any) {
      return new Response('Model error: ' + (err.message||'unknown'), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  } catch (e: any) {
    return new Response('Error: ' + (e.message || 'Unexpected error'), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

// Fetch recent chat history (GET /api/chat?limit=50)
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200);
  const cookieStore = cookies();
  const userSession = cookieStore.get('bl_session')?.value || cookieStore.get('ecw_session')?.value || null;
    const adminSession = userSession;
  let userId: string | null = null;
  let adminId: string | null = null;
    const hasAdminIdCol = false;
    if (adminSession) {
      
      const { data: s } = await supabase.from('admin_sessions').select('admin_id').eq('token', adminSession).limit(1).maybeSingle();
      if (s?.admin_id) adminId = s.admin_id as string;
    }
    if (!adminId && userSession) {
      
      const { data: s } = await supabase.from('sessions').select('user_id').eq('token', userSession).limit(1).maybeSingle();
      if (s?.user_id) {
        const uid = s.user_id as string;
        userId = uid;
      }
    }
  let rows;
  const selectCols = ['id','role','content','created_at','response','username'];
  
  // Determine current username for filtering (new schema) while retaining legacy id-based filtering
    let currentUsername: string | null = null;
    if (adminId) {
      try { const { data: a } = await supabase.from('admin_accounts').select('username').eq('id', adminId).limit(1).maybeSingle(); currentUsername = a?.username || 'Admin'; } catch {}
    } else if (userId) {
      try { const { data: u } = await supabase.from('users').select('username').eq('id', userId).limit(1).maybeSingle(); currentUsername = u?.username || null; } catch {}
    }
    if (currentUsername) {
      const { data } = await supabase
        .from('chat_messages')
        .select(selectCols.join(','))
        .eq('username', currentUsername)
        .order('created_at', { ascending: true })
        .limit(limit);
      rows = data || [];
    } else if (adminId) {
      const { data } = await supabase
        .from('chat_messages')
        .select(selectCols.join(','))
        .order('created_at', { ascending: true })
        .limit(limit);
      rows = data || [];
    } else if (userId) {
      const { data } = await supabase
        .from('chat_messages')
        .select(selectCols.join(','))
        .order('created_at', { ascending: true })
        .limit(limit);
      rows = data || [];
    } else {
      return new Response(JSON.stringify({ messages: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Expand history: for any row that has a stored assistant response, emit two messages
    // 1) the original user (or assistant) message
    // 2) an assistant message with the saved response
    // This preserves order by created_at while ensuring the UI receives both sides.
    const expanded: any[] = [];
    for (const r of rows as any[]) {
      const base = { id: r.id, role: r.role, content: r.content, created_at: r.created_at, username: r.username };
      // Push the base message
      expanded.push({ ...base, displayRole: r.role === 'assistant' ? 'assistant' : 'user' });
      // If there's a response associated with this message, push it as a separate assistant entry
      if (r.response && String(r.response).trim()) {
        expanded.push({
          id: `${r.id}-resp`,
          role: 'assistant',
          content: r.response,
          created_at: r.created_at,
          username: r.username,
          displayRole: 'assistant'
        });
      }
    }
    return new Response(JSON.stringify({ messages: expanded }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
  return new Response(JSON.stringify({ error: e.message || 'Unexpected error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// --- helpers ---
async function insertChatMessage(supabase: ReturnType<typeof getSupabase>, role: string, content: string, _userId: string | null, _adminId: string | null, username: string | null): Promise<number | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ role, content, username })
    .select('id')
    .maybeSingle();
  if (error) return null;
  return (data as any)?.id ?? null;
}

async function getSessionColumns(): Promise<Set<string>> { return new Set(); }

// Lightweight formatting helper to ensure each metric label starts on its own line.
function neatFormat(text: string): string {
  if (!text) return text;
  // Insert newline before metric labels if not already at line start
  const pattern = /(\s+)(TDS:|Temp:|Temperature:|Water Level:|pH Level:|pH:|Bin Lid:|Bin Fill %:|Status:|Bin Location:)/g;
  let out = text.replace(pattern, '\n$2');
  // Collapse extra spaces around newlines
  out = out.replace(/\n{2,}/g, '\n\n');
  return out.trim();
}

// Fallback responder removed: model responses only.