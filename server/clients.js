let clients = [];

const getClients = () => clients;
const setClients = (newClients) => (clients = newClients);
const addClient = (reply, session_id, name, cursor) => {
    let client = {
        reply: reply,
        session_id: session_id,
        name: name,
        cursor: cursor
    };
    clients.push(client);
};
const setClientCursor = (i, index, length) => {
    clients[i].cursor.index = index;
    clients[i].cursor.length = length;
};

module.exports = {
    getClients,
    setClients,
    addClient,
    setClientCursor
};