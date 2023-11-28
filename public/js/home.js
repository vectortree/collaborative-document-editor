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