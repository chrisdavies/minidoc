/**
 * This plugin handles the editor behavior for tables.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { h, on } from '../dom';
import { EditorMiddleware, MinidocBase } from '../types';
import { Changeable } from '../undo-redo';
import { InlineTogglable } from '../inline-toggle';
import { OnSequenceable } from '../on-sequence';
import { compose, last } from '../util';
import { Scrubbable } from '../scrubbable';

export interface TableEditor {}

const selectCell = (range: Range, cell: Node | null) => {
  if (cell) {
    range.selectNodeContents(cell);
    Dom.isEmpty(cell) && range.collapse(true);
  }
};

const handlers: {
  [key: string]: (e: KeyboardEvent, ctx: MinidocBase & InlineTogglable) => void;
} = {
  Tab(e, ctx) {
    if (!ctx.isActive('TD') && !ctx.isActive('TH')) {
      return;
    }
    e.preventDefault();
    const range = Rng.currentRange();
    if (!range) {
      return;
    }
    // We don't currently support tabbing list selections
    const currentElement = Dom.toElement(Rng.toNode(range));
    const table = currentElement?.closest('table');
    const currentCell = currentElement?.closest('td,th');
    if (!table || !currentCell) {
      return;
    }
    const direction = e.shiftKey ? -1 : 1;
    const cells = Array.from(table.querySelectorAll('td,th'));
    const nextCell = cells[cells.indexOf(currentCell) + direction];
    if (nextCell) {
      selectCell(range, nextCell);
      return;
    }

    // We're tabbing out of the table, which is a prepend / append new row operation
    const trs = table.querySelectorAll('tr');
    const currentTr = direction < 0 ? trs[0] : last(trs);
    if (!currentTr) {
      return;
    }
    const tr = currentTr.cloneNode(true) as HTMLTableRowElement;
    const target = table.querySelector(direction < 0 ? 'thead,tbody' : 'tbody,tfoot') || table;
    // If the previous row was a header row, convert it to a normal row-- we only want one header
    currentTr.querySelectorAll('th').forEach((cell) => cell.replaceWith(h('td', cell.childNodes)));
    tr.querySelectorAll('td,th').forEach((cell) => cell.replaceChildren(h('br')));
    direction < 0 ? target.prepend(tr) : target.append(tr);

    selectCell(range, direction < 0 ? tr.lastElementChild : tr.firstElementChild);
  },
};

// function resize({
//   width,
//   cell,
//   resizer,
// }: {
//   width: number;
//   cell: HTMLElement;
//   resizer: HTMLElement;
// }) {
//   cell.style.width = `${width}px`;
//   resizer.style.left = `${offsetRight(cell)}px`;
//   resizer.classList.add('is-resizing');
// }

function makeResizer(container: HTMLElement) {
  const selector = '.mini-col-resizer';
  const colHeaderSelector = '.mini-table-edit-cell';
  const resizer = h(selector, {
    onmousedown(e: MouseEvent) {
      e.preventDefault();
      const originalX = e.x;
      const originalLeft = resizer.offsetLeft;
      const cell = container.querySelector('tr')?.children[
        Array.from(container.querySelectorAll(selector)).indexOf(resizer)
      ] as HTMLElement;
      const header = resizer.closest(colHeaderSelector) as HTMLElement;
      const offs = [
        on(document, 'mousemove', (e) => {
          const width = e.x - originalX + originalLeft;
          cell.style.width = `${width}px`;
          header.style.width = `${cell.offsetWidth}px`;

          if (!e.buttons) {
            off();
          }
        }),
        on(document, 'mouseup', off),
      ];

      function off() {
        resizer.classList.remove('is-resizing');
        offs.forEach((f) => f());
      }
    },
  });
  return resizer;
}

function makeTableEditWrapper(container: HTMLElement) {
  const cells = Array.from(
    container.querySelector('tr')?.querySelectorAll<HTMLTableColElement>('th,td') || [],
  );
  if (!cells.length) {
    return;
  }

  const createInserter = (className = '') => {
    const selector = '.mini-table-col-inserter';
    const button = h(`button${selector}${className}`, {
      type: 'button',
      onclick() {
        const width = 150;
        const index = Array.from(container.querySelectorAll(selector)).indexOf(button);
        container.querySelectorAll('tr').forEach((row, i) => {
          const firstCell = row.querySelector('th,td');
          const newCell = h(firstCell?.tagName || 'td', h('br'));
          if (i === 0) {
            newCell.style.width = `${width}px`;
          }
          row.insertBefore(newCell, row.children[index]);
        });
        const colHeader = createColHeader(width);
        header.insertBefore(colHeader, header.children[index]);
      },
      onmouseover() {
        header.style.setProperty('--wrapperHeight', `${container.offsetHeight}px`);
      },
    });
    return button;
  };

  const createColHeader = (width: number) =>
    h(
      '.mini-table-edit-cell',
      {
        style: `width: ${width}px;`,
      },
      h('button.mini-table-col-selector', {
        type: 'button',
      }),
      makeResizer(container),
      createInserter(),
    );

  const header = h(
    'header.mini-table-edit-header',
    cells.map((cell) => createColHeader(cell.offsetWidth)),
    createInserter(`.mini-table-col-appender`),
  );
  container.prepend(header);
}

class MiniTable extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const cells = this.querySelector('tr')?.querySelectorAll<HTMLTableColElement>('th,td');
    if (!cells) {
      return;
    }
    makeTableEditWrapper(this);
  }

  disconnectedCallback() {
    Array.from(this.querySelectorAll('.mini-col-resizer')).forEach((x) => x.remove());
  }
}
customElements.define('mini-table', MiniTable);

export const tableMixin: EditorMiddleware<TableEditor> = (next, editor) => {
  const result = editor as MinidocBase &
    TableEditor &
    Changeable &
    InlineTogglable &
    Scrubbable &
    OnSequenceable;
  Dom.on(editor.root, 'keydown', (e) => {
    !e.defaultPrevented && handlers[e.code]?.(e, result);
  });

  // When the editor loads any content, we need to mount all the tables.
  result.scrub = compose(result.scrub, (node) => {
    const parentNode = node as unknown as ParentNode;
    if (parentNode.querySelectorAll) {
      Array.from(parentNode.querySelectorAll('table')).forEach((n) => {
        if (!n.parentElement?.matches('mini-table')) {
          const wrapper = new MiniTable();
          n.replaceWith(wrapper);
          wrapper.append(n);
        }
      });
    }
    return node;
  });

  return next(result);
};
