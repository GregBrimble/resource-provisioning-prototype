import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as z from "zod";

const schema = z.object({
  accountId: z.string(),
  projectId: z.string(),
  deploymentId: z.string(),
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

export const Container = () => {
  const { accountId, projectId, deploymentId } = useParams<
    "accountId" | "projectId" | "deploymentId"
  >();

  const [data, setData] = useState<z.infer<typeof schema>>();

  useEffect(() => {
    if (accountId && projectId && deploymentId) {
      fetch(
        `/api/accounts/${accountId}/projects/${projectId}/deployments/${deploymentId}`
      )
        .then((resp) => resp.json())
        .then((data) => setData(schema.parse(data)));
    }
  }, [accountId, projectId, deploymentId]);

  if (!data) {
    return null;
  }

  const { requirementFiles } = data;

  return (
    <div>
      <h1>Provisioning Service</h1>
      <ol>
        {Object.entries(requirementFiles).map(([filename, requirementFile]) => {
          return (
            <li key={filename}>
              <h2>{filename}</h2>
              <pre>{requirementFile.description}</pre>
              <ol>
                {requirementFile.requirements.map((requirement, i) => {
                  return (
                    <li key={i + requirement.hash}>
                      <h3>{requirement.name}</h3>
                      <pre>{requirement.description}</pre>
                      <div>{requirement.error?.message}</div>
                      <iframe
                        src={`/provisioner/accounts/${accountId}/projects/${projectId}/deployments/${deploymentId}/files/${filename}/requirements/${i}`}
                        title={i + requirement.hash}
                        style={{ width: "100%", height: "320px" }}
                      />
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
