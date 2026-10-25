const assert = require('node:assert/strict');
const { test } = require('node:test');

const { patternsInText } = require('./patterns');

const rangeOf = (text, pattern) => ({ start: text.indexOf(pattern), end: text.indexOf(pattern) + pattern.length });

test('finds send and emit calls as senders', () => {
	const send = "\t\treturn lastValueFrom(this.client.send('get-users-list', payload));";
	const emit = '\t\tthis.client.emit("order.created", payload);';

	assert.deepEqual(patternsInText(send), [
		{ kind: 'sender', pattern: 'get-users-list', ...rangeOf(send, 'get-users-list') },
	]);
	assert.deepEqual(patternsInText(emit), [
		{ kind: 'sender', pattern: 'order.created', ...rangeOf(emit, 'order.created') },
	]);
});

test('finds MessagePattern and EventPattern decorators as handlers', () => {
	const message = "\t@MessagePattern('get-users-list')";
	const event = "\t@EventPattern('order.created')";

	assert.deepEqual(patternsInText(message), [
		{ kind: 'handler', pattern: 'get-users-list', ...rangeOf(message, 'get-users-list') },
	]);
	assert.deepEqual(patternsInText(event), [
		{ kind: 'handler', pattern: 'order.created', ...rangeOf(event, 'order.created') },
	]);
});

test('finds object patterns regardless of key order', () => {
	const handler = "\t@MessagePattern({ cmd: 'sum', role: 'math' })";
	const sender = "\t\treturn this.client.send<number>({ 'role': \"math\", cmd: 'sum' }, [1, 2]);";

	assert.deepEqual(patternsInText(handler), [
		{ kind: 'handler', pattern: '{"cmd":"sum","role":"math"}', ...rangeOf(handler, "{ cmd: 'sum', role: 'math' }") },
	]);
	assert.deepEqual(patternsInText(sender), [
		{ kind: 'sender', pattern: '{"cmd":"sum","role":"math"}', ...rangeOf(sender, "{ 'role': \"math\", cmd: 'sum' }") },
	]);
});

test('finds patterns in calls wrapped over several lines', () => {
	const text = "this.client.send(\n\t'get-users-list',\n\tpayload,\n);\n@EventPattern(\n\t{ cmd: 'sum' },\n)";

	assert.deepEqual(patternsInText(text), [
		{ kind: 'sender', pattern: 'get-users-list', ...rangeOf(text, 'get-users-list') },
		{ kind: 'handler', pattern: '{"cmd":"sum"}', ...rangeOf(text, "{ cmd: 'sum' }") },
	]);
});

test('ignores calls without a literal pattern', () => {
	assert.deepEqual(patternsInText('\t\tthis.kafkaClient.emit(topic, message);'), []);
	assert.deepEqual(patternsInText("\t@Post('list')"), []);
	assert.deepEqual(patternsInText("\t\tres.send({ id: user.id, name: 'x' });"), []);
});
