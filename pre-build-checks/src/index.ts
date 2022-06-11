import { join } from "node:path";
import { readFile } from "node:fs/promises";
import glob from "glob-promise";
import { load } from "js-yaml";
import * as z from "zod";
import { createHash } from "crypto";

const WORKDIR = process.env.CF_PAGES
  ? "/opt/buildhome/repo"
  : join(process.cwd(), "../");

const schema = z.object({
  require: z
    .object({
      use: z.string(),
      config: z.unknown(),
    })
    .array(),
});

type Requirement = z.infer<typeof schema>["require"][number] & {
  hash: string;
  error?: { message: string };
};

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

  const requirements: Requirement[] = [];

  for (const file of files) {
    const result = await readFile(file, "utf8");
    const doc = schema.parse(load(result, { filename: file }));

    for (const requirement of doc.require) {
      const packageJSONPath = require.resolve(
        `${requirement.use}/package.json`
      );
      const packageJSON = JSON.parse(await readFile(packageJSONPath, "utf8"));

      const { name, version } = packageJSON;

      const hash = createHash("md5")
        .update(name)
        .update(version)
        .update(JSON.stringify(requirement.config))
        .digest("hex");

      requirements.push({ ...requirement, hash });
    }
  }

  console.log(`Found ${requirements.length} requirements. Checking...`);

  for (let i = 0; i < requirements.length; i++) {
    const { use, config } = requirements[i];
    const { default: check } = await import(`${use}/check.mjs`);
    try {
      await check({ deployment, config });
      console.log(`✅ ${i + 1}/${requirements.length} passed`);
    } catch (error) {
      requirements[i].error = { message: error.message };
      console.error(`❌ Failed ${use} check: ${error.message}.`);
      break;
    }
  }

  if (requirements.every((requirement) => !requirement.error)) {
    console.log(
      "Completed every pre-build check successfully! Proceeding with the build..."
    );
  } else {
    console.error("Failed one of the pre-build checks. Aborting build...");
  }

  // TODO: POST `requirements` to funfetti so it can monitor change in hashes.
  // TODO: POST provisioners to provisioning service
};

main();
