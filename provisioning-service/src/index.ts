export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    let result: URLPatternURLPatternResult | undefined;

    if (url.pathname.startsWith("/upload/")) {
      const pattern = new URLPattern({
        pathname:
          "/upload/accounts/:accountId/projects/:projectId/deployments/:deploymentId",
      });

      result = pattern.exec({ pathname: url.pathname });
    } else if (url.pathname.startsWith("/api/")) {
      const pattern = new URLPattern({
        pathname:
          "/api/accounts/:accountId/projects/:projectId/deployments/:deploymentId",
      });

      result = pattern.exec({ pathname: url.pathname });
    } else if (url.pathname.startsWith("/provisioner/")) {
      const pattern = new URLPattern({
        pathname:
          "/provisioner/accounts/:accountId/projects/:projectId/deployments/:deploymentId/files/*",
      });

      result = pattern.exec({
        pathname: url.pathname.endsWith("/")
          ? url.pathname
          : `${url.pathname}/`,
      });
    }

    if (result) {
      const { accountId, projectId, deploymentId } = result.pathname.groups;

      const id = env.DO.idFromName(`${accountId}/${projectId}/${deploymentId}`);
      const stub = env.DO.get(id);

      return stub.fetch(request);
    }

    url.host = "localhost:3000";
    return fetch(new Request(url.toString(), request));
  },
} as ExportedHandler<Environment>;

export { DO } from "./do";
