/**
 * This plugin handles the editor behavior for tables.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { EditorMiddleware, MinidocBase } from '../types';
import { Changeable } from '../undo-redo';
import { InlineTogglable } from '../inline-toggle';
import { OnSequenceable } from '../on-sequence';
import { last } from '../util';

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
    const tr = (direction < 0 ? trs[0] : last(trs))?.cloneNode(true) as HTMLTableRowElement;
    const target = table.querySelector(direction < 0 ? 'thead,tbody' : 'tbody,tfoot') || table;
    if (!tr) {
      return;
    }
    tr.querySelectorAll('td,th').forEach((cell) => cell.replaceChildren(h('br')));
    direction < 0 ? target.prepend(tr) : target.append(tr);

    selectCell(range, direction < 0 ? tr.lastElementChild : tr.firstElementChild);
  },
};

export const tableMixin: EditorMiddleware<TableEditor> = (next, editor) => {
  const result = editor as MinidocBase &
    TableEditor &
    Changeable &
    InlineTogglable &
    OnSequenceable;
  Dom.on(editor.root, 'keydown', (e) => {
    !e.defaultPrevented && handlers[e.code]?.(e, result);
  });
  return next(result);
};
