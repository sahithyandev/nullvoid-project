import app from "./src/app";

const server = Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: app.fetch });
console.log(`Listening on ${server.url}`);
