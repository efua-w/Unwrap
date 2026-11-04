// A modal <dialog> makes everything outside it inert. Content that must stay usable (the toast and
// its action) waits for the last modal to close. Whoever closes one fires this event.
export const MODAL_CLOSED_EVENT = "unwrap:modal-closed";

export function announceModalClosed(): void {
  window.dispatchEvent(new Event(MODAL_CLOSED_EVENT));
}

export function isModalOpen(): boolean {
  // WHY: Safari before 15.6 throws on the unknown `:modal` selector, which would break every toast.
  // Sheet only opens dialogs with showModal(), so `dialog[open]` is equivalent where `:modal` fails.
  try {
    return document.querySelector("dialog:modal") !== null;
  } catch {
    return document.querySelector("dialog[open]") !== null;
  }
}
