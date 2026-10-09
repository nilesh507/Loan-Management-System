import express from "express";
import mongoose from "mongoose";
import { rejectionSchema, paymentSchema, paise } from "@creditsea/shared";
import { Draft, Loan, User } from "../models";
import { pageSchema } from "../domain";
import {
  HttpError,
  actor,
  auth,
  id,
  invalidState,
  ok,
  requireRole,
  run,
} from "../http";
import { storedFile } from "../storage";

const operations = express.Router();
operations.use(auth);
operations.get(
  "/sales/leads",
  requireRole("SALES", "ADMIN"),
  run(async (req, res) => {
    const q = pageSchema.parse(req.query);
    const applied = await Loan.distinct("borrowerId");
    const filter = {
      role: "BORROWER",
      _id: { $nin: applied },
      ...(q.search
        ? {
            $or: [
              {
                fullName: {
                  $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  $options: "i",
                },
              },
              {
                email: {
                  $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  $options: "i",
                },
              },
            ],
          }
        : {}),
    };
    const users = await User.find(filter)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean();
    const drafts = await Draft.find({
      borrowerId: { $in: users.map((u) => u._id) },
    })
      .select("-personalDetails.pan -personalDetails.dateOfBirth")
      .lean();
    ok(res, {
      items: users.map((u) => ({
        id: u._id,
        fullName: u.fullName,
        email: u.email,
        createdAt: u.createdAt,
        draft: drafts.find((d) => String(d.borrowerId) === String(u._id)),
      })),
      total: await User.countDocuments(filter),
      page: q.page,
    });
  }),
);
operations.get(
  "/sales/leads/:borrowerId",
  requireRole("SALES", "ADMIN"),
  run(async (req, res) => {
    const borrower = await User.findOne({
      _id: id(req.params.borrowerId),
      role: "BORROWER",
    });
    if (!borrower || (await Loan.exists({ borrowerId: borrower.id })))
      throw new HttpError(404, "NOT_FOUND", "Lead not found.");
    ok(res, {
      borrower,
      draft: await Draft.findOne({ borrowerId: borrower.id }).select(
        "-personalDetails.pan -personalDetails.dateOfBirth",
      ),
    });
  }),
);
for (const [module, role, status] of [
  ["sanction", "SANCTION", "APPLIED"],
  ["disbursement", "DISBURSEMENT", "SANCTIONED"],
  ["collection", "COLLECTION", "DISBURSED"],
] as const) {
  operations.get(
    `/${module}/loans`,
    requireRole(role, "ADMIN"),
    run(async (req, res) => {
      const q = pageSchema.parse(req.query);
      const filter = { status };
      const selection =
        module === "sanction"
          ? ""
          : "-applicationSnapshot.pan -applicationSnapshot.dateOfBirth -applicationSnapshot.monthlySalaryPaise -salarySlip";
      const items = await Loan.find(filter)
        .select(selection)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate("borrowerId", "fullName email");
      ok(res, {
        items,
        total: await Loan.countDocuments(filter),
        page: q.page,
      });
    }),
  );
  operations.get(
    `/${module}/loans/:loanId`,
    requireRole(role, "ADMIN"),
    run(async (req, res) => {
      const selection =
        module === "sanction"
          ? ""
          : "-applicationSnapshot.pan -applicationSnapshot.dateOfBirth -applicationSnapshot.monthlySalaryPaise -salarySlip";
      const allowedStatuses =
        module === "collection" ? ["DISBURSED", "CLOSED"] : [status];
      const loan = await Loan.findOne({
        _id: id(req.params.loanId),
        status: { $in: allowedStatuses },
      })
        .select(selection)
        .populate("borrowerId", "fullName email");
      if (!loan) throw new HttpError(404, "NOT_FOUND", "Loan not found.");
      ok(res, loan);
    }),
  );
}
operations.get(
  "/sanction/loans/:loanId/salary-slip",
  requireRole("SANCTION", "ADMIN"),
  run(async (req, res) => {
    const loan = await Loan.findOne({
      _id: id(req.params.loanId),
      status: "APPLIED",
    });
    if (!loan?.salarySlip?.storageKey)
      throw new HttpError(404, "NOT_FOUND", "Document not found.");
    res
      .set("Cache-Control", "no-store")
      .type(loan.salarySlip.mimeType || "application/octet-stream")
      .send(await storedFile(loan.salarySlip.storageKey));
  }),
);
operations.post(
  "/sanction/loans/:loanId/approve",
  requireRole("SANCTION", "ADMIN"),
  run(async (req, res) => {
    const loan = await Loan.findOneAndUpdate(
      { _id: id(req.params.loanId), status: "APPLIED" },
      {
        $set: {
          status: "SANCTIONED",
          sanctionedAt: new Date(),
          sanctionedBy: actor(req).id,
        },
      },
      { new: true },
    );
    if (!loan)
      await invalidState(
        req.params.loanId,
        "Only applied loans can be sanctioned.",
      );
    ok(res, loan);
  }),
);
operations.post(
  "/sanction/loans/:loanId/reject",
  requireRole("SANCTION", "ADMIN"),
  run(async (req, res) => {
    const { reason } = rejectionSchema.parse(req.body);
    const loan = await Loan.findOneAndUpdate(
      { _id: id(req.params.loanId), status: "APPLIED" },
      {
        $set: {
          status: "REJECTED",
          rejectionReason: reason,
          rejectedAt: new Date(),
          rejectedBy: actor(req).id,
        },
      },
      { new: true },
    );
    if (!loan)
      await invalidState(
        req.params.loanId,
        "Only applied loans can be rejected.",
      );
    ok(res, loan);
  }),
);
operations.post(
  "/disbursement/loans/:loanId/disburse",
  requireRole("DISBURSEMENT", "ADMIN"),
  run(async (req, res) => {
    const loan = await Loan.findOneAndUpdate(
      { _id: id(req.params.loanId), status: "SANCTIONED" },
      {
        $set: {
          status: "DISBURSED",
          disbursedAt: new Date(),
          disbursedBy: actor(req).id,
        },
      },
      { new: true },
    ).select(
      "-applicationSnapshot.pan -applicationSnapshot.dateOfBirth -applicationSnapshot.monthlySalaryPaise -salarySlip",
    );
    if (!loan)
      await invalidState(
        req.params.loanId,
        "Only sanctioned loans can be disbursed.",
      );
    ok(res, loan);
  }),
);
operations.get(
  "/collection/loans/:loanId/payments",
  requireRole("COLLECTION", "ADMIN"),
  run(async (req, res) => {
    const loan = await Loan.findById(id(req.params.loanId));
    if (!loan) throw new HttpError(404, "NOT_FOUND", "Loan not found.");
    ok(res, loan.payments);
  }),
);
operations.post(
  "/collection/loans/:loanId/payments",
  requireRole("COLLECTION", "ADMIN"),
  run(async (req, res) => {
    const input = paymentSchema.parse(req.body);
    const amount = paise(input.amountRupees);
    const when = new Date(input.paymentDate + "T00:00:00.000Z");
    if (Number.isNaN(when.getTime()))
      throw new HttpError(400, "INVALID_DATE", "Invalid payment date.");
    const loanId = id(req.params.loanId);
    const now = new Date();
    const payment = {
      _id: new mongoose.Types.ObjectId(),
      utr: input.utr,
      amountPaise: amount,
      paymentDate: when,
      recordedBy: new mongoose.Types.ObjectId(actor(req).id),
      createdAt: now,
    };
    try {
      const loan = await Loan.findOneAndUpdate(
        {
          _id: loanId,
          status: "DISBURSED",
          "payments.utr": { $ne: input.utr },
          $expr: {
            $lte: [
              { $add: ["$paidAmountPaise", amount] },
              "$totalRepaymentPaise",
            ],
          },
        },
        [
          {
            $set: {
              payments: { $concatArrays: ["$payments", [payment]] },
              paidAmountPaise: { $add: ["$paidAmountPaise", amount] },
              status: {
                $cond: [
                  {
                    $eq: [
                      { $add: ["$paidAmountPaise", amount] },
                      "$totalRepaymentPaise",
                    ],
                  },
                  "CLOSED",
                  "$status",
                ],
              },
              closedAt: {
                $cond: [
                  {
                    $eq: [
                      { $add: ["$paidAmountPaise", amount] },
                      "$totalRepaymentPaise",
                    ],
                  },
                  now,
                  "$closedAt",
                ],
              },
            },
          },
        ],
        { new: true },
      ).select(
        "-applicationSnapshot.pan -applicationSnapshot.dateOfBirth -applicationSnapshot.monthlySalaryPaise -salarySlip",
      );
      if (!loan) {
        const current = await Loan.findById(loanId);
        if (!current) throw new HttpError(404, "NOT_FOUND", "Loan not found.");
        if (current.status !== "DISBURSED")
          throw new HttpError(
            409,
            "INVALID_LOAN_STATE",
            "Payments require a disbursed loan.",
          );
        if (current.payments.some((p) => p.utr === input.utr))
          throw new HttpError(
            409,
            "DUPLICATE_UTR",
            "UTR has already been recorded.",
          );
        throw new HttpError(
          422,
          "OVERPAYMENT",
          "Payment exceeds outstanding balance.",
        );
      }
      ok(res, loan, 201);
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new HttpError(
          409,
          "DUPLICATE_UTR",
          "UTR has already been recorded.",
        );
      throw error;
    }
  }),
);

export default operations;
