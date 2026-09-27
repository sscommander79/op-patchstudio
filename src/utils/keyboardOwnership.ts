const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const MODAL_SELECTOR = 'dialog[open], [role="dialog"][aria-modal="true"]';

function targetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  return document.activeElement instanceof Element ? document.activeElement : null;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  return Boolean(targetElement(target)?.closest(EDITABLE_SELECTOR));
}

export function hasBlockingModal(owner?: Element | null): boolean {
  const openModals = Array.from(document.querySelectorAll(MODAL_SELECTOR));
  if (!owner) return openModals.length > 0;
  return openModals.some(modal => modal !== owner);
}

interface KeyboardOwnershipOptions {
  allowModifiers?: boolean;
  modalOwner?: Element | null;
}

export function shouldIgnoreKeyboardKeyDown(
  event: KeyboardEvent,
  { allowModifiers = false, modalOwner }: KeyboardOwnershipOptions = {},
): boolean {
  if (event.repeat || event.isComposing || isEditableKeyboardTarget(event.target)) return true;
  if (!allowModifiers && (event.ctrlKey || event.metaKey || event.altKey)) return true;
  return hasBlockingModal(modalOwner);
}
