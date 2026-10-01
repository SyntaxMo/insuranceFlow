/** Enabled keyboard targets, excluding hidden, inert, and disabled controls. */
export function keyboardTargets(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]',
  )).filter((element) => {
    if (element.tabIndex < 0 || element.matches(":disabled") ||
      element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = window.getComputedStyle(ancestor);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (ancestor === root) break;
    }
    return true;
  });
}

export function preserveDialogFocus(dialog: HTMLElement | null) {
  if (!dialog) return;
  const targets = keyboardTargets(dialog);
  if (!targets.includes(document.activeElement as HTMLElement)) {
    (targets[0] ?? dialog).focus();
  }
}

/** Keep the existing dialog's Tab boundary, including its empty/pending state. */
export function trapDialogTab(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
  dialog: HTMLElement | null,
) {
  if (event.key !== "Tab" || !dialog) return;
  const targets = keyboardTargets(dialog);
  const first = targets[0];
  const last = targets.at(-1);
  const active = document.activeElement as HTMLElement;
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
  } else if (!targets.includes(active) || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
