// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createClientIpResolver, resolverFromEnv } = require('../client-ip');

function req(peer, headers = {}) {
  return { socket: { remoteAddress: peer }, headers };
}

const CF_EDGE_V4 = '172.68.10.20'; // inside 172.64.0.0/13
const CF_EDGE_V6 = '2a06:98c1:3120::5'; // inside 2a06:98c0::/29
const VISITOR = '203.0.113.7';

describe('client IP', () => {
  const clientIp = createClientIpResolver();

  it('uses the socket address of a direct client and ignores its headers', () => {
    const ip = clientIp(req('198.51.100.9', { 'x-real-ip': '1.1.1.1', 'cf-connecting-ip': '2.2.2.2' }));
    assert.equal(ip, '198.51.100.9');
  });

  it('takes the visitor from CF-Connecting-IP when nginx saw a Cloudflare edge', () => {
    const ip = clientIp(req('127.0.0.1', { 'x-real-ip': CF_EDGE_V4, 'cf-connecting-ip': VISITOR }));
    assert.equal(ip, VISITOR);
  });

  it('does the same for an IPv6 edge and an IPv6 visitor', () => {
    const ip = clientIp(req('::1', { 'x-real-ip': CF_EDGE_V6, 'cf-connecting-ip': '2001:db8::42' }));
    assert.equal(ip, '2001:db8::42');
  });

  it('ignores CF-Connecting-IP from a client that bypassed Cloudflare', () => {
    // Straight to the origin through nginx: X-Real-IP is the client itself, and
    // the header is its own invention.
    const ip = clientIp(req('127.0.0.1', { 'x-real-ip': '198.51.100.9', 'cf-connecting-ip': VISITOR }));
    assert.equal(ip, '198.51.100.9');
  });

  it('falls back to the edge address when Cloudflare sent no usable visitor', () => {
    assert.equal(clientIp(req('127.0.0.1', { 'x-real-ip': CF_EDGE_V4 })), CF_EDGE_V4);
    assert.equal(clientIp(req('127.0.0.1', { 'x-real-ip': CF_EDGE_V4, 'cf-connecting-ip': 'not-an-ip' })), CF_EDGE_V4);
  });

  it('reads the last X-Forwarded-For hop when there is no X-Real-IP', () => {
    assert.equal(clientIp(req('127.0.0.1', { 'x-forwarded-for': '10.0.0.1, 198.51.100.4' })), '198.51.100.4');
    assert.equal(
      clientIp(req('127.0.0.1', { 'x-forwarded-for': `10.0.0.1, ${CF_EDGE_V4}`, 'cf-connecting-ip': VISITOR })),
      VISITOR,
    );
  });

  it('treats the IPv6-mapped loopback as the proxy', () => {
    assert.equal(clientIp(req('::ffff:127.0.0.1', { 'x-real-ip': CF_EDGE_V4, 'cf-connecting-ip': VISITOR })), VISITOR);
  });

  it('uses the peer when a trusted proxy sent no forwarding header at all', () => {
    assert.equal(clientIp(req('127.0.0.1', {})), '127.0.0.1');
  });

  it('takes its lists from the environment and skips malformed ranges', () => {
    const custom = resolverFromEnv({ TRUSTED_PROXY_IPS: '10.9.9.9', CLOUDFLARE_IPS: 'garbage, 192.0.2.0/24' });
    assert.equal(custom(req('10.9.9.9', { 'x-real-ip': '192.0.2.50', 'cf-connecting-ip': VISITOR })), VISITOR);
    assert.equal(custom(req('127.0.0.1', { 'x-real-ip': '192.0.2.50' })), '127.0.0.1', 'loopback is no longer trusted');
    // An edge address of the default list is not special under the custom one.
    assert.equal(custom(req('10.9.9.9', { 'x-real-ip': CF_EDGE_V4, 'cf-connecting-ip': VISITOR })), CF_EDGE_V4);
  });
});
