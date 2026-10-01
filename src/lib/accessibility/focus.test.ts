// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { keyboardTargets, preserveDialogFocus, trapDialogTab } from "./focus";
afterEach(() => { document.body.replaceChildren(); });

describe("existing dialog focus helpers", () => {
  it("excludes hidden fields, disabled fieldsets, inert regions and visually hidden ancestors", () => {
    const root = document.createElement("div");
    root.innerHTML = '<input type="hidden"><fieldset disabled><button>Disabled</button></fieldset><div inert><button>Inert</button></div><div style="display:none"><a href="/">Hidden</a></div><button>Enabled</button>';
    document.body.append(root);
    expect(keyboardTargets(root).map((element) => element.textContent)).toEqual(["Enabled"]);
  });

  it("recovers focus from outside and cycles both directions without activating an action", () => {
    const dialog = document.createElement("div");
    dialog.tabIndex = -1;
    dialog.innerHTML = '<button>Cancel</button><button>Confirm</button>';
    const outside = document.createElement("button");
    document.body.append(outside, dialog);
    outside.focus();
    preserveDialogFocus(dialog);
    expect(document.activeElement?.textContent).toBe("Cancel");
    const backwards = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true });
    trapDialogTab(backwards, dialog);
    expect(backwards.defaultPrevented).toBe(true);
    expect(document.activeElement?.textContent).toBe("Confirm");
    const forwards = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapDialogTab(forwards, dialog);
    expect(document.activeElement?.textContent).toBe("Cancel");
    for (const button of dialog.querySelectorAll("button")) button.disabled = true;
    preserveDialogFocus(dialog);
    trapDialogTab(backwards, dialog);
    expect(document.activeElement).toBe(dialog);
  });
});
