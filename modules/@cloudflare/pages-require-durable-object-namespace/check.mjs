export default async ({ deployment, config }) => {
  if (!(config.binding in deployment.durable_object_namespaces)) {
    throw new Error(
      `Missing Durable Object namespace bound to '${config.binding}'`
    );
  }
};
