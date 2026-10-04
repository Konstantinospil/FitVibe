interface EnvMockShape {
  PORT: number;
  isProduction: boolean;
}

const listenMock = jest.fn();
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const initializeSecretsManagerMock = jest.fn();
const getJWTKeysMock = jest.fn();
const getDatabaseURLMock = jest.fn();
const antivirusHealthMock = jest.fn();
const initializeApplicationSettingsRuntimeMock = jest.fn();

const envMock: EnvMockShape = {
  PORT: 5050,
  isProduction: false,
};

jest.mock("../../apps/backend/src/app.js", () => ({
  __esModule: true,
  default: { listen: listenMock },
}));

jest.mock("../../apps/backend/src/config/logger.js", () => ({
  logger: loggerMock,
}));

jest.mock("../../apps/backend/src/config/env.js", () => ({
  env: envMock,
}));

jest.mock("../../apps/backend/src/services/secrets.service.js", () => ({
  initializeSecretsManager: initializeSecretsManagerMock,
  getJWTKeys: getJWTKeysMock,
  getDatabaseURL: getDatabaseURLMock,
}));

jest.mock("../../apps/backend/src/services/antivirus.service.js", () => ({
  checkHealth: antivirusHealthMock,
}));

jest.mock("../../apps/backend/src/modules/system/app-settings.runtime.js", () => ({
  initializeApplicationSettingsRuntime: initializeApplicationSettingsRuntimeMock,
}));

describe("server bootstrap", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.VAULT_ENABLED = "false";
    delete process.env.VAULT_TOKEN;
    envMock.PORT = 5050;
    envMock.isProduction = false;
    getJWTKeysMock.mockResolvedValue(null);
    getDatabaseURLMock.mockResolvedValue(null);
    antivirusHealthMock.mockResolvedValue(true);
    initializeApplicationSettingsRuntimeMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const loadServer = () => import("../../apps/backend/src/server.js");

  it("starts the HTTP server when Vault is disabled", async () => {
    const { startServer } = await loadServer();
    await startServer();

    expect(initializeSecretsManagerMock).not.toHaveBeenCalled();
    expect(initializeApplicationSettingsRuntimeMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledWith(5050, expect.any(Function));
    expect(loggerMock.info).toHaveBeenCalledWith(
      "[server] Secrets manager disabled - using environment/files",
    );
  });

  it("fails startup when Vault is enabled without a token", async () => {
    process.env.VAULT_ENABLED = "true";
    delete process.env.VAULT_TOKEN;

    const { startServer } = await loadServer();

    await expect(startServer()).rejects.toThrow("VAULT_ENABLED=true but VAULT_TOKEN is not set");
    expect(listenMock).not.toHaveBeenCalled();
  });

  it("loads Vault secrets before importing the runtime application", async () => {
    process.env.VAULT_ENABLED = "true";
    process.env.VAULT_TOKEN = "vault-token";
    process.env.VAULT_ADDR = "https://secure-vault";
    process.env.VAULT_NAMESPACE = "devops";
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.DATABASE_URL;

    getJWTKeysMock.mockResolvedValue({
      privateKey: "vault-private",
      publicKey: "vault-public",
    });
    getDatabaseURLMock.mockResolvedValue("postgresql://vault/database");

    const { startServer } = await loadServer();
    await startServer();

    expect(initializeSecretsManagerMock).toHaveBeenCalledWith({
      provider: "vault",
      vault: {
        enabled: true,
        addr: "https://secure-vault",
        token: "vault-token",
        namespace: "devops",
      },
    });
    expect(getJWTKeysMock).toHaveBeenCalled();
    expect(getDatabaseURLMock).toHaveBeenCalled();
    expect(process.env.JWT_PRIVATE_KEY).toBe("vault-private");
    expect(process.env.JWT_PUBLIC_KEY).toBe("vault-public");
    expect(process.env.DATABASE_URL).toBe("postgresql://vault/database");
    expect(listenMock).toHaveBeenCalledWith(5050, expect.any(Function));
  });

  it("refuses production startup when ClamAV is unavailable", async () => {
    envMock.isProduction = true;
    antivirusHealthMock.mockResolvedValue(false);

    const { startServer } = await loadServer();

    await expect(startServer()).rejects.toThrow(
      "ClamAV health check failed during production startup",
    );
    expect(listenMock).not.toHaveBeenCalled();
  });
});
