/**
 * Universal safe clipboard helper with automatic fallback for older browsers,
 * legacy WebViews, HTTP contexts, and restricted iframe environments.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }
  if (!text) return false;

  // 1. Attempt modern Async Clipboard API if available and permitted
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permissions, document unfocused, or insecure origin - fallback to execCommand below
    }
  }

  // 2. Fallback using document.execCommand('copy')
  try {
    if (typeof document !== 'undefined' && document.body) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '-9999px';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch {
    return false;
  }

  return false;
}
