/**
 * editorExport — dev-only browser I/O for the level editor (T082, FR-024).
 *
 * The interactive counterpart to the levels-as-code pipeline emits the SAME
 * artifact scripts/levels/authoring.ts writes: `JSON.stringify(level, null, 2)`
 * + trailing newline. Export does both a file download (a[download]) and a
 * clipboard copy; import pops a textarea overlay whose text the caller parses
 * with editorState.draftFromJson.
 *
 * All DOM lives here (kept out of the pure editorState module) and only runs in
 * the browser dev build — EditorScene is attached under import.meta.env.DEV.
 */

/** Canonical serialization — byte-compatible with the authoring script's output. */
export function serializeLevel(json: Record<string, unknown>): string {
  return JSON.stringify(json, null, 2) + '\n';
}

/** Trigger a browser download of `<id>.json`. */
export function downloadLevelJson(id: string, json: Record<string, unknown>): void {
  const blob = new Blob([serializeLevel(json)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Copy text to the clipboard; resolves false when the API is unavailable/denied. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Export = download + clipboard copy in one call. Returns clipboard success. */
export async function exportLevelJson(id: string, json: Record<string, unknown>): Promise<boolean> {
  downloadLevelJson(id, json);
  return copyToClipboard(serializeLevel(json));
}

/**
 * Show a modal textarea overlay and resolve with the pasted text, or null if the
 * author cancels. The caller validates via editorState.draftFromJson.
 */
export function showImportOverlay(): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } satisfies Partial<CSSStyleDeclaration>);

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: 'min(560px, 92vw)',
      padding: '14px',
      background: '#14161b',
      color: '#e8ecf1',
      font: '12px monospace',
      borderRadius: '8px',
    } satisfies Partial<CSSStyleDeclaration>);

    const title = document.createElement('div');
    title.textContent = 'Import level JSON — paste and press Import';
    title.style.marginBottom = '8px';

    const textarea = document.createElement('textarea');
    Object.assign(textarea.style, {
      width: '100%',
      height: '320px',
      background: '#0c0e12',
      color: '#e8ecf1',
      font: '11px monospace',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px',
      boxSizing: 'border-box',
    } satisfies Partial<CSSStyleDeclaration>);

    const finish = (value: string | null): void => {
      backdrop.remove();
      resolve(value);
    };

    const buttonRow = document.createElement('div');
    Object.assign(buttonRow.style, { marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' });
    buttonRow.appendChild(makeButton('Cancel', () => finish(null)));
    buttonRow.appendChild(makeButton('Import', () => finish(textarea.value)));

    panel.append(title, textarea, buttonRow);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    textarea.focus();
  });
}

function makeButton(text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = text;
  Object.assign(button.style, {
    cursor: 'pointer',
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.12)',
    color: '#e8ecf1',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '4px',
    font: '12px monospace',
  });
  button.addEventListener('click', onClick);
  return button;
}
