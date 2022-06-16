import * as z from "zod";
import requireD1Database from "../../modules/@cloudflare/pages-require-d1-database/provisioner.mjs";
import requireDurableObjectNamespace from "../../modules/@cloudflare/pages-require-durable-object-namespace/provisioner.mjs";
import requireEnvironmentVariable from "../../modules/@cloudflare/pages-require-environment-variable/provisioner.mjs";
import requireKVNamespace from "../../modules/@cloudflare/pages-require-kv-namespace/provisioner.mjs";

const uploadSchema = z.object({
  requirementFiles: z.record(
    z.object({
      description: z.string().optional(),
      requirements: z
        .object({
          name: z.string(),
          description: z.string().optional(),
          provisioner: z.string(),
          config: z.unknown(),
          error: z.object({ message: z.string() }).optional(),
          hash: z.string(),
        })
        .array(),
    })
  ),
});

export class DO implements DurableObject {
  state: DurableObjectState;
  env: Environment;

  constructor(state: DurableObjectState, env: Environment) {
    this.state = state;
    this.env = env;
  }

  async upload(request: Request) {
    try {
      const url = new URL(request.url);

      const pattern = new URLPattern({
        pathname:
          "/upload/accounts/:accountId/projects/:projectId/deployments/:deploymentId",
      });

      const result = pattern.exec({ pathname: url.pathname });

      if (!result) {
        return new Response(null, { status: 404 });
      }

      const { accountId, projectId, deploymentId } = result.pathname.groups;

      console.log("foo");
      const data = await request.json();
      console.log(data);
      const { requirementFiles } = uploadSchema.parse(data);
      console.log("foo2");

      this.state.storage.put("meta", { accountId, projectId, deploymentId });
      this.state.storage.put("requirementFiles", requirementFiles);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error(e);
    }
  }

  async api(request: Request) {
    const meta = await this.state.storage.get<{
      accountId: string;
      projectId: string;
      deploymentId: string;
    }>("meta");
    const requirementFiles = await this.state.storage.get("requirementFiles");

    if (!meta || !requirementFiles) {
      return new Response(null, { status: 404 });
    }

    const { accountId, projectId, deploymentId } = meta;

    return new Response(
      JSON.stringify({ accountId, projectId, deploymentId, requirementFiles }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  async provisioner(request: Request) {
    const url = new URL(request.url);

    const pattern = new URLPattern({
      pathname:
        "/provisioner/accounts/:accountId/projects/:projectId/deployments/:deploymentId/files/*/requirements/:requirementNumber/*",
    });

    const result = pattern.exec({
      pathname: url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`,
    });
    const {
      0: filename,
      1: pathname,
      requirementNumber,
    } = result.pathname.groups;

    const requirementFiles = await this.state.storage.get<
      z.infer<typeof uploadSchema>["requirementFiles"]
    >("requirementFiles");

    const requirement =
      requirementFiles[filename]?.requirements[requirementNumber];

    if (!requirement) {
      return new Response(null, { status: 404 });
    }

    // TODO: Call this Worker on Workers for Platforms
    const { name } = requirement;
    url.pathname = pathname;

    console.log(url.toString());
    request = new Request(url.toString(), request);

    let provisioner: ExportedHandler = {
      fetch: () => new Response("Unknown provisioner!"),
    };

    switch (name) {
      case "@cloudflare/pages-require-d1-database": {
        provisioner = requireD1Database;
        break;
      }
      case "@cloudflare/pages-require-durable-object-namespace": {
        provisioner = requireDurableObjectNamespace;
        break;
      }
      case "@cloudflare/pages-require-environment-variable": {
        provisioner = requireEnvironmentVariable;
        break;
      }
      case "@cloudflare/pages-require-kv-namespace": {
        provisioner = requireKVNamespace;
        break;
      }
    }

    return provisioner.fetch(request, {}, {
      waitUntil: this.state.waitUntil, // TODO: Definitely not correct
    } as any);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/upload/")) {
      console.log("upload");
      return this.upload(request);
    } else if (url.pathname.startsWith("/api/")) {
      return this.api(request);
    } else if (url.pathname.startsWith("/provisioner")) {
      return this.provisioner(request);
    }

    return new Response(null, { status: 404 });
  }
}
