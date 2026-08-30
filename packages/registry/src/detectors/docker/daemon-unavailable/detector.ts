import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "docker/daemon-unavailable",
  ecosystem: "docker",
  title: "Docker daemon unavailable",
  explanation:
    "The Docker client could not connect to the configured Docker Engine endpoint, so it could not send the requested operation to a daemon.",
  match: {
    threshold: 70,
    evidence: [
      {
        id: "daemon-connection-failure",
        description:
          "The Docker client reports a daemon or engine connection failure.",
        weight: 70,
        required: true,
        pattern: {
          kind: "regex",
          source:
            "Cannot connect to the Docker daemon(?: at [^\\s]+)?(?:\\.|\\s|$)|error during connect:.*docker_engine",
          flags: "i",
          scope: "line",
        },
      },
      {
        id: "daemon-unavailable-detail",
        description:
          "The message asks whether the daemon is running or reports a missing engine endpoint.",
        weight: 30,
        required: false,
        pattern: {
          kind: "regex",
          source:
            "Is the docker daemon running\\?|The system cannot find the file specified",
          flags: "i",
          scope: "line",
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "pull access denied",
        caseSensitive: false,
      },
    ],
  },
  likelyCauses: [
    "Docker Engine or Docker Desktop is not running.",
    "The selected Docker context points to an unavailable local or remote endpoint.",
    "DOCKER_HOST or the platform socket configuration points to the wrong engine.",
    "The current user cannot access the configured Docker socket.",
  ],
  diagnosticSteps: [
    {
      description: "Show the Docker context currently selected by the client.",
      command: "docker context show",
    },
    {
      description: "Ask the configured engine for diagnostic information.",
      command: "docker info",
    },
  ],
  remediation: [
    {
      description:
        "Start Docker Engine or Docker Desktop, then retry the operation.",
      safety: "review",
    },
    {
      description:
        "Select the intended Docker context or correct DOCKER_HOST after reviewing which engine should receive commands.",
      safety: "review",
    },
    {
      description:
        "Correct socket permissions using the platform's documented Docker setup; do not make the socket world-writable.",
      safety: "review",
    },
  ],
  documentation: [
    {
      title: "Troubleshoot the Docker daemon",
      url: "https://docs.docker.com/engine/daemon/troubleshoot/",
    },
  ],
});
