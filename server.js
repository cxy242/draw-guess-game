const fastify = require('fastify')({ logger: false });
fastify.get('/', async (req, reply) => {
  reply.type('text/html; charset=utf-8');
  return '<h1>测试页面 - 如果看到这个说明部署成功</h1><p>时间: ' + new Date().toISOString() + '</p>';
});
const port = Number(process.env.PORT) || 3001;
fastify.listen({ port, host: '0.0.0.0' }).then(() => console.log('Running on ' + port));
