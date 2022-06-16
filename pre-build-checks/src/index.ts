import { join, relative } from "node:path";
import { readFile } from "node:fs/promises";
import glob from "glob-promise";
import { load } from "js-yaml";
import * as z from "zod";
import { createHash } from "crypto";
import { fetch } from "cross-fetch";

const WORKDIR = process.env.CF_PAGES
  ? "/opt/buildhome/repo"
  : join(process.cwd(), "../");

const PROVISIONER_SERVICE = process.env.CF_PAGES
  ? "https://example.com/"
  : "http://localhost:8787/";

const schema = z.object({
  description: z.string().optional(),
  require: z
    .object({
      use: z.string(),
      description: z.string().optional(),
      config: z.unknown(),
    })
    .array(),
});

type Requirement = {
  name: string;
  description?: string;
  check: ({
    deployment,
  }: {
    deployment: unknown;
    config: unknown;
  }) => Promise<void>;
  provisioner: string;
  config: unknown;
  error?: { message: string };
  hash: string;
};

// TODO: Get `accountId` from funfetti
const accountId = "5a883b414d4090a1442b20361f3c43a9";

// TODO: Get `deployment` from funfetti
const deployment = {
  id: "c9352041-ce86-415f-bdaf-7ccf4ebc2455",
  short_id: "c9352041",
  project_id: "216ac461-66e5-4708-8c88-8bb15b7e48dc",
  project_name: "gregbrimble",
  environment: "preview",
  deployment_trigger: {
    type: "github:push",
    metadata: {
      branch: "snyk-fix-2c72510cca9313b02a2777581da82c31",
      commit_hash: "0fe307a43595b79f269042ebe09b8e4297873208",
      commit_message:
        "fix: package.json to reduce vulnerabilities\n\nThe following vulnerabilities are fixed with an upgrade:\n- https://snyk.io/vuln/SNYK-JS-MOMENT-2440688",
      commit_dirty: false,
    },
  },
  build_config: {
    build_command: "npm run build",
    destination_dir: "public",
    root_dir: "",
    web_analytics_tag: null,
    web_analytics_token: null,
    fast_builds: true,
  },
  source: {
    type: "github",
    config: {
      owner: "GregBrimble",
      repo_name: "gregbrimble.com",
      production_branch: "main",
      pr_comments_enabled: false,
    },
  },
  env_vars: {},
  kv_namespaces: {
    KV: {
      namespace_id: "e3db8476df4346e2b0e0c04daa1a87eb",
    },
  },
  is_skipped: false,
  production_branch: "main",
};

const main = async () => {
  const files = await glob(join(WORKDIR, "**/_require.yml"));

  const requirementFiles: Map<
    string,
    { description?: string; requirements: Requirement[] }
  > = new Map();

  let requirementsCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await readFile(file, "utf8");
    const doc = schema.parse(load(result, { filename: file }));

    const relativeFilePath = relative(WORKDIR, file);

    requirementFiles.set(relativeFilePath, {
      description: doc.description,
      requirements: [],
    });

    for (const requirement of doc.require) {
      const packageJSON = JSON.parse(
        await readFile(
          require.resolve(`${requirement.use}/package.json`),
          "utf8"
        )
      );

      const { name, version } = packageJSON;

      const hash = createHash("md5")
        .update(name)
        .update(version)
        .update(JSON.stringify(requirement.config))
        .digest("hex");

      requirementFiles.get(relativeFilePath).requirements.push({
        name,
        description: requirement.description,
        check: (await import(`${requirement.use}/check.mjs`)).default,
        provisioner: await readFile(
          require.resolve(`${requirement.use}/provisioner.mjs`),
          "utf8"
        ),
        config: requirement.config,
        hash,
      });
      requirementsCount++;
    }
  }

  console.log(
    `Found ${requirementsCount} requirements across ${requirementFiles.size} files. Checking...`
  );

  let passedChecks = 0;
  let failed = false;

  for (const { requirements } of requirementFiles.values()) {
    for (const requirement of requirements) {
      try {
        await requirement.check({ deployment, config: requirement.config });
        passedChecks++;
        console.log(`✅ ${passedChecks}/${requirementsCount} passed`);
      } catch (error) {
        failed = true;
        requirement.error = { message: error.message };
        console.error(`❌ Failed ${requirement.name} check: ${error.message}.`);
        break;
      }
    }

    if (failed) {
      break;
    }
  }

  try {
    const response = await fetch(
      new URL(
        `/upload/accounts/${accountId}/projects/${deployment.project_id}/deployments/${deployment.id}`,
        PROVISIONER_SERVICE
      ).toString(),
      {
        method: "POST",
        body: JSON.stringify({
          requirementFiles: Object.fromEntries(
            [...requirementFiles.entries()].map(
              ([filename, { description, requirements }]) => {
                return [
                  filename,
                  {
                    description,
                    requirements: requirements.map(
                      ({ check, ...requirement }) => requirement
                    ),
                  },
                ];
              }
            )
          ),
        }),
        headers: {
          "CF-Access-Client-Id": "TODO",
          "CF-Access-Client-Secret": "TODO",
        },
      }
    );
    if (!(await response.json()).success) {
      throw new Error("Failed to configure provisioning service");
    }
  } catch {
    console.error("Failed to configure provisioning service!");
  }

  if (
    [...requirementFiles.values()]
      .map(({ requirements }) => requirements)
      .flat()
      .every((requirement) => !requirement.error)
  ) {
    console.log(
      "Completed every pre-build check successfully! Proceeding with the build..."
    );
  } else {
    console.error("Failed one of the pre-build checks. Aborting build...");
    console.log(
      new URL(
        `/accounts/${accountId}/projects/${deployment.project_id}/deployments/${deployment.id}`,
        PROVISIONER_SERVICE
      ).toString()
    );
  }
};

main();
