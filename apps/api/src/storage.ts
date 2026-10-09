import { readFile } from "fs/promises";
import path from "path";
import multer from "multer";
import { uploadDir } from "./config";
import { HttpError } from "./http";

export const fileType = (buffer: Buffer) => {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return "image/jpeg";
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  return null;
};
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
export const uploadPath = (key: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
  )
    throw new HttpError(422, "MISSING_DOCUMENT", "Upload a valid salary slip.");
  return path.join(uploadDir, key);
};
export const storedFile = async (key: string) => {
  try {
    return await readFile(uploadPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new HttpError(
        422,
        "MISSING_DOCUMENT",
        "Upload a salary slip again.",
      );
    throw error;
  }
};
