export const onRequest = ({ env }) =>
  new Response(JSON.stringify(env), {
    headers: { "Content-Type": "application/json" },
  });
