const fastify = require('fastify')({ logger: true });
fastify.get('/', async () => ({ ok: true, message: 'Hello from Railway!' }));
const port = process.env.PORT || 3001;
fastify.listen({ port, host: '0.0.0.0' }).then(() => console.log(`Running on ${port}`));
