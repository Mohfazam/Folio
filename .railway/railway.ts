import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const source = github("Mohfazam/Folio", { branch: "main" });

  const backend = service("folio-backend", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/backend/Dockerfile",
    },
    healthcheck: "/health",
    healthcheckTimeout: 60,
  });

  const calling = service("folio-calling", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/calling/Dockerfile",
    },
    healthcheck: "/health",
    healthcheckTimeout: 60,
  });

  return project("thriving-connection", {
    variables: { managed: false },
    resources: [backend, calling],
  });
});
