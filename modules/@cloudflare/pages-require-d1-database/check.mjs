export default async ({ deployment, config }) => {
  if (!(config.binding in deployment.d1_databases)) {
    throw new Error(`Missing D1 database bound to '${config.binding}'`);
  }
};
