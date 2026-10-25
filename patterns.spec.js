const assert = require('node:assert/strict');
const { test } = require('node:test');

const { patternsInLine } = require('./patterns');

const rangeOf = (line, pattern) => ({ start: line.indexOf(pattern), end: line.indexOf(pattern) + pattern.length });

test('finds send and emit calls as senders', () => {
	const send = "\t\treturn lastValueFrom(this.client.send('get-users-list', payload));";
	const emit = '\t\tthis.client.emit("order.created", payload);';

	assert.deepEqual(patternsInLine(send), [
		{ kind: 'sender', pattern: 'get-users-list', ...rangeOf(send, 'get-users-list') },
	]);
	assert.deepEqual(patternsInLine(emit), [
		{ kind: 'sender', pattern: 'order.created', ...rangeOf(emit, 'order.created') },
	]);
});

test('finds MessagePattern and EventPattern decorators as handlers', () => {
	const message = "\t@MessagePattern('get-users-list')";
	const event = "\t@EventPattern('order.created')";

	assert.deepEqual(patternsInLine(message), [
		{ kind: 'handler', pattern: 'get-users-list', ...rangeOf(message, 'get-users-list') },
	]);
	assert.deepEqual(patternsInLine(event), [
		{ kind: 'handler', pattern: 'order.created', ...rangeOf(event, 'order.created') },
	]);
});

test('ignores lines without a literal pattern', () => {
	assert.deepEqual(patternsInLine('\t\tthis.kafkaClient.emit(topic, message);'), []);
	assert.deepEqual(patternsInLine("\t@Post('list')"), []);
});
