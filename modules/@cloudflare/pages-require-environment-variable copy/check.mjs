export default async ({ deployment, config }) => {
  if (!(config.binding in deployment.env_vars)) {
    throw new Error(
      `Missing environment variable bound to '${config.binding}'`
    );
  }
};
