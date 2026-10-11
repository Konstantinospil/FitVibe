import sharp from "sharp";
import { scanBuffer } from "../../../../apps/backend/src/services/antivirus.service.js";
import { prepareRegistrationAvatar } from "../../../../apps/backend/src/modules/auth/auth.registration-avatar.service.js";

jest.mock("sharp");
jest.mock("../../../../apps/backend/src/services/antivirus.service.js");

it("classifies an image decode failure after valid metadata as 422", async () => {
  jest.mocked(scanBuffer).mockResolvedValue({ isInfected: false, viruses: [] });
  const instance = {
    metadata: jest.fn().mockResolvedValue({ format: "png" }),
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockRejectedValue(new Error("invalid image data")),
  };
  jest.mocked(sharp).mockReturnValue(instance as never);
  await expect(prepareRegistrationAvatar({
    buffer: Buffer.from("damaged picture"),
    mimetype: "image/png",
    originalname: "avatar.png",
    size: 15,
  })).rejects.toMatchObject({ status: 422, code: "UPLOAD_UNSUPPORTED_TYPE" });
});
