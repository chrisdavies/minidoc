import { MinidocToolbarAction } from '../toolbar';
import { HighlightMenu } from './highlight-menu';

const icoHighlighter = `
<svg viewBox="0 0 20 20" fill="currentColor">
  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
</svg>
`;

export const highlightToolbarAction: MinidocToolbarAction = {
  id: 'highlight',
  label: 'Highlight',
  html: icoHighlighter,
  run: (t) => t.toolbar.setMenu(HighlightMenu(t)),
  isActive: (t) => t.isActive('mini-color'),
};
