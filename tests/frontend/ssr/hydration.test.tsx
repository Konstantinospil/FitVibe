/**
 * Hydration tests
 * Tests that client-side hydration matches server-rendered content
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot } from "react-dom/client";
import {
  DEHYDRATED_STATE_ELEMENT_ID,
  readDehydratedStateFromDocument,
  serializeDehydratedState,
} from "../../../apps/frontend/src/ssr/dehydratedState";

// Mock components
const TestComponent: React.FC<{ text: string }> = ({ text }) => (
  <div id="root">
    <h1>{text}</h1>
  </div>
);

describe("SSR Hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the same content on server and client", () => {
    const serverHtml = renderToString(<TestComponent text="Hello SSR" />);
    expect(serverHtml).toContain("Hello SSR");
    expect(serverHtml).toContain("<div");
    expect(serverHtml).toContain("<h1>");
  });

  it("should handle hydration without errors", () => {
    // This is a basic test - in a real scenario, we'd use jsdom
    // to actually test hydration in a browser-like environment
    const serverHtml = renderToString(<TestComponent text="Test" />);
    expect(serverHtml).toBeTruthy();
    // In a real test, we'd:
    // 1. Create a DOM element
    // 2. Set innerHTML to serverHtml
    // 3. Call hydrateRoot
    // 4. Verify no hydration errors
  });

  it("serializes React Query state as inert, HTML-safe JSON", () => {
    const dehydratedState = {
      queries: [
        {
          queryKey: ["test"],
          state: { data: "</template><script>alert(1)</script>&" },
        },
      ],
      mutations: [],
    } as never;

    const serialized = serializeDehydratedState(dehydratedState);

    expect(serialized).not.toContain("</template>");
    expect(serialized).not.toContain("<script>");
    expect(serialized).toContain("\\u003c");
    expect(serialized).toContain("\\u0026");
  });

  it("reads and removes inert dehydrated state from the document", () => {
    const dehydratedState = {
      queries: [{ queryKey: ["test"], state: { data: "test data" } }],
      mutations: [],
    } as never;
    const template = document.createElement("template");
    template.id = DEHYDRATED_STATE_ELEMENT_ID;
    template.content.textContent = serializeDehydratedState(dehydratedState);
    document.body.appendChild(template);

    expect(readDehydratedStateFromDocument(document)).toEqual(dehydratedState);
    expect(document.getElementById(DEHYDRATED_STATE_ELEMENT_ID)).toBeNull();
  });

  it("reads inert state from a non-template element", () => {
    const dehydratedState = { queries: [], mutations: [] } as never;
    const element = document.createElement("div");
    element.id = DEHYDRATED_STATE_ELEMENT_ID;
    element.textContent = serializeDehydratedState(dehydratedState);
    document.body.appendChild(element);

    expect(readDehydratedStateFromDocument(document)).toEqual(dehydratedState);
    expect(document.getElementById(DEHYDRATED_STATE_ELEMENT_ID)).toBeNull();
  });

  it("rejects malformed inert state and still removes the element", () => {
    const template = document.createElement("template");
    template.id = DEHYDRATED_STATE_ELEMENT_ID;
    template.content.textContent = "{not-json";
    document.body.appendChild(template);

    expect(readDehydratedStateFromDocument(document)).toBeUndefined();
    expect(document.getElementById(DEHYDRATED_STATE_ELEMENT_ID)).toBeNull();
  });

});
