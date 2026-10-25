// @vitest-environment node
import { expect, test } from 'vitest';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

test('single production entry builds tokens and emit all three CSP-safe font files', async () => {
  const result = await build({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (bundle) => ('output' in bundle ? bundle.output : []),
  );
  expect(
    outputs.filter((output) => output.fileName.endsWith('.css')),
  ).toHaveLength(1);
  expect(
    outputs.filter((output) => output.fileName.endsWith('.js')),
  ).toHaveLength(1);
  const fonts = outputs.filter((output) => output.fileName.endsWith('.woff2'));
  expect(fonts).toHaveLength(3);
  for (const name of [
    'LeonSans-var',
    'JetBrainsMono-Regular',
    'JetBrainsMono-Medium',
  ])
    expect(
      fonts.some((font) => font.fileName.startsWith(`assets/${name}-`)),
    ).toBe(true);
  const css = outputs
    .filter(
      (output) => output.type === 'asset' && output.fileName.endsWith('.css'),
    )
    .map((output) => (output.type === 'asset' ? String(output.source) : ''))
    .join('\n');
  expect(css).not.toMatch(/data:.*(?:font|woff)/);
  expect(css).toContain('@font-face');
  for (const font of fonts) expect(css).toContain(`/${font.fileName}`);
}, 20_000);
