const { updateDocuments } = require('../update-documents');

async function routes(app, options) {

    app.get('/index/search', async (request, reply) => {
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        const searchQuery = request.query.q;
        try {
            await updateDocuments();
            console.log('searching...');
            const result = await app.elastic.search({
                index: 'documents',
                _source: 'name',
                query: {
                    multi_match: {
                        query: searchQuery,
                        fields: ['name', 'text']
                    }
                },
                highlight: {
                    fields: { name: {}, text: {} },
                    fragment_size: 500
                }
            });
            //console.log(result.hits.hits);
            const list = await Promise.all(result.hits.hits.map(async (hit) => {
                return {
                    docid: hit._id,
                    name: hit._source.name,
                    snippet: hit.highlight.text ? hit.highlight.text[0] : hit.highlight.name[0]
                };
            }));
            return list;
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    app.get('/index/suggest', async (request, reply) => {
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        const searchQuery = request.query.q;
        if (searchQuery.length < 4) {
            return { error: true, message: 'Search query must be at least 4 characters' };
        }
        try {
            await updateDocuments();
            console.log('suggesting...');
            const result = await app.elastic.search({
                index: 'documents',
                _source: false,
                suggest: {
                    autocomplete: {
                        prefix: searchQuery,
                        completion: {
                            field: 'suggest',
                            skip_duplicates: true
                        }
                    }
                }
            });
            const list = [];
            //console.log(result.suggest.autocomplete);
            //result.suggest.autocomplete.map((suggestion) => //console.log(suggestion.options));
            await Promise.all(result.suggest.autocomplete
                .map(async (suggestion) => {
                    suggestion.options.forEach(async (option) => {
                        if(option.text.length > searchQuery.length)
                            list.push(option.text)
                    });
                }));
            return list;
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });
}

module.exports = routes;