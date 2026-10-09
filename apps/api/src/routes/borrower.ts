import express from "express";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { loanSchema } from "@creditsea/shared";
import { Draft, Loan } from "../models";
import { uploadDir } from "../config";
import { evaluateDetails, reevaluate, terms } from "../domain";
import { HttpError, actor, auth, id, ok, requireRole, run } from "../http";
import { fileType, storedFile, upload, uploadPath } from "../storage";

const router = express.Router();
router.get(
  "/applications/me/draft",
  auth,
  requireRole("BORROWER"),
  run(async (req, res) =>
    ok(res, await Draft.findOne({ borrowerId: actor(req).id })),
  ),
);
router.put(
  "/applications/me/personal-details",
  auth,
  requireRole("BORROWER"),
  run(async (req, res) => {
    const { details, result } = evaluateDetails(req.body);
    const draft = await Draft.findOneAndUpdate(
      { borrowerId: actor(req).id },
      {
        $set: {
          personalDetails: details,
          eligibility: { ...result, checkedAt: new Date() },
          currentStep: result.eligible ? 3 : 2,
        },
      },
      { upsert: true, new: true },
    );
    ok(res, { draft, eligibility: result });
  }),
);
router.post(
  "/applications/me/eligibility-check",
  auth,
  requireRole("BORROWER"),
  run(async (req, res) => {
    const draft = await Draft.findOne({ borrowerId: actor(req).id });
    if (!draft?.personalDetails)
      throw new HttpError(
        422,
        "MISSING_DETAILS",
        "Save personal details first.",
      );
    const result = reevaluate(draft.personalDetails);
    draft.set("eligibility", { ...result, checkedAt: new Date() });
    await draft.save();
    ok(res, result);
  }),
);
router.post(
  "/applications/me/salary-slip",
  auth,
  requireRole("BORROWER"),
  upload.single("file"),
  run(async (req, res) => {
    const borrowerId = actor(req).id;
    const draft = await Draft.findOne({ borrowerId });
    if (!draft?.personalDetails || !reevaluate(draft.personalDetails).eligible)
      throw new HttpError(422, "INELIGIBLE", "Complete eligibility first.");
    if (!req.file) throw new HttpError(400, "MISSING_FILE", "Choose a file.");
    const mime = fileType(req.file.buffer);
    if (!mime)
      throw new HttpError(
        422,
        "INVALID_FILE",
        "Upload a PDF, JPEG, or PNG file.",
      );
    await mkdir(uploadDir, { recursive: true });
    const oldKey = draft.salarySlip?.storageKey;
    const key = randomUUID();
    await writeFile(uploadPath(key), req.file.buffer, {
      flag: "wx",
    });
    draft.salarySlip = {
      originalFilename: path.basename(req.file.originalname).slice(0, 150),
      storageKey: key,
      mimeType: mime,
      sizeBytes: req.file.size,
      uploadedAt: new Date(),
    };
    draft.currentStep = 4;
    try {
      await draft.save();
    } catch (error) {
      await unlink(uploadPath(key)).catch(() => {});
      throw error;
    }
    if (oldKey && !(await Loan.exists({ "salarySlip.storageKey": oldKey })))
      await unlink(uploadPath(oldKey)).catch(() => {});
    ok(
      res,
      {
        originalFilename: draft.salarySlip.originalFilename,
        mimeType: mime,
        sizeBytes: req.file.size,
      },
      201,
    );
  }),
);
router.get(
  "/applications/me/salary-slip",
  auth,
  requireRole("BORROWER"),
  run(async (req, res) => {
    const draft = await Draft.findOne({ borrowerId: actor(req).id });
    if (!draft?.salarySlip?.storageKey)
      throw new HttpError(404, "NOT_FOUND", "Document not found.");
    res
      .set("Cache-Control", "no-store")
      .type(draft.salarySlip.mimeType || "application/octet-stream")
      .send(await storedFile(draft.salarySlip.storageKey));
  }),
);
router.post(
  "/applications/me/submit",
  auth,
  requireRole("BORROWER"),
  run(async (req, res) => {
    const input = loanSchema.parse(req.body);
    const borrowerId = actor(req).id;
    const draft = await Draft.findOne({ borrowerId });
    if (!draft?.personalDetails)
      throw new HttpError(422, "MISSING_DETAILS", "Complete personal details.");
    const bre = reevaluate(draft.personalDetails);
    if (!bre.eligible)
      throw new HttpError(
        422,
        "INELIGIBLE",
        "Eligibility failed.",
        bre.reasons,
      );
    if (!draft.salarySlip?.storageKey)
      throw new HttpError(422, "MISSING_DOCUMENT", "Upload a salary slip.");
    const slip = await storedFile(draft.salarySlip.storageKey);
    if (
      slip.length !== draft.salarySlip.sizeBytes ||
      fileType(slip) !== draft.salarySlip.mimeType
    )
      throw new HttpError(
        422,
        "MISSING_DOCUMENT",
        "Upload a valid salary slip again.",
      );
    const financials = terms(input.principalRupees, input.tenureDays);
    try {
      const loan = await Loan.create({
        borrowerId,
        applicationSnapshot: { ...draft.personalDetails },
        salarySlip: { ...draft.salarySlip },
        ...financials,
        paidAmountPaise: 0,
        status: "APPLIED",
        appliedAt: new Date(),
        payments: [],
      });
      ok(res, loan, 201);
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new HttpError(
          409,
          "ACTIVE_LOAN_EXISTS",
          "You already have an active loan.",
        );
      throw error;
    }
  }),
);
router.get(
  "/loans/me",
  auth,
  requireRole("BORROWER"),
  run(async (req, res) =>
    ok(
      res,
      await Loan.find({ borrowerId: actor(req).id }).sort({ createdAt: -1 }),
    ),
  ),
);
router.get(
  "/loans/me/:loanId",
  auth,
  requireRole("BORROWER"),
  run(async (req, res) => {
    const loan = await Loan.findOne({
      _id: id(req.params.loanId),
      borrowerId: actor(req).id,
    });
    if (!loan) throw new HttpError(404, "NOT_FOUND", "Loan not found.");
    ok(res, loan);
  }),
);

export default router;
