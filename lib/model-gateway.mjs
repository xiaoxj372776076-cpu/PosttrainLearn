export async function callModel({ model = 'gpt-6-astra', messages, maxOutputTokens = 10000, effort = 'high' }) {
  const key = process.env.LLMGW_OPENAI_API_KEY;
  if (!key) throw new Error('LLMGW_OPENAI_API_KEY is missing');
  const start = Date.now();
  try {
    const response = await fetch('https://llmbox.bytedance.net/responses', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(600000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'x-source': 'aidp_agent', 'X-Llmgw-Subscription': '0' },
      body: JSON.stringify({ model, input: messages, reasoning: { effort }, max_output_tokens: maxOutputTokens, stream: true, store: false }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    let final; let buffer = '';
    const reader = response.body.getReader(); const decoder = new TextDecoder();
    function consume(block) {
      const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') return;
      const event = JSON.parse(data);
      if (['response.completed', 'response.incomplete', 'response.failed'].includes(event.type)) final = event.response;
      if (event.type === 'error') throw new Error(String(event.message || event.error?.message || 'Stream error'));
    }
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) { consume(buffer.slice(0, match.index)); buffer = buffer.slice(match.index + match[0].length); }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    const text = (final?.output ?? []).filter(o => o.type === 'message').flatMap(o => (o.content ?? []).filter(c => c.type === 'output_text').map(c => c.text)).join('');
    if (final?.status !== 'completed') {
      const error = new Error(`Incomplete response: ${final?.status ?? 'no terminal event'}`);
      error.publicResponse = { requestedModel:model, actualModel:final?.model??null, text,
        usage:final?.usage??null, latencyMs:Date.now()-start, completedAt:new Date().toISOString(),
        status:final?.status??'no_terminal_event', incompleteDetails:final?.incomplete_details??null };
      throw error;
    }
    if (!text.trim()) throw new Error('Empty response');
    return { requestedModel: model, actualModel: final.model ?? null, text, usage: final.usage ?? null, latencyMs: Date.now() - start, completedAt: new Date().toISOString(), status: final.status };
  } catch (error) {
    const sanitized = new Error(String(error.message).replaceAll(key, '[REDACTED]').slice(0, 1000));
    if (error.publicResponse) sanitized.publicResponse = JSON.parse(JSON.stringify(error.publicResponse).replaceAll(key, '[REDACTED]'));
    throw sanitized;
  }
}
