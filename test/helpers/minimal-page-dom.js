'use strict';

/** Minimal DOM for translate-document unit tests (single visible paragraph). */
function createMinimalPageDocument({ bodyText = 'Hello world', lang = 'en' } = {}) {
  const injectedStyles = [];
  const textNodes = [];

  const textNode = {
    nodeType: 3,
    textContent: bodyText,
    parentElement: null,
    parentNode: null,
    getRootNode: () => document,
  };

  const paragraph = {
    tagName: 'P',
    textContent: bodyText,
    childNodes: [textNode],
    firstChild: textNode,
    parentNode: null,
    closest: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 10, bottom: 30, left: 10, right: 200 }),
    replaceChild(newChild, oldChild) {
      const idx = this.childNodes.indexOf(oldChild);
      if (idx >= 0) this.childNodes[idx] = newChild;
      newChild.parentNode = this;
      if (typeof newChild.textContent === 'string') this.textContent = newChild.textContent;
    },
  };
  textNode.parentElement = paragraph;
  textNode.parentNode = paragraph;
  textNodes.push(textNode);

  const body = {
    innerText: bodyText,
    childNodes: [paragraph],
    appendChild() {},
    querySelectorAll: (sel) => {
      if (String(sel).includes('span[data-')) return [];
      if (String(sel).includes('script')) return [];
      if (String(sel).includes('style')) return [];
      return [];
    },
  };
  paragraph.parentNode = body;

  const head = {
    appendChild(el) {
      if (el?.id) injectedStyles.push(el);
    },
  };

  const document = {
    documentElement: {
      lang,
      getAttribute: (n) => (n === 'lang' ? lang : null),
    },
    head,
    body,
    title: 'Test page',
    location: undefined,
    getElementById: (id) => injectedStyles.find((s) => s.id === id) || null,
    createElement(tag) {
      if (tag === 'style') {
        const el = { _id: '', textContent: '' };
        Object.defineProperty(el, 'id', {
          get() { return el._id; },
          set(v) { el._id = v; },
        });
        return el;
      }
      if (tag === 'span') {
        return {
          className: '',
          classList: { add() {}, remove() {} },
          dataset: {},
          textContent: '',
          firstChild: null,
          parentNode: null,
          getBoundingClientRect: () => ({ top: 10, bottom: 30, left: 10, right: 200 }),
        };
      }
      return { textContent: '', dataset: {}, parentNode: null };
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: text, parentElement: null };
    },
    createTreeWalker() {
      let i = 0;
      const walker = {
        currentNode: null,
        nextNode() {
          if (i >= textNodes.length) return null;
          walker.currentNode = textNodes[i++];
          return walker.currentNode;
        },
      };
      return walker;
    },
    querySelectorAll: () => [],
  };

  return { document, injectedStyles, textNodes };
}

module.exports = { createMinimalPageDocument };
