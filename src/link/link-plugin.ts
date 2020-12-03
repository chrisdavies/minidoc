import { hasToolbar } from '../toolbar';
import { LinkMenu } from './link-menu';

export const linkPlugin: MinidocPlugin = {
  name: 'link',
  onKeydown(e, ctx) {
    if ((e.metaKey || e.ctrlKey) && hasToolbar(ctx) && e.code === 'KeyK') {
      e.preventDefault();
      ctx.toolbar.setMenu(LinkMenu(ctx));
    }
  },
};
