import * as Dom from './dom';

export function minidoc(el: HTMLDivElement) {
  el.contentEditable = 'true';
  el.classList.add('minidoc');

  Dom.on(el, 'keydown', (e) => {
    if (e.key === 'Enter') {
      console.log('enter');
    }
  });
}
