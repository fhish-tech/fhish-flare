const fakeSelf = {
  addEventListener: () => {},
  removeEventListener: () => {},
  postMessage: () => {},
  dispatchEvent: () => true,
};
(globalThis).self = fakeSelf;
