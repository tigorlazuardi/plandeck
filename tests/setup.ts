import { Window } from "happy-dom";

// Install happy-dom globals so @testing-library/react can find document/window
const happyWindow = new Window({ url: "http://localhost/" });

/* biome-ignore lint/suspicious/noExplicitAny: global augmentation for test env */
const g = globalThis as any;

g.window = happyWindow;
g.document = happyWindow.document;
g.navigator = happyWindow.navigator;
g.HTMLElement = happyWindow.HTMLElement;
g.Element = happyWindow.Element;
g.Node = happyWindow.Node;
g.Text = happyWindow.Text;
g.Event = happyWindow.Event;
g.CustomEvent = happyWindow.CustomEvent;
g.MutationObserver = happyWindow.MutationObserver;
g.ResizeObserver = happyWindow.ResizeObserver;
g.IntersectionObserver = happyWindow.IntersectionObserver;
g.getComputedStyle = happyWindow.getComputedStyle.bind(happyWindow);
g.requestAnimationFrame = (cb: FrameRequestCallback) =>
  happyWindow.setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = happyWindow.clearTimeout.bind(happyWindow);
g.CSS = { supports: () => false };
