import { minidoc } from '../index';

// const doc = `<h1>This is editable</h1>
// <p>No, <em>really</em>. <a href="foo.com">Give it a shot</a>.</p><mini-card type="counter" state="0"></mini-card><p>Still <strong>LOTS</strong> todo...</p>
// <ol><li>Numero one</li><li>Deux</li><li>Tres</li><li>Quatro</li></ol>
// <p>Some text here in a paragraph.</p>
// <ul><li>Dots are cewl<ul><li>And can be nested!!!</li><li>That's trickies</li></ul></li><li>We'll see how it goes</li></ul>
// <mini-card type="media" state="{&quot;caption&quot;:&quot;A rainy day&quot;,&quot;name&quot;:&quot;rained-on.png&quot;,&quot;src&quot;:&quot;https://trix-editor.org/images/attachments/rained-on.png&quot;,&quot;type&quot;:&quot;image/png&quot;}"></mini-card>
// <mini-card type="media" state="{&quot;name&quot;:&quot;rained-on.pdf&quot;,&quot;src&quot;:&quot;https://example/areport.png&quot;,&quot;type&quot;:&quot;application/pdf&quot;}"></mini-card>
// <mini-card type="media" state="{&quot;name&quot;:&quot;rained-on.mp4&quot;,&quot;poster&quot;:&quot;https://trix-editor.org/images/attachments/rained-on.png&quot;,&quot;src&quot;:&quot;https://file-examples-com.github.io/uploads/2017/04/file_example_MP4_480_1_5MG.mp4&quot;,&quot;type&quot;:&quot;video/mp4&quot;}"></mini-card>
// <p>This is using i and b instead of em and strong. <b>Does</b> it <i>work</i>?. Chrome: yes.</p>`.replace(
//   /\n/g,
//   '',
// );

// const editor = minidoc(doc);
// document.querySelector('main')?.append(editor.container);
// (window as any).editor = editor;

(window as any).integrationTests = {
  minidoc,
};
