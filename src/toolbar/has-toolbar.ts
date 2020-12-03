export function hasToolbar(editor: MinidocCoreEditor): editor is MinidocToolbarEditor {
  return !!editor.toolbar;
}
