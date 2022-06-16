export default async ({ deployment, config, state }) => {
  if (!state.name) {
    throw new Error("Missing Workers Service");
  }

  state.put('pack') = `npx wrangler pack ${config.worker}`;

  const previousEtag = state.etag;
  const currentEtag = await fetch(
    `https://api.cloudflare.com/services/${state.name}`
  );

  if (previousEtag !== currentEtag) {
    return false;
  }

  return true;
};
