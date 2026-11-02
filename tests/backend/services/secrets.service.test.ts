export {};

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

  it("reads a configured environment secret without an external provider", async () => {
    const { initializeSecretsManager, getSecret, writeSecret } = await loadSecretsService();
    process.env.JWT_PRIVATE_KEY = "environment-private-key";

    initializeSecretsManager({ provider: "env" });

    await expect(getSecret("secret/jwt", "private")).resolves.toBe("environment-private-key");
    await expect(writeSecret("secret/jwt", "replacement")).resolves.toBe(false);
    expect(createVaultClientMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported secrets provider instead of silently falling back", async () => {
    const { initializeSecretsManager } = await loadSecretsService();
    expect(() =>
      initializeSecretsManager({
        provider: "aws",
      } as unknown as Parameters<typeof initializeSecretsManager>[0]),
    ).toThrow("Unsupported secrets provider");
    expect(createVaultClientMock).not.toHaveBeenCalled();
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
