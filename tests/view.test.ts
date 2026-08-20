import { describe, expect, it } from 'vitest';
import { createView, mountApp, mountView } from '../src/view';

describe('createView', () => {
  it('returns the built node and an open lifetime', () => {
    const view = createView(() => document.createElement('section'));

    expect(view.node).toBeInstanceOf(HTMLElement);
    expect(view.lifetime.closed).toBe(false);
  });

  it('removes the node from the DOM when the lifetime ends', () => {
    const view = createView(() => document.createElement('div'));
    document.body.append(view.node);

    view.lifetime.unsubscribe();
    expect(view.node.isConnected).toBe(false);
  });

  it('runs builder teardowns before removing the node', () => {
    let connectedDuringTeardown: boolean | null = null;

    const view = createView(lifetime => {
      const node = document.createElement('div');
      lifetime.add(() => {
        connectedDuringTeardown = node.isConnected;
      });
      return node;
    });

    document.body.append(view.node);
    view.lifetime.unsubscribe();

    expect(connectedDuringTeardown).toBe(true);
    expect(view.node.isConnected).toBe(false);
  });

  it('tears down partial work and rethrows when the builder throws', () => {
    let cleaned = false;

    expect(() =>
      createView(lifetime => {
        lifetime.add(() => {
          cleaned = true;
        });
        throw new Error('build failed');
      }),
    ).toThrowError('build failed');

    expect(cleaned).toBe(true);
  });
});

describe('mountView', () => {
  it('appends the view and keeps existing host content', () => {
    const host = document.createElement('div');
    host.append(document.createElement('p'));

    const view = createView(() => document.createElement('section'));
    const lifetime = mountView(host, view);

    expect(host.children).toHaveLength(2);
    expect(host.lastElementChild).toBe(view.node);
    expect(lifetime).toBe(view.lifetime);
  });
});

describe('mountApp', () => {
  it('replaces the host contents with the app view', () => {
    const host = document.createElement('div');
    host.append(document.createElement('p'));

    const view = createView(() => document.createElement('main'));
    const lifetime = mountApp(host, view);

    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild).toBe(view.node);

    lifetime.unsubscribe();
    expect(host.children).toHaveLength(0);
  });
});
