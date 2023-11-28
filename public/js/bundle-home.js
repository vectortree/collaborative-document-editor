(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
window.addEventListener('load', () => {
    const request = new XMLHttpRequest();
    request.open("GET", '/collection/list');
    request.send();
    request.onload = () => {
        if(request.status == 200) {
            let data = JSON.parse(request.response);
            //console.log(data);
            let documentLinks = document.getElementById('document-links');
            documentLinks.replaceChildren();
            if(!data.length) {
                documentLinks.appendChild(document.createTextNode('No documents found :('));
                documentLinks.appendChild(document.createElement("br"));
            }
            data.forEach((doc, index) => {
                let div = document.createElement('div');
                div.append(document.createTextNode((index + 1) + ". Document " + doc.id + ` (Name: ${doc.name}) `));
                let editLink = document.createElement('a');
                editLink.setAttribute('href', `/edit/${doc.id}`);
                editLink.innerHTML = "Edit";
                let deleteForm = document.createElement('form');
                deleteForm.setAttribute('action', '/collection/delete');
                deleteForm.setAttribute('method', 'post');
                deleteForm.setAttribute('style', 'display: inline');
                let input = document.createElement('input');
                input.setAttribute('type', 'hidden');
                input.setAttribute('value', doc.id);
                input.setAttribute('name', 'id');
                let submit = document.createElement('input');
                submit.setAttribute('type', 'submit');
                submit.setAttribute('value', 'Delete');
                deleteForm.appendChild(input);
                deleteForm.appendChild(submit);
                div.appendChild(editLink);
                div.appendChild(document.createTextNode(' '));
                div.appendChild(deleteForm);
                documentLinks.appendChild(div);
            });
            documentLinks.appendChild(document.createElement("br"));
        }
    }
});
},{}]},{},[1]);
