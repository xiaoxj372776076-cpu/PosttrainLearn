import test from 'node:test';
import assert from 'node:assert/strict';
import { callModel } from '../lib/model-gateway.mjs';

async function mockTerminal(type, response, action) {
  const fetch = globalThis.fetch;
  const key = process.env.LLMGW_OPENAI_API_KEY;
  process.env.LLMGW_OPENAI_API_KEY = 'unit-test-not-a-real-key';
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 10000);
    return new Response(`data: ${JSON.stringify({type,response})}\n\n`, {
      headers: {'content-type':'text/event-stream'},
    });
  };
  try { await action(); }
  finally {
    globalThis.fetch = fetch;
    if (key === undefined) delete process.env.LLMGW_OPENAI_API_KEY;
    else process.env.LLMGW_OPENAI_API_KEY = key;
  }
}

test('gateway archives public answer and usage, never hidden reasoning output', async () => {
  await mockTerminal('response.completed', {status:'completed',model:'test-model',usage:{output_tokens:7},output:[
    {type:'reasoning',summary:[{text:'not public reasoning'}]},
    {type:'message',content:[{type:'output_text',text:'{"answer":1}'}]},
  ]}, async () => {
    const response = await callModel({messages:[]});
    assert.equal(response.text, '{"answer":1}');
    assert.equal(response.usage.output_tokens, 7);
    assert.ok(!JSON.stringify(response).includes('not public reasoning'));
  });
});

test('incomplete terminal retains known usage and reason without exposing key or reasoning', async () => {
  await mockTerminal('response.incomplete', {status:'incomplete',model:'test-model',
    incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:25,output_tokens:10000},
    output:[{type:'reasoning',summary:[{text:'not public reasoning'}]},
      {type:'message',content:[{type:'output_text',text:'unit-test-not-a-real-key'}]}],
  }, async () => {
    await assert.rejects(callModel({messages:[]}), error => {
      assert.equal(error.publicResponse.incompleteDetails.reason, 'max_output_tokens');
      assert.equal(error.publicResponse.usage.output_tokens, 10000);
      assert.equal(error.publicResponse.text, '[REDACTED]');
      assert.ok(!JSON.stringify(error.publicResponse).includes('not public reasoning'));
      return true;
    });
  });
});

test('missing terminal event is unknown usage, not a completed empty answer', async () => {
  await mockTerminal('response.created', {status:'in_progress'}, async () => {
    await assert.rejects(callModel({messages:[]}), error => {
      assert.equal(error.publicResponse.status, 'no_terminal_event');
      assert.equal(error.publicResponse.usage, null);
      return true;
    });
  });
});
