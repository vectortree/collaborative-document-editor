const { QuillBinding } = require('y-quill');
const Quill = require('quill');
const QuillCursors = require('quill-cursors');
const Y = require('yjs');
// const Base64 = require('js-base64');
const uniqolor = require('uniqolor');
const QuillDeltaToHtmlConverter = require('quill-delta-to-html');

window.addEventListener('load', () => {
    function updateText(id, data) {
        //console.log(data);
        let request = new XMLHttpRequest();
        request.open("POST", `/api/op/${id}`);
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify(data));
        request.onload = () => {
            if(request.status == 401) {
                location.reload();
            }
        }
    }
    function updateCursor(id, data) {
        //console.log(data);
        let request = new XMLHttpRequest();
        request.open("POST", `/api/presence/${id}`);
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify(data));
        request.onload = () => {
            if(request.status == 401) {
                location.reload();
            }
        }
    }
    function uploadImageHandler() {
        var range = quill.getSelection();
        var value = prompt('Embed Image URL.');
        if (value) {
            quill.insertEmbed(range.index, 'image', value, Quill.sources.USER);
        }
    }
    function consoleHTMLContent() {
        //console.log(quill.root.innerHTML);
        //console.log(ydoc.getText().toDelta());
    }
    function toHTML() {
        return new QuillDeltaToHtmlConverter(ydoc.getText().toDelta(), {}).convert();
        //return "<p>" + toHTMLTextOnly() + "</p>";
    }
    function toHTMLTextOnly() {
        let html = "";
        let delta = ydoc.getText().toDelta();
        for (let i = 0; i < delta.length; i++) {
            let text = delta[i].insert;
            if (delta[i].attributes && delta[i].attributes.bold)
            text = "<strong>" + text + "</strong>";
            if (delta[i].attributes && delta[i].attributes.italic)
            text = "<em>" + text + "</em>";
            if (delta[i].attributes && delta[i].attributes.underline)
            html = "<u>" + text + "</u>";
            html += (delta[i].insert === '\n') ? "<br />" : text;
        }
        return html;
    }
    let id = location.pathname.split('/')[2];
    //console.log(id);
    const request = new XMLHttpRequest();
    request.open("GET", `/getname/${id}`);
    request.send();
    request.onload = () => {
        if(request.status == 200) {
            let name = JSON.parse(request.response);
            //console.log(name);
            document.getElementById("document-id").appendChild(document.createTextNode(id));
            document.getElementById("document-name").appendChild(document.createTextNode(name));
        }
    }
    const editor = document.getElementById('editor');
    editor.setAttribute('style', 'height: 400px');
    const ydoc = new Y.Doc();
    //const isLocal = false;
    ydoc.on('updateV2', (update) => {
        updateText(id, Array.from(update));
    });
    let toolbarOptions = [
        ['bold', 'italic', 'underline'],
        ['link'],
        ['image']
    ];
    Quill.register('modules/cursors', QuillCursors);
    const quill = new Quill(editor, {
        modules: {
            cursors: true,
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: uploadImageHandler
                }
            }
        },
        theme: 'snow'
    });

    // var mod = editor.addModule('multi-cursor', {
    //     timeout: 10000
    // });
      
    // mod.setCursor('id-1234', 10, 'Frodo', 'rgb(255, 0, 255)');

    const cursors = quill.getModule('cursors');
    const binding = new QuillBinding(ydoc.getText(), quill);
    quill.on('selection-change', function(range, oldRange, source) {
        if(source === 'user') {
            //console.log('Cursor changed');
            let cursor = range ? {
                index: range.index,
                length: range.length
            } : {};
            updateCursor(id, cursor);
        }
    });
    quill.on('text-change', function(delta, source) {
        //console.log("Text changed");
        /*if(source === 'user') {
            isLocal = true;
        }*/
        consoleHTMLContent();
        //console.log(ydoc.getText().toDelta());
        ////console.log(toHTML());
        //updateText(id, Array.from(Y.encodeStateAsUpdateV2(ydoc)));
    });
    // Create an EventSource object to open a connection to the server
    const eventSource = new EventSource(`/api/connect/${id}`);
    eventSource.onerror = function(event) {
        //console.log("Event source error\nClosing connection");
        // Close connection
        eventSource.close();
        location.reload();
    };
    eventSource.addEventListener("sync", (event) => {
        // Replace the document contents in the UI
        //console.log("Sync event");
        //console.log(event.data);
        //isLocal = false;
        let data = Uint8Array.from(JSON.parse(event.data));
        //console.log(data);
        ydoc.getText().delete(0, ydoc.getText().length);
        Y.applyUpdateV2(ydoc, data);
        //console.log(Y.encodeStateAsUpdateV2(ydoc));
        //quill.root.innerHTML = toHTML();
    });
    eventSource.addEventListener("update", (event) => {
        // Apply CRDT changes sent by the server
        //console.log("Update event");
        //console.log(event.data);
        //isLocal = false;
        let data = Uint8Array.from(JSON.parse(event.data));
        //console.log(data);
        Y.applyUpdateV2(ydoc, data);
        //console.log(Y.encodeStateAsUpdateV2(ydoc));
        //quill.root.innerHTML = toHTML();
    });
    eventSource.addEventListener("presence", (event) => {
        // Apply cursor changes sent by the server
        //console.log("Presence event");
        //console.log(event.data);
        let data = JSON.parse(event.data);
        //console.log(data);
        //console.log("Update cursor");
        cursors.createCursor(data.session_id, data.name, uniqolor.random().color);
        cursors.moveCursor(data.session_id, data.cursor);
        cursors.toggleFlag(data.session_id, true);
        //quill.root.innerHTML = toHTML();
    });
});