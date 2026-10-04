export {};

const sendMock = jest.fn();
const secretsManagerClientMock = jest.fn(() => ({ send: sendMock }));
const getSecretValueCommandMock = jest.fn((input: { SecretId: string }) => ({ type: "get", input }));
const createSecretCommandMock = jest.fn((input: unknown) => ({ type: "create", input }));
const updateSecretCommandMock = jest.fn((input: unknown) => ({ type: "update", input }));
const describeSecretCommandMock = jest.fn((input: unknown) => ({ type: "describe", input }));
const vaultClientMock = {
  read: jest.fn(),
  write: jest.fn(),
  health: jest.fn(),
};
const loggerMock: Record<"info" | "warn" | "error", jest.Mock> = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const createVaultClientMock = jest.fn(() => vaultClientMock);

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: secretsManagerClientMock,
  GetSecretValueCommand: getSecretValueCommandMock,
  CreateSecretCommand: createSecretCommandMock,
  UpdateSecretCommand: updateSecretCommandMock,
  DescribeSecretCommand: describeSecretCommandMock,
}));

jest.mock("../../../apps/backend/src/config/logger.js", () => ({
  logger: loggerMock,
}));

jest.mock("../../../apps/backend/src/services/vault.client.js", () => ({
  createVaultClient: createVaultClientMock,
}));

async function loadSecretsService() {
  return import("../../../apps/backend/src/services/secrets.service.js");
}

