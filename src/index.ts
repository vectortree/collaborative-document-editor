// ... add imports and fill in the code
import * as Y from 'yjs';
// import { Base64 } from 'js-base64';
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import Delta from 'quill-delta';

class CRDTFormat {
  public bold?: Boolean = false;
  public italic?: Boolean = false;
  public underline?: Boolean = false;
};

exports.CRDT = class {
  public ydoc: Y.Doc;
  public cb: (update: string, isLocal: Boolean) => void;
  public isLocal: Boolean;

  constructor(cb: (update: string, isLocal: Boolean) => void) {
    this.ydoc = new Y.Doc();
    this.cb = cb;
    this.isLocal = false;
    this.ydoc.on('updateV2', (update) => {
      if(this.isLocal) {
        this.cb(JSON.stringify(Array.from(update)), true);
      }
    });
    ['update', 'insert', 'insertImage', 'delete', 'toHTML'].forEach(f => (this as any)[f] = (this as any)[f].bind(this));
  }

  update(update: string) {
    ////console.log("Update string: " + update);
    this.isLocal = false;
    Y.applyUpdateV2(this.ydoc, Uint8Array.from(JSON.parse(update)));
    this.cb(JSON.stringify(update), false);
  }

  insert(index: number, content: string, format: CRDTFormat) {
    this.isLocal = true;
    this.ydoc.getText().insert(index, content, format);
  }

  insertImage(index: number, url: string) {
    this.isLocal = true;
    let delta = new Delta(this.ydoc.getText().toDelta());
    ////console.log(delta);
    let first = delta.slice(0, index).insert({ image: url });
    ////console.log(first);
    let second = delta.slice(index);
    ////console.log(second);
    let result = first.concat(second);
    //console.log(result);
    this.ydoc.getText().delete(0, this.ydoc.getText().length);
    this.ydoc.getText().applyDelta(result.ops);
    ////console.log(this.ydoc.getText().toDelta());
  }

  delete(index: number, length: number) {
    this.isLocal = true;
    this.ydoc.getText().delete(index, length);
  }

  toHTML() {
    /*let html = "";
    let delta = this.ydoc.getText().toDelta();
    for (let i = 0; i < delta.length; i++) {
      if (delta[i].attributes && delta[i].attributes.bold)
        html += "<strong>" + delta[i].insert + "</strong>";
      else if (delta[i].attributes && delta[i].attributes.italic)
        html += "<em>" + delta[i].insert + "</em>";
      else if (delta[i].attributes && delta[i].attributes.underline)
        html += "<u>" + delta[i].insert + "</u>";
      else
        html += (delta[i].insert === '\n') ? "<br />" : delta[i].insert;
    }
    return "<p>" + html + "</p>";*/
    /*let html = "";
    let delta = this.ydoc.getText().toDelta();
    for (let i = 0; i < delta.length; i++) {
      let text = delta[i].insert;
      if (delta[i].attributes && delta[i].attributes.underline)
        text = "<u>" + text + "</u>";
      if (delta[i].attributes && delta[i].attributes.italic)
        text = "<em>" + text + "</em>";
      if (delta[i].attributes && delta[i].attributes.bold)
        text = "<strong>" + text + "</strong>";
      if (delta[i].attributes && delta[i].attributes.link)
        text = "<a href=\"" + delta[i].attributes.link + "\">" + text + "</a>";
      html += (delta[i].insert === '\n') ? "<br />" : text;
    }
    return "<p>" + html + "</p>";*/

    return new QuillDeltaToHtmlConverter(this.ydoc.getText().toDelta(), {}).convert();
  }
};
