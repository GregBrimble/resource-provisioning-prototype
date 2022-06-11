export default async ({ deployment, config }) => {
  if (!(config.binding in deployment.kv_namespaces)) {
    throw new Error(`Missing KV namespace bound to '${config.binding}'`);
  }
};