describe("secrets.service", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    sendMock.mockReset();
    secretsManagerClientMock.mockClear();
    getSecretValueCommandMock.mockClear();
    createSecretCommandMock.mockClear();
    updateSecretCommandMock.mockClear();
    describeSecretCommandMock.mockClear();
    delete process.env.FITVIBE_SECRET_SECRET_JWT_PRIVATE;
    delete process.env.JWT_PRIVATE_KEY;
    createVaultClientMock.mockClear();
    vaultClientMock.read.mockReset();
    vaultClientMock.write.mockReset();
    vaultClientMock.health.mockReset();
  });

  it("logs an error when getSecret is called before initialization", async () => {
    const { getSecret } = await loadSecretsService();

    await expect(getSecret("secret-key")).resolves.toBeNull();
    expect(loggerMock.error).toHaveBeenCalledWith("[secrets] Secrets manager not initialized");
  });

  it("reads secrets from Vault KV data when configured", async () => {
    const { initializeSecretsManager, getSecret } = await loadSecretsService();
    vaultClientMock.read.mockResolvedValue({
      data: { data: { private: "super-secret" } },
    });

    initializeSecretsManager({
      provider: "vault",
      vault: {
        enabled: true,
        addr: "http://vault:8200",
        token: "vault-token",
      },
    });

    const value = await getSecret("secret/jwt", "private");

    expect(createVaultClientMock).toHaveBeenCalledWith({
      endpoint: "http://vault:8200",
      token: "vault-token",
      namespace: undefined,
    });
    expect(vaultClientMock.read).toHaveBeenCalledWith("secret/jwt");
    expect(value).toBe("super-secret");
  });

  it("falls back to AWS Secrets Manager when configured", async () => {
    const { initializeSecretsManager, getSecret } = await loadSecretsService();
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ url: "postgres://db" }),
    });

    initializeSecretsManager({
      provider: "aws",
      aws: {
        enabled: true,
        region: "us-west-2",
      },
    });

    const value = await getSecret("secret/database", "url");

    expect(secretsManagerClientMock).toHaveBeenCalledWith({ region: "us-west-2" });
    expect(getSecretValueCommandMock).toHaveBeenCalledWith({ SecretId: "secret/database" });
    expect(sendMock).toHaveBeenCalled();
    expect(value).toBe("postgres://db");
  });

  it("writes secrets to Vault and normalizes string payloads", async () => {
    const { initializeSecretsManager, writeSecret } = await loadSecretsService();
    vaultClientMock.write.mockResolvedValue(undefined);

    initializeSecretsManager({
      provider: "vault",
      vault: {
        enabled: true,
        addr: "http://vault:8200",
        token: "vault-token",
      },
    });

    const result = await writeSecret("secret/jwt", "private-key");

    expect(result).toBe(true);
    expect(vaultClientMock.write).toHaveBeenCalledWith("secret/jwt", { value: "private-key" });
    expect(loggerMock.info).toHaveBeenCalledWith(
      { key: "secret/jwt" },
      "[secrets] Secret written to Vault",
    );
  });

  it("round-trips an unfielded string through Vault", async () => {
    const { initializeSecretsManager, writeSecret, getSecret } = await loadSecretsService();
    vaultClientMock.write.mockImplementation(async (_key: string, data: unknown) => {
      vaultClientMock.read.mockResolvedValue({ data: { data } });
    });
    initializeSecretsManager({
      provider: "vault",
      vault: { enabled: true, addr: "http://vault:8200", token: "vault-token" },
    });

    await expect(writeSecret("secret/plain", "plain-value")).resolves.toBe(true);
    await expect(getSecret("secret/plain")).resolves.toBe("plain-value");
  });

  it("round-trips strings and structured fields through AWS", async () => {
    const store = new Map<string, string>();
    sendMock.mockImplementation(async (command: { type: string; input: Record<string, string> }) => {
      if (command.type === "get") return { SecretString: store.get(command.input.SecretId) };
      if (command.type === "describe") {
        if (!store.has(command.input.SecretId)) {
          const error = new Error("not found");
          error.name = "ResourceNotFoundException";
          throw error;
        }
        return {};
      }
      if (command.type === "create") {
        store.set(command.input.Name, command.input.SecretString);
        return {};
      }
      if (command.type === "update") {
        store.set(command.input.SecretId, command.input.SecretString);
        return {};
      }
      return {};
    });
    const { initializeSecretsManager, writeSecret, getSecret } = await loadSecretsService();
    initializeSecretsManager({ provider: "aws", aws: { enabled: true, region: "eu-central-1" } });

    await expect(writeSecret("secret/plain", "plain-value")).resolves.toBe(true);
    await expect(getSecret("secret/plain")).resolves.toBe("plain-value");
    await expect(writeSecret("secret/object", { private: "private-value" })).resolves.toBe(true);
    await expect(getSecret("secret/object", "private")).resolves.toBe("private-value");
    await expect(getSecret("secret/object")).resolves.toBe(JSON.stringify({ private: "private-value" }));
  });

  it("uses environment fallback after the configured provider cannot supply the secret", async () => {
    process.env.JWT_PRIVATE_KEY = "environment-private-key";
    vaultClientMock.read.mockRejectedValue(new Error("vault unavailable"));
    const { initializeSecretsManager, getSecret } = await loadSecretsService();
    initializeSecretsManager({
      provider: "vault",
      vault: { enabled: true, addr: "http://vault:8200", token: "vault-token" },
    });

    await expect(getSecret("secret/jwt", "private")).resolves.toBe("environment-private-key");
  });

  it("does not fall through from the configured Vault provider to AWS", async () => {
    vaultClientMock.read.mockResolvedValue(null);
    sendMock.mockResolvedValue({ SecretString: "aws-value" });
    const { initializeSecretsManager, getSecret } = await loadSecretsService();
    initializeSecretsManager({
      provider: "vault",
      vault: { enabled: true, addr: "http://vault:8200", token: "vault-token" },
      aws: { enabled: true, region: "eu-central-1" },
    });

    await expect(getSecret("secret/plain")).resolves.toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns null when JWT keys are missing", async () => {
    const service = await loadSecretsService();
    const getSecretSpy = jest
      .spyOn(service, "getSecret")
      .mockResolvedValueOnce("private")
      .mockResolvedValueOnce(null);

    await expect(service.getJWTKeys()).resolves.toBeNull();
    expect(loggerMock.warn).toHaveBeenCalledWith("[secrets] JWT keys not found in secrets manager");
    getSecretSpy.mockRestore();
  });

  it("reports Vault health status", async () => {
    const { initializeSecretsManager, checkSecretsHealth } = await loadSecretsService();
    vaultClientMock.health.mockResolvedValue(undefined);

    initializeSecretsManager({
      provider: "vault",
      vault: {
        enabled: true,
        addr: "http://vault:8200",
        token: "vault-token",
      },
    });

    await expect(checkSecretsHealth()).resolves.toBe(true);
    expect(vaultClientMock.health).toHaveBeenCalled();
  });
});
