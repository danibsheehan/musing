const PORTAL_ID = "editor-bubble-menu-portal";

/**
 * TipTap's bubble menu skips `hide()` on blur when `relatedTarget` is inside
 * `element.parentNode`. With `appendTo: document.body`, that parent is `body`,
 * so every in-page focus target matches and the menu never dismisses. A tiny
 * dedicated portal keeps `contains()` meaningful.
 */
export function getEditorBubbleMenuPortal(): HTMLElement {
  let el = document.getElementById(PORTAL_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = PORTAL_ID;
  el.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:0",
    "height:0",
    "overflow:visible",
    "pointer-events:none",
    "z-index:1001",
  ].join(";");
  document.body.appendChild(el);
  return el;
}
