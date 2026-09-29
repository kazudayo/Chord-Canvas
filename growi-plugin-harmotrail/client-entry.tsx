import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import appStyles from "../src/styles.css?inline";
import { rehypeHarmoTrail } from "./src/rehype-harmotrail";

declare const growiFacade: {
  markdownRenderer?: {
    optionsGenerators: Record<
      string,
      ((...args: unknown[]) => any) | undefined
    >;
  };
} | null;

const PLUGIN_NAME = "growi-plugin-harmotrail";
const ELEMENT_NAME = "harmotrail-app";
const moduleUrl = import.meta.url;
const pianoBaseUrl = import.meta.env.DEV
  ? new URL("assets/audio/piano/", document.baseURI).href
  : new URL("audio/piano/", moduleUrl).href;

(
  globalThis as typeof globalThis & {
    __HARMOTRAIL_PIANO_BASE_URL__?: string;
  }
).__HARMOTRAIL_PIANO_BASE_URL__ = pianoBaseUrl;

const embeddedStyles = `${appStyles
  .replace(/:root\s*\{/g, ":host {")
  .replace(/body\s*\{/g, ":host {")}

:host {
  display: block;
  width: 100%;
  min-width: 0;
  margin: 1.5rem 0;
  overflow: clip;
  border: 1px solid var(--line, #e6e9e1);
  border-radius: 12px;
  background: #f6f7f3;
  color: #303b34;
  text-align: initial;
  white-space: normal;
}

.harmotrail-plugin-root {
  min-width: 0;
  min-height: 680px;
  background: #f6f7f3;
}
`;

class HarmoTrailElement extends HTMLElement {
  private reactRoot: Root | null = null;
  private mountPoint: HTMLDivElement | null = null;

  connectedCallback(): void {
    if (this.reactRoot != null) return;

    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    if (this.mountPoint == null) {
      const style = document.createElement("style");
      style.textContent = embeddedStyles;
      this.mountPoint = document.createElement("div");
      this.mountPoint.className = "harmotrail-plugin-root";
      shadow.append(style, this.mountPoint);
    }

    this.reactRoot = createRoot(this.mountPoint);
    this.reactRoot.render(<App />);
  }

  disconnectedCallback(): void {
    queueMicrotask(() => {
      if (this.isConnected || this.reactRoot == null) return;
      this.reactRoot.unmount();
      this.reactRoot = null;
    });
  }

  dispose(): void {
    this.reactRoot?.unmount();
    this.reactRoot = null;
  }
}

if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, HarmoTrailElement);
}

type Generator = (...args: unknown[]) => any;
let optionsGenerators: Record<string, Generator | undefined> | null = null;
let originalView: Generator | undefined;
let originalPreview: Generator | undefined;
let patchedView: Generator | undefined;
let patchedPreview: Generator | undefined;
let previewCustomKey:
  "customGeneratePreviewOptions" | "customGeneratePreViewOptions" =
  "customGeneratePreviewOptions";

function withHarmoTrail(
  original: Generator | undefined,
  fallback: Generator,
): Generator {
  return (...args: unknown[]) => {
    const options = (original ?? fallback)(...args);
    options.rehypePlugins ??= [];
    if (!options.rehypePlugins.includes(rehypeHarmoTrail)) {
      options.rehypePlugins.push(rehypeHarmoTrail);
    }
    return options;
  };
}

const activate = (): void => {
  if (
    typeof growiFacade === "undefined" ||
    growiFacade?.markdownRenderer == null
  ) {
    return;
  }

  optionsGenerators = growiFacade.markdownRenderer.optionsGenerators;
  const generateView = optionsGenerators.generateViewOptions;
  const usesModernPreview = optionsGenerators.generatePreviewOptions != null;
  const generatePreview = usesModernPreview
    ? optionsGenerators.generatePreviewOptions
    : optionsGenerators.generatePreViewOptions;
  if (generateView == null) return;

  originalView = optionsGenerators.customGenerateViewOptions;
  patchedView = withHarmoTrail(originalView, generateView);
  optionsGenerators.customGenerateViewOptions = patchedView;

  if (generatePreview != null) {
    previewCustomKey = usesModernPreview
      ? "customGeneratePreviewOptions"
      : "customGeneratePreViewOptions";
    originalPreview = optionsGenerators[previewCustomKey];
    patchedPreview = withHarmoTrail(originalPreview, generatePreview);
    optionsGenerators[previewCustomKey] = patchedPreview;
  }
};

const deactivate = (): void => {
  if (optionsGenerators != null) {
    if (optionsGenerators.customGenerateViewOptions === patchedView) {
      optionsGenerators.customGenerateViewOptions = originalView;
    }
    if (optionsGenerators[previewCustomKey] === patchedPreview) {
      optionsGenerators[previewCustomKey] = originalPreview;
    }
  }

  document.querySelectorAll(ELEMENT_NAME).forEach((element) => {
    if (element instanceof HarmoTrailElement) element.dispose();
  });
};

const pluginWindow = window as typeof window & {
  pluginActivators?: Record<
    string,
    { activate: () => void; deactivate: () => void }
  >;
};
pluginWindow.pluginActivators ??= {};
pluginWindow.pluginActivators[PLUGIN_NAME] = { activate, deactivate };

export {};
