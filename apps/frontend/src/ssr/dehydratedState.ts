import type { DehydratedState } from "@tanstack/react-query";

export const DEHYDRATED_STATE_ELEMENT_ID = "fitvibe-react-query-state";

export function serializeDehydratedState(state: DehydratedState): string {
  return JSON.stringify(state)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function readDehydratedStateFromDocument(
  doc: Pick<Document, "getElementById">,
): DehydratedState | undefined {
  const element = doc.getElementById(DEHYDRATED_STATE_ELEMENT_ID);
  if (!element) {
    return undefined;
  }

  const raw =
    element.tagName === "TEMPLATE"
      ? (element as HTMLTemplateElement).content.textContent
      : element.textContent;

  element.remove();

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as DehydratedState;
  } catch {
    return undefined;
  }
}
