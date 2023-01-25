import { MinidocToolbarAction } from '../toolbar';
import { HighlightMenu, TextColorMenu, initTextColors } from './highlight-menu';

const icoPaintBucket = `<svg viewBox="0 0 48 48">
<path d="M16.5,2.6A1.8,1.8,0,0,0,15.1,2a2,2,0,0,0-1.4.6,1.9,1.9,0,0,0,0,2.8L19.4,11,6.2,24.1a3.9,3.9,0,0,0,0,5.6L19.4,42.8A3.8,3.8,0,0,0,22.2,44,3.9,3.9,0,0,0,25,42.8L41,26.9ZM9.1,26.9l13.1-13,13,13Z"/>
<path d="M41,32s-4,5.8-4,8a4,4,0,0,0,8,0C45,37.8,41,32,41,32Z"/>
</svg>
`;

const icoTextColor = `
  <span>
    <span>A</span>
    <span style="border-top: 3px solid; border-radius: 20px; display:block; width: 1rem;"></span>
  </span>
`;

export const highlightToolbarAction: MinidocToolbarAction = {
  id: 'highlight',
  label: 'Highlight',
  html: icoPaintBucket,
  run: (t) => t.toolbar.setMenu(HighlightMenu(t)),
  isActive: (t) => t.isActive('mark'),
};

export const colorToolbarAction: MinidocToolbarAction = {
  id: 'textcolor',
  label: 'Text Color',
  html: icoTextColor,
  run: (t) => t.toolbar.setMenu(TextColorMenu(t)),
  isActive: (t) => t.isActive('text-color'),
  init: initTextColors,
};
