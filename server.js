const fastify = require('fastify')({ logger: false });

fastify.get('/', async (req, reply) => {
  reply.type('text/html; charset=utf-8');
  return '<h1>你画我猜</h1><p>测试页面</p>';
});

fastify.get('/api/status', async () => ({ ok: true, current: null }));

const port = process.env.PORT || 3001;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`Running on ${port}`))
  .catch(err => { console.error('STARTUP ERROR:', err.message); process.exit(1); });
